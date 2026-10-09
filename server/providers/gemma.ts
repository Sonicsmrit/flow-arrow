import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { STEP_JSON_SCHEMA, parseStepText, type NextStepRequest } from "../schema.ts";
import { SYSTEM_PROMPT, buildUserText } from "../prompt.ts";
import {
  ProviderError,
  UnparsableOutput,
  withParseRetry,
  type Provider,
  type ProviderResult,
} from "./types.ts";

const TIMEOUT_MS = 15_000;

// Bake-off winner 2026-10-09 (6 cases, identical inputs): 6/6 accuracy at
// p50 ~3-5s with zero failures. thinking minimal also beat thinking-off on
// speed (~3.3s vs ~5.0s avg) at equal accuracy.
export const DEFAULT_GEMMA_MODEL = "gemma-4-26b-a4b-it";

// Returns null when GEMMA_API_KEY is not set, so the server refuses to boot
// with a clear message instead of failing every turn.
export function createGemmaProvider(model = process.env.GEMMA_MODEL || DEFAULT_GEMMA_MODEL): Provider | null {
  const apiKey = process.env.GEMMA_API_KEY;
  if (!apiKey) return null;
  const ai = new GoogleGenAI({ apiKey });

  async function callOnce(req: NextStepRequest, extraNote: string | undefined, signal: AbortSignal | undefined): Promise<ProviderResult> {
    const userText = buildUserText(req) + (extraNote ? `\nNOTE: ${extraNote}` : "");
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: "image/jpeg", data: req.screenshot } },
              { text: userText },
            ],
          },
        ],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseJsonSchema: STEP_JSON_SCHEMA,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          temperature: 0,
          maxOutputTokens: 1000,
          abortSignal: combined,
          // 1000 output tokens: thinking shares the budget, and an uncapped
          // default truncated mid-instruction in testing.
        },
      });

      const text = response.text;
      if (!text) throw new ProviderError("Gemma returned an empty response", { retryable: true });
      const usage = {
        inputTokens: response.usageMetadata?.promptTokenCount,
        outputTokens: (response.usageMetadata?.candidatesTokenCount ?? 0) + (response.usageMetadata?.thoughtsTokenCount ?? 0),
      };
      try {
        return { step: parseStepText(text), ...usage };
      } catch (err) {
        throw new UnparsableOutput(`${(err as Error).message}: ${text.slice(0, 200)}`);
      }
    } catch (err) {
      if (err instanceof ProviderError || err instanceof UnparsableOutput) throw err;
      if (signal?.aborted) throw new ProviderError("Gemma request aborted", { retryable: true });
      if (timeout.aborted) throw new ProviderError("Gemma request timed out after 15s", { retryable: true });

      // Classify by the HTTP status (ApiError.status). Matching digits in the
      // message text misfires: a 429 quota message contains other numbers.
      const message = err instanceof Error ? err.message : String(err);
      const status = err instanceof ApiError ? err.status : 0;
      if (status === 401 || status === 403 || /API key not valid|API_KEY_INVALID/i.test(message)) {
        throw new ProviderError(`Gemma rejected the API key: ${message.slice(0, 200)}`, { authFailed: true });
      }
      if (status === 429) {
        throw new ProviderError(`Gemma rate limit / quota: ${message.slice(0, 160)}`, { retryable: true });
      }
      if (status >= 500) {
        throw new ProviderError(`Gemma unavailable (${status}): ${message.slice(0, 160)}`, { retryable: true });
      }
      throw new ProviderError(`Gemma error${status ? ` ${status}` : ""}: ${message.slice(0, 300)}`);
    }
  }

  return {
    name: "gemma",
    model,
    getNextStep(req, extraNote, signal) {
      return withParseRetry("gemma", () => callOnce(req, extraNote, signal));
    },
  };
}
