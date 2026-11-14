# ADR 0001 — Keep DUOFIT as is; build CollabFit around it (strangler pattern)

Status: accepted (14 Nov 2026)

Context: DUOFIT (index.html) holds the training engine — progression, variety, time budget, timers, body composition —
covered by about 580 checks run in Chromium and WebKit. CollabFit adds accounts and sharing.

Decision: no rewrite and no extraction of the training engine now. CollabFit is a separate React/TypeScript app
(apps/web) that links to DUOFIT and reads its local data through a read-only bridge (`packages/domain/src/legacy.ts`).
Workout "started / completed" moments are derived from that data with stable references; nothing else leaves the phone.
The engine will be extracted into `packages/training-legacy` piece by piece, only behind the existing DUOFIT tests used
as characterisation tests, when a feature needs it in the new app.

Consequences: zero risk for current users; two apps for a while; the new app must be served from the same site as DUOFIT
to read its data (browsers isolate storage per site).
