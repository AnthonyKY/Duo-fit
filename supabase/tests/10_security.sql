-- Adversarial tests of the CollabFit schema, run as the real client role ("authenticated") with five different users.
-- Every line prints PASS or stops the run with FAIL. Made-up users only.
\set ON_ERROR_STOP 1
\set QUIET 1
\set A 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
\set B 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
\set C 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
\set D 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
\set E 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

create schema t;
grant usage on schema t to anon, authenticated;
create function t.as_user(u uuid) returns void language sql as $$ select set_config('request.jwt.claim.sub', coalesce(u::text, ''), false) $$;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin if cond is not true then raise exception 'FAIL: %', what; end if; raise notice 'PASS %', what; end $$;
create function t.fails(stmt text, expect text, what text) returns void language plpgsql as $$
begin
  begin execute stmt;
  exception when others then
    if position(lower(expect) in lower(sqlerrm)) > 0 then raise notice 'PASS % [refused: %]', what, sqlerrm; return; end if;
    raise exception 'FAIL: % — unexpected error: %', what, sqlerrm;
  end;
  raise exception 'FAIL: % — it was allowed', what;
end $$;
create function t.n(q text) returns bigint language plpgsql as $$ declare k bigint; begin execute 'select count(*) from (' || q || ') x' into k; return k; end $$;
create function t.send(ws uuid, body text) returns uuid language sql as $$
  insert into public.messages (client_id, workspace_id, author_id, body) values (gen_random_uuid(), ws, auth.uid(), body) returning id $$;
grant execute on all functions in schema t to anon, authenticated;

-- ===================================================================== accounts
insert into auth.users (id, email, raw_user_meta_data) values
  (:'A', 'a@test.invalid', '{"display_name":"Alice"}'), (:'B', 'b@test.invalid', '{"display_name":"Bob"}'),
  (:'C', 'c@test.invalid', '{"display_name":"Chloé"}'), (:'D', 'd@test.invalid', '{}'),
  (:'E', 'e@test.invalid', '{"display_name":"  "}');
select t.ok((select count(*) from public.profiles) = 5, 'every new account gets a profile');
select t.ok((select display_name from public.profiles where id = :'D') = 'Membre', 'no name given → "Membre"');

set role anon;
select t.as_user(null);
select t.fails('select * from public.profiles', 'permission denied', 'not signed in: cannot read profiles');
select t.fails('select * from public.workspaces', 'permission denied', 'not signed in: cannot list spaces');
select t.fails('select public.create_workspace(''x'', ''couple'')', 'permission denied', 'not signed in: cannot create a space');
reset role;

set role authenticated;
select t.as_user(null);
select t.fails('select public.create_workspace(''x'', ''couple'')', 'not signed in', 'a request without a user is refused by the actions');

-- ===================================================================== couple space: create, invite, join
select t.as_user(:'A');
select public.create_workspace('Nous deux', 'couple') as ws \gset
select t.ok((select role from public.workspace_members where workspace_id = :'ws' and user_id = :'A') = 'owner', 'creator is the owner');
select t.fails(format('insert into public.workspaces (name, mode, max_members, owner_id) values (%L, %L, 2, %L)', 'x', 'couple', :'A'),
  'permission denied', 'spaces cannot be created by writing the table directly');
select t.fails(format('update public.workspaces set max_members = 20 where id = %L', :'ws'), 'permission denied', 'owner cannot raise a couple''s capacity');
select public.create_invitation(:'ws') as tok \gset
select t.ok(length(:'tok') >= 32, 'invitation link token is long and random');
select t.ok((select count(*) from public.workspace_invitations where token_hash = convert_to(:'tok', 'UTF8')) = 0, 'the token itself is not stored (only its hash)');

select t.as_user(:'D');
select t.ok(t.n('select * from public.workspaces') = 0, 'a stranger sees no space');
select t.ok(t.n('select * from public.workspace_members') = 0, 'a stranger cannot list members');
select t.ok(t.n('select * from public.workspace_invitations') = 0, 'a stranger cannot list invitations');
select t.ok(t.n(format('select * from public.profiles where id = %L', :'A')) = 0, 'a stranger cannot read Alice''s profile');
select t.fails(format('insert into public.workspace_members (workspace_id, user_id, role, status) values (%L, %L, %L, %L)', :'ws', :'D', 'member', 'active'),
  'permission denied', 'a stranger cannot add himself as a member');
