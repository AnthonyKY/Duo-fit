// Deletes the CALLER's own account, completely: files first (avatar, chat pictures — through the Storage API, which also
// removes the stored bytes), then the user. Runs on Supabase (Deno) with the project's server key, which never leaves
// Supabase. The database refuses to delete an account that still has files (refuse_delete_with_files), so a partial
// run can be retried safely: it simply finishes the job.
// Call: POST /functions/v1/delete-account, Authorization: Bearer <the user's session token>, body {"confirm":"DELETE"}.
// Deployed with --no-verify-jwt: the caller is checked below by Supabase Auth itself (works with the new signing keys).

const url = Deno.env.get('SUPABASE_URL')!;
const serverKey = (() => {
  try { const k = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}'); if (k.default) return k.default as string; } catch { /* older projects */ }
  return Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
})();
const server = (extra: Record<string, string> = {}) => serverKey.startsWith('sb_secret_')
  ? { apikey: serverKey, ...extra } : { apikey: serverKey, Authorization: `Bearer ${serverKey}`, ...extra };
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

type File = { bucket: string; name: string };
async function filesOf(user: string): Promise<File[]> {
  const r = await fetch(`${url}/rest/v1/rpc/prepare_account_deletion`, { method: 'POST', headers: server({ 'Content-Type': 'application/json' }), body: JSON.stringify({ p_user: user }) });
  if (!r.ok) throw new Error(`prepare_account_deletion: HTTP ${r.status} ${await r.text()}`);
  return await r.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'POST only' });
  const auth = req.headers.get('Authorization') ?? '';
  if (!/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/.test(auth)) return reply(401, { error: 'sign in first' });
  let body: { confirm?: string } = {};
  try { body = await req.json(); } catch { /* empty body */ }
  if (body.confirm !== 'DELETE') return reply(400, { error: 'confirmation missing' });

  // who is calling: asked to Supabase Auth with the user's own token (an expired or forged token is refused there)
  const me = await fetch(`${url}/auth/v1/user`, { headers: server({ Authorization: auth }) });
  if (!me.ok) return reply(401, { error: 'session not valid' });
  const user: string = (await me.json()).id;

  try {
    const files = await filesOf(user);
    for (const bucket of ['avatars', 'chat-media']) {
      const names = files.filter((f) => f.bucket === bucket).map((f) => f.name);
      for (let i = 0; i < names.length; i += 100) {
        const r = await fetch(`${url}/storage/v1/object/${bucket}`, { method: 'DELETE', headers: server({ 'Content-Type': 'application/json' }), body: JSON.stringify({ prefixes: names.slice(i, i + 100) }) });
        if (!r.ok) throw new Error(`storage ${bucket}: HTTP ${r.status} ${await r.text()}`);
      }
    }
    const left = await filesOf(user);
    if (left.length) throw new Error(`${left.length} file(s) still there`);
    const d = await fetch(`${url}/auth/v1/admin/users/${user}`, { method: 'DELETE', headers: server() });
    if (!d.ok) throw new Error(`auth: HTTP ${d.status} ${await d.text()}`);
    return reply(200, { deleted: true, files: files.length });
  } catch (e) {
    console.error('delete-account', user, String(e));
    return reply(500, { error: 'deletion not finished, try again' });
  }
});
