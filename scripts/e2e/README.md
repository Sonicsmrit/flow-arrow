# Flow Arrow - Robot Tester

Person C owns this folder. suite.mjs --smoke must pass before any demo.

## Setup (Windows)

```
cd scripts/e2e
npm install
```

Browsers need ~500MB free. If C: is full, point the bundle at another drive:

```
$env:PLAYWRIGHT_BROWSERS_PATH='D:\playwright-browsers'
npx playwright install chromium
```

(`setup.sh` is the WSL/Linux path with the .debs workaround; not needed on Windows.)

Bundled Chromium is required: branded Google Chrome ignores
`--load-extension`, so the unpacked extension can never load there.

## Run

```
node suite.mjs --smoke            # widget offline + HERO/tell-me when backend is up
node run-goal.mjs http://localhost:3001/ "pay my credit card bill"
node visual.mjs                   # .out/shots/v-*.png widget states
node voice.mjs                    # transcribe pipe + whisper health
```

Backend URL defaults to http://localhost:8787, override with
`config.local.json` `{"BACKEND_URL": "..."}` (gitignored).
Bank must be up on :3001 (compose or `npm run dev -w bank` from demo-apps/).
Exit codes: 0 pass, 1 fail, 2 backend unreachable (offline scenarios only).
