# 2026-10-10 14:15 Person C: Multi-Key Pool & Automatic Rotation on Rate Limits / Quotas

## Context
API keys can encounter 429 rate limits, project quota exhaustion, or transient errors. To prevent user-facing downtime or "Try again" errors during demo and testing, multiple API keys are pooled and automatically rotated when an error or quota is reached.

## Changes Made
1. **`server/keypool.ts`**:
   - Implemented `KeyPool` class that parses `GEMMA_API_KEYS` (comma-separated) or `GEMMA_API_KEY`.
   - Supports `current()` and `rotate()` methods with logging.
2. **`server/providers/gemma.ts`**:
   - Rewired `callOnce` to fetch the current key from `globalKeyPool`.
   - Catches 429 rate limit, quota exhaustion, or key authorization errors, immediately rotates to the next available key in the pool, and retries the turn seamlessly.
3. **`server/transcribe.ts`**:
   - Cloud STT fallback now utilizes `globalKeyPool` with multi-attempt key rotation.
   - Selected `gemini-3.6-flash` for high-speed voice transcription (~4.3s latency) with full multimodal audio support across all keys.
4. **Local Configuration**:
   - `server/.env` updated with active keys in `GEMMA_API_KEYS` (untracked in git).
