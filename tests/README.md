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
