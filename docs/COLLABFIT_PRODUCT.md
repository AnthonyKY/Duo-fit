# CollabFit — Product contract (draft)
Status: foundation proposal, not a deployed feature.

## Product
CollabFit is a private, collaborative fitness tracker with two workspace modes:
- **Couple**: a private workspace of exactly two accepted members.
- **Friends**: a private workspace of multiple accepted members.

Each person owns their account, workout history, body composition, goals and private measurements. Workspace membership does **not** automatically grant access to private health or body metrics.

## Scope
1. Avatar: generated avatar or user-uploaded profile image, crop/replace/delete.
2. Workspace: invite, accept, decline, leave; couple or friends; role and membership controls.
3. Communication: text messages and image attachments; notifications on opted-in workout start/finish.
4. Calls: one-to-one audio/video and optional group live, after privacy and realtime infrastructure is proven.

## Non-negotiable
- Existing DUOFIT training functionality remains usable while migration is developed.
- No default-public profiles, no public feed, no leaderboard unless separately approved.
- Notifications must be opt-in, muted by default until permission is requested contextually.
- All media private; authenticated time-limited URLs and server-side access checks.
- No recording or storing audio/video calls by default.
- A user can block another member; blocked members cannot message/call.
- A user can export/delete their account data, subject to retention obligations.
- No silent migration of browser-local profiles into another person's account.

## Acceptance
A feature is done only after tests of ownership isolation, two-browser sync, mobile Safari, failed network, duplicate events, revocation, and export/deletion.
