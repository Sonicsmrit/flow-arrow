# Flow Arrow - Architecture

How Flow Arrow works, the decisions behind it, and the exact data contracts between its parts. Contracts in section 6 are binding: code on both sides of a message or HTTP call follows them exactly. Code comments refer to this file by section number.

## 1. Product in one paragraph

A user who is unsure how to use a website opens the small Flow Arrow widget (bottom-right launcher, or `Alt+X`) and types or speaks ONE goal in English or Nepali ("pay my credit card bill" / "मेरो क्रेडिट कार्डको बिल तिर्नुहोस्"). Flow Arrow looks at the current screen, decides the single next action, glides a large arrow to the right element, draws a ring around it with the rest of the page dimmed, and shows a short caption in the user's language. Optionally it reads the caption aloud. When the user performs the action, Flow Arrow looks again and shows the next step, until the goal is done. Then the widget shows "You did it!" / "सफल भयो!" and goes quiet until the next goal. Flow Arrow never clicks or types for the user and never asks for a password.

Demo: one mock bank app running locally in Docker, plus a Demo Hub to reset it. Nothing in Flow Arrow is specific to the mock app; it also runs on real sites.

Flow Arrow is not a chatbot: there is no chat transcript, only a goal box and the on-page arrow.

## 2. Decisions (and why)

| # | Decision | Why |
|---|----------|-----|
| D1 | Chrome extension (Manifest V3) | Reads the DOM, so rings are pixel-exact from `getBoundingClientRect()`; the model never guesses coordinates. |
| D2 | Model provider is hosted Gemma 4 vision model (`MODEL_PROVIDER=gemma`, key `GEMMA_API_KEY` in `server/.env`). Chosen 2026-10-09: `gemma-4-26b-a4b-it` (bake-off 6/6 acc @ p50 ~3-5s, 0 failures; 31b-it disqualified on latency, p50 28s + timeouts; key exposes exactly 2 Gemma 4 models of 62). | Multimodal text+image in one call, strong instruction following, JSON mode. One provider keeps hackathon scope small; no fallback chain. |
| D3 | Small local backend (Node 24, TypeScript run directly, `node:http`) | Keeps keys off the client, one place to swap prompts, logs every request with the exact screenshot the model saw. |
| D4 | Extension in plain JS, no bundler | Edit, reload in `chrome://extensions`. Three laptops can review diffs without build artifacts. |
| D5 | One step at a time loop (observe -> ask -> point -> wait -> repeat), **event-driven, never time-polled** | A model call happens only when something meaningful happens (user acted, page changed, target covered). Cheaper and faster than screenshots every 1-2 s. |
| D6 | Set-of-Marks grounding | The model gets a numbered element list + a screenshot with the same numbers drawn; it answers with an element id. |
| D7 | Step actions: `click`, `type`, `scroll`, `info`, `show`, plus a `done` flag | `show` points at non-clickable information (a balance) for "tell me" goals. |
| D8 | Layered overlay handoff | The arrow fades when the real cursor is near; the ring stays until the action is done. |
| D9 | Voice input push-to-talk + optional voice output. `Alt+X` or mic button records, press again to stop, transcribe, auto-send. Audio recorded in an extension **offscreen document**, transcribed by a **local Nepali Whisper container**. Output speech is browser-only `speechSynthesis` (`ne-NP` / `en-US`), no server. | Mic permission granted ONCE to the extension instead of once per website. Browser TTS needs zero backend work, which fits a 12-24h build. |
| D10 | Session state in the service worker + `chrome.storage.session`, keyed by tab id | Survives page loads and cross-domain redirects. The widget rebuilds itself on every full page load from this state. |
| D11 | All Flow Arrow UI inside a closed Shadow DOM on `<flow-arrow-root>` | Page CSS cannot break our UI and vice versa. |
| D12 | The element list never includes field values (only `hasValue`) | Basic privacy hygiene. |
| D13 | Wrong clicks are never blocked. Flow Arrow re-plans from the new screen toward the ORIGINAL goal. | Real users may detour; blocking breaks real sites. |
| D14 | The mock app contains NO Flow Arrow-specific hints (no `data-flowarrow`, no special ids). Ordinary, realistically busy, well-labeled HTML. | Honest answer to "does it work on real sites?". |
| D15 | Overlay look: arrow + ring, dimmed page, Atkinson Hyperlegible with Noto Sans Devanagari fallback. Dim default `0.52`. | High contrast, legible for low-vision users, Devanagari glyphs render correctly. |
| D16 | No progress bar or step count estimate. Caption eyebrow says "Step N" only. | The model plans one step at a time; a wrong total looks worse than none. |
| D17 | Bilingual core: every turn carries `lang: "ne" | "en"`. Instructions always match the goal language. Element labels stay in page language (usually English). | Nepali users get Nepali guidance while the model still grounds to English buttons. |

