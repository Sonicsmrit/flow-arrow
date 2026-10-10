# Stop widget keystrokes reaching the page

- What: dock stops keydown, keyup, keypress propagation so typing a goal never triggers page shortcuts or fields.
- Why: typing in the goal box also typed into the page behind it.
- Test: node --check clean, hand-test typing on a page with a focused field.
- Contracts touched: no.
- Next/Blockers: reload extension and retest typing.
