# DUOFIT automated tests

Browser suites (Playwright, iPhone emulation) simulate iPhone Safari strictly (see `iosinit.js`):
- typing only fires `input` events — `change` never reaches text fields (iOS does not blur a field when a button is tapped);
- native `alert`/`confirm` are blocked and recorded (the app must not use them).

Run from the repo root:

```
python3 -m http.server 8766 &              # serve index.html
node tests/full.js                         # whole app: sessions, progression engine, history, progress, tracking, profiles, export/import
node tests/nut2.js                         # profile, nutrition, auto-adjustment, adaptive sessions, measurements
node tests/ios.js                          # iPhone flows: ✓, rest timer, session clock, Terminer, Abandonner, history edit/delete
node tests/all.js                          # every workout, guide/swap everywhere, library filters, planner, theme/language,
                                           # charts, corrupted/old storage, 300-session performance, DST, small/large screens
node --test tests/session-history.test.cjs # unit tests (no browser): durations, pause, rest per profile, storage full, stale tabs, validation
```

V2 runs with `node tests/v2.js` (Playwright Chromium). It starts its own HTTP server under `/Duo-fit/` and checks cold offline launch, a version upgrade during a session, strict input-only iPhone interactions, the back check, warm-ups, equipment increments, guided mode, mid-session adaptations and the end summary. The release is usable offline after the service worker finishes the first online visit. With no prior load for an exercise, enter an appropriate working weight. Warm-up and working weights are separate.

The two historical load expectations in `full.js` now use the V2 equipment grid and the 10% jump rule.
