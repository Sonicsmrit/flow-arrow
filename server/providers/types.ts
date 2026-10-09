import type { NextStepRequest, Step } from "../schema.ts";

export type ProviderResult = {
  step: Step;
  inputTokens?: number;
  outputTokens?: number;
};

export type Provider = {
  name: string;
  model: string;
  // `signal` aborts the call (lets a slow call be abandoned).
  getNextStep(req: NextStepRequest, extraNote?: string, signal?: AbortSignal): Promise<ProviderResult>;
};

export class ProviderError extends Error {
  retryable: boolean;
  authFailed: boolean;
  constructor(message: string, opts: { retryable?: boolean; authFailed?: boolean } = {}) {
    super(message);
    this.name = "ProviderError";
    this.retryable = opts.retryable ?? false;
    this.authFailed = opts.authFailed ?? false;
  }
}

// Thrown by the provider when the model answered but the text is not a usable
// Step. The caller retries once before giving up.
export class UnparsableOutput extends Error {}

// Calls `once` and retries a single time on UnparsableOutput.
export async function withParseRetry(
  name: string,
  once: () => Promise<ProviderResult>
): Promise<ProviderResult> {
  try {
    return await once();
  } catch (err) {
    if (!(err instanceof UnparsableOutput)) throw err;
    console.warn(`${name}: unparsable output, retrying once (${err.message})`);
    try {
      return await once();
    } catch (err2) {
      if (err2 instanceof UnparsableOutput) {
        throw new ProviderError(`${name} returned unusable output twice: ${err2.message}`, { retryable: true });
      }
      throw err2;
    }
  }
}
