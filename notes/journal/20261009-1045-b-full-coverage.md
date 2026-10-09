# Full B-side coverage: retries, races, error paths proven

- What: closed every gap from the coverage audit. No repo code changes needed - all green as written.
- Test: decide.ts retries 11/11 unit (validation/give-up/mismatch-EN-skipped-NE/done-ambiguous/3-call cap/bilingual fallback, 0 quota). api.js 5/5 (remote URL honored+cached, localhost fallback, non-JSON path). loop.js transitions 9/9 in-memory (record/stale/done-show-ready/hello-page_changed/bg-pause/stop). Gap gate live 4300ms. element_missing→page_changed→replan proven live in SW logs; replan success already proven by Tier 2 t2.
- Incidents: Google returned three 500 INTERNALs in ~15 min; each surfaced correctly as retryable FLOW_ERROR (error path proven 3x by fire). 429 backoff branch still un-triggered all session (no 429s; code-reviewed). Test beds live in /tmp only (fa-harness2/missing, test-decide/api/loop, marks-test).
- Still needs human + C: voice recording path (no mic here) + transcribe happy path (no Whisper container). Everything else on Person B: proven.
- Live calls this round: ~8 spaced. Backend left running for A/C.
- Contracts touched: no.
- Next/Blockers: H4 with A's content + manifest (must include commands block). No B blockers.
