# DUOFIT automated tests

Browser suites (Playwright, iPhone emulation) simulate iPhone Safari strictly (see `iosinit.js`):
- typing only fires `input` events — `change` never reaches text fields (iOS does not blur a field when a button is tapped);
- native `alert`/`confirm` are blocked and recorded (the app must not use them).

The original session fixtures select fixed exercises for repeatable progression checks. The rotation suites exercise fresh profiles (balanced variety by default) and the maximum and fixed modes. Browser suites use Playwright 1.56.1 and Chromium. The 20-minute tests count ramp-up sets in the budget and exclude them from completed working volume.

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
node tests/priorities.js                   # the 3 priorities end to end (iPhone SE, /Duo-fit/): variety vs equipment/level/exclusions + pinned
                                           # reference lift and last loads; real 20-min cable-only Back & Arms run; timer, pause, replace after a
                                           # logged set, shortening, airplane-mode relaunch, finish offline, abandon, history, pre-update data
node tests/backup.js                       # backup copy: weekly reminder (✕ = hidden 7 days), share sheet with a .json file, cancel,
                                           # download fallback, restore from that file, bad file refused
node tests/erase.js                        # erasing a profile: what goes, type EFFACER, other profile untouched, 7-day undo
node tests/coach.js                        # the requested scenarios: 'Lancer l'exercice' starts the timer, 5:00 target amber after 5:00 / red after
                                           # 5:30, 2 min + 3 min wait + 4 min = 06:00 in summary and History (also offline), next-target advice
                                           # (all sets done, interrupted, load changed) = next pre-fill, add an exercise (equipment, time, today only)
node tests/tanita.js                        # body composition · Tanita: partial + complete readings, measurement conditions kept in the history,
                                           # same-condition comparison, kJ / kg-% typo checks, edit, delete, unfinished form kept across an iOS reload,
                                           # offline relaunch, Him / Her separation, backup restore, old and damaged backups, exercise timers still work
node tests/pages.js                        # as GitHub Pages serves it: /Duo-fit/ sub-path, icons, offline cold start, auto-update keeps the workout
node tests/budget-iphone.js                # 20-minute cable-only plan on iPhone SE, input-only ramp up, offline resume, history and EN
node --test tests/budget.test.cjs          # 324 plan combinations, equipment, exclusions, time allocation, migration and session snapshots
node --test tests/session-history.test.cjs # unit tests (no browser): durations, pause, rest per profile, storage full, stale tabs, validation
```

GitHub Actions (`.github/workflows/tests.yml`) runs every suite on each push to main, claude/** and astra/**.
