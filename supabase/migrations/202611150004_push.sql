-- Push notifications (step 5). A person turns them on per DEVICE (the phone asks the system permission), then chooses
-- per space: messages (on by default once the device is on) and the others' workouts (off until turned on, as before).
--   * push_subscriptions: one row per device, readable by its owner only, written only through the functions below.
--     The address must be a known push service (Apple, Google, Mozilla, Microsoft): the sending function can never be
--     pointed at another server.
--   * push_targets: who must be told about a message / a workout / a test, computed by the database with the same rules
--     as reading (active member, joined before, not blocked by the recipient). Server only (the "push" Edge Function);
--     each message or workout is announced once, whoever asks and however many times.
alter table public.workspace_members add column notify_messages boolean not null default true;

create table public.push_subscriptions (
  endpoint text primary key check (endpoint ~ '^https://(web\.push\.apple\.com|fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.notify\.windows\.com)/[!-~]+$' and char_length(endpoint) <= 1000),
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null check (p256dh ~ '^[A-Za-z0-9_-]{87}$'), -- the device's public key (65 bytes): the content is encrypted for it
  auth text not null check (auth ~ '^[A-Za-z0-9_-]{22}$'),     -- the device's 16-byte secret
  lang text not null default 'fr' check (lang in ('fr', 'en')),
  failures int not null default 0,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id, created_at desc);
alter table public.push_subscriptions enable row level security;
create policy push_read_own on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.push_subscriptions from anon;
revoke insert, update, delete, truncate, references, trigger on public.push_subscriptions from authenticated;

-- what was already announced (a resend, a second call, a second phone: never twice); kept two days
create table public.push_sent (
  kind text not null, ref text not null, created_at timestamptz not null default now(), primary key (kind, ref)
);
alter table public.push_sent enable row level security;
revoke all on public.push_sent from anon, authenticated;

-- this device, for the signed-in person (a device that changes hands follows its new owner); at most 10 devices each
create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_lang text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.require_user();
begin
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth, lang) values (p_endpoint, uid, p_p256dh, p_auth, coalesce(p_lang, 'fr'))
    on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
      lang = excluded.lang, failures = 0, created_at = now();
  delete from public.push_subscriptions s where s.user_id = uid and s.endpoint not in
    (select k.endpoint from public.push_subscriptions k where k.user_id = uid order by k.created_at desc limit 10);
end $$;

