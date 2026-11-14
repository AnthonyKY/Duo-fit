-- Regression contracts for the disposable database created by scripts/db-test.sh.
-- Print all mismatches before returning a single nonzero exit status.
\set ON_ERROR_STOP 1
begin;
create temporary table review_results (label text primary key, passed boolean not null);
grant insert on review_results to authenticated;

insert into auth.users(email) values ('creator@review.invalid') returning id as creator \gset
insert into auth.users(email) values ('earlier@review.invalid') returning id as earlier \gset
insert into auth.users(email) values ('successor@review.invalid') returning id as successor \gset
set local role authenticated;
select t.as_user(:'creator');
select public.create_workspace('Review fixture', 'friends', 4) as space \gset
select public.create_invitation(:'space', 2) as invitation \gset
select t.as_user(:'earlier');
select public.accept_invitation(:'invitation');
select t.as_user(:'successor');
select public.accept_invitation(:'invitation');
reset role;
-- now() is constant inside a transaction. Establish a deterministic join order.
update public.workspace_members set joined_at = now() - interval '1 day'
where workspace_id = :'space' and user_id = :'earlier';

set local role authenticated;
select t.as_user(:'creator');
select t.send(:'space', 'Membership control');
select public.create_invitation(:'space') as unused_invitation \gset
select set_config('review.space', :'space', true), set_config('review.successor', :'successor', true);
do $$
begin
  begin
    perform public.transfer_ownership(current_setting('review.space')::uuid, current_setting('review.successor')::uuid);
    insert into review_results select 'Explicit owner transfer to a later member',
      exists (select 1 from public.workspaces where id = current_setting('review.space')::uuid
        and owner_id = current_setting('review.successor')::uuid);
  exception when unique_violation then
    insert into review_results values ('Explicit owner transfer to a later member', false);
  end;
end $$;
reset role;
-- Use a privileged fixture to model removal independently of the transfer outcome.
update public.workspace_members set status = 'removed', left_at = now()
where workspace_id = :'space' and user_id = :'earlier';
set local role authenticated;
select t.as_user(:'earlier');
insert into review_results select 'Removed member sees no messages',
  not exists (select 1 from public.messages where workspace_id = :'space');
reset role;

-- Account deletion via the hosted Auth API requires Storage ownership to be
-- resolved first. The test double must enforce this prerequisite too.
insert into auth.users(email) values ('media-owner@review.invalid') returning id as media_owner \gset
insert into storage.objects(bucket_id,name,owner) values
  ('avatars', :'media_owner' || '/' || gen_random_uuid() || '.jpg', :'media_owner');
select set_config('review.media_owner', :'media_owner', true);
do $$
declare target uuid := current_setting('review.media_owner')::uuid;
begin
  begin
    delete from auth.users where id = target;
    insert into review_results select 'Account deletion cannot strand owned media',
      not exists (select 1 from storage.objects where owner = target);
  exception when foreign_key_violation then
    insert into review_results values ('Account deletion cannot strand owned media', true);
  end;
end $$;

-- Inspect effective client grants, without exercising elevated privileges.
insert into review_results
select 'Client needs no trigger-definition privilege on workspace tables',
  not exists (select 1 from (values ('public.workspaces'), ('public.workspace_members'),
    ('public.workspace_invitations'), ('public.messages')) as tables(name)
    where has_table_privilege('authenticated', name, 'TRIGGER'));

-- Positive control: removed users cannot see private Storage rows, and active
-- users can. Seed as the fixture owner so write privileges do not affect this test.
insert into storage.objects(bucket_id,name,owner) values
  ('chat-media', :'space' || '/' || :'creator' || '/' || gen_random_uuid() || '.jpg', :'creator')
  returning id as photo \gset
set local role authenticated;
select t.as_user(:'earlier');
insert into review_results select 'Removed member sees no space photo',
  not exists (select 1 from storage.objects where id = :'photo');
select t.as_user(:'successor');
insert into review_results select 'Active member sees fixture photo',
  exists (select 1 from storage.objects where id = :'photo');
reset role;

do $$
declare r record; failures integer := 0;
begin
  for r in select * from review_results order by label loop
    if r.passed then raise notice 'PASS %', r.label;
    else raise warning 'FAIL %', r.label; failures := failures + 1; end if;
  end loop;
  if failures > 0 then raise exception 'FAIL % review contracts', failures; end if;
end $$;
rollback;
