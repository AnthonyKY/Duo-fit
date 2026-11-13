# DUOFIT automated tests (Playwright, iPhone emulation)

All suites simulate iPhone Safari strictly (see `iosinit.js`):
- typing only fires `input` events — `change` never reaches text fields (iOS does not blur a field when a button is tapped);
- native `alert`/`confirm` are blocked and recorded (the app must not use them).

Run from the repo root:

```
python3 -m http.server 8766 &   # serve index.html
node tests/full.js   # whole app: sessions, progression engine, history, progress, tracking, profiles, export/import
node tests/nut2.js   # profile, nutrition, auto-adjustment, adaptive sessions, measurements
node tests/ios.js    # iPhone flows: ✓, rest timer, stopwatch, Terminer, Abandonner, history edit/delete
node tests/all.js    # every remaining feature: all workouts, guide/swap everywhere, library filters, planner, theme/language, charts, edge cases, performance
```