create function public.delete_push_subscription(p_endpoint text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.require_user();
begin
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = uid;
end $$;

create function public.set_message_notifications(p_workspace uuid, p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.require_user();
begin
  update public.workspace_members set notify_messages = p_on where workspace_id = p_workspace and user_id = uid and status = 'active';
  if not found then raise exception 'not a member' using errcode = 'P0002'; end if;
end $$;

-- the devices to notify and what to show them. p_caller is the person who asks (checked by the Edge Function with
-- Supabase Auth): only the author of a message / workout can have it announced, within 10 minutes, once.
create function public.push_targets(p_caller uuid, p_kind text, p_ref uuid)
returns table (endpoint text, p256dh text, auth text, lang text, title text, body text, url text, tag text)
language plpgsql security definer set search_path = '' as $$
declare msg public.messages; ev public.workout_events; who text; ws text;
begin
  delete from public.push_sent where created_at < now() - interval '2 days';
  if p_kind = 'message' then
    select * into msg from public.messages m where m.id = p_ref;
    if msg.id is null or msg.author_id is distinct from p_caller or msg.deleted_at is not null or msg.created_at < now() - interval '10 minutes' then return; end if;
    insert into public.push_sent (kind, ref) values ('message', p_ref::text) on conflict do nothing;
    if not found then return; end if;
    select p.display_name into who from public.profiles p where p.id = p_caller;
    select w.name into ws from public.workspaces w where w.id = msg.workspace_id;
    return query select s.endpoint, s.p256dh, s.auth, s.lang, ws,
        coalesce(who, 'CollabFit') || case when s.lang = 'fr' then ' : ' else ': ' end
          || case when msg.body is null then '📷 Photo' when char_length(msg.body) > 140 then left(msg.body, 139) || '…' else msg.body end,
        '#/space/' || msg.workspace_id::text, 'space-' || msg.workspace_id::text
      from public.workspace_members r join public.push_subscriptions s on s.user_id = r.user_id
      where r.workspace_id = msg.workspace_id and r.status = 'active' and r.user_id <> p_caller and r.notify_messages
        and r.joined_at <= msg.created_at
        and not exists (select 1 from public.user_blocks k where k.blocker_id = r.user_id and k.blocked_id = p_caller);
  elsif p_kind = 'workout' then
    select * into ev from public.workout_events e where e.id = p_ref;
    if ev.id is null or ev.user_id is distinct from p_caller or ev.created_at < now() - interval '10 minutes' then return; end if;
    insert into public.push_sent (kind, ref) values ('workout', p_ref::text) on conflict do nothing;
    if not found then return; end if;
    select p.display_name into who from public.profiles p where p.id = p_caller;
    select w.name into ws from public.workspaces w where w.id = ev.workspace_id;
    return query select s.endpoint, s.p256dh, s.auth, s.lang, ws,
        coalesce(who, 'CollabFit') || case
          when s.lang = 'fr' and ev.event_type = 'started' then ' a commencé sa séance 💪'
          when s.lang = 'fr' then ' a terminé sa séance ✅'
          when ev.event_type = 'started' then ' started a workout 💪'
          else ' finished a workout ✅' end,
        '#/space/' || ev.workspace_id::text, 'workout-' || ev.workspace_id::text
      from public.workspace_members r join public.push_subscriptions s on s.user_id = r.user_id
      where r.workspace_id = ev.workspace_id and r.status = 'active' and r.user_id <> p_caller and r.notify_workouts
        and r.joined_at <= ev.created_at
        and not exists (select 1 from public.user_blocks k where k.blocker_id = r.user_id and k.blocked_id = p_caller);
  elsif p_kind = 'test' then
    -- "send me a test": the caller's own devices, at most once a minute
    insert into public.push_sent (kind, ref) values ('test', p_caller::text || '@' || to_char(date_trunc('minute', now()), 'YYYYMMDDHH24MI'))
      on conflict do nothing;
    if not found then return; end if;
    return query select s.endpoint, s.p256dh, s.auth, s.lang, 'CollabFit'::text,
        case when s.lang = 'fr' then 'Les notifications fonctionnent sur cet appareil ✅' else 'Notifications work on this device ✅' end,
        '#/profile'::text, 'test'::text
      from public.push_subscriptions s where s.user_id = p_caller;
  else
    raise exception 'unknown notification kind' using errcode = '22023';
  end if;
end $$;

-- what the push services answered: a device that is gone (404 / 410) is forgotten; one that keeps failing too
create function public.push_result(p_ok text[], p_gone text[], p_failed text[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.push_subscriptions set failures = 0 where endpoint = any (coalesce(p_ok, '{}')) and failures <> 0;
  delete from public.push_subscriptions where endpoint = any (coalesce(p_gone, '{}'));
  update public.push_subscriptions set failures = failures + 1 where endpoint = any (coalesce(p_failed, '{}'));
  delete from public.push_subscriptions where failures >= 20;
end $$;

revoke all on function public.save_push_subscription(text, text, text, text), public.delete_push_subscription(text),
  public.set_message_notifications(uuid, boolean), public.push_targets(uuid, text, uuid), public.push_result(text[], text[], text[])
  from public, anon, authenticated;
grant execute on function public.save_push_subscription(text, text, text, text), public.delete_push_subscription(text),
  public.set_message_notifications(uuid, boolean) to authenticated;
grant execute on function public.push_targets(uuid, text, uuid), public.push_result(text[], text[], text[]) to service_role;
