# ADR 0004 — DUOFIT stays for good; its data is only ever copied, with the owner's consent

Status: accepted (15 Nov 2026), decided by Invictus

Context: CollabFit is now usable on the test site. Invictus wants to keep both apps, even after CollabFit launches.

Decision:
- DUOFIT keeps its address (https://anthonyky.github.io/Duo-fit/), its two profiles, workouts and whole history.
  CollabFit never replaces, moves or rewrites it. "Ouvrir DUOFIT" in CollabFit opens that address (tested on the
  deployed test app by following the link).
- If one day DUOFIT data is taken into CollabFit, it is an import of a COPY (for example from DUOFIT's backup file);
  the original stays in DUOFIT, unchanged and usable.
- Explicit agreement from Invictus is required BEFORE any migration or import of his data, and before any merge into
  `main`. Claude and Astra prepare and test; they do not run either step on their own.

Consequences: the read-only bridge (ADR 0001) only works when CollabFit is served from DUOFIT's site; on another
address CollabFit says it sees no DUOFIT data, which is expected. Any import feature ships with a test proving the
original data is byte-for-byte unchanged afterwards.
