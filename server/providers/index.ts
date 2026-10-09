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

export async function getNextStep(req: NextStepRequest, extraNote?: string): Promise<ProviderAnswer> {
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
