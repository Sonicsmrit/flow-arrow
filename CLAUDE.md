# Flow Arrow - Agent Instructions

Flow Arrow is a Chrome extension + small local Node backend that guides users through web tasks with an on-screen arrow cursor, a dimmed-page highlight ring, and short captions. Users give one goal by typing or by voice (`Alt+X`), in English or Nepali. Demoed on a local mock bank app plus a Demo Hub, and tested by hand on real sites.

Flow Arrow supports Nepali end to end: Nepali typed goals, Nepali voice input, Nepali instructions, and optional Nepali voice output. The UI uses Noto Sans Devanagari as fallback for Devanagari script.

## Read first

1. `README.md` - what Flow Arrow is, how to run and test it.
2. `docs/ARCHITECTURE.md` - decisions, components, exact data contracts. Treat section 6 (contracts) as law; code comments refer to its section numbers.
3. `docs/MOCK-APPS.md` when a change touches the demo apps.
4. `notes/` (local only, gitignored; may not exist in a fresh clone): `PROGRESS.md` (build log, numbers, known issues, open ideas), `TEST-CHECKLIST.md` (manual paths through the demo apps), `LIVE-DEMO.md`.

## Working rules

- Do not change a contract in `docs/ARCHITECTURE.md` section 6 (message types, request/response shapes, step schema) or the default model without asking the user first. If a change is approved, update ARCHITECTURE.md in the same change.
- Never use em-dashes in any file or message. Use a plain dash "-".
- The user cares about pixel-level visual quality for anything UI.
- If something unrelated looks broken or risky, tell the user immediately and propose a fix.
- After a change: run `node scripts/e2e/suite.mjs --smoke` (about 1 minute); the full suite (`--runs 3`) only for big changes. Keep `notes/PROGRESS.md` truthful if it exists.
- Write commit messages as original Flow Arrow work describing what changed and why. Keep messages short and factual.
- Git is direct to `main`, and every agent on every laptop may push and pull. Order is fixed: `git pull --rebase origin main` first, then commit owned files plus one new `notes/journal/` fragment, then `git push origin main`. Never force-push `main`. If a push is rejected, rebase and push again. Check `git status --short` before pushing and stage only intended files.

## Naming

- Product: `Flow Arrow`. Code slug: `flow-arrow`. JS namespace: `globalThis.FlowArrow`.
- DOM host: `<flow-arrow-root>`. Message prefix: `FLOW_`. Log prefixes: `[FlowArrow]` (content), `[FlowArrow:sw]` (service worker).
- Font family: `FlowArrow Atkinson Hyperlegible` with `Noto Sans Devanagari` fallback for Nepali text.

## Debugging rules

- Reproduce first, as close to the real user flow as possible: the robot tester in `scripts/e2e/` runs the real unpacked extension in Chromium; Windows Chrome via the user when that matters. The robot must never drive real third-party sites (use a local page served through Playwright routing, like `scripts/e2e/scanner-cases.mjs`).
- The backend logs every request to `server/logs/<timestamp>-<session>-<turn>/` with the marked screenshot the model saw, the request (minus image), the prompt, and the response (with timings). When a step picks the wrong element, open the latest log folder and LOOK at `screenshot.jpg` before guessing. `server/logs/timings.csv` has one line per turn.
- A failed robot run saves the extension's own logs to `scripts/e2e/.out/fail-*.log`.
- Content-script logs use the prefix `[FlowArrow]` in the page's DevTools console. Service worker logs (`[FlowArrow:sw]`) are under `chrome://extensions` -> Flow Arrow -> "service worker".

## Environment facts

- Code in WSL2 Ubuntu at `/home/sonica/flow-arrow`. No GPU. Docker Engine + Compose run natively in WSL.
- Chrome runs on Windows. The extension is loaded unpacked from `\\wsl.localhost\Ubuntu-26.04\home\sonica\flow-arrow\extension`. After extension changes the user clicks reload in `chrome://extensions` and refreshes the page.
- Node 24 runs `.ts` files directly (type stripping). Only erasable TS syntax: no `enum`, no `namespace`, no constructor parameter properties. Relative imports must include the `.ts` extension. (The Vite apps in `demo-apps/` are normal TS and are exempt.)
- Ports: backend `8787` (`cd server && npm run dev`), Whisper Nepali `8790` (`cd server && docker compose up -d whisper`), Demo Hub `3000`, Bank `3001` (`cd demo-apps && docker compose up -d --build`). All reachable from Windows Chrome via WSL2 localhost forwarding.
- Secrets live only in `server/.env` (gitignored): `GEMMA_API_KEY` for the hosted Gemma 4 model. Never print, log, or commit secrets, and never put them in the extension.
- Server edits: restart `npm run dev` by hand after editing `server/*.ts` or `server/.env` (`node --watch` silently loses track of files saved by replacement). To stop it from a shell use `pkill -f "[n]ode --watch"` (the bracket stops pkill from matching your own shell).
- Model: `MODEL_PROVIDER=gemma` in `server/.env` (hosted Gemma 4 vision + text model).
- Repo: `https://github.com/Sonicsmrit/flow-arrow.git` (public, branch `main`). Teammates are collaborators with push access; each laptop runs `gh auth login` once so agent pushes work non-interactively. Pull needs no auth.

## Hackathon checklists

File ownership follows `AGENTS.md` (A = Extension UI, B = Brain + Model, C = Voice + Demo + Show). Ports frozen: backend `8787`, whisper `8790`, hub `3000`, bank `3001`.

### Person A - Extension UI

- [ ] Widget opens from launcher + `Alt+X`, goal send works (`content/widget.js`)
- [ ] NE/EN toggle flips caption language, persists across reload
- [ ] Speaker toggle reads caption via `speechSynthesis` with `ne-NP` / `en-US`
- [ ] Overlay: ring + dim + arrow glide + caption never covers target (`content/overlay.js`, `content/config.js`)
- [ ] Scanner max 100 elements, no values; Devanagari font stack set
- [ ] Reload check: `chrome://extensions` -> reload -> refresh demo page

### Person B - Brain + Model

Setup: `cd server && npm install && npm run dev`, check `curl http://localhost:8787/health`.

- [ ] `POST /next-step` returns ONE step, existing elementId only, instruction in `req.lang`
- [ ] `decide.ts` retries once on bad id, fake `done:true` never accepted
- [ ] `POST /transcribe` forwards `audio/webm`, returns `{ok, text, lang}`
- [ ] Every turn logs `server/logs/<ts>-<session>-<turn>/screenshot.jpg + response.json`
- [ ] `npm run typecheck` clean

### Person C - Voice + Demo + Show

Setup: `cd demo-apps && docker compose up -d --build`, then `cd scripts/e2e && bash setup.sh && node suite.mjs --smoke`.

- [ ] Whisper Nepali on `:8790` green; TTS fallback to text-only if no `ne-NP` voice
- [ ] Hub `:3000` + Bank `:3001` green, login `eluu / 1234`, `/reset` works
- [ ] Flow A: "pay my credit card bill", Flow B: Nepali goal, Flow C: "tell me" balance goal
- [ ] `node suite.mjs --smoke` passes, backup video exported
