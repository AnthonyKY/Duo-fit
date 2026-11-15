-- Astra's review of d23103c: someone else's chat picture follows the visibility of ITS message.
-- Before: any active member of the space could open every picture of the space, even one whose message is hidden from
-- him (posted before he joined, or by someone he blocked). Now a picture is readable by:
--   * its uploader, always (own content stays his, even after leaving — product rule confirmed by Astra)
--   * anyone who can read a message carrying it. messages_read (active member, posted after he joined, author not
--     blocked) is applied by the subquery itself, so the two rules can never drift apart. A deleted message drops its
--     picture (delete_message clears image_path), and a picture not yet sent is private to its uploader.
drop policy chat_media_read on storage.objects;
create policy chat_media_read on storage.objects for select to authenticated using (
  bucket_id = 'chat-media' and ((storage.foldername(name))[2] = (select auth.uid())::text
    or exists (select 1 from public.messages m where m.image_path = objects.name)));
create index messages_image_path_idx on public.messages (image_path) where image_path is not null;

-- Account deletion (Edge Function delete-account, server key only): list the account's files so they can be removed
-- through the Storage API (which also deletes the stored bytes), and detach its pictures from the messages it leaves
-- behind (an image-only message becomes a deleted trace). Then the user can be deleted: refuse_delete_with_files passes.
create function public.prepare_account_deletion(p_user uuid) returns table (bucket text, name text)
language plpgsql security definer set search_path = '' as $$
begin
  update public.messages set image_path = null, deleted_at = case when body is null then coalesce(deleted_at, now()) else deleted_at end
    where author_id = p_user and image_path is not null;
  update public.profiles set avatar_path = null where id = p_user;
  return query select o.bucket_id, o.name from storage.objects o
    where (o.bucket_id = 'avatars' and (storage.foldername(o.name))[1] = p_user::text)
       or (o.bucket_id = 'chat-media' and (storage.foldername(o.name))[2] = p_user::text);
end $$;
revoke all on function public.prepare_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.prepare_account_deletion(uuid) to service_role;
