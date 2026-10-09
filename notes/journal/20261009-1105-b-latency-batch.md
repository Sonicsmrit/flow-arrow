# Latency batch: gap gate ships, cap revert, model flake documented

- What: gap gate 4000->2500ms (index.ts) + lesson comments (gemma.ts). Prompt trim FULLY reverted (prompt.ts identical to HEAD). Cap 500 reverted to 1000.
- Why: A/B demanded by empty-instruction failures. Isolation result: cap 500 caused schema-valid-but-empty instructions (3/3 NE fails); examples falsely accused then exonerated (fails persisted through full restore); final proof: NE passes on committed-equivalent code. Verdict: intermittent model-side flake bursts (also 6 Google 500s today), not our code. Mitigation already in place (parse rejects empty, retry once, retryable error to widget).
- Test: tsc clean. Exit proof on final code: EN 3.2s correct + NE 3.5s perfect Nepali. Gap gate live-measured 4300ms floor respected. Zero 429s across ~25 batch calls (mixed spacing) - gate+backoff holding.
- Lesson: never tune two knobs at once; temp-0 is NOT deterministic across calls (reasoning text varies) - identical inputs can flip, so single-sample verdicts are lies. Test-shell hygiene: kill-by-grep hangs sessions; use exact pids, setsid for daemons.
- Live calls this batch: ~25 spaced. Backend left running for A/C.
- Contracts touched: no.
- Next/Blockers: H4 with A+C. No B blockers.
