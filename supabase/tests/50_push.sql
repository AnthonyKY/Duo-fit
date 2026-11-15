-- Push notifications: devices belong to their owner, only known push services, and the recipients of a message or a
-- workout follow exactly the reading rules (active member, joined before, not blocked) plus each person's choices.
\set ON_ERROR_STOP 1
\set QUIET 1
begin;
insert into auth.users (email, raw_user_meta_data) values ('a@push.invalid', '{"display_name":"Alice"}') returning id as a \gset
insert into auth.users (email, raw_user_meta_data) values ('b@push.invalid', '{"display_name":"Bob"}') returning id as b \gset
insert into auth.users (email, raw_user_meta_data) values ('c@push.invalid', '{"display_name":"Chloé"}') returning id as c \gset
insert into auth.users (email, raw_user_meta_data) values ('d@push.invalid', '{"display_name":"Dan"}') returning id as d \gset
insert into auth.users (email, raw_user_meta_data) values ('f@push.invalid', '{"display_name":"Fanny"}') returning id as f \gset
insert into auth.users (email, raw_user_meta_data) values ('e@push.invalid', '{"display_name":"Eve"}') returning id as e \gset
\set K '''AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'''
\set S '''BBBBBBBBBBBBBBBBBBBBBB'''
grant usage on schema t to service_role; grant execute on all functions in schema t to service_role; -- the checks run as the server too
set local role authenticated;

-- a friends space: Alice (owner), Bob, Chloé, Dan, Fanny; Eve is outside
select t.as_user(:'a');
select public.create_workspace('Équipe', 'friends', 10) as ws \gset
select public.create_invitation(:'ws', 10) as tok \gset
select t.as_user(:'b'); select public.accept_invitation(:'tok');
select t.as_user(:'c'); select public.accept_invitation(:'tok');
select t.as_user(:'d'); select public.accept_invitation(:'tok');
select t.as_user(:'f'); select public.accept_invitation(:'tok');

-- ---------------------------------------------------------------- devices
select t.as_user(:'b');
select public.save_push_subscription('https://web.push.apple.com/QBobPhone1', :K, :S, 'fr');
select t.ok(t.n('select * from public.push_subscriptions') = 1, 'a person saves their device and reads it back');
select t.fails(format('select public.save_push_subscription(%L, %L, %L, ''fr'')', 'https://evil.example.com/x', :K, :S), 'check constraint', 'a device address outside the known push services is refused (the server never calls anywhere else)');
select t.fails(format('select public.save_push_subscription(%L, %L, %L, ''fr'')', 'http://web.push.apple.com/x', :K, :S), 'check constraint', 'plain http refused');
select t.fails(format('select public.save_push_subscription(%L, %L, %L, ''fr'')', 'https://web.push.apple.com/x', 'short', :S), 'check constraint', 'a malformed device key is refused');
select t.fails(format('select public.save_push_subscription(%L, %L, %L, ''de'')', 'https://web.push.apple.com/x', :K, :S), 'check constraint', 'only French or English texts');
select t.fails(format('insert into public.push_subscriptions (endpoint, user_id, p256dh, auth) values (%L, %L, %L, %L)', 'https://web.push.apple.com/y', :'b', :K, :S), 'permission denied', 'no direct write, only the functions');
select t.fails('select * from public.push_sent', 'permission denied', 'what was announced is not readable');
select t.as_user(:'c'); select public.save_push_subscription('https://fcm.googleapis.com/fcm/send/chloe:1', :K, :S, 'en');
select t.as_user(:'d'); select public.save_push_subscription('https://web.push.apple.com/QDan', :K, :S, 'fr');
select t.as_user(:'f'); select public.save_push_subscription('https://updates.push.services.mozilla.com/wpush/v2/fanny', :K, :S, 'fr');
select t.as_user(:'e'); select public.save_push_subscription('https://wns2-par02p.notify.windows.com/w/?token=eve%2B1', :K, :S, 'fr');
select t.ok(t.n('select * from public.push_subscriptions') = 1, 'each person sees only their own devices');
select t.as_user(:'a');
select public.delete_push_subscription('https://web.push.apple.com/QBobPhone1');
select t.as_user(:'b');
select t.ok(t.n('select * from public.push_subscriptions') = 1, 'nobody can remove someone else''s device');
-- the same phone, signed in to another account: it follows its new owner
select t.as_user(:'e');
select public.save_push_subscription('https://web.push.apple.com/QBobPhone1', :K, :S, 'fr');
select t.ok(t.n('select * from public.push_subscriptions') = 2, 'a phone that changes account follows its new owner');
select t.as_user(:'b');
select t.ok(t.n('select * from public.push_subscriptions') = 0, '…and no longer notifies the previous one');
select public.save_push_subscription('https://web.push.apple.com/QBobPhone1', :K, :S, 'fr');
select t.as_user(:'e');
select public.delete_push_subscription('https://wns2-par02p.notify.windows.com/w/?token=eve%2B1');
select t.ok(t.n('select * from public.push_subscriptions') = 0, 'a person removes their own device');
select t.as_user(:'a');
select public.save_push_subscription('https://web.push.apple.com/QAlice' || g, :K, :S, 'fr') from generate_series(1, 12) g;
select t.ok(t.n('select * from public.push_subscriptions') = 10, 'at most 10 devices per person (the oldest are dropped)');
reset role;
delete from public.push_subscriptions where user_id = :'a';
set local role authenticated;

