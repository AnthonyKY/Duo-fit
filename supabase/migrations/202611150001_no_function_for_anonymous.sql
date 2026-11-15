-- Found by the first install on staging: Supabase grants EXECUTE on every NEW function to anon (and PostgreSQL to PUBLIC).
-- The blanket revoke of the foundation migration ran before try_uuid() existed, so anonymous visitors could call it.
-- try_uuid() only turns text into a uuid (no data read or written): no exposure, but the rule is "anonymous: nothing".
revoke all on function public.try_uuid(text) from public, anon;
grant execute on function public.try_uuid(text) to authenticated;

-- and for every function created later by these migrations: no automatic right for anonymous visitors or PUBLIC;
-- each function grants explicitly what it needs (as all CollabFit functions already do)
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;
