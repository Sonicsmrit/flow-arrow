# Flow Arrow

**A patient arrow for the web.** Tell Flow Arrow one goal, typed or spoken, in English or Nepali ("pay my credit card bill" / "मेरो क्रेडिट कार्डको बिल तिर्नुहोस्"), and it shows you where to click, one step at a time, on the real website: the page dims, a big arrow glides to the right button, a ring highlights it, and a short caption says what to do in your language. You do the clicking; Flow Arrow looks again after every action until the goal is done. It can also read the caption aloud in Nepali if you turn the speaker on.

Built for people who find websites hard to use: older adults, people with low vision, anyone who freezes at a screen full of buttons, and Nepali speakers who prefer guidance in Nepali. It is not a chatbot. There is no chat window, just one goal box and an arrow.

## What it does

- **One goal, step by step.** Flow Arrow plans a single next step at a time from what is on the screen right now, and never clicks or types for you (it never asks for your password either; it points at the box).
- **Handles real-world mess.** Closes popups and promos first, guides you back after a wrong click, a logout, a reload or the Back button.
- **Answers "tell me" goals.** "What's my checking balance?" / "मेरो ब्यालेन्स कति छ?" navigates there and rings the answer.
- **Nepali + English.** Type or speak in either language. Instructions come back in the same language. Toggle NE/EN in the goal box.
- **Push-to-talk voice.** Press **Alt+X** (or the mic in the goal box), talk in Nepali or English, press again. The microphone is allowed once for Flow Arrow, never per website.
- **Voice output (optional).** Speaker button reads each caption aloud via built-in speech synthesis (`ne-NP` / `en-US`). No server needed.
- **Works on real sites.** Demoed on a mock bank app we built, plus hand tests on common sites.

## How it works

```
 Chrome                                                 Local machine
+-----------------------------------------+           +--------------------------------------+
| Content script (every page)             |           | Backend  server/  (Node 24, :8787)   |
|  scanner  -> numbered element list      |           |   POST /next-step -> prompt ->       |
|  overlay  -> ring, dim, arrow, caption  |           |     Hosted Gemma 4 vision model      |
|  watcher  -> "the user did it"          |           |   POST /transcribe -> Nepali Whisper |
|  widget   -> goal box, NE/EN, mic, Stop |   HTTP    |   logs/ (every request + screenshot) |
|  speech   -> Nepali/English TTS         | <-------> |                                      |
| Service worker: step loop               |           | Whisper  server/voice/ (Docker :8790)|
|  screenshot + numbered boxes            |           |   faster-whisper Nepali, CPU         |
|  (Set-of-Marks)                         |           |                                      |
| Offscreen document: mic (Alt+X)         |           | Demo apps  demo-apps/ (Docker)       |
+-----------------------------------------+           |   Hub :3000  Bank :3001              |
                                                      +--------------------------------------+
```

Each step: the extension screenshots the tab with a number drawn on every button, link and field, and sends the picture plus the numbered list plus the goal language to the model. The model answers with ONE element number and a short instruction in the user's language; the extension rings that element (pixel-exact, from the real page) and waits for the user. Flow Arrow only looks again when something happens. Details and contracts: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Run it

Requirements: Node 24, Docker with Compose, Google Chrome, and a hosted Gemma 4 API key.

1. **Keys.** Copy `server/.env.example` to `server/.env` and fill in `GEMMA_API_KEY`. `.env` is gitignored; never commit it.
2. **Backend.** `cd server && npm install && npm run dev`. The startup line shows the model in use; the next line says whether the voice helper is reachable.
3. **Voice helper.** `cd server && docker compose up -d --build whisper` (the first build downloads the Nepali speech model; after that it runs offline).
4. **Demo apps.** `cd demo-apps && docker compose up -d --build`, then open the Demo Hub at `http://localhost:3000`.
5. **Extension.** In Chrome open `chrome://extensions`, turn on Developer mode, click **Load unpacked** and pick the `extension/` folder. A welcome tab opens: click **Allow microphone** once. After code changes, click reload on Flow Arrow and refresh the page.

Demo login on the mock bank app: username **`eluu`**, password **`1234`**.

**Use it:** click the round Flow Arrow button (bottom right) and type a goal, or press **Alt+X**, say the goal, and press **Alt+X** again. Toggle NE/EN for language, speaker icon for voice output. Try "pay my credit card bill" or "मेरो क्रेडिट कार्डको बिल तिर्नुहोस्" on the bank.

Running Chrome on Windows with the code in WSL works too: load the extension from `\\wsl.localhost\<distro>\<path>\extension`; WSL forwards the localhost ports.

## Test it

- **Robot tester** (`scripts/e2e/`): loads the real extension into Playwright's Chromium and plays a user who clicks wherever the arrow ring is. Set up once with `bash scripts/e2e/setup.sh`, then `cd scripts/e2e && node suite.mjs --smoke` (about 1 minute). One goal: `node run-goal.mjs http://localhost:3001 "pay my credit card bill"`.
- **Voice**, with Chromium's fake microphone: `node voice.mjs`. **Look**, screenshots of every overlay and widget state: `node visual.mjs [--zoom 1.25]`.

The robot only drives our own demo apps and local test pages, never real third-party sites.

## Repository

```
extension/     Chrome extension (Manifest V3, plain JS, no build step)
server/        Node backend, model provider, prompt, fixtures, Nepali Whisper container (voice/)
demo-apps/     Demo Hub + Bank (React, Docker)
scripts/e2e/   Robot tester
docs/          ARCHITECTURE.md (design + contracts), MOCK-APPS.md (what the demo apps do)
```

## Built with

Chrome Extensions (Manifest V3, offscreen documents), Gemma 4 hosted API, faster-whisper Nepali fine-tune, Web Speech Synthesis for TTS, Node.js 24, React + Vite, Docker, Playwright.

Fonts: Atkinson Hyperlegible by the Braille Institute (SIL Open Font License, `extension/fonts/OFL.txt`) + Noto Sans Devanagari fallback for Nepali text.