-- ---------------------------------------------------------------- choices per space
select t.as_user(:'f');
select public.set_message_notifications(:'ws', false);
select t.ok((select not notify_messages from public.workspace_members where workspace_id = :'ws' and user_id = :'f'), 'a person can mute a space''s messages');
select t.as_user(:'e');
select t.fails(format('select public.set_message_notifications(%L, true)', :'ws'), 'not a member', 'not for a space one is not in');
select t.as_user(:'c');
insert into public.user_blocks (blocker_id, blocked_id) values (:'c', :'a');
select t.as_user(:'b'); select public.set_workout_sharing(:'ws', false, true);

-- ---------------------------------------------------------------- a message from Alice
select t.as_user(:'a');
select t.send(:'ws', 'Séance à 18 h ?') as m1 \gset
select t.fails(format('select * from public.push_targets(%L, ''message'', %L)', :'a', :'m1'), 'permission denied', 'a phone cannot ask who will be notified (server only)');
select t.fails('select public.push_vapid_key()', 'permission denied', 'a phone cannot read the signing key (server only)');
reset role;
update public.workspace_members set joined_at = now() + interval '1 second' where workspace_id = :'ws' and user_id = :'d'; -- Dan arrives after
set local role service_role;
select t.ok(t.n(format('select * from public.push_targets(%L, ''message'', %L)', :'b', :'m1')) = 0, 'only the author can have a message announced');
create temp table got on commit drop as select * from public.push_targets(:'a', 'message', :'m1');
select t.ok((select array_agg(endpoint order by endpoint) from got) = array['https://web.push.apple.com/QBobPhone1'],
  'recipients: Bob only — not the author, not Chloé (she blocked Alice), not Dan (joined after), not Fanny (muted), not Eve (outside)');
select t.ok((select title = 'Équipe' and body = 'Alice : Séance à 18 h ?' and url = '#/space/' || :'ws' and tag = 'space-' || :'ws' from got),
  'what Bob''s phone shows: the space, "Alice : …" in French, a link to the space');
