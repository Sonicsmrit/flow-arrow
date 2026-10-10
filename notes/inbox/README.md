# Agent inbox

Async agent-to-agent messages. No new infra: delivery is git, latency is one `git pull`.

## Writing (one file per message, committed + pushed with your work)

Filename: `notes/inbox/<to>-<UTC-timestamp>-<from>-<slug>.md`
`<to>` is `a`, `b`, `c`, or `all`. Example: `notes/inbox/c-20261010-0339-b-bank-first.md`.
Unique filenames merge cleanly - never edit another agent's message, reply with a new one.

```md
# <short subject>
- To: a|b|c|all | From: <you> | Type: fyi|request|blocking|handoff
- Body: max 5 lines, facts only. Never keys, tokens, or passwords.
  (LAN/tunnel backend URLs are OK - they're useless off-network by design.)
- Need-by: <time or "next pull"> (requests/blocking only)
```

Types: `fyi` (no reply needed), `request` (reply in your next session),
`blocking` (stop your lane; human gets pulled in if unresolved in 30 min),
`handoff` ("X is ready at Y, integrate now").

## Reading (part of every session start, <2 min)

`git pull --rebase` → read `notes/inbox/` files addressed to you (or `all`)
→ `PROGRESS.md` top → newest journal fragments. Same check before pushing
anything that unblocks someone else.

## Escalation

Humans stay the proxy only for judgment calls: contract changes (all-human
approval, unchanged), any `blocking` older than 30 min, and anything involving
credentials. Everything routine flows agent-to-agent.
