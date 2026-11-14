# chat — step 4
Text messages and pictures in a space. Sending goes through `Outbox` (packages/domain): offline messages wait and are
resent with the same `client_id`, so the database refuses duplicates. Pictures: private bucket `chat-media`, path from
`chatMediaPath()`, read through short-lived signed URLs. Live updates: Supabase Realtime (same read rules as the tables).
