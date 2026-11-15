# ADR 0003 — Security model

1. Health data stays on the phone (DUOFIT). The server stores identity, spaces, invitations, messages, pictures, blocks and
   opt-in workout moments — less sensitive data, less GDPR exposure.
2. Clients only READ through row level security. Every write that needs a decision goes through a SECURITY DEFINER
   function with `search_path = ''`, one transaction, explicit checks, rate limits.
3. Invitations are bearer links: 24 random bytes, only the hash stored, expiry ≤ 7 days, limited uses, revocable.
4. Capacity under concurrency: the space row is locked while joining (tested with simultaneous joins).
5. Media: private buckets, typed paths that carry the owner, member-only reads, short-lived signed URLs, no SVG/HTML.
6. Client: strict CSP without 'unsafe-inline'; user text rendered by React (escaped); avatars as data-URL images.
7. Keys: only the publishable key is built into the app; the build refuses a secret key. Secrets live in GitHub/Supabase
   settings, never in the repository or the chat.
8. Staging and production are separate Supabase projects; nothing reaches production without the owner's go-ahead.
