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
4. Sync: direct to `main`, no PR gate. Push any time; at H4/H8/H12 everyone runs `git pull --rebase origin main`, reads the new journal fragments + PROGRESS.md top, and the humans do a 5 min review on a call. No feature branches unless a change is risky - then branch `wip/<owner>-<slug>` and merge via fast-forward after review.
5. Secrets (`GEMMA_API_KEY`) live only on Person B laptop in `server/.env`. Never commit, never log, never put in extension.

## Journal protocol (every commit leaves a trace)

1. Every commit includes exactly one new `notes/journal/<UTC-timestamp>-<owner>-<slug>.md` fragment, staged in the same commit. Copy `notes/journal/TEMPLATE.md`. Never edit an existing fragment - always a new file, so concurrent commits from 3 laptops merge cleanly.
2. Fragment shape (5 lines): What / Why / Test / Contracts touched (no, or `PROPOSAL: <diff>` then stop) / Next-Blockers. No keys, tokens, tunnel URLs, or passwords in fragments.
3. `notes/PROGRESS.md` is the checkpoint rollup, rewritten by Person C at H4/H8/H12 from the journal + `git log`. Sections: Done / Numbers / Known issues / Next. Only Person C rewrites it.
4. Reading protocol after every `git pull`: `ls notes/journal | tail -5`, read the new fragments, read `PROGRESS.md` top. Under 1 minute.
5. Personal mess goes in `notes/scratch-<name>.md` (gitignored, never committed).

## Git access (all agents may push and pull)

Repo: `https://github.com/Sonicsmrit/flow-arrow.git`, public, single branch `main`.

1. One-time per laptop: accept the collaborator invite (gives `push` permission), then `gh auth login` (GitHub.com, HTTPS) and verify with `git ls-remote origin` showing refs with no password prompt. Agents push non-interactively after this - if a push asks for credentials, stop and tell the human instead of pasting tokens into commands.
2. Clone: `git clone https://github.com/Sonicsmrit/flow-arrow.git`. Pull needs no auth (public repo); push needs the invite + login above.
3. Every push follows this order, no exceptions: `git pull --rebase origin main` first, then commit (owned files + one new journal fragment), then `git push origin main`.
4. NEVER `push --force` on `main`. A rejected push means someone landed first: `git pull --rebase origin main`, resolve, push again. Journal fragments never conflict by design (unique filenames, never edited). If `notes/PROGRESS.md` conflicts, Person C resolves; everyone else takes their side and re-applies.
5. Before pushing, run `git status --short` and `git diff --cached --stat`: stage only your owned files + your one fragment. Unrelated or unreviewed files never ride along.
6. No secrets in commits or fragments, ever: no keys, tokens, tunnel URLs, or passwords. `server/.env` and `config.local.json` are gitignored for this reason.

## Commit rules

- Short factual messages describing what changed and why. Example: `Add NE/EN toggle to widget` or `Clamp screenshot to 1024px for stage wifi`.
- One logical change per commit. Stage only your owned files.

## Hackathon checklists

### Person A - Extension UI

- [ ] Widget opens from launcher + `Alt+X`, goal send works (`content/widget.js`)
- [ ] NE/EN toggle flips caption language, persists across reload
- [ ] Speaker toggle reads caption via `speechSynthesis` with `ne-NP` / `en-US`, no server call
- [ ] Mic flow: idle -> recording (red pulse) -> transcribing (spinner) -> auto-send (`content/voice.js`)
- [ ] Overlay: ring + dim + arrow glide + caption never covers target (`content/overlay.js`, `content/config.js`)
- [ ] Scanner max 100 elements for stage speed, labels max 80 chars, no values (`content/scanner.js`)
- [ ] Devanagari font stack set, `prefers-reduced-motion` disables glide
- [ ] Reload check: `chrome://extensions` -> reload -> refresh demo page
- [ ] Record 20s video: goal -> ring -> click -> next ring

Done when: ring is pixel-exact on Bank app, Nepali caption readable.

### Person B - Brain + Model

Setup: `cd server && npm install && npm run dev`, check `curl http://localhost:8787/health`.

- [ ] `GET /health` returns `{ok, provider, model}` (`server.ts`)
- [ ] `POST /next-step` takes `{sessionId, turn, goal, lang, page, elements, history, screenshot}`, history last 6, screenshot JPEG max 1024px
- [ ] Prompt forces ONE step, existing elementId only, instruction always in `req.lang` (`prompt.ts`)
- [ ] `decide.ts` retries once on bad id, text landmark misuse, fake `done:true`
- [ ] p50 model under 2s, `maxTokens` 300, temp 0
- [ ] `POST /transcribe` forwards `audio/webm`, returns `{ok, text, lang}` (`transcribe.ts`)
- [ ] Every turn logs `server/logs/<ts>-<session>-<turn>/screenshot.jpg + response.json`
- [ ] `npm run typecheck` clean

Done when: fixtures replay clean, logs prove each decision.

### Person C - Voice + Demo + Show

Setup: `cd demo-apps && docker compose up -d --build`, open `http://localhost:3000`, reset via `http://localhost:3001/reset`. Then `cd scripts/e2e && bash setup.sh && node suite.mjs --smoke`.

- [ ] Whisper Nepali container green on `:8790` (`server/voice/*`)
- [ ] TTS wrapper `extension/content/speech.js` works, fallback to text-only if no `ne-NP` voice
- [ ] Hub `:3000` + Bank `:3001` green, login `eluu / 1234` works
- [ ] Flow A: "pay my credit card bill" end-to-end
- [ ] Flow B: Nepali goal on same Bank app end-to-end
- [ ] Flow C: "tell me" goal (balance) ends with `show + done:true`
- [ ] `node run-goal.mjs http://localhost:3001 "pay my credit card bill"` passes
- [ ] `node suite.mjs --smoke` passes, `node visual.mjs` screenshots saved
- [ ] Backup: offline screenshots + log folder + pre-recorded video if model drops

Done when: 3 flows pass 3x in a row, video exported, reset works in under 5s.
