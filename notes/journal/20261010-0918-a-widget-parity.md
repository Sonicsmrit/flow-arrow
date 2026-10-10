# Match widget and stylesheet to original look

- What: rewrote widget.js as full state machine (idle, open, thinking, guiding, done, error, voice states, draft persist, pill, avoid) and styles.js as full sheet, both Flow Arrow named with NE/EN plus speaker rows.
- Why: UI parity pass showed our panel was a skeleton next to the original mini panel.
- Test: node --check clean on both, zero old class names left.
- Contracts touched: no.
- Next/Blockers: wiring pass for states plus icons next.
