# Flow Arrow - Build Log

Checkpoint rollup, rewritten by Person C at H4/H8/H12 from `notes/journal/` + `git log`. Agents read this for state, the journal for detail.

## H0 - Scaffold (2026-10-09)

### Done
- Repo live with README, CLAUDE, AGENTS, ARCHITECTURE (sec 6 contracts frozen).
- Skeleton: extension/, server/ (.env.example, package.json, stub.json), demo-apps/, scripts/e2e/.
- Journal protocol adopted: fragment per commit + checkpoint rollups.

### Numbers (bake-off 2026-10-09, /tmp/bakeoff/bakeoff.py + rethink.py, 6 cases, identical inputs)
- MODEL: `gemma-4-26b-a4b-it` | knobs: temperature 0, thinking_level minimal, no max-output cap
- 26b-a4b-it: 6/6 acc, p50 ~3-5s, 0 badJSON/429/timeouts. 31b-it: 4/4 + 2 timeouts, p50 28s (out on latency).
  Baseline flash-lite: 6/6, p50 8.27s (slower, not Gemma 4). Key exposes exactly 2 Gemma 4 models of 62.
- Thinking minimal beats thinking-off (~3.3s vs ~5.0s avg, equal accuracy).
- Bank EN+NE cases skipped (demo app down); re-run via `npm run try` once :3001 is live.

### Known issues
- None yet.

### Next
- B: wire `server/providers/gemma.ts` with these knobs, confirm via `npm run try` on a fixture. (Key verification: done.)
- C: boot Hub + Bank demo skeleton.
- A: widget + scanner skeleton against server/stub.json.
