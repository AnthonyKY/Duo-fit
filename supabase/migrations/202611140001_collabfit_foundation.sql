-- CollabFit foundation: review and test on a staging Supabase project first.
-- Requires auth.users from Supabase Auth.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  avatar_path text,
  created_at timestamptz not null default now()
);
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  mode text not null check (mode in ('couple','friends')),
  owner_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','member')),
  status text not null check (status in ('invited','active','left','removed')),
  joined_at timestamptz,
  primary key (workspace_id,user_id)
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  body text check (char_length(body) <= 4000),
  image_path text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (body is not null or image_path is not null)
);
create index if not exists messages_workspace_time_idx on public.messages(workspace_id, created_at desc);
create table if not exists public.workout_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  workout_id text not null,
  event_type text not null check (event_type in ('started','completed')),
  created_at timestamptz not null default now()
);
create index if not exists workout_events_workspace_time_idx on public.workout_events(workspace_id, created_at desc);

create function public.is_active_member(wid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.workspace_members m
    where m.workspace_id = wid and m.user_id = (select auth.uid()) and m.status='active');
$$;
revoke all on function public.is_active_member(uuid) from public;
grant execute on function public.is_active_member(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.messages enable row level security;
alter table public.workout_events enable row level security;

create policy profiles_read_self on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_insert_self on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy workspaces_read_member on public.workspaces for select to authenticated using (public.is_active_member(id));
create policy members_read_member on public.workspace_members for select to authenticated using (public.is_active_member(workspace_id));
create policy messages_read_member on public.messages for select to authenticated using (public.is_active_member(workspace_id));
create policy messages_insert_member on public.messages for insert to authenticated with check (
  author_id = (select auth.uid()) and public.is_active_member(workspace_id)
);
create policy events_read_member on public.workout_events for select to authenticated using (public.is_active_member(workspace_id));
-- No direct client insert policies for workspaces, membership, or events.
-- Use trusted, transactional server RPCs with authorization, invitation verification,
-- couple capacity enforcement, membership changes, and opt-in event publication.
-- This schema is an initial staging foundation, not a complete production backend.
