# notifications — step 5
- **On per device, by the person** (Profile → Notifications). The system asks permission at that moment. On iPhone, only in
  the app opened from the home screen (iOS 16.4+): in a Safari tab the card explains how to add it first.
- **Per space** (Members tab): messages (on), the others' workouts (off until chosen), sharing my own workouts (off).
- **Who is told** is decided by the database (`push_targets`, server only): active member, joined before, not blocked by
  the recipient, their choices. Each message / workout is announced once, only by its author, within 10 minutes.
- **Sending**: after a message is stored, the author's app asks the `push` Edge Function to announce it; the function
  encrypts the text for each device (RFC 8291, checked against the reference implementation in
  `supabase/functions/push/test`) and signs with the VAPID key (RFC 8292), a Supabase secret created once by the staging
  workflow. It only ever calls Apple, Google, Mozilla or Microsoft push services (checked twice: database and function).
- **Shown**: `apps/web/public/sw.js` displays it (space, "Name : text", link back to the space). No offline copy, no
  request interception. A tap opens the conversation.
- Signing out removes the device from the account; a device that the push service reports gone is forgotten.
- Delivery is never guaranteed by Apple: the app always shows everything when opened.
