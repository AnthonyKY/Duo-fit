-- Training in CollabFit (Invictus' choice 1A): each person's workouts follow their account, so a new phone loses nothing.
-- One row per person holds their training state in DUOFIT's own format (programme, planning, settings, workouts).
-- Body measurements stay on the phone unless the person chooses otherwise (the app does not send them).
-- Only the person can read or write it; nobody else, not even people sharing a space with them.
create table public.training_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 3000000),
  version int not null default 1 check (version >= 1), -- a phone writes over the version it read: two phones never erase each other
  updated_at timestamptz not null default now()
);
alter table public.training_profiles enable row level security;
create policy training_read_own on public.training_profiles for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.training_profiles from anon;
revoke insert, update, delete, truncate, references, trigger on public.training_profiles from authenticated;

-- saves the state if the phone had the latest version; returns the new version, or raises 40001 when another phone
-- saved in between (the app then reads, merges and saves again)
create function public.save_training(p_data jsonb, p_version int) returns int
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.require_user(); v int;
begin
  if jsonb_typeof(p_data) <> 'object' or octet_length(p_data::text) > 3000000 then
    raise exception 'training data refused' using errcode = '22023';
  end if;
  if p_version = 0 then
    insert into public.training_profiles (user_id, data) values (uid, p_data) on conflict (user_id) do nothing returning version into v;
  else
    update public.training_profiles set data = p_data, version = version + 1, updated_at = now()
      where user_id = uid and version = p_version returning version into v;
  end if;
  if v is null then raise exception 'saved meanwhile from another phone' using errcode = '40001'; end if;
  return v;
end $$;
revoke all on function public.save_training(jsonb, int) from public, anon, authenticated;
grant execute on function public.save_training(jsonb, int) to authenticated;