Out of scope for the hackathon build: hedged requests, predicted next step, new-tab following, off-path check-in, wake word, iframes, acting on the user's behalf.

## 3. Components

```
+----------------------------- Chrome ---------------------------------------+
|                                                                            |
|  CONTENT SCRIPT (per page, UI in closed Shadow DOM on <flow-arrow-root>)   |
|   styles.js   CSS for the shadow root                                      |
|   config.js   visual tunables (dim, ring, arrow, proximity)                |
|   icons.js    SVG icons (createElementNS, no innerHTML)                    |
|   scanner.js  interactive elements -> ElementInfo[]                        |
|   overlay.js  arrow, ring + dim, caption, cards                             |
|   watcher.js  detects the user's action -> StepOutcome                     |
|   widget.js   launcher + goal box (text, NE/EN toggle, mic, speaker, Send) |
|   voice.js    mic button / Alt+X glue (recording lives in offscreen)       |
|   speech.js   browser TTS wrapper (speechSynthesis, ne-NP/en-US)           |
|   main.js     message wiring, font loading (LAST in the manifest list)     |
|                    ^            |  chrome.runtime messages (6.3)            |
|                    |            v                                           |
|  SERVICE WORKER background.js (ES module)                                  |
|   sw/session.js  per-tab Session in chrome.storage.session                 |
|   sw/loop.js     observe -> ask -> point -> wait state machine             |
|   sw/marks.js    captureVisibleTab + draw Set-of-Marks (OffscreenCanvas)   |
|   sw/api.js      POST /next-step (BACKEND_URL, default localhost:8787)     |
|   sw/voice.js    offscreen document lifecycle, Alt+X command               |
|  OFFSCREEN DOC offscreen/offscreen.html+js  MediaRecorder -> /transcribe    |
|  WELCOME TAB   welcome/welcome.html  one-time "Allow microphone"           |
+--------------------------------|-------------------------------------------+
                                 | HTTP (BACKEND_URL)
+---------------- server/ (Node 24) -----------------------------------------+
|  server.ts        GET /health, POST /next-step, POST /transcribe           |
|  schema.ts        types + JSON schema + validation (incl. lang)            |
|  prompt.ts        system prompt + per-request prompt builder (bilingual)   |
|  decide.ts        model answer -> Step (validation retries, guards)        |
|  providers/       types.ts, gemma.ts (hosted Gemma 4 call)                 |
|  transcribe.ts    forwards audio to Nepali Whisper                        |
|  logger.ts        server/logs/<ts>-<session>-<turn>/ + timings.csv         |
|  voice/           Docker: faster-whisper Nepali service on :8790           |
+----------------------------------------------------------------------------+
+---------------- demo-apps/ (Docker Compose) --------------------------------+
|  hub :3000   bank :3001                                                     |
+----------------------------------------------------------------------------+
```

## 4. Repository layout (file structure)

```
flow-arrow/
  README.md  CLAUDE.md  AGENTS.md
  docs/ARCHITECTURE.md  docs/MOCK-APPS.md
  config.local.json           (gitignored: BACKEND_URL override for cross-laptop dev)
  server/
    server.ts schema.ts prompt.ts decide.ts logger.ts transcribe.ts
    providers/types.ts providers/gemma.ts
    .env.example  package.json  tsconfig.json  docker-compose.yml
    stub.json                 (2 fake /next-step responses for offline UI dev)
    scripts/try-fixture.ts
    fixtures/<name>/{request.json, screenshot.jpg, expected.json}
    voice/Dockerfile voice/app.py
    logs/  (gitignored)
  extension/
    manifest.json background.js
    sw/session.js sw/loop.js sw/marks.js sw/api.js sw/voice.js
    content/styles.js config.js icons.js scanner.js overlay.js watcher.js widget.js voice.js speech.js main.js
    offscreen/offscreen.html offscreen.js
    welcome/welcome.html welcome.js
    fonts/ (Atkinson Hyperlegible 400/700 woff2 + Noto Sans Devanagari + OFL.txt)
    icons/
  demo-apps/
    package.json docker-compose.yml Dockerfile.app nginx.conf
    shared/  hub/  bank/
  scripts/e2e/   (suite.mjs --smoke, run-goal.mjs, voice.mjs, visual.mjs)
```

