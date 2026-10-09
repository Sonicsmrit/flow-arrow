# Flow Arrow - Reuse Audit

Per-file verdicts for rebuilding Flow Arrow from the reference implementation. Read your section before writing code. Contracts in `docs/ARCHITECTURE.md` sec 6 stay frozen regardless.

Legend: COPY = take as-is + rename strings. ADAPT = keep logic, targeted edits listed. NEW = write fresh. SKIP = out of hackathon scope.

## Person A - Extension UI (owns `extension/content/*`, manifest, fonts, welcome)

- COPY: `content/watcher.js` (outcome state machine is language-agnostic; only bilingual button labels + host-tag check change).
- COPY: `content/main.js` wiring + font-loading trick (fetch bytes into `FontFace`; `@font-face` in shadow roots fails and page CSP can block `url()`). Add Noto Sans Devanagari bytes next to Atkinson.
- ADAPT: `content/scanner.js` (cap 150 to 100, drop the 40-landmark + DATA_PATTERNS block, retag host check). Keep selector list, visibility + topmost + 85% dedup, label priority, `hasValue`/`checked`.
- ADAPT: `content/styles.js`, `config.js`, `icons.js` (keep tunables shape: dim 0.52, ring 4px/pad 7, glide 800ms; swap cursor SVG for an arrow).
- NEW: `content/overlay.js` arrow rendering, `content/widget.js` (goal box + NE/EN toggle + speaker button + bilingual states), `content/speech.js` TTS wrapper (Person C file, lives in A's folder - coordinate the interface: `FlowArrow.speech.speak(text, lang)`, `cancel()`).

## Person B - Brain + Model (owns `extension/sw/*`, background, offscreen, `server/*`)

- COPY: `sw/session.js`, `sw/voice.js`, `offscreen/*`, `server/logger.ts` (drop fallback/hedge fields), `server/scripts/try-fixture.ts`, `server/providers/types.ts` (`Provider`, `ProviderError`, `withParseRetry`).
- ADAPT: `server/schema.ts` (+`lang`, caps 100/6), `server/server.ts` (single Gemma provider, bilingual errors), `server/decide.ts` (bilingual fallback; gate `instructionMismatch` to `lang=="en"` - its `[a-z]` splitting false-fires on Devanagari), `server/prompt.ts` (rule 15 bilingual + `LANG:` line; keep rules 1-14 + all four helper notes), `sw/marks.js` (keep placement algorithm verbatim; 1280 to 1024px, q80 to 70), `sw/loop.js` (strip prediction/check-in/new-tab; +`lang`/`speak`; history 12 to 6), `sw/api.js` (BACKEND_URL), `background.js` (rename, thread goal/lang/speak, drop check-in + new-tab), `server/transcribe.ts` (timeout 10s to 15s), `server/.env.example`.
- NEW: `server/providers/gemma.ts` (template = `gemini.ts` call shape: image inlineData + user text, JSON schema, `parseStepText`, 15s timeout), collapsed `providers/index.ts` (no hedge/fallback).
- SKIP: `bedrock.ts`, `bakeoff.ts`, `make-fixture.ts`, `timings.ts`.

## Person C - Voice + Demo + Show (owns `server/voice/*`, `speech.js`, `demo-apps/*`, `scripts/e2e/*`, `notes/*`)

- COPY: `server/voice/Dockerfile` shape (build-time model download = offline at runtime), `server/voice/app.py` FastAPI shape (5MB cap, vad_filter), `demo-apps/docker-compose.yml` + `Dockerfile.app` + `nginx.conf` SPA fallback + `shared/` helpers. Cut 4 apps to Hub + Bank.
- ADAPT: Whisper model to Nepali fine-tune (`whisper-small-nepali-ct2`, `language="ne"`, Nepali demo vocab in `initial_prompt`), e2e suite to smoke subset (HERO + 1 tell-me goal).
- NEW: single bank demo app (spec in `docs/MOCK-APPS.md`), browser-only TTS, demo script + presentation.

## Post-mortem lessons (do not relearn)

1. Plain-text JSON beats tool-calling (97% vs 91%), reasoning-first beats reasoning-last. Keep both.
2. 1280px beats 1024px on accuracy (~6 pts) - Flow Arrow takes 1024px anyway for stage wifi, knowingly.
3. Tag-clearance rules exist because outside tags were misread as the neighbour's number. Keep verbatim.
4. Guards that saved demos: validation retry, give-up retry (`done:true` + sorry-text never accepted), done-ambiguous resolve, stale-error vs emptied-field notes. All kept.
5. Opacity-0 overlay controls, shadow-DOM recursion, 85% dedup came from real-site failures. Keep.
6. Model is ~70% of turn cost - event-driven loop, never polling.
7. Every turn logged with its exact screenshot (`server/logs/`) - LOOK at the image before guessing on misfires.