select t.fails('select public.accept_invitation(''not-a-real-token'')', 'invalid or expired', 'a guessed invitation is refused');
select t.ok(t.n('select * from public.peek_invitation(''not-a-real-token'')') = 0, 'a guessed invitation reveals nothing');
select t.ok((select workspace_name from public.peek_invitation(:'tok')) = 'Nous deux', 'a real link shows the space name before joining');

select t.as_user(:'B');
select t.ok(public.accept_invitation(:'tok') = :'ws'::uuid, 'Bob joins with the link');
select t.ok((select count(*) from public.workspace_members where workspace_id = :'ws' and status = 'active') = 2, 'couple has 2 members');
select t.ok(t.n(format('select * from public.profiles where id = %L', :'A')) = 1, 'Bob can now see Alice''s name and avatar');
select t.fails('select public.create_workspace(''Autre'', ''couple'')', 'already in a couple', 'one couple space per person');

select t.as_user(:'C');
select t.fails(format('select public.accept_invitation(%L)', :'tok'), 'invalid or expired', 'a used single-use link cannot be reused');
select t.as_user(:'A');
select public.create_invitation(:'ws', 2) as tok2 \gset
select t.as_user(:'C');
select t.fails(format('select public.accept_invitation(%L)', :'tok2'), 'full', 'a third person cannot join a couple');

-- revoked / expired links
select t.as_user(:'A');
select public.create_invitation(:'ws') as tok3 \gset
select public.revoke_invitation((select id from public.workspace_invitations where token_hash = extensions.digest(:'tok3', 'sha256'))) \gset
select t.as_user(:'C');
select t.fails(format('select public.accept_invitation(%L)', :'tok3'), 'invalid or expired', 'a revoked link cannot be used');
select t.as_user(:'B');
select t.fails(format('select public.create_invitation(%L)', :'ws'), 'only the owner', 'only the owner invites');

-- ===================================================================== messages
select t.as_user(:'A');
select t.send(:'ws', 'Salut Bob') as m1 \gset
select t.as_user(:'B');
select t.ok(t.n(format('select * from public.messages where workspace_id = %L', :'ws')) = 1, 'Bob reads Alice''s message');
select t.send(:'ws', 'Salut Alice') as m2 \gset
select t.fails(format('insert into public.messages (client_id, workspace_id, author_id, body) values (gen_random_uuid(), %L, %L, %L)', :'ws', :'A', 'fake'),
  'row-level security', 'Bob cannot post as Alice');
select t.fails(format('insert into public.messages (client_id, workspace_id, author_id, body, created_at) values (gen_random_uuid(), %L, %L, %L, now() - interval ''1 year'')', :'ws', :'B', 'x'),
  'permission denied', 'Bob cannot backdate a message');
select t.fails(format('insert into public.messages (client_id, workspace_id, author_id, body) values (gen_random_uuid(), %L, %L, %L)', :'ws', :'B', '   '),
  'check constraint', 'an empty message is refused');
select t.fails(format('insert into public.messages (client_id, workspace_id, author_id, image_path) values (gen_random_uuid(), %L, %L, %L)', :'ws', :'B',
  :'ws' || '/' || :'A' || '/11111111-1111-4111-8111-111111111111.jpg'), 'row-level security', 'Bob cannot attach a picture stored in Alice''s folder');
select t.fails(format('update public.messages set body = %L where id = %L', 'modifié', :'m1'), 'permission denied', 'nobody edits a message directly');
select t.fails(format('select public.delete_message(%L)', :'m1'), 'not found', 'Bob cannot delete Alice''s message');
-- same message sent twice after a network error = one message
select gen_random_uuid() as cid \gset
insert into public.messages (client_id, workspace_id, author_id, body) values (:'cid', :'ws', :'B', 'retry') on conflict (author_id, client_id) do nothing;
insert into public.messages (client_id, workspace_id, author_id, body) values (:'cid', :'ws', :'B', 'retry') on conflict (author_id, client_id) do nothing;
select t.ok(t.n(format('select * from public.messages where client_id = %L', :'cid')) = 1, 'a resend after a network error does not duplicate');
select t.as_user(:'D');
select t.ok(t.n('select * from public.messages') = 0, 'a stranger reads no message');
select t.fails(format('select t.send(%L, %L)', :'ws', 'intrus'), 'row-level security', 'a stranger cannot post');
select t.as_user(:'A');
select public.delete_message(:'m1') \gset
select t.ok((select body is null and deleted_at is not null from public.messages where id = :'m1'), 'Alice deletes her message: text erased, trace kept');

