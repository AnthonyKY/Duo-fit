# Audit of PR #5 (feat/collabfit-foundation @725e671) — 14 Nov 2026

Scope: the 6 files Astra added (product, architecture, security docs, `packages/domain/src/types.ts`, the SQL draft).
Verdict: the direction is right (separate client, RLS, private media, opt-in sharing, legacy kept). The SQL draft was
not usable as is: nothing could be created or joined, and several rules it promised were not enforced.

| # | Finding | Severity | Done on claude/collabfit-foundation |
|---|---------|----------|-------------------------------------|
| 1 | No way to create a space, invite, join, leave, remove (no RPC, no insert policy) | blocking | Transactional SECURITY DEFINER functions for every action |
| 2 | Invitations modelled as `status='invited'` rows with a user id: the owner must know the other person's id, i.e. enumerate users | high | Secret link tokens (24 random bytes), only the SHA-256 stored, expiry, max uses, revocation, preview |
| 3 | Couple capacity (2) not enforced, and not safe if two people join at once | high | Capacity checked under a row lock on the space; a race test with two simultaneous joins (fails without the lock — verified) |
| 4 | Profiles readable only by their owner: members could not see each other's name/avatar | functional | Readable by people sharing an active space only |
| 5 | `owner_id` / `author_id` / `user_id` reference `auth.users` without `on delete`: deleting an account is impossible (GDPR) | high | Cascades chosen per table; messages kept anonymous; owner hand-over trigger; empty space deleted |
| 6 | No owner lifecycle (owner leaves → orphan space) | medium | Trigger keeps exactly one active owner or deletes the space |
| 7 | Messages: `image_path` free text (could point to another space's file), empty bodies allowed, `created_at` settable by the client, no delete, no rate limit, no idempotency | high | Path shape + owner checked, trimmed length, column-level insert grant, author-only soft delete, 30/min limit, `unique(author_id, client_id)` |
| 8 | A new member can read the whole history | privacy | Messages / events visible from the join date |
| 9 | No blocks | required by product doc | `user_blocks`; blocked authors hidden; a blocked person cannot join a space of the blocker |
| 10 | Workout events: no opt-in, free text reference | privacy | Per-membership `share_workouts` / `notify_workouts`, opaque reference format, 20/h limit |
| 11 | Storage not covered (buckets, paths, policies) | high | Private buckets, type and size limits, path shapes, member-only reads, no update |
| 12 | Supabase grants every table to `anon`/`authenticated`; the draft relied on RLS alone | defense in depth | Explicit revokes; anon gets nothing; functions executable by `authenticated` only |
| 13 | `types.ts`: `invited` status, `workspaceCapacity` 50 for friends while docs say "bounded" | low | Types follow the schema; friends 2–20 (default 10) |
| 14 | CI on PR #5 failed (WebKit, budget-iphone.js) on a docs-only change | flaky test | Same WebKit driver message as the stability suite; filtered narrowly and errors now printed |

Not yet covered (later steps): account deletion endpoint (needs the service key → server function), push subscriptions,
reporting/moderation, data export, retention policy, calls (TURN/SFU), privacy notice and age policy.

## Second review — Astra, PR #7 (astra/collabfit-review @ac5785d, on 9148099)

6 new checks (`supabase/tests/20_astra_review.sql`), 3 failed. All 3 confirmed and fixed; her tests now pass unchanged.

| Point | Verdict | Fix |
|-------|---------|-----|
| Explicit transfer to the most recent member of a 3-person space failed | **bug** — the succession trigger fired on the old owner's demotion and picked the next in line, then the transfer hit the one-owner index | Succession only when the owner stops being an active member |
| Account deletion left the avatar file behind | **bug** (orphan files) | Deleting an account is refused while it still has files; the deletion function removes them through the Storage API first (step 2) |
| `authenticated` kept TRIGGER (and REFERENCES, TRUNCATE) on tables | **excess right** (no direct SQL access through the API, but removed) | Revoked; tests check effective rights, RLS on every table, nothing for `anon` |
| Can a removed member delete his old pictures? | **decision, not a bug**: yes for his OWN files and messages, never for anyone else's | A person's content stays theirs: after leaving or removal (e.g. a break-up) they can still see and erase what they posted; they lose access to everything else. Tests: an active or removed member cannot delete someone else's picture |
| Browser-enforced CSP | added | The web tests now check that a request, an image and a script from another site are blocked and injected inline code does not run, also on a build made for a Supabase project |

To verify on the staging project (cannot be proven on plain PostgreSQL): signed picture URLs issued before a removal stay valid until they expire (the app will use short expiries); account deletion end to end through the Storage and Auth APIs; effective rights after `supabase db push`.
