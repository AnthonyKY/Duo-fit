# Architecture decision — incremental modular migration

## Current baseline
main is a static PWA with a large index.html and browser-local storage. It is the stable baseline; do not rewrite it in one PR.

## Target layout
```
apps/
  web/                   # Vite + TypeScript + React (new CollabFit client)
    src/
      app/               # router, providers
      features/
        auth/
        profile/
        workspaces/
        workouts/
        chat/
        notifications/
        calls/
      shared/
        components/
        lib/
packages/
  domain/                # framework-free types and rules
  training-legacy/       # progressively extracted DUOFIT training engine
supabase/
  migrations/            # reviewed schema + RLS policies
  functions/             # trusted server operations if required
docs/
  ADR/                   # architecture decisions
```

## Migration strategy
1. Freeze and regression-test the current static app. Keep index.html operational.
2. Introduce typed domain contracts and a separate client; no direct rewrite of training math.
3. Add authentication, private storage and workspace membership; prove RLS with adversarial tests.
4. Add explicit per-user migration from localStorage with preview, backup, idempotency and rollback.
5. Add chat + private image storage; then workout event subscriptions and push.
6. Add calls after signaling, TURN, rate limits, moderation and consent are addressed.
7. Switch deployment only after parity tests, staged rollout and rollback plan.

## Technical decisions
- React + TypeScript + Vite; modular by feature, not by file size alone.
- Supabase Auth, Postgres RLS, Storage, Realtime for collaboration.
- WebRTC for calls; production needs TURN and signaling, potentially a managed SFU for group live.
- iOS web push requires supported browser/PWA installation and user permission; no guarantee of delivery.
- Keep client-side cached workouts available offline; sync with server using stable IDs, timestamps and explicit conflict handling.
- Never put a service-role key in client bundles. Do not use localStorage for sensitive auth tokens unless unavoidable and reviewed.
- Use env variables; secrets stay in the hosting platform or server runtime.
- Enforce authorization in Postgres policies/server, not only UI.
- Add error boundaries, telemetry without health data, CI tests and schema migration checks.

## Deployment
Staging and production must be separate Supabase projects and separate hosting environments. No production migration without backup and tested rollback.