Content scripts are classic scripts sharing `globalThis.FlowArrow = globalThis.FlowArrow || {}`. Each file attaches its API (`FlowArrow.scanner = {...}`). `main.js` is last and wires everything.

Ownership (see AGENTS.md): Person A owns `extension/content/*` + manifest + fonts + welcome. Person B owns `extension/sw/*` + background + offscreen + `server/*`. Person C owns `server/voice/*` + `speech.js` + `demo-apps/*` + `scripts/e2e/*`.

## 5. The step loop (state machine in `sw/loop.js`)

```
            FLOW_START {goal, lang}
                   |
                   v
   +--------> OBSERVING ---- SW -> content: FLOW_PREPARE_CAPTURE
   |               |          content hides ALL Flow Arrow UI, scans, replies ScanResult
   |               |          SW: captureVisibleTab + draw marks   (UI STILL HIDDEN)
   |               v
   |           THINKING  ---- SW -> content: FLOW_THINKING (content un-hides UI, widget "Looking..." / "हेर्दै...")
   |               |          SW: POST /next-step
   |               v
   |        step.done && action=="info" --> DONE: FLOW_DONE {message}; clear session
   |               |
   |               v
   |       AWAITING_ACTION -- SW -> content: FLOW_STEP {turn, step}
   |               |          content: overlay points, watcher armed, optional TTS speaks
   |               |
   |      content -> SW: FLOW_STEP_RESULT {turn, outcome}   (sent the INSTANT the outcome is known)
   |               |          SW appends HistoryEntry, turn++
   |               v
   |           SETTLING  ---- waits for EITHER
   |               |            content -> SW: FLOW_READY {turn}  (same page, DOM quiet)
   |               |            content -> SW: FLOW_HELLO {url}   (a new page loaded)
   |               |
   +---------------+ (back to OBSERVING)
```

Rules:
- **Capture order:** the screenshot is taken while Flow Arrow UI is hidden. `FLOW_THINKING` (which un-hides the UI) is sent only AFTER `captureWithMarks` resolves, so the model never sees our own widget.
- `turn` is a counter on the session; every turn-scoped message carries it. The SW ignores a `FLOW_STEP_RESULT`/`FLOW_READY` whose `turn` does not match (READY carries the NEW turn number).
- Only one loop iteration in flight per tab: re-read the session and re-check `status` after every `await` (a run token per tab; a stale run stops at its next check).
- `FLOW_HELLO` while `settling` -> run the turn. While `awaiting_action` (user navigated without a watcher event, e.g. back button or typed URL) -> record outcome `page_changed`, turn++, run the turn. While `observing`/`thinking` -> restart the current turn. While `error` -> re-run the turn (a reload acts as "Try again"). The HELLO reply always includes the session summary so the widget restores itself immediately.
- Content sends `FLOW_HELLO` only after `document.readyState === "complete"` AND the DOM is quiet for 500 ms (max wait 4 s).
- `FLOW_STOP` clears the session from any state and sends `FLOW_ENDED`.
- Errors (backend down, timeout, invalid response): `FLOW_ERROR {message, retryable}`; the widget shows "Try again" / "फेरि प्रयास गर्नुहोस्" -> `FLOW_RETRY` re-enters OBSERVING with the same turn.
- Max 40 turns -> `FLOW_ERROR {message: "This is taking longer than expected. Let's start over.", retryable: false}`, clear session.
- `chrome.tabs.captureVisibleTab` is rate-limited to 2 calls/s. Never call it twice within 600 ms. Screenshot clamped to max width 1024px JPEG quality 70 for stage wifi.
- If `chrome.tabs.sendMessage` fails because no content script is loaded yet (page loading), do not error: leave the status and let `FLOW_HELLO` resume.
- A turn in a background tab pauses (captureVisibleTab would shoot the visible tab) and resumes on `tabs.onActivated`.
- Content replies `element_missing` when the target is gone or `location.href` differs from the scan's URL (the page moved on while thinking), so a stale step is never shown; the SW records `page_changed` and re-plans.
- Closing a tab clears its session.

