// webpush.ts against independent implementations: the reference RFC 8291 code decrypts what we encrypt (for a key pair
// made like a phone makes it), and Node's own crypto verifies the VAPID signature. Run: tsx --test supabase/functions/push/test/*.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { decrypt } from './ece.reference.mjs';
import { encrypt, vapidAuthorization, vapidPublicKey, b64u, unb64u, send, PUSH_SERVICE } from '../webpush.ts';

const phone = () => { const k = crypto.createECDH('prime256v1'); k.generateKeys(); return { k, pub: new Uint8Array(k.getPublicKey()), auth: new Uint8Array(crypto.randomBytes(16)) }; };
const payload = JSON.stringify({ title: 'Équipe', body: 'Alice : Séance à 18 h ? 💪', url: '#/space/x', tag: 'space-x' });

test('a phone decrypts the notification with the reference implementation (RFC 8291, aes128gcm)', async () => {
  const p = phone();
  const body = await encrypt(new TextEncoder().encode(payload), p.pub, p.auth);
  const out = decrypt(Buffer.from(body), { version: 'aes128gcm', privateKey: p.k, authSecret: Buffer.from(p.auth) });
  assert.equal(out.toString('utf8'), payload);
  assert.equal(body.length, 86 + new TextEncoder().encode(payload).length + 1 + 16, 'header 86 bytes + text + delimiter + tag: one record, no padding');
});

test('every message uses a new key and salt: the same text never looks the same twice', async () => {
  const p = phone();
  const a = await encrypt(new TextEncoder().encode(payload), p.pub, p.auth), b = await encrypt(new TextEncoder().encode(payload), p.pub, p.auth);
  assert.notDeepEqual(a.slice(0, 86), b.slice(0, 86));
});

test('another phone (other keys) cannot read it', async () => {
  const p = phone(), q = phone();
  const body = await encrypt(new TextEncoder().encode(payload), p.pub, p.auth);
  assert.throws(() => decrypt(Buffer.from(body), { version: 'aes128gcm', privateKey: q.k, authSecret: Buffer.from(p.auth) }));
  assert.throws(() => decrypt(Buffer.from(body), { version: 'aes128gcm', privateKey: p.k, authSecret: Buffer.from(q.auth) }));
});

test('malformed device keys and oversized messages are refused', async () => {
  const p = phone();
  await assert.rejects(encrypt(new Uint8Array(10), p.pub.slice(1), p.auth));
  await assert.rejects(encrypt(new Uint8Array(4000), p.pub, p.auth));
});

test('VAPID: ES256 token for the push service only, valid one hour, verified with Node\'s crypto', async () => {
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = privateKey.export({ format: 'jwk' });
  const now = Date.UTC(2026, 10, 15, 12);
  const h = await vapidAuthorization('https://web.push.apple.com/QAbc', { jwk, subject: 'https://collabfit.example' }, now);
  const m = /^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/.exec(h);
  assert.ok(m, h);
  const [, head, claims, sig, k] = m!;
  assert.deepEqual(JSON.parse(Buffer.from(head!, 'base64url').toString()), { typ: 'JWT', alg: 'ES256' });
  assert.deepEqual(JSON.parse(Buffer.from(claims!, 'base64url').toString()), { aud: 'https://web.push.apple.com', exp: now / 1000 + 3600, sub: 'https://collabfit.example' });
  const pub = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: jwk.x!, y: jwk.y! }, format: 'jwk' });
  assert.ok(crypto.verify('sha256', Buffer.from(`${head}.${claims}`), { key: pub, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig!, 'base64url')));
  assert.equal(k, vapidPublicKey(jwk));
  assert.equal(unb64u(k!).length, 65);
  assert.equal(b64u(unb64u(k!)), k);
});

test('only the known push services: never another server', async () => {
  for (const ok of ['https://web.push.apple.com/QAbc', 'https://fcm.googleapis.com/fcm/send/a:b', 'https://updates.push.services.mozilla.com/wpush/v2/x', 'https://wns2-par02p.notify.windows.com/w/?token=a%2B'])
    assert.ok(PUSH_SERVICE.test(ok), ok);
  for (const bad of ['https://evil.example/x', 'http://web.push.apple.com/x', 'https://web.push.apple.com.evil.example/x', 'https://evil.example/https://web.push.apple.com/x', 'https://web.push.apple.com/a b'])
    assert.ok(!PUSH_SERVICE.test(bad), bad);
  const p = phone(); let called = false;
  const real = globalThis.fetch; globalThis.fetch = (async () => { called = true; return new Response(null, { status: 201 }); }) as typeof fetch;
  try {
    const r = await send({ endpoint: 'https://evil.example/x', p256dh: b64u(p.pub), auth: b64u(p.auth) }, {}, { jwk: {}, subject: 'x' }, { ttl: 60, urgency: 'high' });
    assert.equal(r.status, 0); assert.equal(called, false);
  } finally { globalThis.fetch = real; }
});

test('what is sent to the push service: encrypted body, the four headers, no redirect followed', async () => {
  const p = phone(), { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  let seen: { url: string; init: RequestInit } | null = null;
  const real = globalThis.fetch; globalThis.fetch = (async (url: string, init: RequestInit) => { seen = { url, init }; return new Response(null, { status: 201 }); }) as typeof fetch;
  try {
    const r = await send({ endpoint: 'https://web.push.apple.com/QAbc', p256dh: b64u(p.pub), auth: b64u(p.auth) }, JSON.parse(payload), { jwk: privateKey.export({ format: 'jwk' }), subject: 'https://collabfit.example' }, { ttl: 86400, urgency: 'high' });
    assert.equal(r.status, 201);
    const h = seen!.init.headers as Record<string, string>;
    assert.equal(h.TTL, '86400'); assert.equal(h.Urgency, 'high'); assert.equal(h['Content-Encoding'], 'aes128gcm'); assert.match(h.Authorization!, /^vapid t=/);
    assert.equal(seen!.init.redirect, 'manual');
    const out = decrypt(Buffer.from(seen!.init.body as Uint8Array), { version: 'aes128gcm', privateKey: p.k, authSecret: Buffer.from(p.auth) });
    assert.deepEqual(JSON.parse(out.toString()), JSON.parse(payload));
  } finally { globalThis.fetch = real; }
});
