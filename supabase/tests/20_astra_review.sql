-- Astra adversarial regression tests. Run after 10_security.sql.
-- Intentionally fails on confirmed vulnerabilities. Never run against production.
\set ON_ERROR_STOP 1
\set QUIET 1
\set F 'ffffffff-ffff-4fff-8fff-ffffffffffff'
\set G '99999999-9999-4999-8999-999999999999'
\set H '88888888-8888-4888-8888-888888888888'

reset role;
insert into auth.users(id,email) values
(:'F','astra-f@test.invalid'),(:'G','astra-g@test.invalid'),(:'H','astra-h@test.invalid');
set role authenticated;
select t.as_user(:'F');
select public.create_workspace('Astra private friends','friends',3) as aw gset
select public.create_invitation(:'aw') as atok gset
select t.as_user(:'G');
select public.accept_invitation(:'atok') as joined gset

-- FINDING A1 (HIGH): a removed user can still DELETE files they uploaded to a
-- former workspace because chat_media_delete_own only checks folder user_id,
-- not active membership. No upload is necessary: a storage.objects row suffices.
\set aphoto :aw/:G/77777777-7777-4777-8777-777777777777.jpg
insert into storage.objects(bucket_id,name,owner) values('chat-media',:'aphoto',:'G');
select t.as_user(:'F');
select public.remove_member(:'aw',:'G');
select t.as_user(:'G');
-- Expected: zero deleted rows. Actual in PR #6: one row deleted.
with removed as (
  delete from storage.objects
  where bucket_id='chat-media' and name=:'aphoto'
  returning id
)
select t.ok((select count(*) from removed)=0,
 'A1 HIGH: removed member must not delete media from a former workspace');

-- FINDING A2 (HIGH availability/integrity): transfer_ownership must work when
-- there are multiple active members. keep_an_owner runs on demotion and can
-- preemptively promote the longest-standing member, colliding with the
-- partial unique index or changing the requested heir.
select t.as_user(:'F');
select public.create_invitation(:'aw') as atok2 \gset
select t.as_user(:'H');
select public.accept_invitation(:'atok2') \gset
-- G was removed; H is now the only other active member. The RPC should
-- succeed; catch errors as a FAIL with diagnostic rather than aborting.
select t.as_user(:'F');
do $$
declare target uuid := '88888888-8888-4888-8888-888888888888'::uuid;
        wid uuid;
begin
  select workspace_id into wid from public.workspace_members
  where user_id='ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid
    and role='owner' and status='active' and workspace_id in
      (select id from public.workspaces where name='Astra private friends');
  begin
    perform public.transfer_ownership(wid,target);
  exception when others then
    raise exception 'FAIL A2: ownership transfer raised %', sqlerrm;
  end;
  if not exists(select 1 from public.workspaces where id=wid and owner_id=target) then
    raise exception 'FAIL A2: ownership did not transfer to requested user';
  end if;
  raise notice 'PASS A2: ownership transferred';
end $$;

-- Additional negative controls: stranger cannot read/write workspace.
select t.as_user(:'G');
select t.ok(t.n(format('select * from public.messages where workspace_id=%L',:'aw'))=0,
 'removed member cannot read messages');
select t.fails(format('select t.send(%L,%L)',:'aw','intrusion'),
 'row-level security','removed member cannot write messages');
