# Handoff to Claude — CollabFit foundation

Repository: AnthonyKY/Duo-fit
Branch: feat/collabfit-foundation
Base: main

## Current delivery
Non-breaking architecture and product foundation; typed domain contracts and staging-only SQL draft.
**Not** a deployed social app; no auth, chat, push or calls are live.
Existing index.html is unchanged. main is unchanged.

## Review instructions
1. Fetch main and feature branch; inspect all changed files.
2. Identify bugs, missing constraints and authorization flaws before implementing.
3. Fix SQL security: secure membership invitation and acceptance RPCs, owner lifecycle, couple capacity under concurrency, member visibility rules, and media access. Test with at least two distinct users.
4. Decide whether to extract the existing training engine or use a migration adapter. Preserve exact user data, exercise behavior, locale, Tanita calculations, and offline behavior.
5. Build modular React/TypeScript app in apps/web with real integration tests. Keep legacy static app accessible until parity is proven.
6. Implement in small PRs: identity/avatar; private workspaces; chat/photos; workout notifications; calls/live last.
7. Implement real, not mock, persistence; do not claim push/video works unless tested on target devices.
8. Require explicit confirmation before enabling production Supabase or changing deployment.
9. Do not put credentials in Git, and do not merge into main without approval.
10. Report test results, screenshots, known limitations and migrations.

## Suggested acceptance test matrix
- Existing DUOFIT data and workouts unchanged in legacy app.
- Couple rejects third member, including simultaneous joins.
- Uninvited user cannot join or enumerate members.
- Removed member loses access to chat and media immediately.
- Two phones see authorized messages in real time.
- Opted-out member does not receive workout notifications.
- Failed upload and offline send have retry without duplicates.
- User can revoke photo, leave workspace, delete profile.
- iPhone Safari/PWA push limitations documented and tested.
