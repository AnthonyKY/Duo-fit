-- CollabFit private media. Both buckets are PRIVATE: files are read through short-lived signed URLs, which Supabase only
-- issues when the policies below allow the read. Paths carry the owner, so a guessed path is useless without the right.
--   avatars     <user id>/<random uuid>.<jpg|png|webp>                  readable by its owner and by people sharing a space
--   chat-media  <workspace id>/<user id>/<random uuid>.<jpg|png|webp>  readable by ACTIVE members of that space only
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('chat-media', 'chat-media', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- a folder name that is not a uuid must deny, not crash the policy
create function public.try_uuid(t text) returns uuid language plpgsql immutable set search_path = '' as $$
begin return t::uuid; exception when others then return null; end $$;
grant execute on function public.try_uuid(text) to authenticated;

create policy avatars_insert_own on storage.objects for insert to authenticated with check (
  bucket_id = 'avatars' and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
  and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_delete_own on storage.objects for delete to authenticated using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_read on storage.objects for select to authenticated using (
  bucket_id = 'avatars' and ((storage.foldername(name))[1] = (select auth.uid())::text
    or public.shares_active_workspace(public.try_uuid((storage.foldername(name))[1]))));

create policy chat_media_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'chat-media' and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and public.is_active_member(public.try_uuid((storage.foldername(name))[1])));
-- active members read the space's pictures; the uploader keeps his own (to see and delete them), even after leaving
create policy chat_media_read on storage.objects for select to authenticated using (
  bucket_id = 'chat-media' and (public.is_active_member(public.try_uuid((storage.foldername(name))[1]))
    or (storage.foldername(name))[2] = (select auth.uid())::text));
create policy chat_media_delete_own on storage.objects for delete to authenticated using (
  bucket_id = 'chat-media' and (storage.foldername(name))[2] = (select auth.uid())::text);
-- no UPDATE policy: a stored file is never replaced in place

-- 3. An account is deleted only after its files are gone: the deletion function removes them through the Storage API
-- (which also deletes the stored bytes), then deletes the user. A direct deletion with files left is refused.
create function public.refuse_delete_with_files() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from storage.objects o
      where (o.bucket_id = 'avatars' and (storage.foldername(o.name))[1] = old.id::text)
         or (o.bucket_id = 'chat-media' and (storage.foldername(o.name))[2] = old.id::text)) then
    raise exception 'delete this account''s files first (avatars, chat pictures)' using errcode = '23503';
  end if;
  return old;
end $$;
revoke all on function public.refuse_delete_with_files() from public, anon, authenticated;
create trigger auth_user_files_first before delete on auth.users for each row execute function public.refuse_delete_with_files();
