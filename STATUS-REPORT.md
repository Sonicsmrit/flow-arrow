# Flow Arrow - General Status Report (2026-10-09, evening)

Deadline: tomorrow 4pm. Overall: ~60% built.

## Person A - Extension UI: DONE 9/9

- `f08fa41` widget shell, `5ef268d` icons, `20d5f05` scanner (100 cap),
  `b4447d2` overlay ring, `2f9a4b1` overlay arrow, `e624787` caption + step wiring,
  `949098a` watcher outcomes, `29bfad5` voice glue, `5e52840` welcome + fonts.
- Extra: MIT `LICENSE` added.
- Verified: 9/9 content files + `background.js` + `sw/loop.js` pass
  `node --check`, manifest parses with `main.js` last, zero old-naming
  leftovers, fonts + welcome present.
- Live browser test pending (needs Bank app).

## Person B - Brain + Model: DONE per report

- Server core with guards, Gemma provider with Nepali check,
  service worker loop, commands guard, coverage audit logged.
- To verify: live smoke once Bank exists.

## Person C - Voice + Demo + Show: NOT STARTED (main risk)

- `demo-apps/` README only (needs Hub `:3000` + Bank `:3001`).
- `server/voice/` missing (needs Nepali Whisper on `:8790`).
- `extension/content/speech.js` missing (TTS wrapper).
- `scripts/e2e/` README only (needs smoke + run-goal + voice + visual).
- 7 parts defined: whisper, TTS, hub, bank, robot, checkpoints, show.

## Critical path

1. C boots Hub + Bank (blocks everything).
2. Smoke + 1 EN + 1 NE goal end to end.
3. 90s demo video + backup screenshots.
4. Freeze, bugfix only.

## Risks

- C scope is ~40% of the repo with ~18h left.
- Keep pre-recorded backup plan if live demo slips.
