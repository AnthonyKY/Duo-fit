-- CollabFit foundation — identity, private workspaces (couple / friends), invitations, blocks, messages, workout events.
-- Security model: every table has row level security; clients can only READ through policies. Every change that needs an
-- authorization decision (create a workspace, invite, join, leave, remove, delete a message, publish a workout event)
-- goes through a SECURITY DEFINER function below that checks the caller and runs in one transaction.
-- Health data (workouts, body composition) is NOT stored here: it stays on the phone. Only "started / completed" events
-- that a member explicitly chose to share are published.
-- Apply on a STAGING project first. Tested by supabase/tests (two to four users, simultaneous joins).

create extension if not exists pgcrypto with schema extensions;

-- ===================================================================== tables
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  avatar_seed text not null default encode(extensions.gen_random_bytes(8), 'hex') check (avatar_seed ~ '^[0-9a-f]{8,32}$'),
  -- uploaded picture, private bucket "avatars", always inside the owner's folder
  avatar_path text check (avatar_path is null or avatar_path ~ ('^' || id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$')),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  mode text not null check (mode in ('couple', 'friends')),
  max_members int not null,
  owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((mode = 'couple' and max_members = 2) or (mode = 'friends' and max_members between 2 and 20))
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  status text not null check (status in ('active', 'left', 'removed')),
  share_workouts boolean not null default false,  -- opt-in: publish my workout start / finish here
  notify_workouts boolean not null default false, -- opt-in: notify me of the others' workouts
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (workspace_id, user_id)
);
create unique index workspace_one_active_owner on public.workspace_members (workspace_id) where role = 'owner' and status = 'active';
create index workspace_members_user_idx on public.workspace_members (user_id) where status = 'active';

create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  token_hash bytea not null unique,            -- sha-256 of the secret link; the link itself is shown once and never stored
  max_uses int not null default 1 check (max_uses between 1 and 20),
  uses int not null default 0 check (uses >= 0),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (uses <= max_uses)
);
create index workspace_invitations_ws_idx on public.workspace_invitations (workspace_id);

create table public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,                                  -- set by the phone: a resend after a network error is not a duplicate
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null, -- account deleted: message kept for the others, author anonymous
  body text check (body is null or char_length(btrim(body)) between 1 and 4000),
  image_path text check (image_path is null or image_path ~ ('^' || workspace_id::text || '/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (deleted_at is not null or body is not null or image_path is not null),
  unique (author_id, client_id)
);
create index messages_workspace_time_idx on public.messages (workspace_id, created_at desc);
create index messages_author_time_idx on public.messages (author_id, created_at desc);

create table public.workout_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  workout_ref text not null check (workout_ref ~ '^[A-Za-z0-9_-]{1,64}$'), -- opaque id from the phone, no content
  event_type text not null check (event_type in ('started', 'completed')),
  created_at timestamptz not null default now()
);
create index workout_events_workspace_time_idx on public.workout_events (workspace_id, created_at desc);

-- ===================================================================== helpers (SECURITY DEFINER, no search path)
create function public.is_active_member(wid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.workspace_members m
    where m.workspace_id = wid and m.user_id = (select auth.uid()) and m.status = 'active');
$$;

-- since when the caller can see a workspace's messages and events (no reading of what was said before joining)
create function public.member_since(wid uuid) returns timestamptz
language sql stable security definer set search_path = '' as $$
  select m.joined_at from public.workspace_members m
    where m.workspace_id = wid and m.user_id = (select auth.uid()) and m.status = 'active';
$$;

create function public.shares_active_workspace(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.workspace_members a join public.workspace_members b using (workspace_id)
    where a.user_id = (select auth.uid()) and a.status = 'active' and b.user_id = other and b.status = 'active');
$$;

create function public.blocked_by_me(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_blocks k where k.blocker_id = (select auth.uid()) and k.blocked_id = other);
$$;

create function public.require_user() returns uuid
language plpgsql stable set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  return uid;
end $$;

-- ===================================================================== row level security (reads only)
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invitations enable row level security;
alter table public.user_blocks enable row level security;
alter table public.messages enable row level security;
alter table public.workout_events enable row level security;

create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_active_workspace(id));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy workspaces_read on public.workspaces for select to authenticated using (public.is_active_member(id));