-- ===================================================================== workout events (opt-in)
select t.as_user(:'B');
select t.fails(format('select public.publish_workout_event(%L, %L, %L)', :'ws', 'started', 'w1'), 'sharing is off', 'nothing is shared until Bob opts in');
select public.set_workout_sharing(:'ws', true, true) \gset
select public.publish_workout_event(:'ws', 'started', 'w1') as ev \gset
select t.fails(format('select public.publish_workout_event(%L, %L, %L)', :'ws', 'started', '<script>'), 'check constraint', 'event reference cannot carry content');
select t.as_user(:'A');
select t.ok(t.n(format('select * from public.workout_events where id = %L', :'ev')) = 1, 'Alice sees Bob''s shared start');
select t.as_user(:'D');
select t.ok(t.n('select * from public.workout_events') = 0, 'a stranger sees no workout event');

-- ===================================================================== private media (storage)
select t.as_user(:'B');
\set pic :ws/:B/22222222-2222-4222-8222-222222222222.jpg
insert into storage.objects (bucket_id, name, owner) values ('chat-media', :'pic', :'B');
select t.ok(true, 'Bob uploads a picture into the couple''s folder');
select t.fails(format('insert into storage.objects (bucket_id, name, owner) values (%L, %L, %L)', 'chat-media', :'ws' || '/' || :'A' || '/33333333-3333-4333-8333-333333333333.jpg', :'B'),
  'row-level security', 'Bob cannot upload into Alice''s folder');
select t.fails(format('insert into storage.objects (bucket_id, name, owner) values (%L, %L, %L)', 'chat-media', 'not-a-uuid/' || :'B' || '/x.jpg', :'B'),
  'row-level security', 'a malformed path is refused (no crash)');
select t.fails(format('insert into storage.objects (bucket_id, name, owner) values (%L, %L, %L)', 'chat-media', :'ws' || '/' || :'B' || '/44444444-4444-4444-8444-444444444444.html', :'B'),
  'row-level security', 'only pictures (jpg, png, webp)');
select t.as_user(:'A');
select t.ok(t.n(format('select * from storage.objects where name = %L', :'pic')) = 0, 'a picture not yet sent in a message stays private to its uploader');
select t.as_user(:'B');
insert into public.messages (client_id, workspace_id, author_id, image_path) values (gen_random_uuid(), :'ws', :'B', :'pic');
select t.as_user(:'A');
select t.ok(t.n(format('select * from storage.objects where name = %L', :'pic')) = 1, 'Alice can open Bob''s picture once it is sent');
\set apic :ws/:A/66666666-6666-4666-8666-666666666666.jpg
insert into storage.objects (bucket_id, name, owner) values ('chat-media', :'apic', :'A');
select t.as_user(:'B');
delete from storage.objects where name = :'apic';
reset role;
select t.ok(exists (select 1 from storage.objects where name = :'apic'), 'an active member cannot delete someone else''s picture');
set role authenticated;
select t.as_user(:'A');
select t.as_user(:'D');
select t.ok(t.n(format('select * from storage.objects where name = %L', :'pic')) = 0, 'a stranger who guesses the path gets nothing');
select t.as_user(:'A');
\set av :A/55555555-5555-4555-8555-555555555555.webp
insert into storage.objects (bucket_id, name, owner) values ('avatars', :'av', :'A');
update public.profiles set avatar_path = :'av' where id = :'A';
select t.ok(true, 'Alice uploads her avatar');
select t.fails(format('update public.profiles set avatar_path = %L where id = %L', :'B' || '/55555555-5555-4555-8555-555555555555.webp', :'A'), 'check constraint',
  'Alice cannot point her avatar to someone else''s file');
