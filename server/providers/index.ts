import { createGemmaProvider } from "./gemma.ts";
import { ProviderError, type Provider } from "./types.ts";
import type { NextStepRequest, Step } from "../schema.ts";

export { ProviderError } from "./types.ts";
export type { Provider } from "./types.ts";

// Single provider, no hedge/fallback (ARCHITECTURE D2). The server refuses to
// boot without a key instead of failing every turn.
const provider: Provider | null = createGemmaProvider();
if (!provider) {
  throw new Error("GEMMA_API_KEY is not set in server/.env");
}
const active: Provider = provider;

export type ProviderAnswer = {
  step: Step;
  provider: string;
  model: string;
  outputTokens?: number;
};

// Anti-429: minimum gap between model call starts. Serializes bursts from
// retries, concurrent turns, and rapid testing into a safe cadence.
const MIN_GAP_MS = 4000;
let lastStart = 0;

async function gapGate(): Promise<void> {
  const wait = MIN_GAP_MS - (Date.now() - lastStart);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastStart = Date.now();
}

export async function getNextStep(req: NextStepRequest, extraNote?: string): Promise<ProviderAnswer> {
  await gapGate();
  const result = await active.getNextStep(req, extraNote);
  return { step: result.step, provider: active.name, model: active.model, outputTokens: result.outputTokens };
}

// GET /health: which provider/model answers turns.
export function healthInfo(): { provider: string; model: string } {
  return { provider: active.name, model: active.model };
}

export function startupSummary(): string {
  return `provider ${active.name} (${active.model})`;
}
