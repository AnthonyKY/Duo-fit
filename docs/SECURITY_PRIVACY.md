# Security and privacy requirements

CollabFit will process workout history and potentially sensitive body-composition and personal information. Design for EU GDPR obligations and data minimization.

- Private by default: workspace members see only expressly shared workout status, not measurements or personal history.
- Membership acceptance required before messaging or status events.
- Couple workspace capacity two; friend workspace membership configurable with a bounded limit.
- Workspace role changes, invitations, blocks and removals must be checked server-side.
- Rate-limit invitations, messaging, media uploads, signaling and login attempts.
- Storage: private buckets, content-type and size validation, non-executable file types, randomized object keys, signed access URLs; remove orphaned files.
- Escape or safely render user content; no raw HTML in chat messages.
- Protect account deletion, exports and email changes with re-authentication.
- Audit permission changes, not message bodies or medical details.
- Data retention policy, privacy notice, consent for workout notifications, age policy, reporting/blocking flows.
- Do not build covert presence indicators or auto-enable camera/microphone.
- Media devices require explicit user action and OS permission.
- Verify GDPR controller/processor agreements and third-party subprocessor locations before launch.

Threat tests: A cannot read B private workouts; removed member cannot read old attachments; revoked invitation cannot join; guessing media URL cannot fetch; unauthenticated cannot enumerate workspaces.