select t.as_user(:'B');
select t.ok(t.n(format('select * from storage.objects where name = %L', :'av')) = 1, 'Bob sees Alice''s avatar (they share a space)');
select t.as_user(:'D');
select t.ok(t.n(format('select * from storage.objects where name = %L', :'av')) = 0, 'a stranger does not see Alice''s avatar');

-- ===================================================================== profile rights
select t.as_user(:'A');
update public.profiles set display_name = 'Hacked' where id = :'B';
reset role;
select t.ok((select display_name from public.profiles where id = :'B') = 'Bob', 'Alice cannot rename Bob');
set role authenticated;
select t.as_user(:'A');
select t.fails(format('update public.profiles set id = %L where id = %L', :'D', :'A'), 'permission denied', 'nobody changes a profile''s id');

-- ===================================================================== removal: access ends at once
select public.remove_member(:'ws', :'B') \gset
select t.as_user(:'B');
select t.ok(t.n('select * from public.messages where author_id <> auth.uid() or author_id is null') = 0, 'removed: Bob no longer reads Alice''s messages');
select t.ok(t.n(format('select * from storage.objects where bucket_id = %L and name not like %L', 'chat-media', '%/' || :'B' || '/%')) = 0, 'removed: Bob no longer opens Alice''s pictures');
select t.ok(t.n('select * from public.messages where author_id = auth.uid() and deleted_at is null') >= 1, 'removed: Bob still sees his own messages (to delete them)');
select t.ok(t.n(format('select * from storage.objects where name = %L', :'pic')) = 1, 'removed: Bob still sees his own picture (to delete it)');
delete from storage.objects where name = :'apic';
select t.fails(format('select public.delete_message(%L)', :'m1'), 'not found', 'removed: Bob cannot delete Alice''s message');
reset role;
select t.ok(exists (select 1 from storage.objects where name = :'apic'), 'removed: Bob''s attempt to delete Alice''s picture leaves it in place');
set role authenticated;
select t.as_user(:'B');
select public.delete_message(:'m2') \gset
delete from storage.objects where bucket_id = 'chat-media' and name = :'pic';
reset role;
select t.ok((select body is null from public.messages where id = :'m2') and not exists (select 1 from storage.objects where name = :'pic'),
  'removed: Bob can still erase his own message and picture (his content stays his)');
set role authenticated;
select t.as_user(:'B');
select t.fails(format('select t.send(%L, %L)', :'ws', 'encore là ?'), 'row-level security', 'removed: Bob cannot post');
select t.fails(format('select public.publish_workout_event(%L, %L, %L)', :'ws', 'started', 'w2'), 'sharing is off', 'removed: Bob cannot publish');
select t.ok(t.n('select * from public.workspaces') = 0, 'removed: the space disappears from Bob''s list');

-- ===================================================================== friends space: history, blocks, owner leaving
select t.as_user(:'C');
select public.create_workspace('Salle du lundi', 'friends', 5) as fw \gset
select t.send(:'fw', 'avant ton arrivée') as old \gset
select public.create_invitation(:'fw', 5) as ftok \gset
select pg_sleep(0.01);
select t.as_user(:'E');
select public.accept_invitation(:'ftok') \gset
select t.ok(t.n(format('select * from public.messages where workspace_id = %L', :'fw')) = 0, 'a new friend does not read what was said before joining');
select t.as_user(:'C');
select t.send(:'fw', 'bienvenue') \gset
select t.as_user(:'E');
select t.ok(t.n(format('select * from public.messages where workspace_id = %L', :'fw')) = 1, '…but reads what is said after');
select t.as_user(:'D');
select public.accept_invitation(:'ftok') \gset
select t.as_user(:'E');
select t.send(:'fw', 'message de E') \gset
select t.as_user(:'C');
insert into public.user_blocks (blocker_id, blocked_id) values (:'C', :'E');
select t.ok(t.n(format('select * from public.messages where workspace_id = %L and author_id = %L', :'fw', :'E')) = 0, 'Chloé blocks E: E''s messages are hidden for her');
select t.as_user(:'D');
select t.ok(t.n(format('select * from public.messages where workspace_id = %L and author_id = %L', :'fw', :'E')) = 1, '…but still visible to the others');
select t.fails(format('insert into public.user_blocks (blocker_id, blocked_id) values (%L, %L)', :'E', :'D'), 'row-level security', 'D cannot create a block in E''s name');
select t.as_user(:'C');
select public.create_workspace('Autre groupe', 'friends') as fw2 \gset
select public.create_invitation(:'fw2') as btok \gset
select t.as_user(:'E');
select t.fails(format('select public.accept_invitation(%L)', :'btok'), 'invalid or expired', 'a blocked person cannot join a space of the person who blocked him');
-- explicit transfer in a space of three, to the most recent member (not the next in line)
select t.as_user(:'C');
select public.transfer_ownership(:'fw', :'D') \gset
reset role;
select t.ok((select owner_id from public.workspaces where id = :'fw') = :'D'::uuid
  and (select count(*) from public.workspace_members where workspace_id = :'fw' and role = 'owner' and status = 'active') = 1
  and (select role from public.workspace_members where workspace_id = :'fw' and user_id = :'C') = 'member'
  and (select status from public.workspace_members where workspace_id = :'fw' and user_id = :'C') = 'active',
  'transfer to the most recent member: he is the only owner, the former owner stays a member');
