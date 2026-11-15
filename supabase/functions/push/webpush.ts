// Web Push, written against the standards with the platform's own cryptography (WebCrypto) — no library to trust:
//   RFC 8291 (message encryption: only the receiving device can read the content, not Apple / Google / Mozilla)
//   RFC 8188 (aes128gcm content coding), RFC 8292 (VAPID: the push service knows the message comes from CollabFit).
// Runs the same in Supabase's Deno and in Node ≥ 20 (where test/webpush.test.ts checks it against the reference
// implementation of the encryption, and checks the signature with Node's own crypto).
const te = new TextEncoder();
const subtle = globalThis.crypto.subtle;

export function b64u(bytes: Uint8Array): string {
  let s = ''; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function unb64u(s: string): Uint8Array {
  const t = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0; for (const p of parts) { out.set(p, i); i += p.length; }
  return out;
};
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}

/** RFC 8291: the body of a push message for one device (its public key p256dh and its secret auth). One record. */
export async function encrypt(plaintext: Uint8Array, uaPublic: Uint8Array, authSecret: Uint8Array,
  fixed?: { serverKeys: CryptoKeyPair; salt: Uint8Array }): Promise<Uint8Array> {
  if (uaPublic.length !== 65 || uaPublic[0] !== 4 || authSecret.length !== 16) throw new Error('bad device keys');
  if (plaintext.length > 3800) throw new Error('message too long');
  const server = fixed?.serverKeys ?? await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
  const asPublic = new Uint8Array(await subtle.exportKey('raw', server.publicKey));
  const device = await subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: device }, server.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, concat(te.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = fixed?.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const key = await subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const sealed = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(plaintext, Uint8Array.of(2)))); // 2 = last record
  const header = new Uint8Array(21);
  header.set(salt, 0); new DataView(header.buffer).setUint32(16, 4096); header[20] = 65; // salt | record size | key id length
  return concat(header, asPublic, sealed);
}

export interface Vapid { jwk: JsonWebKey; subject: string }
/** the application server's public key, as the browsers want it (applicationServerKey) */
export const vapidPublicKey = (jwk: JsonWebKey) => b64u(concat(Uint8Array.of(4), unb64u(jwk.x!), unb64u(jwk.y!)));
/** RFC 8292: "vapid t=<signed token>, k=<public key>", valid 1 hour, for the push service of that address only */
export async function vapidAuthorization(endpoint: string, v: Vapid, now = Date.now()): Promise<string> {
  const head = b64u(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(te.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 3600, sub: v.subject })));
  const key = await subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', d: v.jwk.d, x: v.jwk.x, y: v.jwk.y, ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(`${head}.${claims}`)));
  return `vapid t=${head}.${claims}.${b64u(sig)}, k=${vapidPublicKey(v.jwk)}`;
}

// the only servers a push may be sent to (same list as the database's check): never anywhere else
export const PUSH_SERVICE = /^https:\/\/(web\.push\.apple\.com|fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.notify\.windows\.com)\/[!-~]+$/;
export interface Device { endpoint: string; p256dh: string; auth: string }
export interface Sent { endpoint: string; status: number; reason: string }
/** sends one notification; status 201 = accepted by the push service; 404 / 410 = the device is gone */
export async function send(d: Device, payload: unknown, v: Vapid, o: { ttl: number; urgency: 'high' | 'normal' }): Promise<Sent> {
  if (!PUSH_SERVICE.test(d.endpoint) || d.endpoint.length > 1000) return { endpoint: d.endpoint, status: 0, reason: 'not a push service' };
  try {
    const body = await encrypt(te.encode(JSON.stringify(payload)), unb64u(d.p256dh), unb64u(d.auth));
    const r = await fetch(d.endpoint, {
      method: 'POST', redirect: 'manual', body,
      headers: { TTL: String(o.ttl), Urgency: o.urgency, 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream',
        Authorization: await vapidAuthorization(d.endpoint, v) },
    });
    let reason = '';
    try { reason = (await r.text()).replace(/\s+/g, ' ').slice(0, 120); } catch { /* no body */ }
    return { endpoint: d.endpoint, status: r.status, reason };
  } catch (e) {
    return { endpoint: d.endpoint, status: 0, reason: String(e).slice(0, 120) };
  }
}
