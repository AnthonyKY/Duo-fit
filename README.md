# Duo-fit / CollabFit

- **DUOFIT** — the training app in use today: `index.html`, `sw.js`, `manifest.webmanifest` at the root, published by
  GitHub Pages from `main`. Tests: `tests/` (see tests/README.md).
- **CollabFit** — the shared version in progress: `apps/web` (React + TypeScript), `packages/domain` (rules, no framework),
  `supabase/` (schema, row level security, tests). Status: docs/STATUS.md. Decisions: docs/adr/.

```
npm install
npm run check        # strict type check, unit tests, web build, web tests (iPhone SE + 16 Plus)
npm run test:db      # schema + attack tests on a throw-away PostgreSQL (needs the PostgreSQL server binaries)
```