select t.ok(t.n(format('select * from public.push_targets(%L, ''message'', %L)', :'a', :'m1')) = 0, 'a message is announced once, even if asked again');
reset role;
set local role authenticated;
select t.as_user(:'a');
select t.send(:'ws', repeat('x', 300)) as m2 \gset
insert into public.messages (client_id, workspace_id, author_id, image_path) values (gen_random_uuid(), :'ws', :'a', :'ws' || '/' || :'a' || '/' || gen_random_uuid() || '.jpg') returning id as m3 \gset
select t.send(:'ws', 'old') as m4 \gset
select t.send(:'ws', 'erased') as m5 \gset
select public.delete_message(:'m5');
reset role;
update public.messages set created_at = now() - interval '11 minutes' where id = :'m4';
update public.push_subscriptions set lang = 'en' where endpoint = 'https://web.push.apple.com/QBobPhone1';
set local role service_role;
select t.ok((select char_length(body) = char_length('Alice: ') + 140 and body like '%…' from public.push_targets(:'a', 'message', :'m2')), 'a long message is cut at 140 characters; English punctuation for an English phone');
select t.ok((select body = 'Alice: 📷 Photo' from public.push_targets(:'a', 'message', :'m3')), 'a picture: "📷 Photo", never the picture itself');
select t.ok(t.n(format('select * from public.push_targets(%L, ''message'', %L)', :'a', :'m4')) = 0, 'nothing for a message older than 10 minutes');
select t.ok(t.n(format('select * from public.push_targets(%L, ''message'', %L)', :'a', :'m5')) = 0, 'nothing for a deleted message');
select t.fails(format('select * from public.push_targets(%L, ''spam'', %L)', :'a', :'m1'), 'unknown', 'unknown kinds refused');

-- ---------------------------------------------------------------- a workout shared by Alice
reset role;
set local role authenticated;
select t.as_user(:'a'); select public.set_workout_sharing(:'ws', true, false);
select public.publish_workout_event(:'ws', 'completed', 'w1') as w1 \gset
reset role;
set local role service_role;
create temp table gw on commit drop as select * from public.push_targets(:'a', 'workout', :'w1');
select t.ok((select array_agg(endpoint) from gw) = array['https://web.push.apple.com/QBobPhone1'] and (select body from gw) = 'Alice finished a workout ✅',
  'workouts: only those who asked for them (Bob), with the person''s name and nothing else');
select t.ok(t.n(format('select * from public.push_targets(%L, ''workout'', %L)', :'b', :'w1')) = 0, 'only the person who trained can have it announced');
select t.ok(t.n(format('select * from public.push_targets(%L, ''workout'', %L)', :'a', :'w1')) = 0, 'a workout is announced once');

-- ---------------------------------------------------------------- "send me a test", and what the push services answer
select t.ok(t.n(format('select * from public.push_targets(%L, ''test'', null)', :'b')) = 1, 'a test goes to the person''s own devices');
select t.ok(t.n(format('select * from public.push_targets(%L, ''test'', null)', :'b')) = 0, 'at most one test a minute');
select public.push_result(array[]::text[], array['https://web.push.apple.com/QDan'], array['https://fcm.googleapis.com/fcm/send/chloe:1']);
reset role;
select t.ok(not exists (select 1 from public.push_subscriptions where endpoint = 'https://web.push.apple.com/QDan'), 'a device the push service no longer knows is forgotten');
select t.ok((select failures from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/chloe:1') = 1, 'a failure is counted');
set local role service_role;
select public.push_result(array[]::text[], array[]::text[], array['https://fcm.googleapis.com/fcm/send/chloe:1']) from generate_series(1, 19);
reset role;
select t.ok(not exists (select 1 from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/chloe:1'), 'a device failing 20 times in a row is forgotten');
set local role anon;
select t.as_user(null);
select t.fails('select public.save_push_subscription(''https://web.push.apple.com/x'', null, null, null)', 'permission denied', 'not signed in: nothing');
reset role;
delete from auth.users where id = :'b';
select t.ok(not exists (select 1 from public.push_subscriptions where endpoint = 'https://web.push.apple.com/QBobPhone1'), 'account deleted: its devices go with it');
rollback;