set role authenticated;
select t.as_user(:'D');
select public.transfer_ownership(:'fw', :'C') \gset
select t.as_user(:'C');
select public.leave_workspace(:'fw') \gset
reset role;
select t.ok((select owner_id from public.workspaces where id = :'fw') = :'E'::uuid, 'owner leaves: the longest-standing member becomes owner');
select t.ok((select count(*) from public.workspace_members where workspace_id = :'fw' and role = 'owner' and status = 'active') = 1, 'always exactly one active owner');
set role authenticated;
select t.as_user(:'C');
select public.leave_workspace(:'fw2') \gset
reset role;
select t.ok(not exists (select 1 from public.workspaces where id = :'fw2'), 'last member leaves: the space and its data are deleted');

-- ===================================================================== rate limit
set role authenticated;
select t.as_user(:'E');
select t.fails(format('select t.send(%L, ''spam'') from generate_series(1, 40)', :'fw'), 'too many messages', 'more than 30 messages a minute is refused');

-- ===================================================================== account deletion (service side)
reset role;
select t.ok((select count(*) from public.messages where author_id = :'E') > 0, '(setup) E has messages');
delete from auth.users where id = :'E';
select t.ok(not exists (select 1 from public.profiles where id = :'E'), 'deleted account: profile gone');
select t.ok(not exists (select 1 from public.workspace_members where user_id = :'E'), 'deleted account: memberships gone');
select t.ok((select owner_id from public.workspaces where id = :'fw') = :'D'::uuid, 'deleted owner: ownership passes to the next member');
select t.ok(exists (select 1 from public.messages where workspace_id = :'fw' and author_id is null), 'deleted account: its messages stay for the others, anonymous');
select t.fails(format('delete from auth.users where id = %L', :'A'), 'files first', 'an account with files left cannot be deleted (no orphan files)');
-- the deletion function does this through the Storage API: every avatar and chat picture of the account
delete from storage.objects where (bucket_id = 'avatars' and split_part(name, '/', 1) = :'A') or (bucket_id = 'chat-media' and split_part(name, '/', 2) = :'A');
delete from auth.users where id = :'A';
select t.ok(not exists (select 1 from public.workspaces where id = :'ws'), 'files removed first, then the account: the couple space is deleted');
select t.ok(not exists (select 1 from public.profiles where id = :'A'), '…and the profile with it');
-- client roles: read through policies, write through functions, nothing structural
select t.ok(not exists (select 1 from information_schema.role_table_grants where table_schema = 'public'
  and grantee in ('anon', 'authenticated') and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER')), 'client roles have no TRUNCATE / REFERENCES / TRIGGER right');
select t.ok(not exists (select 1 from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon'), 'not signed in: no right on any table');
select t.ok(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
  and has_function_privilege('anon', p.oid, 'execute')), 'not signed in: no function callable (found on staging: try_uuid)');
create function public.zz_future_probe() returns int language sql as 'select 1';
select t.ok(not has_function_privilege('anon', 'public.zz_future_probe()', 'execute'), 'not signed in: a function added later is not callable either');
drop function public.zz_future_probe();
select t.ok(not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  'row level security is on for every table');
\echo SECURITY-SUITE-DONE