## 6. Contracts (binding)

### 6.1 Shared types

```ts
type Lang = "ne" | "en";

type ElementRole =
  | "button" | "link" | "textbox" | "checkbox" | "radio" | "combobox" | "tab"
  | "menuitem" | "option" | "switch" | "other";

type ElementInfo = {
  id: number;            // 1..N, unique per scan, matches the number drawn on the screenshot
  role: ElementRole;
  label: string;         // best human label, trimmed, max 80 chars ("" if none)
  inputType?: string;    // for <input>: "email" | "password" | "text" | ...
  hasValue?: boolean;    // for typeable elements: true if non-empty. NEVER the value itself
  focused?: boolean;
  checked?: boolean;     // checkbox/radio/switch; tab: aria-selected (the open tab)
  rect: { x: number; y: number; w: number; h: number }; // viewport CSS px, rounded ints
};

type PageInfo = {
  url: string;
  title: string;
  viewport: { width: number; height: number };
  devicePixelRatio: number;
  scrollY: number;
  scrollMaxY: number;
};

type StepAction = "click" | "type" | "scroll" | "info" | "show";

type Step = {
  action: StepAction;
  elementId: number | null;      // required for click/type/show; null for scroll/info
  scrollDirection: "up" | "down" | null; // required for scroll; null otherwise
  instruction: string;           // shown to the user, ALWAYS in req.lang. Plain language, max ~20 words
  done: boolean;                 // goal achieved. Then action is "info" (no element) or "show" (points at the answer)
  confidence: "high" | "medium" | "low";
  reasoning: string;             // ONE short sentence, logs only, never shown
};

type StepOutcome =
  | "completed"          // user did the asked action on the target
  | "clicked_elsewhere"  // user clicked a DIFFERENT interactive element (not Flow Arrow UI, not plain text/background)
  | "scrolled"
  | "confirmed"          // "I did it" / "बुझें" (info) or "Got it" (show)
  | "page_changed"       // URL changed or target detached without a prior outcome
  | "target_covered";    // target stayed covered by something else (popup, modal, ad) for 400 ms

type HistoryEntry = {
  turn: number;
  action: StepAction;
  instruction: string;
  elementLabel: string | null;
  outcome: StepOutcome;
  url: string;
};

type Session = {
  sessionId: string;
  tabId: number;
  goal: string;
  lang: Lang;
  speak: boolean;                // TTS toggle from the widget
  status: "observing" | "thinking" | "awaiting_action" | "settling" | "error" | "done";
  turn: number;                  // starts at 1
  history: HistoryEntry[];       // send the last 6 to the backend
  currentStep: Step | null;
  currentElementLabel: string | null;
  startedAt: number;
  // SW-internal bookkeeping (never sent to content or the backend):
  stepUrl: string | null;
  outcomeAt: number | null;
};

type StageTimings = {
  settleMs?: number;
  scanMs: number;
  captureMs: number;
  marksMs: number;
};
```

### 6.2 Backend HTTP API

`GET /health` -> `200 {"ok": true, "provider": "gemma", "model": "<id>"}`.

`POST /next-step` (JSON body, max 8 MB)

```ts
type NextStepRequest = {
  sessionId: string;
  turn: number;
  goal: string;
  lang: Lang;
  page: PageInfo;
  elements: ElementInfo[];       // max 100
  history: HistoryEntry[];       // max 6, oldest first
  screenshot: string;            // base64 JPEG, NO "data:" prefix, marks drawn, max width 1024 px
  timings?: StageTimings;
};

type NextStepResponse =
  | { ok: true; step: Step; latencyMs: number; provider: string; model: string }
  | { ok: false; error: string; retryable: boolean };
```

Server-side validation after the provider answers (`decide.ts`):
- `click`/`type`/`show` with an `elementId` not in `elements` -> retry ONCE with note "Element N does not exist. Pick from the list." Still invalid -> fallback Step `{action:"info", elementId:null, confidence:"low", instruction: lang=="ne" ? "अर्को कहाँ थिच्ने भन्ने पक्का भएन। स्क्रोल गर्नुहोस् वा लक्ष्य खुलाउनुहोस्।" : "I'm not sure where to click next. Try scrolling, or tell me more about what you want.", done:false}`.
- `scroll` toward an edge the page is already at -> same retry path.
- `type` on a non-textbox/combobox -> accept, log a warning.
- `done: true` whose text says sorry / not available / can't -> one retry, never accepted as done.
- HTTP 200 for model-level problems (`ok:false`), 400 malformed request, 500 crashes only.

