import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkImage, avatarPath, chatMediaPath, inviteLink, parseInvite, avatarSvg } from '../src/index.ts';

const U = '11111111-1111-4111-8111-111111111111', W = '22222222-2222-4222-8222-222222222222', F = '33333333-3333-4333-8333-333333333333';
test('pictures only, size limits per use', () => {
  assert.deepEqual(checkImage({ type: 'image/webp', size: 100_000 }, 'avatar'), { ok: true, ext: 'webp' });
  assert.deepEqual(checkImage({ type: 'image/svg+xml', size: 10 }, 'chat'), { ok: false, error: 'type' }, 'SVG can carry scripts: refused');
  assert.deepEqual(checkImage({ type: 'image/jpeg', size: 3 * 1024 * 1024 }, 'avatar'), { ok: false, error: 'size' });
  assert.deepEqual(checkImage({ type: 'image/jpeg', size: 3 * 1024 * 1024 }, 'chat'), { ok: true, ext: 'jpg' });
});
test('storage paths have the shapes the storage rules expect', () => {
  assert.equal(avatarPath(U, F, 'png'), `${U}/${F}.png`);
  assert.equal(chatMediaPath(W, U, F, 'jpg'), `${W}/${U}/${F}.jpg`);
  assert.throws(() => chatMediaPath('../etc', U, F, 'jpg'), 'no path tricks');
});
test('invitation links', () => {
  const tok = 'abcdefghijklmnopqrstuvwxyzAB-_12';
  const link = inviteLink('https://example.app/collabfit/', tok);
  assert.equal(link, `https://example.app/collabfit/#/join/${tok}`);
  assert.equal(parseInvite(link), tok);
  assert.equal(parseInvite(`  ${tok} `), tok);
  assert.equal(parseInvite('https://evil.example/#/join/short'), null);
  assert.throws(() => inviteLink('https://x/', 'bad token'));
});
test('generated avatar: same seed same picture, labels escaped', () => {
  assert.equal(avatarSvg('a1b2c3d4', 'AM'), avatarSvg('a1b2c3d4', 'AM'));
  assert.notEqual(avatarSvg('a1b2c3d4', 'AM'), avatarSvg('ffff0000', 'AM'));
  assert.ok(!avatarSvg('a1b2c3d4', '<b').includes('<b') && avatarSvg('a1b2c3d4', '<b').includes('&lt;b'), 'no markup injection through the name');
});
