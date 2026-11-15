-- Training state follows the account, readable and writable by its owner only; two phones never erase each other.
\set ON_ERROR_STOP 1
\set QUIET 1
begin;
insert into auth.users (email) values ('runner@training.invalid') returning id as a \gset
insert into auth.users (email) values ('other@training.invalid') returning id as b \gset
set local role authenticated;
select t.as_user(:'a');
select t.ok(public.save_training('{"p":"M","d":{}}'::jsonb, 0) = 1, 'first save of a person''s training: version 1');
select t.ok((select data->>'p' from public.training_profiles where user_id = :'a') = 'M', 'the owner reads it back');
select t.ok(public.save_training('{"p":"F","d":{}}'::jsonb, 1) = 2, 'a save over the version read: version 2');
select t.fails('select public.save_training(''{"p":"M","d":{}}''::jsonb, 1)', 'another phone', 'a phone still on version 1 cannot erase version 2 (asked to merge)');
select t.fails('select public.save_training(''{"p":"M","d":{}}''::jsonb, 0)', 'another phone', 'a second "first save" cannot replace existing data');
select t.fails('select public.save_training(''[1,2]''::jsonb, 2)', 'refused', 'only an object is accepted');
select t.fails(format('select public.save_training(%L::jsonb, 2)', json_build_object('x', repeat('a', 3000001))::text), 'refused', 'more than 3 MB refused');
select t.fails(format('insert into public.training_profiles (user_id, data) values (%L, ''{}'')', :'a'), 'permission denied', 'no direct write, only the save function');
select t.fails(format('update public.training_profiles set version = 99 where user_id = %L', :'a'), 'permission denied', 'nobody edits the version directly');
select t.as_user(:'b');
select t.ok(t.n('select * from public.training_profiles') = 0, 'another person sees nothing of it');
select t.ok(public.save_training('{"p":"F","d":{}}'::jsonb, 0) = 1, 'the other person has their own');
select t.as_user(:'a');
select t.ok(t.n('select * from public.training_profiles') = 1, 'and the first one still sees only theirs');
reset role;
set local role anon;
select t.as_user(null);
select t.fails('select * from public.training_profiles', 'permission denied', 'not signed in: nothing');
reset role;
delete from auth.users where id = :'a';
select t.ok(not exists (select 1 from public.training_profiles where user_id = :'a'), 'account deleted: its training data goes with it');
rollback;
