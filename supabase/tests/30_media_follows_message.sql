-- Astra's review of d23103c: someone else's chat picture is visible exactly when its message is. Made-up users only.
-- Runs in a transaction that is rolled back (uses the t.* helpers of 10_security.sql).
\set ON_ERROR_STOP 1
\set QUIET 1
begin;
insert into auth.users (email) values ('owner@media.invalid') returning id as o \gset
insert into auth.users (email) values ('early@media.invalid') returning id as p \gset
insert into auth.users (email) values ('late@media.invalid') returning id as l \gset
set local role authenticated;
select t.as_user(:'o');
select public.create_workspace('Photos', 'friends', 5) as ws \gset
select public.create_invitation(:'ws', 3) as inv \gset
select t.as_user(:'p');
select public.accept_invitation(:'inv') \gset
select t.as_user(:'o');
\set pic1 :ws/:o/a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1.jpg
insert into storage.objects (bucket_id, name, owner) values ('chat-media', :'pic1', :'o');
insert into public.messages (client_id, workspace_id, author_id, image_path) values (gen_random_uuid(), :'ws', :'o', :'pic1') returning id as m1 \gset
reset role;
-- an hour ago (now() is frozen inside a transaction): the early member had joined before, the late one has not
update public.messages set created_at = now() - interval '1 hour' where id = :'m1';
update public.workspace_members set joined_at = now() - interval '2 hours' where workspace_id = :'ws' and user_id in (:'o', :'p');
set local role authenticated;
select t.as_user(:'l');
select public.accept_invitation(:'inv') \gset

-- case 1: a new member and a picture posted before he arrived
select t.ok(t.n(format('select * from public.messages where id = %L', :'m1')) = 0, 'new member: the message posted before he joined is hidden');
select t.ok(t.n(format('select * from storage.objects where name = %L', :'pic1')) = 0, 'new member: its picture is hidden too (even with the exact path)');
select t.as_user(:'o');
\set pic2 :ws/:o/b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2.jpg
insert into storage.objects (bucket_id, name, owner) values ('chat-media', :'pic2', :'o');
insert into public.messages (client_id, workspace_id, author_id, image_path) values (gen_random_uuid(), :'ws', :'o', :'pic2');
select t.as_user(:'l');
select t.ok(t.n(format('select * from storage.objects where name = %L', :'pic2')) = 1, 'new member: a picture posted after he joined is visible');

-- case 2: a member and the picture of an author he blocked
select t.as_user(:'p');
select t.ok(t.n(format('select * from storage.objects where name = %L', :'pic1')) = 1, 'early member sees the picture before blocking');
insert into public.user_blocks (blocker_id, blocked_id) values (:'p', :'o');
select t.ok(t.n(format('select * from public.messages where id = %L', :'m1')) = 0, 'blocked author: his message is hidden');
select t.ok(t.n(format('select * from storage.objects where bucket_id = %L and name like %L', 'chat-media', :'ws' || '/' || :'o' || '/%')) = 0,
  'blocked author: all his pictures are hidden too');
delete from public.user_blocks where blocker_id = :'p' and blocked_id = :'o';
select t.ok(t.n(format('select * from storage.objects where name = %L', :'pic1')) = 1, 'unblocked: the picture is visible again');

-- the author keeps his own files, sent or not
select t.as_user(:'o');
\set draft :ws/:o/c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3.jpg
insert into storage.objects (bucket_id, name, owner) values ('chat-media', :'draft', :'o');
select t.ok(t.n(format('select * from storage.objects where name in (%L, %L, %L)', :'pic1', :'pic2', :'draft')) = 3, 'author: sees all his pictures, sent or not');
select t.as_user(:'p');
select t.ok(t.n(format('select * from storage.objects where name = %L', :'draft')) = 0, 'a picture not yet sent stays private to its author');
-- a deleted message takes its picture with it
select t.as_user(:'o');
select public.delete_message(:'m1') \gset
select t.as_user(:'p');
select t.ok(t.n(format('select * from storage.objects where name = %L', :'pic1')) = 0, 'deleted message: its picture is no longer visible to others');
select t.as_user(:'o');
select t.ok(t.n(format('select * from storage.objects where name = %L', :'pic1')) = 1, 'deleted message: the author still sees his file (to erase it)');

-- account deletion helper: server key only; detaches pictures, lists files; then the account can go
select t.fails(format('select * from public.prepare_account_deletion(%L)', :'o'), 'permission denied', 'an app user cannot call the account-deletion helper');
\set av :o/d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4.png
insert into storage.objects (bucket_id, name, owner) values ('avatars', :'av', :'o');
update public.profiles set avatar_path = :'av' where id = :'o';
reset role;
set local role service_role;
create temporary table files on commit drop as select * from public.prepare_account_deletion(:'o');
reset role;
select t.ok((select count(*) from files) = 4, 'helper lists the account''s 4 files (avatar + 3 chat pictures)');
select t.ok(not exists (select 1 from public.messages where author_id = :'o' and image_path is not null), 'helper detaches his pictures from the messages he leaves');
delete from storage.objects o using files f where o.bucket_id = f.bucket and o.name = f.name; -- what the Storage API does
delete from auth.users where id = :'o';
select t.ok(not exists (select 1 from auth.users where id = :'o') and not exists (select 1 from public.profiles where id = :'o'), 'account deleted once its files are gone');
select t.ok((select owner_id from public.workspaces where id = :'ws') = :'p', 'the space passes to the earliest remaining member');
rollback;
