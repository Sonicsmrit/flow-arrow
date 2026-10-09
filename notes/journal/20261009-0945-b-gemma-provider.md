# Add gemma provider + try-fixture, fix Nepali compliance live

- What: providers/types.ts + gemma.ts (26b-a4b-it, temp 0, thinking minimal, maxOutputTokens 1000, schema-constrained JSON, status-classified errors) + index.ts (single provider, boot refusal without key) + scripts/try-fixture.ts (goal/lang overrides) + @google/genai dep + tsconfig allowImportingTsExtensions.
- Why: Phase 1 Step 1; schema-mode output on 26b was the one unproven combo.
- Test: tsc clean. Live smoke direct vs provider: EN 3/3 correct element+action. NE FAILED twice first (English instruction) -> hardened rule 15 (hard requirement) + trailing LANG reminder in buildUserText -> NE now passes ("Username वा email address को बक्समा टाइप गर्नुहोस्।", correct id). Fix verified live, not assumed.
- Notes: instructions run short (~9 words, label sometimes dropped) - acceptable, revisit if captions feel thin. Key quota is tight (429 after ~8 rapid calls) - space out test calls.
- Contracts touched: no (established by schema/prompt commit; prompt wording hardened, shape unchanged).
- Next/Blockers: decide.ts + logger.ts + transcribe.ts + server.ts, then try-fixture EN+NE. No blockers.
