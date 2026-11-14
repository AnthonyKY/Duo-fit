import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDisplayName, checkWorkspaceName, checkMessageBody, capacity, initials, LIMITS } from '../src/index.ts';

test('names are cleaned and bounded like the database', () => {
  assert.deepEqual(checkDisplayName('  Alice   Martin '), { ok: true, value: 'Alice Martin' });
  assert.deepEqual(checkDisplayName('   '), { ok: false, error: 'empty' });
  assert.deepEqual(checkDisplayName('A‮evil\u0000'), { ok: true, value: 'Aevil' }, 'direction tricks and control characters removed');
  assert.equal(checkDisplayName('x'.repeat(41)).ok, false);
  assert.equal(checkDisplayName('é'.repeat(40)).ok, true, 'counts characters, not bytes');
  assert.equal(checkWorkspaceName('Salle du lundi').ok, true);
});
test('messages keep line breaks, refuse empty and too long', () => {
  assert.deepEqual(checkMessageBody(' Salut\r\nça va ? '), { ok: true, value: 'Salut\nça va ?' });
  assert.deepEqual(checkMessageBody('\n\n'), { ok: false, error: 'empty' });
  assert.equal(checkMessageBody('a'.repeat(LIMITS.messageBody + 1)).ok, false);
});
test('capacity: a couple is always 2, friends 2 to 20 (default 10)', () => {
  assert.equal(capacity('couple', 9), 2);
  assert.equal(capacity('friends'), 10);
  assert.equal(capacity('friends', 20), 20);
  assert.throws(() => capacity('friends', 21));
  assert.throws(() => capacity('friends', 1));
});
test('initials for avatars', () => {
  assert.equal(initials('alice martin'), 'AM');
  assert.equal(initials('Bob'), 'B');
  assert.equal(initials('  '), '?');
});
