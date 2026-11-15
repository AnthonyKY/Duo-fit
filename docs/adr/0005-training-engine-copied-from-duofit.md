# ADR 0005 — CollabFit's training engine is DUOFIT's own code, copied verbatim and proven identical

Status: accepted (15 Nov 2026). Context: Invictus decided CollabFit is a separate, complete app (training + social),
to be sold later; DUOFIT stays his own app (ADR 0004). Choices: 1A (workouts follow the account), engine first.

Decision: no hand rewrite of DUOFIT's engine (≈ 1 900 dense lines: progression, variety, time budget, warm-up, back
sensitivity, levels, machine increments). `scripts/extract-duofit-engine.mjs` reads DUOFIT's index.html at a pinned
commit (`packages/training/SOURCE.json`), keeps the calculation code and the data it needs (scope-aware dependency
closure with the TypeScript parser, plus the statements that complete that data, never UI), and writes
`packages/training/src/duofit-engine.generated.js`. A typed API (`Trainer`) wraps it; the two steps DUOFIT does inside
its screens (start a workout, build the saved workout) are mirrored line for line.

Proof: `packages/training/test/characterize.mjs` runs DUOFIT itself in a browser and the copy in Node with the same
random people, histories, dates and random draws: 2 822 / 2 822 identical results on 200 people (CI runs it on every
push). `--check` fails CI when DUOFIT changed and the copy was not regenerated.

Consequences: CollabFit computes exactly what DUOFIT computes, including the 8 corrections of PR #8 (the pinned commit
is that branch; after the merge, re-pin to main). The engine is plain JavaScript inside a typed shell; parts can be
rewritten in TypeScript later, one at a time, behind the same comparison. State is DUOFIT's format (one programme per
person), so a DUOFIT backup can later be imported as a COPY, with Invictus' agreement (ADR 0004).
