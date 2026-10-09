# Bake off Gemma 4 models on AI Studio key, pick winner

- What: ran /tmp/bakeoff/bakeoff.py (6 public cases, identical inputs per model) + rethink.py A/B (thinking minimal vs off on winner). Key exposes exactly 2 Gemma 4 models out of 62. Set GEMMA_MODEL=gemma-4-26b-a4b-it in server/.env (gitignored, not committed).
- Why: pick the fastest accurate model for the extension before wiring providers/gemma.ts.
- Test: bake-off results - 26b-a4b-it 6/6 acc, p50 ~3-5s, 0 failures; 31b-it 4/4 + 2 timeouts, p50 28s (disqualified on latency); flash-lite baseline 6/6, p50 8.27s (slower + not Gemma 4). Thinking minimal BEATS thinking off on both speed (~3.3s vs ~5.0s avg) and equal accuracy - use thinking_level minimal, temperature 0. Bank cases auto-skipped (demo app not up yet).
- Contracts touched: no.
- Next/Blockers: wire providers/gemma.ts with winner knobs, confirm via npm run try on a fixture. No blockers.
