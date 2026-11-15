# ADR 0006 — Push notifications

Date: 2026-11-15. Status: accepted (step 5).

## Decision
- Web Push (standard, works on iPhone from iOS 16.4 in the home-screen app), no third-party push provider: the Supabase
  Edge Function `push` encrypts and signs with WebCrypto (`webpush.ts`, ~100 lines), proven against the reference RFC 8291
  implementation. No library and no account elsewhere to trust or pay.
- The **author's app** asks for the announcement right after the message / workout is stored. The database decides the
  recipients and refuses anyone but the author, after 10 minutes, or a second time. No database trigger calling out with a
  server key (which would have to live in the database).
- The VAPID private key is generated on GitHub's machine during the staging workflow, masked, stored directly as a
  Supabase secret, never written to Git or shown. Kept forever once created (a new key would cut every phone off).
- Device addresses are restricted to the four push services, in the database and again in the function (no request
  to any other server can be caused by a user).
- Notification text: the space name, the author's name and up to 140 characters (or "📷 Photo"); encrypted end to end
  for the device. People who want no preview on the lock screen use iPhone's own setting.

## Consequences
- If the author's phone loses the network between storing a message and announcing it, that message is not pushed
  (it is still delivered in the app). Acceptable for now; a server-side retry can come later.
- Real delivery can only be checked on a real phone: the tests prove the encryption, the signature (Apple's push service
  accepts it on staging), the recipients' rules, the app's switches and the service worker's display.
