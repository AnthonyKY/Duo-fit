// Push notifications. Runs on Supabase (Deno) with the project's server key and the VAPID key, both stored as
// Supabase secrets (set by the staging workflow, never in Git, never shown).
//   GET  /functions/v1/push                       → { key }: the public key a phone needs to subscribe
//   POST /functions/v1/push {kind, id}            → announces a message / workout the CALLER just posted, or a test
//        Authorization: Bearer <the user's session token>          kind = 'message' | 'workout' | 'test'
// Who is told, and what they see, is decided by the database (push_targets): same rules as reading, each person's
// choices, once per message. The content is encrypted for each device; the push services only carry it.
// Deployed with --no-verify-jwt: the caller is checked below by Supabase Auth itself (as delete-account).
import { send, vapidPublicKey, type Sent, type Vapid } from './webpush.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const serverKey = (() => {
  try { const k = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}'); if (k.default) return k.default as string; } catch { /* older projects */ }
  return Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
})();
const server = (extra: Record<string, string> = {}) => serverKey.startsWith('sb_secret_')
  ? { apikey: serverKey, ...extra } : { apikey: serverKey, Authorization: `Bearer ${serverKey}`, ...extra };
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const reply = (status: number, body: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', ...extra } });

const vapid: Vapid | null = (() => {
  try {
    const jwk = JSON.parse(Deno.env.get('VAPID_PRIVATE_JWK') ?? '') as JsonWebKey;
    if (jwk.kty !== 'EC' || jwk.crv !== 'P-256' || !jwk.d || !jwk.x || !jwk.y) return null;
    return { jwk, subject: Deno.env.get('VAPID_SUBJECT') || 'mailto:collabfit@example.com' };
  } catch { return null; }
})();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
type Target = { endpoint: string; p256dh: string; auth: string; lang: string; title: string; body: string; url: string; tag: string };

async function rpc<T>(fn: string, args: unknown): Promise<T> {
  const r = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: server({ 'Content-Type': 'application/json' }), body: JSON.stringify(args) });
  if (!r.ok) throw new Error(`${fn}: HTTP ${r.status} ${await r.text()}`);
  const t = await r.text();
  return (t ? JSON.parse(t) : null) as T;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (!vapid) return reply(503, { error: 'notifications are not configured on this server' });
  if (req.method === 'GET') return reply(200, { key: vapidPublicKey(vapid.jwk) }, { 'Cache-Control': 'public, max-age=3600' });
  if (req.method !== 'POST') return reply(405, { error: 'GET or POST' });

  const auth = req.headers.get('Authorization') ?? '';
  if (!/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/.test(auth)) return reply(401, { error: 'sign in first' });
  let body: { kind?: unknown; id?: unknown } = {};
  try { body = await req.json(); } catch { /* empty body */ }
  const kind = body.kind, id = body.id ?? null;
  if (kind !== 'message' && kind !== 'workout' && kind !== 'test') return reply(400, { error: 'unknown kind' });
  if (kind !== 'test' && (typeof id !== 'string' || !UUID.test(id))) return reply(400, { error: 'id missing' });

  const me = await fetch(`${url}/auth/v1/user`, { headers: server({ Authorization: auth }) });
  if (!me.ok) return reply(401, { error: 'session not valid' });
  const caller: string = (await me.json()).id;

  try {
    const targets = await rpc<Target[]>('push_targets', { p_caller: caller, p_kind: kind, p_ref: kind === 'test' ? null : id });
    const results: Sent[] = await Promise.all(targets.map(t => send(t, { title: t.title, body: t.body, url: t.url, tag: t.tag }, vapid,
      { ttl: kind === 'workout' ? 3600 : 86400, urgency: kind === 'workout' ? 'normal' : 'high' })));
    const ok = results.filter(r => r.status >= 200 && r.status < 300).map(r => r.endpoint);
    const gone = results.filter(r => r.status === 404 || r.status === 410).map(r => r.endpoint);
    const failed = results.filter(r => !ok.includes(r.endpoint) && !gone.includes(r.endpoint)).map(r => r.endpoint);
    if (results.length) await rpc('push_result', { p_ok: ok, p_gone: gone, p_failed: failed });
    for (const r of results) if (!ok.includes(r.endpoint)) console.log('push', kind, new URL(r.endpoint).host, r.status, r.reason);
    // the caller learns how many devices were reached; for a test (their own devices only) also the services' answers
    return reply(200, { devices: results.length, sent: ok.length, gone: gone.length, failed: failed.length,
      ...(kind === 'test' ? { answers: results.map(r => `${new URL(r.endpoint).host} ${r.status}${r.reason ? ' ' + r.reason : ''}`) } : {}) });
  } catch (e) {
    console.error('push', kind, String(e));
    return reply(500, { error: 'not sent, try again' });
  }
});