`POST /transcribe`: body = raw audio bytes (`Content-Type: audio/webm`), max 5 MB. Response `{ ok: true, text: string, lang: Lang, latencyMs: number } | { ok: false, error: string }` (`error` is `voice_helper_down`, `voice_timeout`, `audio_too_large`, `audio_empty`, or `whisper_http_<status>`). The backend forwards to the Nepali Whisper container (`WHISPER_URL`, default `http://localhost:8790`), 15 s timeout (Nepali model is larger than English), and never writes audio to disk.

No CORS headers needed for the extension (host permission `BACKEND_URL/*`).

### 6.3 Extension messages

All messages are `{ type: string, ...payload }`.

Content -> Service worker (`chrome.runtime.sendMessage`):

| type | payload | SW response |
|------|---------|-------------|
| `FLOW_START` | `{ goal, lang, speak }` | `{ ok: true }`, starts the loop for `sender.tab.id` (replaces any session in that tab) |
| `FLOW_HELLO` | `{ url }` | `{ session: { goal, lang, speak, status, turn } \| null }` then acts per section 5 |
| `FLOW_STEP_RESULT` | `{ turn, outcome }` | `{ ok: true }` |
| `FLOW_READY` | `{ turn }` | `{ ok: true }` (DOM settled on the same page after an outcome) |
| `FLOW_STOP` | `{}` | `{ ok: true }`, clears session, then sends `FLOW_ENDED` |
| `FLOW_RETRY` | `{}` | `{ ok: true }`, re-enters OBSERVING |
| `FLOW_VOICE_TOGGLE` | `{}` | `{ ok: true }` mic button pressed (same as `Alt+X`) |
| `FLOW_SPEAK_TOGGLE` | `{ speak }` | `{ ok: true }` speaker button toggled |

Service worker -> Content (`chrome.tabs.sendMessage(tabId, ...)`):

| type | payload | Content response |
|------|---------|------------------|
| `FLOW_PREPARE_CAPTURE` | `{ turn }` | Hides ALL Flow Arrow UI (host `visibility:hidden`), waits 2 animation frames, scans, replies `ScanResult`. Stays hidden until `FLOW_THINKING`/`FLOW_STEP`/`FLOW_ERROR`/`FLOW_ENDED`. |
| `FLOW_THINKING` | `{ turn, goal, lang }` | Un-hides UI, widget shows "Looking..." / "हेर्दै..." |
| `FLOW_STEP` | `{ turn, step }` | Renders overlay, arms watcher, speaks instruction if session.speak. Replies `{ ok: true }` or `{ ok: false, reason: "element_missing" }` (SW then records `page_changed`). |
| `FLOW_DONE` | `{ message }` | Clears overlay, widget "You did it!" / "सफल भयो!" + message for 3 s, then collapses to the launcher |
| `FLOW_ERROR` | `{ message, retryable }` | Un-hides UI, widget error state |
| `FLOW_ENDED` | `{}` | Un-hides UI, clears overlay, widget idle (collapsed) unless the goal box is open |
| `FLOW_TOGGLE_VOICE` | `{}` | From `Alt+X`: open the widget if closed, then behave like the mic button |
| `FLOW_VOICE_STATE` | `{ state: "recording" \| "transcribing" \| "idle" \| "error", text?: string, error?: string }` | Widget mic UI. On `idle` with `text`, fill the box and auto-send (`FLOW_START`) |

```ts
type ScanResult = { scanId: number; page: PageInfo; elements: ElementInfo[] };
```
Content keeps `Map<number, Element>` for the latest scan only; `step.elementId` resolves against it.

Service worker <-> Offscreen document (`chrome.runtime.sendMessage` with `target: "offscreen"`):

| type | payload | reply |
|------|---------|-------|
| `OFFSCREEN_RECORD_START` | `{}` | `{ ok: true } \| { ok: false, error: "mic_denied" \| "no_mic" \| string }` |
| `OFFSCREEN_RECORD_STOP` | `{}` | `{ ok: true, text, lang } \| { ok: false, error }` (offscreen POSTs the audio to `/transcribe` itself) |

## 7. Scanner rules (`content/scanner.js`, Person A)