create policy members_read on public.workspace_members for select to authenticated
  using (public.is_active_member(workspace_id) and (status = 'active' or user_id = (select auth.uid())));

create policy invitations_read_owner on public.workspace_invitations for select to authenticated
  using (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = (select auth.uid())));

create policy blocks_read_own on public.user_blocks for select to authenticated using (blocker_id = (select auth.uid()));
create policy blocks_insert_own on public.user_blocks for insert to authenticated with check (blocker_id = (select auth.uid()));
create policy blocks_delete_own on public.user_blocks for delete to authenticated using (blocker_id = (select auth.uid()));

create policy messages_read on public.messages for select to authenticated using (
  author_id = (select auth.uid())
  or (public.is_active_member(workspace_id) and created_at >= public.member_since(workspace_id)
      and (author_id is null or not public.blocked_by_me(author_id))));
create policy messages_send on public.messages for insert to authenticated with check (
  author_id = (select auth.uid()) and deleted_at is null and public.is_active_member(workspace_id)
  and (image_path is null or split_part(image_path, '/', 2) = (select auth.uid())::text));

create policy events_read on public.workout_events for select to authenticated using (
  public.is_active_member(workspace_id) and created_at >= public.member_since(workspace_id)
  and (user_id is null or not public.blocked_by_me(user_id)));

-- belt and braces: Supabase grants every table to the client roles; take back what only the functions may do
revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
revoke insert, update, delete, truncate on public.workspaces, public.workspace_members, public.workspace_invitations,
  public.workout_events from authenticated;
revoke insert, update, delete, truncate on public.messages from authenticated;
grant insert (client_id, workspace_id, author_id, body, image_path) on public.messages to authenticated; -- id, dates: server only
revoke insert, delete, truncate on public.profiles from authenticated;
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_seed, avatar_path) on public.profiles to authenticated;
revoke update, truncate on public.user_blocks from authenticated;

-- ===================================================================== triggers
-- a profile for every new account (name from sign-up metadata, else "Membre")
create function public.on_auth_user_created() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), 'Membre'), 40));
  return new;
end $$;
create trigger auth_user_created after insert on auth.users for each row execute function public.on_auth_user_created();

create function public.touch_profile() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_profile();

-- the owner leaves, is removed or deletes the account: the longest-standing active member becomes owner;
-- nobody left: the workspace (messages, events, invitations) is deleted
create function public.keep_an_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
declare wid uuid := old.workspace_id; heir uuid;
begin
  if old.role <> 'owner' or old.status <> 'active' then return null; end if;
  -- still an active member (e.g. transfer_ownership demoting the old owner): not a departure, nothing to do
  if tg_op = 'UPDATE' and new.status = 'active' then return null; end if;
  if not exists (select 1 from public.workspaces where id = wid) then return null; end if;
  select m.user_id into heir from public.workspace_members m
    where m.workspace_id = wid and m.status = 'active' and m.user_id <> old.user_id
    order by m.joined_at, m.user_id limit 1;
  if heir is null then
    delete from public.workspaces where id = wid;
  else
    update public.workspace_members set role = 'member' where workspace_id = wid and user_id = old.user_id and tg_op = 'UPDATE';
    update public.workspace_members set role = 'owner' where workspace_id = wid and user_id = heir;
    update public.workspaces set owner_id = heir where id = wid;
  end if;
  return null;
end $$;
create trigger members_keep_owner after update or delete on public.workspace_members
  for each row execute function public.keep_an_owner();

-- rate limit: 30 messages a minute per person
create function public.limit_messages() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.messages where author_id = new.author_id and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'too many messages, wait a minute' using errcode = '54000';
  end if;
  return new;
end $$;
create trigger messages_rate_limit before insert on public.messages for each row execute function public.limit_messages();

