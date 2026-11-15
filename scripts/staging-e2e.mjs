// End-to-end checks on the STAGING Supabase project, through the same public APIs the app uses (publishable key only,
// made-up accounts, every one deleted at the end through the delete-account function).
//   SUPABASE_URL, SUPABASE_KEY (publishable)   node scripts/staging-e2e.mjs
// Covers Astra's review of d23103c: a picture follows its message (new member, blocked author), signed URLs after
// removal (one issued before, one asked after), and the complete deletion of an account with avatar + chat picture.
import { randomBytes, randomUUID } from 'node:crypto';
const URL_ = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_KEY;
if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(URL_ || '') || !KEY) { console.error('SUPABASE_URL / SUPABASE_KEY missing'); process.exit(2); }
export const SIGNED_URL_SECONDS = 60; // what the app uses for chat pictures (re-asked each time a picture is shown)

let fails = 0; const t0 = Date.now();
const ok = (what, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'} ${what}${extra ? ' — ' + extra : ''}`); if (!cond) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function call(path, { token, method = 'GET', body, headers = {}, raw = false } = {}) {
  const h = { apikey: KEY, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers };
  if (body !== undefined && !Buffer.isBuffer(body)) { h['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
  const r = await fetch(URL_ + path, { method, headers: h, body });
  const text = raw ? '' : await r.text(); let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* not json */ }
  return { status: r.status, json, text };
}
const rpc = (u, fn, args) => call(`/rest/v1/rpc/${fn}`, { token: u.token, method: 'POST', body: args });

const run = randomBytes(4).toString('hex');
async function signUp(tag) {
  const password = randomBytes(18).toString('base64url');
  for (const domain of ['example.com', 'example.org', 'mailinator.com']) {
    const r = await call('/auth/v1/signup', { method: 'POST', body: { email: `collabfit-e2e-${run}-${tag}@${domain}`, password, data: { display_name: `Test ${tag.toUpperCase()}` } } });
    const token = r.json?.access_token, id = r.json?.user?.id;
    if (token && id) return { tag, id, token };
    if (!/email/i.test(r.text)) throw new Error(`sign-up ${tag}: HTTP ${r.status} ${r.text.slice(0, 200)}`);
  }
  throw new Error(`sign-up ${tag}: no test e-mail domain accepted`);
}
const upload = (u, bucket, name) => call(`/storage/v1/object/${bucket}/${name}`, { token: u.token, method: 'POST', body: PNG, headers: { 'Content-Type': 'image/png' } });
const sign = (u, bucket, name, expiresIn = SIGNED_URL_SECONDS) => call(`/storage/v1/object/sign/${bucket}/${name}`, { token: u.token, method: 'POST', body: { expiresIn } });
const fetchStatus = async (signed) => (await fetch(`${URL_}/storage/v1${signed}`, { cache: 'no-store' })).status;
const sendPicture = async (u, ws) => {
  const name = `${ws}/${u.id}/${randomUUID()}.png`;
  const up = await upload(u, 'chat-media', name);
  const m = await call('/rest/v1/messages', { token: u.token, method: 'POST', body: { client_id: randomUUID(), workspace_id: ws, author_id: u.id, image_path: name }, headers: { Prefer: 'return=representation' } });
  return { name, uploaded: up.status === 200, message: m.json?.[0]?.id };
};
const sees = async (u, name) => (await sign(u, 'chat-media', name)).status === 200;
const deleteAccount = (u) => call('/functions/v1/delete-account', { token: u.token, method: 'POST', body: { confirm: 'DELETE' } });

const users = [];
try {
  const A = await signUp('a'), B = await signUp('b'), C = await signUp('c'); users.push(A, B, C);
  ok('three made-up accounts signed up (email + password, no confirmation e-mail on staging)', true, `run ${run}`);
  console.log(`E2E_USERS=${users.map((u) => u.id).join(',')}`);

  const ws = (await rpc(A, 'create_workspace', { p_name: `E2E ${run}`, p_mode: 'friends', p_max_members: 5 })).json;
  const inv = (await rpc(A, 'create_invitation', { p_workspace: ws, p_max_uses: 3 })).json;
  ok('A creates a friends space and an invitation', typeof ws === 'string' && typeof inv === 'string');
  ok('B joins with the link', (await rpc(B, 'accept_invitation', { p_token: inv })).status === 200);

  // avatar: private bucket, visible to people sharing a space
  const av = `${A.id}/${randomUUID()}.png`;
  ok('A uploads an avatar', (await upload(A, 'avatars', av)).status === 200);
  ok('A sets it on her profile', (await call(`/rest/v1/profiles?id=eq.${A.id}`, { token: A.token, method: 'PATCH', body: { avatar_path: av } })).status < 300);
  ok('B (same space) can display A\'s avatar', (await sign(B, 'avatars', av)).status === 200);
  ok('C (no shared space yet) cannot', (await sign(C, 'avatars', av)).status !== 200);

  // case 1: a picture posted before a member arrives
  const p1 = await sendPicture(A, ws);
  ok('A sends a picture in a message', p1.uploaded && !!p1.message);
  ok('a stranger (C) cannot get a link to it', !(await sees(C, p1.name)));
  await sleep(1500);
  ok('C joins with the link', (await rpc(C, 'accept_invitation', { p_token: inv })).status === 200);
  const msgsC = (await call(`/rest/v1/messages?select=id&id=eq.${p1.message}`, { token: C.token })).json;
  ok('new member: the message posted before he joined is hidden', Array.isArray(msgsC) && msgsC.length === 0);
  ok('new member: its picture is hidden too (link refused even with the exact path)', !(await sees(C, p1.name)));
  const p2 = await sendPicture(A, ws);
  ok('new member: a picture posted after he joined is visible', await sees(C, p2.name));

  // case 2: a member and the pictures of an author he blocked
  ok('B sees A\'s picture', await sees(B, p1.name));
  ok('B blocks A', (await call('/rest/v1/user_blocks', { token: B.token, method: 'POST', body: { blocker_id: B.id, blocked_id: A.id } })).status < 300);
  ok('blocked author: B no longer gets a link to A\'s pictures', !(await sees(B, p1.name)) && !(await sees(B, p2.name)));
  ok('the author keeps hers', (await sees(A, p1.name)) && (await sees(A, p2.name)));
  ok('B unblocks A', (await call(`/rest/v1/user_blocks?blocked_id=eq.${A.id}`, { token: B.token, method: 'DELETE' })).status < 300);
  ok('unblocked: visible again', await sees(B, p1.name));

  // signed URLs after removal: one issued before, one asked after
  const before = (await sign(B, 'chat-media', p1.name)).json?.signedURL;
  const issuedAt = Date.now();
  ok(`B gets a ${SIGNED_URL_SECONDS}-second link and opens it`, !!before && (await fetchStatus(before)) === 200);
  const pb = await sendPicture(B, ws);
  ok('A removes B from the space', (await rpc(A, 'remove_member', { p_workspace: ws, p_user: B.id })).status < 300);
  const removedAt = Date.now();
  ok('after removal: B can no longer ASK for a link to A\'s picture', !(await sees(B, p1.name)));
  ok('after removal: B still gets a link to his own picture', await sees(B, pb.name));
  let lostAfter = null, firstStatus = await fetchStatus(before);
  console.log(`INFO link issued before removal: HTTP ${firstStatus} right after removal (expected: still valid until it expires)`);
  while (Date.now() - issuedAt < (SIGNED_URL_SECONDS + 90) * 1000) {
    if ((await fetchStatus(before)) !== 200) { lostAfter = Date.now(); break; }
    await sleep(2000);
  }
  ok(`link issued before removal stops working by itself (validity ${SIGNED_URL_SECONDS} s)`, lostAfter !== null,
    lostAfter ? `lost ${((lostAfter - issuedAt) / 1000).toFixed(0)} s after it was issued, ${((lostAfter - removedAt) / 1000).toFixed(0)} s after the removal` : 'still open');
  if (lostAfter) console.log(`SIGNED_URL_RESULT validity=${SIGNED_URL_SECONDS}s lost_after_issue=${((lostAfter - issuedAt) / 1000).toFixed(1)}s lost_after_removal=${((lostAfter - removedAt) / 1000).toFixed(1)}s`);

  // complete deletion of A's account (avatar + 2 chat pictures)
  ok('a deletion without confirmation is refused', (await call('/functions/v1/delete-account', { token: A.token, method: 'POST', body: {} })).status === 400);
  ok('a deletion without session is refused', (await call('/functions/v1/delete-account', { method: 'POST', body: { confirm: 'DELETE' } })).status === 401);
  const del = await deleteAccount(A);
  ok('A deletes her account', del.status === 200 && del.json?.deleted === true, `HTTP ${del.status} ${del.text.slice(0, 160)}`);
  ok('her 3 files were removed (avatar + 2 chat pictures)', del.json?.files === 3, JSON.stringify(del.json));
  ok('her session no longer works', (await call('/auth/v1/user', { token: A.token })).status >= 400);
  ok('C no longer sees her profile', ((await call(`/rest/v1/profiles?select=id&id=eq.${A.id}`, { token: C.token })).json || []).length === 0);
  ok('C no longer gets her pictures', !(await sees(C, p2.name)));
  const own = (await call(`/rest/v1/workspaces?select=owner_id&id=eq.${ws}`, { token: C.token })).json;
  ok('the space passes to the remaining member (C)', own?.[0]?.owner_id === C.id);
  users.shift();
} catch (e) { ok('run', false, String(e)); }
finally {
  for (const u of users) { const r = await deleteAccount(u); ok(`clean-up: test account ${u.tag.toUpperCase()} deleted`, r.status === 200, `HTTP ${r.status} ${r.text.slice(0, 120)}`); }
  console.log(`\n${fails ? 'FAILED' : 'all passed'} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  process.exit(fails ? 1 : 0);
}
