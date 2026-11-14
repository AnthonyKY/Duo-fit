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

-- Additional negative controls: stranger cannot read/write workspace.
select t.as_user(:'G');
select t.ok(t.n(format('select * from public.messages where workspace_id=%L',:'aw'))=0,
 'removed member cannot read messages');
select t.fails(format('select t.send(%L,%L)',:'aw','intrusion'),
 'row-level security','removed member cannot write messages');

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

