# Flow Arrow - Build Log

Checkpoint rollup, rewritten by Person C at H4/H8/H12 from `notes/journal/` + `git log`. Agents read this for state, the journal for detail.

## H1 - Person C first pass (2026-10-10 morning)

### Done
- Himal Bank + Demo Hub boot on :3001/:3000 (`bac96ab`): bank-only compose, Himal rename, himalbank: prefix, bank-only popup settings.
- Nepali Whisper container files + browser TTS wrapper (`5e2c16e`): whisper-small-nepali-ct2, lang ne, beam 5, speech.js with maybeSpeak and ne-NP/en-US voices.
- Robot tester skeleton (`scripts/e2e/`): harness, run-goal, suite --smoke, voice, visual adapted to FLOW-ARROW-ROOT and fa-/flow-arrow- selectors.
- B backend live on their LAN for integration day (`f0e44b2`).

### Numbers
- Bank build: shared tsc + bank tsc/vite + hub tsc all clean.
- Dev-server verify: Hub :3000 200 with bank-only settings, Bank :3001 200 titled Himal Bank, /login and /reset 200.
- e2e scripts: 5/5 node --check pass. Smoke live run pending Chromium download + backend reachability.
- Bake-off (B, 2026-10-09): gemma-4-26b-a4b-it 6/6, p50 ~3-5s.

### Known issues
- Docker daemon down on C laptop (WSL2 needs admin reboot); compose build unverified, Whisper image unbuilt.
- B backend unreachable from C network; HERO and tell-me smoke scenarios gated on same-network integration.
- speech.js landed but manifest line pending with A; speaker-toggle forwarding to setEnabled pending with A.
- `gh auth login` token invalid on C laptop; push currently works via stored credentials.

### Next
- C: run suite --smoke widget scenario once Chromium lands; full HERO on integration network.
- A: manifest speech.js line + speaker toggle wiring + live browser test on :3001.
- B: keep backend reachable; confirm whisperStatus flips once C container runs.
- Freeze features after H8 check; rehearse 90-sec demo.