Interactive candidates only (no text landmarks in the hackathon build):
`a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=link], [role=checkbox], [role=radio], [role=tab], [role=textbox], [role=combobox], [tabindex]:not([tabindex="-1"])`

Keep an element only if ALL are true:
1. Not inside `<flow-arrow-root>`.
2. Rect `width >= 4`, `height >= 4`, intersects the viewport.
3. Computed style visible (`display`, `visibility`, `opacity > 0.05`); not `disabled`; no `aria-hidden="true"` on itself or an ancestor.
4. Topmost: `elementFromPoint` at the center of the visible rect hits the element or a descendant. Covered elements (behind a modal) are dropped.

Then:
- **De-duplication:** of a nested pair whose rects overlap by more than 85% (of the smaller one), keep the outer element, except that a textbox always wins.
- **Label priority** (trimmed, max 80 chars): `aria-label`, `aria-labelledby` text, `<label for>` or wrapping `<label>`, own inner text, `placeholder`, `title`, first `<img alt>`, `value` of submit/button inputs, `name`.
- **Role:** an allowed explicit `role` attribute wins; else `a` -> link, `button` -> button, `input` by type (submit/button/reset -> button, checkbox, radio, else textbox), `select` -> combobox, `textarea` -> textbox, else other.
- **State:** `hasValue` for textbox/combobox only; `checked` for checkbox/radio (and `aria-selected` for tabs); `focused` when it is the active element.
- **Ordering and cap:** document order; above 100 elements the 100 largest are kept, back in document order.

## 8. Set-of-Marks drawing (`sw/marks.js`, Person B)

1. `captureVisibleTab(windowId, {format:"jpeg", quality:70})`.
2. Decode to `ImageBitmap`; `scale = bitmap.width / page.viewport.width`; output width `W = min(1024, bitmap.width)` (1024 keeps stage-wifi latency down; 1280 is the accuracy ceiling for later).
3. Draw the bitmap on an `OffscreenCanvas`; per element a 2 px stroke in an 8-color cycle; label tag with a white bold number.
4. **Tag placement:** all boxes first, then all tags on top. A tag never overlaps another tag. Inside top-left preferred for boxes at least 28x18 px; tiny/single-line boxes get outside tags (left, above, right, below) so the tag does not cover the first letters.
5. Encode `image/jpeg` quality 0.7 -> base64 without prefix.

## 9. Overlay spec (`content/overlay.js`, Person A)

Tunables in `content/config.js`:

```js
FlowArrow.config = {
  dim: 0.52,
  dimColor: "20,18,56",
  ringColor: "#FFD23F",
  ringWidth: 4, ringPad: 7, ringRadius: 12,
  arrowScale: 1.4,
  arrowNearOpacity: 0.3,
  nearPx: 60, farPx: 250, farMs: 2000,
  glideMs: 800,
  captionMaxWidth: 330, captionGap: 14,
  completeMs: 400,
};
```

- **Ring:** `border: ringWidth solid ringColor`, radius `ringRadius`, `ringPad` around the element (clamped inside the viewport), spotlight via `box-shadow: 0 0 0 9999px rgba(dimColor, dim)` plus a soft glow that pulses until the user's mouse is near. Never captures clicks (`pointer-events: none`).
- **Arrow:** SVG arrow in ring color with dark outline and drop shadow. Glides (`glideMs`, `cubic-bezier(.3,.7,.2,1)`) from last position (or widget logo on first step) to 62%/55% into the ring. Fades to `arrowNearOpacity` when the real cursor is within `nearPx`; back to solid beyond `farPx` for `farMs`.
- **Caption:** card in ring color, dark text, bold 19 px, `font-family: "FlowArrow Atkinson Hyperlegible", "Noto Sans Devanagari", system-ui, sans-serif`, max width 330 px, eyebrow "Step N" / "चरण N". Placement: below, above, right, left; first fit that covers neither ring nor widget wins.
- **Tracking:** `requestAnimationFrame` loop re-reads the target rect so ring, arrow and caption follow scroll and layout shifts.
- **Completion:** ring turns green with a check badge while the dim lifts (`completeMs`), then fades.
- `info`: no ring or arrow; centered card with instruction + "I did it" / "मैले गरें". `show`: ring + caption with "Got it" / "बुझें" (no arrow). `scroll`: large animated arrow at bottom/top edge + caption.
- `prefers-reduced-motion: reduce`: no glide or pulse, fades only.
- **Widget** (`content/widget.js`): launcher = 56 px navy circle with arrow logo. Open: 340 px navy card, goal textarea with NE/EN toggle row above it, mic button inside bottom-right corner, speaker toggle, Close + Send (yellow). Thinking and guiding share one 320 px pill ("Looking..." / "हेर्दै..." + goal, Stop). Done: yellow card with check. Error: navy card with Try again. The widget never covers the current target: if the pill overlaps the target, it moves to the bottom-left corner.

