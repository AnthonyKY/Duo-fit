-- The notification function's signing key (VAPID) lives in Supabase Vault (encrypted at rest). The staging workflow
-- writes it once over the database connection (never in Git, never shown); only the server role reads it, here.
-- Kept forever once created: a new key would cut every phone off.
create function public.push_vapid_key() returns text
language plpgsql security definer set search_path = '' as $$
begin
  return (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'collabfit_vapid' limit 1);
end $$;
revoke all on function public.push_vapid_key() from public, anon, authenticated;
grant execute on function public.push_vapid_key() to service_role;
