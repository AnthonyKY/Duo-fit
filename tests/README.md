# DUOFIT automated tests

Browser suites (Playwright, iPhone emulation) simulate iPhone Safari strictly (see `iosinit.js`):
- typing only fires `input` events — `change` never reaches text fields (iOS does not blur a field when a button is tapped);
- native `alert`/`confirm` are blocked and recorded (the app must not use them).

Suites other than v2.js and variety.js switch to the classic list mode and fixed exercises (no back check-in, small increments) so they keep
testing the core flows; v2.js uses the real defaults.

Run from the repo root:

```
python3 -m http.server 8766 &              # serve index.html
node tests/full.js                         # whole app: sessions, progression engine, history, progress, tracking, profiles, export/import
node tests/nut2.js                         # profile, nutrition, auto-adjustment, adaptive sessions, measurements
node tests/ios.js                          # iPhone flows: ✓, rest timer, session clock, Terminer, Abandonner, history edit/delete
node tests/all.js                          # every workout, guide/swap everywhere, library filters, planner, theme/language,
                                           # charts, corrupted/old storage, 300-session performance, DST, small/large screens
node tests/v2.js                           # V2: offline, back check-in, warm-up, machine settings, real increments,
                                           # guided mode, machine busy / replace today / time left, next-time targets
node tests/variety.js                      # variety: drawn exercises per slot (safe pools), 4-week main-lift blocks, 🎲 reroll,
                                           # not-in-my-gym exclusions, pins, warm-up checklist, time budget 30-90 min
node tests/pages.js                        # as GitHub Pages serves it: /Duo-fit/ sub-path, icons, offline cold start, auto-update keeps the workout
node --test tests/session-history.test.cjs # unit tests (no browser): durations, pause, rest per profile, storage full, stale tabs, validation
```

GitHub Actions (`.github/workflows/tests.yml`) runs every suite on each push to main, claude/** and astra/**.
