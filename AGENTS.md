# Flow Arrow - Agent Ownership

Three builders, three laptops, zero file overlap. Each agent owns ONLY its folders. The contracts in `docs/ARCHITECTURE.md` section 6 are frozen - a change needs all three humans to approve.

## Owners

### Person A - Extension UI
Owns ONLY:
- `extension/content/*` (styles, config, icons, scanner, overlay, watcher, widget, voice, speech, main)
- `extension/manifest.json`, `extension/fonts/*`, `extension/icons/*`
- `extension/welcome/*`

Rules:
- Never call the backend directly. Talk to the service worker via `FLOW_*` messages only.
- Never edit `extension/sw/*`, `extension/background.js`, `server/*`, `demo-apps/*`.
- Scanner cap: max 100 elements for hackathon speed. Labels max 80 chars, never include field values.
- UI must support Devanagari: `font-family: "FlowArrow Atkinson Hyperlegible", "Noto Sans Devanagari", system-ui, sans-serif`.
- Widget owns: goal box, NE/EN toggle, mic button, speaker (TTS) toggle, Send, Close, Stop.

### Person B - Brain + Model
Owns ONLY:
- `extension/sw/*` (session, loop, marks, api, voice)
- `extension/background.js`, `extension/offscreen/*`
- `server/server.ts`, `server/schema.ts`, `server/prompt.ts`, `server/decide.ts`, `server/logger.ts`
- `server/providers/gemma.ts`, `server/providers/types.ts`, `server/scripts/*`

Rules:
- Only person who touches the prompt or the model key.
- `POST /next-step` takes `{ sessionId, turn, goal, lang, page, elements, history, screenshot }` and returns `{ ok, step }`. History sent: last 6. Screenshot: JPEG max 1024px for stage wifi.
- `POST /transcribe` takes raw `audio/webm`, returns `{ ok, text, lang }`. Thin forwarder only.
- Step schema: `{ reasoning, action: click|type|scroll|info|show, elementId, scrollDirection, instruction, confidence, done }`. Instruction is always in `req.lang`.
- Never edit Person A or Person C folders.

### Person C - Voice + Demo + Show
Owns ONLY:
- `server/voice/*`, `server/docker-compose.yml` (Nepali Whisper container)
- New file `extension/content/speech.js` (TTS wrapper using `speechSynthesis`, lang `ne-NP` / `en-US`)
- `demo-apps/*` (single Hub + Bank app for hackathon)
- `scripts/e2e/*`, `notes/*`, demo script, presentation

Rules:
- Whisper model: Nepali fine-tuned container (`whisper-small-nepali-ct2`, int8 CPU, `language=ne`). Same HTTP shape as before, no contract change.
- TTS is browser-only. No server work. Toggle in widget. Fallback to text-only if no `ne-NP` voice exists on stage laptop.
- Demo app: semantic HTML, no Flow Arrow hints (`data-flowarrow` forbidden), login `eluu / 1234`, `/reset` route, bottom-right corner kept clear for widget.
- Never edit Person A or Person B folders.

## Communication protocol (agents on different laptops)

1. Agents never message each other directly. They communicate via artifacts:
   - `docs/ARCHITECTURE.md` sec 6 (contracts)
   - `server/stub.json` (2 fake `/next-step` responses for local dev)
   - `server/logs/<ts>-<session>-<turn>/screenshot.jpg + request.json + response.json`
2. If you need a contract change, output `PROPOSAL: <diff>` and STOP. Do not edit. Human approves.
3. Backend sharing: Person B exposes `http://0.0.0.0:8787` via Tailscale or `ngrok http 8787`. URL goes in `config.local.json` (gitignored) + pinned chat. A/C set `BACKEND_URL` there.
4. Integration: PR to `main` at H4 / H8 / H12. PR body lists files touched, contract touched (must be no), how tested. Human reviews 5 min, merges, everyone pulls.
5. Secrets (`GEMMA_API_KEY`) live only on Person B laptop in `server/.env`. Never commit, never log, never put in extension.

## Journal protocol (every commit leaves a trace)

1. Every commit includes exactly one new `notes/journal/<UTC-timestamp>-<owner>-<slug>.md` fragment, staged in the same commit. Copy `notes/journal/TEMPLATE.md`. Never edit an existing fragment - always a new file, so concurrent commits from 3 laptops merge cleanly.
2. Fragment shape (5 lines): What / Why / Test / Contracts touched (no, or `PROPOSAL: <diff>` then stop) / Next-Blockers. No keys, tokens, tunnel URLs, or passwords in fragments.
3. `notes/PROGRESS.md` is the checkpoint rollup, rewritten by Person C at H4/H8/H12 from the journal + `git log`. Sections: Done / Numbers / Known issues / Next. Only Person C rewrites it.
4. Reading protocol after every `git pull`: `ls notes/journal | tail -5`, read the new fragments, read `PROGRESS.md` top. Under 1 minute.
5. Personal mess goes in `notes/scratch-<name>.md` (gitignored, never committed).

## Commit rules

- Short factual messages describing what changed and why. Example: `Add NE/EN toggle to widget` or `Clamp screenshot to 1024px for stage wifi`.
- One logical change per commit. Stage only your owned files.