-- ===================================================================== actions (RPC)
create function public.create_workspace(p_name text, p_mode text, p_max_members int default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.require_user(); wid uuid; cap int;
begin
  if p_mode not in ('couple', 'friends') then raise exception 'unknown mode' using errcode = '22023'; end if;
  cap := case when p_mode = 'couple' then 2 else coalesce(p_max_members, 10) end;
  if p_mode = 'couple' and exists (select 1 from public.workspace_members m join public.workspaces w on w.id = m.workspace_id
      where m.user_id = uid and m.status = 'active' and w.mode = 'couple') then
    raise exception 'already in a couple space' using errcode = '23505';
  end if;
  if (select count(*) from public.workspaces where owner_id = uid) >= 10 then
    raise exception 'too many spaces' using errcode = '54000';
  end if;
  insert into public.workspaces (name, mode, max_members, owner_id) values (btrim(p_name), p_mode, cap, uid) returning id into wid;
  insert into public.workspace_members (workspace_id, user_id, role, status) values (wid, uid, 'owner', 'active');
  return wid;
end $$;

-- returns the secret invitation token ONCE; only its hash is stored
create function public.create_invitation(p_workspace uuid, p_max_uses int default 1, p_valid_hours int default 72) returns text
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.require_user(); tok text;
begin
  if not exists (select 1 from public.workspaces w where w.id = p_workspace and w.owner_id = uid) then
    raise exception 'only the owner can invite' using errcode = '42501';
  end if;
  if p_valid_hours not between 1 and 168 then raise exception 'validity 1 to 168 hours' using errcode = '22023'; end if;
  if (select count(*) from public.workspace_invitations where created_by = uid and created_at > now() - interval '1 day') >= 30 then
    raise exception 'too many invitations today' using errcode = '54000';
  end if;
  tok := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
  insert into public.workspace_invitations (workspace_id, created_by, token_hash, max_uses, expires_at)
  values (p_workspace, uid, extensions.digest(tok, 'sha256'), p_max_uses, now() + make_interval(hours => p_valid_hours));
  return tok;
end $$;

create function public.revoke_invitation(p_invitation uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.require_user();
begin
  update public.workspace_invitations i set revoked_at = now()
    where i.id = p_invitation and i.revoked_at is null
      and exists (select 1 from public.workspaces w where w.id = i.workspace_id and w.owner_id = uid);
  if not found then raise exception 'invitation not found' using errcode = 'P0002'; end if;
end $$;

-- what a valid link leads to, before accepting (name, mode, who invites). Nothing for an invalid link.
create function public.peek_invitation(p_token text) returns table (workspace_name text, mode text, invited_by text, members int, max_members int)
language sql stable security definer set search_path = '' as $$
  select w.name, w.mode, p.display_name,
    (select count(*)::int from public.workspace_members m where m.workspace_id = w.id and m.status = 'active'), w.max_members
  from public.workspace_invitations i join public.workspaces w on w.id = i.workspace_id
  left join public.profiles p on p.id = i.created_by
  where (select auth.uid()) is not null and i.token_hash = extensions.digest(p_token, 'sha256')
    and i.revoked_at is null and i.expires_at > now() and i.uses < i.max_uses;
$$;

-- join with a link. Locks the workspace row: two people accepting at the same moment cannot both take the last place.
create function public.accept_invitation(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.require_user(); inv public.workspace_invitations; ws public.workspaces; n int;
begin
  select * into inv from public.workspace_invitations where token_hash = extensions.digest(p_token, 'sha256') for update;
  if not found or inv.revoked_at is not null or inv.expires_at <= now() or inv.uses >= inv.max_uses then
    raise exception 'invalid or expired invitation' using errcode = '22023';
  end if;
  select * into ws from public.workspaces where id = inv.workspace_id for update;
  if exists (select 1 from public.workspace_members where workspace_id = ws.id and user_id = uid and status = 'active') then
    return ws.id;
  end if;
  if exists (select 1 from public.user_blocks k join public.workspace_members m on m.user_id = k.blocker_id
      where m.workspace_id = ws.id and m.status = 'active' and k.blocked_id = uid) then
    raise exception 'invalid or expired invitation' using errcode = '22023';
  end if;
  if ws.mode = 'couple' and exists (select 1 from public.workspace_members m join public.workspaces w on w.id = m.workspace_id
      where m.user_id = uid and m.status = 'active' and w.mode = 'couple') then
    raise exception 'already in a couple space' using errcode = '23505';
  end if;
  select count(*) into n from public.workspace_members where workspace_id = ws.id and status = 'active';
  if n >= ws.max_members then raise exception 'this space is full' using errcode = '23514'; end if;
  insert into public.workspace_members (workspace_id, user_id, role, status, joined_at, left_at)
  values (ws.id, uid, 'member', 'active', now(), null)
  on conflict (workspace_id, user_id) do update set status = 'active', role = 'member', joined_at = now(), left_at = null,
    share_workouts = false, notify_workouts = false;
  update public.workspace_invitations set uses = uses + 1 where id = inv.id;
  return ws.id;
end $$;

create function public.leave_workspace(p_workspace uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.require_user();
begin
  update public.workspace_members set status = 'left', left_at = now(), share_workouts = false, notify_workouts = false
    where workspace_id = p_workspace and user_id = uid and status = 'active';
  if not found then raise exception 'not a member' using errcode = 'P0002'; end if;
end $$;

create function public.remove_member(p_workspace uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.require_user();
begin
  if not exists (select 1 from public.workspaces w where w.id = p_workspace and w.owner_id = uid) then
    raise exception 'only the owner can remove' using errcode = '42501';
  end if;
  if p_user = uid then raise exception 'use leave_workspace' using errcode = '22023'; end if;
  update public.workspace_members set status = 'removed', left_at = now(), share_workouts = false, notify_workouts = false
    where workspace_id = p_workspace and user_id = p_user and status = 'active';
  if not found then raise exception 'not a member' using errcode = 'P0002'; end if;
end $$;

create function public.transfer_ownership(p_workspace uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.require_user();
begin
  if not exists (select 1 from public.workspaces w where w.id = p_workspace and w.owner_id = uid) then
    raise exception 'only the owner can transfer' using errcode = '42501';
  end if;
  if not exists (select 1 from public.workspace_members where workspace_id = p_workspace and user_id = p_user and status = 'active' and p_user <> uid) then
    raise exception 'not an active member' using errcode = 'P0002';
  end if;
  update public.workspace_members set role = 'member' where workspace_id = p_workspace and user_id = uid;
  update public.workspace_members set role = 'owner' where workspace_id = p_workspace and user_id = p_user;
  update public.workspaces set owner_id = p_user where id = p_workspace;
end $$;

create function public.set_workout_sharing(p_workspace uuid, p_share boolean, p_notify boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.require_user();
begin
  update public.workspace_members set share_workouts = p_share, notify_workouts = p_notify
    where workspace_id = p_workspace and user_id = uid and status = 'active';
  if not found then raise exception 'not a member' using errcode = 'P0002'; end if;
end $$;

-- the author removes a message: text and picture reference erased for everyone, a "deleted" trace stays
create function public.delete_message(p_message uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.require_user();
begin
  update public.messages set deleted_at = now(), body = null, image_path = null
    where id = p_message and author_id = uid and deleted_at is null;
  if not found then raise exception 'message not found' using errcode = 'P0002'; end if;
end $$;

create function public.publish_workout_event(p_workspace uuid, p_type text, p_workout_ref text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.require_user(); eid uuid;
begin
  if not exists (select 1 from public.workspace_members where workspace_id = p_workspace and user_id = uid and status = 'active' and share_workouts) then
    raise exception 'sharing is off for this space' using errcode = '42501';
  end if;
  if (select count(*) from public.workout_events where user_id = uid and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'too many events' using errcode = '54000';
  end if;
  insert into public.workout_events (workspace_id, user_id, workout_ref, event_type) values (p_workspace, uid, p_workout_ref, p_type)
    returning id into eid;
  return eid;
end $$;

-- functions: nobody by default, signed-in users only for the actions
revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function public.is_active_member(uuid), public.member_since(uuid), public.shares_active_workspace(uuid),
  public.blocked_by_me(uuid), public.create_workspace(text, text, int), public.create_invitation(uuid, int, int),
  public.revoke_invitation(uuid), public.peek_invitation(text), public.accept_invitation(text), public.leave_workspace(uuid),
  public.remove_member(uuid, uuid), public.transfer_ownership(uuid, uuid), public.set_workout_sharing(uuid, boolean, boolean),
  public.delete_message(uuid), public.publish_workout_event(uuid, text, text), public.require_user() to authenticated;

-- live updates (Realtime applies the same read policies)
alter publication supabase_realtime add table public.messages, public.workout_events, public.workspace_members;
