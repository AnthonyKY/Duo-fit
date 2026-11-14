import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Outbox, readDuofit, legacyWorkoutEvents } from '../src/index.ts';

test('outbox: same message added twice is kept once, sent in order', () => {
  const o = new Outbox<{ body: string }>();
  assert.equal(o.add('c1', { body: 'a' }, 1000), true);
  assert.equal(o.add('c1', { body: 'a' }, 1001), false);
  o.add('c2', { body: 'b' }, 1002);
  assert.deepEqual(o.due(2000).map(i => i.clientId), ['c1', 'c2']);
  o.sent('c1');
  assert.deepEqual(o.items.map(i => i.clientId), ['c2']);
});
test('outbox: offline retries wait 2 s, 4 s, 8 s … then stop, and can be retried by hand', () => {
  const o = new Outbox<number>([], { baseMs: 2000, maxMs: 300_000, maxAttempts: 3 });
  o.add('m', 1, 0);
  o.failed('m', 0, 'offline'); assert.equal(o.items[0]?.nextAt, 2000);
  assert.equal(o.due(1999).length, 0);
  o.failed('m', 2000, 'offline'); assert.equal(o.items[0]?.nextAt, 6000);
  o.failed('m', 6000, 'offline'); assert.equal(o.items[0]?.dead, true);
  assert.equal(o.due(1e9).length, 0, 'gives up after the limit');
  o.retry('m', 10); assert.equal(o.due(10).length, 1);
  o.failed('m', 0, 'forbidden', true); assert.equal(o.items[0]?.dead, true, 'a refusal is not retried');
});
test('outbox survives a reload and drops damaged entries', () => {
  const o = new Outbox<string>(); o.add('x', 'hi', 5);
  const back = Outbox.from(JSON.parse(JSON.stringify(o)), (p): p is string => typeof p === 'string');
  assert.deepEqual(back.items.map(i => i.clientId), ['x']);
  assert.equal(Outbox.from([{ clientId: 1 }, null, 'x'], (p): p is string => true).items.length, 0);
});

const sample = JSON.stringify({ p: 'F', d: {
  M: { logs: [{ date: 1000, wk: 'A', durSec: 3000 }, { date: 5000, wk: 'B', dur: 47 }], cur: { wk: 'C', start: 9000 } },
  F: { logs: [], cur: null } } });
test('DUOFIT bridge reads, never needs to write', () => {
  const r = readDuofit(sample);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.active, 'F');
  assert.deepEqual(r.profiles[0], { profile: 'M', sessions: 2, last: { date: 5000, workout: 'B', minutes: 47 }, inProgress: { workout: 'C', startedAt: 9000 } });
  assert.deepEqual(r.profiles[1], { profile: 'F', sessions: 0, last: null, inProgress: null });
  assert.deepEqual(readDuofit(null), { ok: false, reason: 'missing' });
  assert.deepEqual(readDuofit('{oops'), { ok: false, reason: 'unreadable' });
});
test('workout moments to share have stable references and no content', () => {
  assert.deepEqual(legacyWorkoutEvents(sample, 'M', 2000), [{ type: 'completed', ref: 'c5000', at: 5000 }, { type: 'started', ref: 's9000', at: 9000 }]);
  assert.deepEqual(legacyWorkoutEvents(sample, 'F', 0), []);
  assert.deepEqual(legacyWorkoutEvents('nope', 'M', 0), []);
});
