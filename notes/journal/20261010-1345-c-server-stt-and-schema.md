# 2026-10-10 13:45 Person C: Server STT Fallback & DOM Schema Role Fixes

## Context
When running without Docker (whisper:8790 offline), audio transcription failed with `voice_helper_down`. Additionally, certain DOM elements extracted by content scripts had `role: "heading"` or `role: "text"`, which caused validation failures against `ELEMENT_ROLES`.

## Changes Made
1. **Gemini STT Fallback in `server/transcribe.ts`**:
   - Added fast 3s check for local Whisper.
   - If Whisper is unreachable, falls back to multimodal transcription via `@google/genai` using `gemini-3.8-flash` and the configured API key (`GEMMA_API_KEY` / `GEMINI_API_KEY`).
   - Automatically detects language (`en` vs `ne`).
2. **Schema Extension in `server/schema.ts`**:
   - Added `"heading"` and `"text"` to `ELEMENT_ROLES` Set so DOM trees containing headings and plain text nodes are accepted during `/next-step`.
3. **Verified**:
   - `npm run try -- fixtures/bank-signin-button` returned HTTP 200 in ~3.5s with action `click`.
   - Audio transcription tested with sample `voice/samples/clip1.webm` returning exact transcribed text: `"Pay my credit card bill, please. I want to pay the whole statement balance."` with `lang: "en"`.