## 10. Watcher rules (`content/watcher.js`, Person A)

Armed per step. First matching rule reports ONE outcome immediately via `FLOW_STEP_RESULT`, clears the overlay, disarms, then waits for settle and sends `FLOW_READY { turn: turn + 1 }` if the page is still alive.

| Step action | Outcome rules |
|-------------|---------------|
| `click` | Capture-phase `click` on `window`: inside the target -> `completed`. Inside a different interactive candidate and not Flow Arrow UI -> `clicked_elsewhere`. Clicks on plain text/background ignored. `change` on a select/checkbox/radio target also counts as `completed`. |
| `type` | `focusout` from the target or `Enter` inside it, AND the target has a value -> `completed`. Click elsewhere -> `clicked_elsewhere`. |
| `scroll` | `scroll` on window or any element (capture) -> debounce 700 ms -> `scrolled`. |
| `info` | "I did it" / "मैले गरें" -> `confirmed`. |
| `show` | "Got it" / "बुझें" -> `confirmed`. If `step.done` is true the session ends with "You did it!" / "सफल भयो!". |
| all | URL change (poll `location.href` every 500 ms) -> `page_changed`. Target detached, or 0x0 for 400 ms -> `page_changed`. Target covered continuously for 400 ms -> `target_covered`. |

- Flow Arrow UI never counts (`event.composedPath()` includes the `<flow-arrow-root>` host).
- Wait for settle: `MutationObserver` on `document.body` quiet for 400 ms, max 2.5 s. If the page navigates, the new page's `FLOW_HELLO` takes over.
- Everything torn down on disarm.

## 11. Prompting (`server/prompt.ts`, Person B)

System prompt (bilingual core):
- Guide a possibly elderly, low-vision, or non-technical user. Exactly ONE next step.
- The request carries `GOAL` plus `LANG: ne|en`. Write `instruction` ALWAYS in that language. Element labels stay in page language: quote the English label inside Nepali text, e.g. `पहेँलो "Pay Bill" बटन थिच्नुहोस्`.
- Only point at numbers from the ELEMENTS list. Never invent a number.
- Never ask for a password; point at the password box ("Type your password here." / "आफ्नो पासवर्ड यहाँ लेख्नुहोस्।").
- Popups covering the page get closed first (X / "No thanks" / "Maybe later"), unless the popup is the goal.
- `hasValue: true` means the user already typed there; move on. `checked` tells checkbox/tab state.
- Recovery: always work toward the ORIGINAL goal from the CURRENT screen. Never scold.
- Sign in first when the goal needs an account; personal records live in the account menu.
- Not visible -> `scroll`. Off-page action (phone, email code) -> `info`.
- Question goals ("what's my balance?" / "मेरो ब्यालेन्स कति छ?"): navigate there, then `show` the element containing the answer with `done: true` and an instruction stating the answer.
- Goal already achieved -> `done: true`, `action: "info"`, short congratulation in req.lang.
- Unsure -> `confidence: "low"` + `info`; never point at a random element.
- Instruction style: start with a verb, mention a visual cue, max ~20 words.
- `reasoning` is logs-only, one short sentence.

Generic notes appended when they apply: `TODAY: <date>`; popup note (short list with dismiss button means popup open); repeat note (same step 3x or 3+ scrolls); filled-form note (all boxes filled after last click -> error stale, click submit); emptied-fields note (HISTORY-typed box now empty, e.g. after reload -> type again).

Model config: JSON only via response schema; `temperature: 0`; `thinking_level` minimal (A/B 2026-10-09: minimal beats thinking-off on speed, ~3.3s vs ~5.0s avg, at equal accuracy); no max-output cap (thinking tokens count toward it - truncating risks broken JSON); `maxTokens` 300. Parse with `parseStepText` (strip fences, first `{...}` block), validate with `schema.ts`; one retry on failure.

Nepali cost note: Devanagari costs ~2x English tokens on this model family. History capped at 6 and screenshot at 1024px keep turns affordable.

