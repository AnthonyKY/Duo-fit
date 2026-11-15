import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkEmail, checkPassword, authProblem } from '../src/index.ts';

test('e-mail: trimmed, plausible shape only', () => {
  assert.deepEqual(checkEmail('  alice@example.com '), { ok: true, value: 'alice@example.com' });
  assert.deepEqual(checkEmail(''), { ok: false, error: 'empty' });
  for (const bad of ['alice', 'alice@', '@example.com', 'a b@example.com', 'alice@example', 'x'.repeat(250) + '@example.com'])
    assert.equal(checkEmail(bad).ok, false, bad);
});
test('password: 10 characters at least, 72 bytes at most (what the hash keeps)', () => {
  assert.deepEqual(checkPassword('123456789'), { ok: false, error: 'short' });
  assert.equal(checkPassword('1234567890').ok, true);
  assert.equal(checkPassword('é'.repeat(36)).ok, true, '36 accented letters = 72 bytes');
  assert.deepEqual(checkPassword('é'.repeat(37)), { ok: false, error: 'long' });
  assert.deepEqual(checkPassword(''), { ok: false, error: 'empty' });
});
test('Supabase Auth answers become a few clear cases', () => {
  assert.equal(authProblem(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }), 'invalid-credentials');
  assert.equal(authProblem(422, { error_code: 'user_already_exists' }), 'email-taken');
  assert.equal(authProblem(422, { error_code: 'weak_password' }), 'weak-password');
  assert.equal(authProblem(429, { error_code: 'over_request_rate_limit' }), 'rate-limited');
  assert.equal(authProblem(400, { error_code: 'email_address_invalid' }), 'email-invalid');
  assert.equal(authProblem(422, { error_code: 'signup_disabled' }), 'signup-closed');
  assert.equal(authProblem(400, { error_code: 'refresh_token_not_found' }), 'session-expired');
  assert.equal(authProblem(0, null), 'offline');
  assert.equal(authProblem(500, 'oops'), 'unknown');
});

import { dbProblem, friendsCapacity } from '../src/index.ts';
test('database refusals become clear cases (codes raised by the schema functions)', () => {
  assert.equal(dbProblem(400, { code: '23514', message: 'this space is full' }), 'space-full');
  assert.equal(dbProblem(400, { code: '22023', message: 'invalid or expired invitation' }), 'invite-invalid');
  assert.equal(dbProblem(409, { code: '23505', message: 'already in a couple space' }), 'already-couple');
  assert.equal(dbProblem(409, { code: '23505', message: 'duplicate key value violates unique constraint' }), 'duplicate');
  assert.equal(dbProblem(400, { code: '54000', message: 'too many messages, wait a minute' }), 'too-many');
  assert.equal(dbProblem(403, { code: '42501', message: 'only the owner can invite' }), 'not-allowed');
  assert.equal(dbProblem(400, { code: 'P0002', message: 'not a member' }), 'not-found');
  assert.equal(dbProblem(400, { code: '23514', message: 'new row violates check constraint' }), 'invalid-input');
  assert.equal(dbProblem(500, 'x'), null);
});
test('friends space: 2 to 20 people', () => {
  assert.equal(friendsCapacity(1), 2); assert.equal(friendsCapacity(25), 20); assert.equal(friendsCapacity('8'), 8); assert.equal(friendsCapacity('abc'), 10);
});
