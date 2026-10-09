# Add overlay caption with step wiring

- What: added caption plus info plus scroll cards with Nepali eyebrow, wired FLOW_PREPARE_CAPTURE and FLOW_STEP in main, widget avoid helper.
- Why: Person A step 6 needs real backend steps to render against Person B loop.
- Test: reloaded unpacked extension, fake FLOW_STEP renders ring plus caption, PREPARE_CAPTURE returns scan.
- Contracts touched: no.
- Next/Blockers: watcher outcomes part next.