## 12. Voice pipeline (Person C + thin Person B forwarder)

`Alt+X` (manifest command `toggle-voice`, suggested key `Alt+X`) or the mic button:
1. Idle -> widget opens, SW ensures offscreen document exists, sends `OFFSCREEN_RECORD_START`; widget shows recording state ("Listening... press Alt+X or the mic to finish" / "सुन्दैछु...").
2. Recording -> stop: `OFFSCREEN_RECORD_STOP`; offscreen stops `MediaRecorder` (`audio/webm;codecs=opus`), releases mic, POSTs blob to `/transcribe`, replies `{text, lang}`; widget shows "Got it, one moment..." then fills the box and auto-sends. Recording under 1.5 KB counts as "nothing said".
3. Guiding -> `Alt+X` stops the current task (`FLOW_STOP`) and starts recording a new goal.
4. Safety cap: auto-stop after 30 s. One recording at a time. No silence detection, no wake word.
5. Mic permission: install opens `welcome/welcome.html`, asks via `getUserMedia` once for the extension origin. On `NotAllowedError`, reopen welcome tab and show "Please allow the microphone in the new tab."
6. STT service: `server/voice/`, Python + `faster-whisper` Nepali fine-tune (`whisper-small-nepali-ct2`, `compute_type=int8`, `beam_size=5`, `language="ne"`, `vad_filter=True`). Model downloaded at image build time so it runs offline. Published on `127.0.0.1:8790`. Timeout 15 s (larger model than English base).
7. TTS: `extension/content/speech.js`, browser `speechSynthesis` only. `speak(text, lang)` picks a `ne-NP` voice if `lang=="ne"` else `en-US`; cancels on `FLOW_ENDED`/`FLOW_STOP`/toggle off. No server involvement.
8. Friendly errors: "Voice helper isn't running" (Whisper down), "Flow Arrow helper server is not running" (backend down).

## 13. Verification strategy (Person C)

- **Backend:** `server/scripts/try-fixture.ts` replays fixtures without Chrome. Every real request is logged with the exact marked screenshot the model saw; any failure can become a fixture.
- **Robot tester** (`scripts/e2e/`): loads the REAL unpacked extension into Playwright Chromium and plays a user who does whatever the arrow points at (real mouse/keyboard at the ring center via CDP, which can see into the closed shadow root). `suite.mjs --smoke` checks the bank HERO goal + 1 "tell me" goal; a failed run saves extension logs to `.out/fail-*.log`. `voice.mjs` tests Nepali voice with fake mic, `visual.mjs` screenshots overlay states. The robot only drives our own demo apps, never real third-party sites.
- **By hand:** Windows Chrome on the mock bank app, one Nepali + one English goal each.
- **Debug:** `DEBUG` const in `content/main.js` draws scanner marks on the live page. `[FlowArrow]` = content console, `[FlowArrow:sw]` = service worker log.

## 14. Demo app contract (details in `docs/MOCK-APPS.md`, Person C)

- Hub `http://localhost:3000`, Bank `:3001`, from `docker compose up -d --build` in `demo-apps/`.
- `/reset` wipes state and redirects to `/`.
- No Flow Arrow hints; semantic HTML; every button/field/icon-button has an accessible name.
- Demo login: username `eluu`, password `1234`, name Edwin Luu.
- Bank HERO goals (must work end to end, EN + NE): pay the credit card bill starting logged out; check the checking balance.
- Bottom-right corner kept clear for the widget (no sole action in a fixed bottom-right element).

## 15. Build order (12-24h)

- **H0-1 (all):** freeze this doc. B verifies hosted Gemma 4 key with one fixture screenshot (done 2026-10-09: bake-off winner `gemma-4-26b-a4b-it`). C boots Hub+Bank. A loads empty extension shell.
- **H1-4:** A: scanner + static ring + widget skeleton against `server/stub.json`. B: `/next-step` live on 2 fixture screens. C: Nepali Whisper transcribes 3 samples + demo login works.
- **H4 check:** fake-step full loop (no AI): goal -> scan -> ring -> outcome -> settle.
- **H4-8:** real loop wired, Nepali captions, TTS toggle, error states.
- **H8 check:** 2 goals end to end EN + NE. Freeze features after this; bugfix only.
- **H8-12:** rehearse 90-sec demo (C drives, A/B fix blockers only).
