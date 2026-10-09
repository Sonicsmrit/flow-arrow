# Journal Fragment Template

Copy this file to a new file per commit. Never edit an existing fragment.

Filename: `notes/journal/<UTC-timestamp>-<owner>-<slug>.md`
Example: `notes/journal/20261009-0827-c-journal-template.md`
Owner is `a`, `b`, or `c`. Timestamp is `date -u +%Y%m%d-%H%M`.

Stage the fragment in the SAME commit as the code change.

```md
# <commit subject, same as git commit message>

- What: one or two sentences on what changed.
- Why: why it was needed.
- Test: what you ran and the result (e.g. `suite.mjs --smoke` pass, fixture replay 3/3, hand test on :3001).
- Contracts touched: no (or `PROPOSAL: <diff>` - then stop and wait for human approval).
- Next/Blockers: what comes next, or what blocks you and who owns it.
```

Rules:
- Five lines, plain and factual. No em-dashes, use a plain dash.
- Never write keys, tokens, tunnel URLs, or passwords in a fragment.
- One fragment per commit, always a new file.
