# Add schema.ts + prompt.ts (contracts + bilingual prompt)

- What: server/schema.ts (Lang, Step without next, caps 100/6, request/step validation, balanced-brace parser) + server/prompt.ts (rules 1-17 bilingual, bank-only nouns, LANG line, 4 helper notes, Nepali few-shot example) + tsconfig.json + package-lock.json.
- Why: Phase 1 foundation; sec 6 frozen from here, changes need human approval.
- Test: tsc --noEmit clean; 13/13 smoke checks (ne request valid, LANG line, bad lang/101 els/7 hist/data-prefix rejected, id normalization, confidence default, scroll-edge guard, unknown id).
- Contracts touched: no (this ESTABLISHES sec 6).
- Next/Blockers: providers/gemma.ts with winner knobs, then try-fixture verify EN+NE. No blockers.
