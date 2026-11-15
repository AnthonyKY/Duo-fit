// A STAND-IN for the Supabase APIs the app calls (Auth, database REST + functions, Storage, Functions, Realtime), in
// memory, for the browser tests. It mirrors the rules of the real schema closely enough to drive the screens; the real
// rules are tested on PostgreSQL (scripts/db-test.sh) and on the real staging project (scripts/staging-e2e.mjs).
import { randomUUID, randomBytes } from 'node:crypto';
import { deflateSync } from 'node:zlib';

export const SB = 'https://abcdefghijklmnopqrst.supabase.co';
export const KEY = 'sb_publishable_test_only';

// WebKit does not hand uploaded bytes to Playwright: the stand-in then serves this 512×512 picture
export const SQUARE_PNG = (() => {
  const crc = b => { let c; const t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(512, 0); ihdr.writeUInt32BE(512, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.alloc(512 * (1 + 512 * 3)))), chunk('IEND', Buffer.alloc(0))]);
})();

export function standIn() {
  const db = { users: new Map(), byToken: new Map(), refresh: new Map(), profiles: new Map(), files: new Map(), calls: [],
    spaces: new Map(), members: [], invites: [], blocks: [], messages: [], sockets: new Set() };
  let clock = Date.now();
  const now = () => new Date(clock += 5).toISOString(); // strictly increasing, like the server's timestamps
  const session = u => {
    const access = `h.${randomBytes(12).toString('base64url')}.s`, refresh = randomUUID();
    db.byToken.set(access, u.id); db.refresh.set(refresh, u.id);
    return { access_token: access, refresh_token: refresh, expires_in: 3600, token_type: 'bearer', user: { id: u.id, email: u.email } };
  };
  const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: body === undefined ? '' : JSON.stringify(body) });
  const pgErr = (route, status, code, message) => json(route, status, { code, message, details: null, hint: null });
  const active = (ws, uid) => db.members.find(m => m.workspace_id === ws && m.user_id === uid && m.status === 'active');
  const blocked = (by, other) => db.blocks.some(b => b.blocker_id === by && b.blocked_id === other);
  const shares = (a, b) => db.members.some(m => m.user_id === a && m.status === 'active' && active(m.workspace_id, b));
  const canRead = (uid, msg) => msg.author_id === uid || (!!active(msg.workspace_id, uid) && msg.created_at >= active(msg.workspace_id, uid).joined_at && !(msg.author_id && blocked(uid, msg.author_id)));
  const pick = (row, select) => select && select !== '*' ? Object.fromEntries(select.split(',').map(k => [k, row[k]])) : row;
  const eq = (q, k) => { const v = q.get(k) || ''; return v.startsWith('eq.') ? v.slice(3) : ''; };
  const owner = ws => db.spaces.get(ws)?.owner_id;
  const keepOwner = ws => {
    const s = db.spaces.get(ws); if (!s) return;
    if (active(ws, s.owner_id)) return;
    const heir = db.members.filter(m => m.workspace_id === ws && m.status === 'active').sort((a, b) => a.joined_at.localeCompare(b.joined_at))[0];
    if (!heir) { db.spaces.delete(ws); db.members = db.members.filter(m => m.workspace_id !== ws); db.messages = db.messages.filter(m => m.workspace_id !== ws); return; }
    heir.role = 'owner'; s.owner_id = heir.user_id;
  };
  // Realtime: push a change to every socket watching this table/filter whose user may read the row
  const publish = (table, type, row) => {
    for (const s of db.sockets) if (s.table === table && s.filter === `workspace_id=eq.${row.workspace_id}` && canRead(s.uid, row))
      s.ws.send(JSON.stringify({ topic: s.topic, event: 'postgres_changes', payload: { data: { type, table, schema: 'public', record: row } }, ref: null }));
  };

  async function handle(route) {
    const req = route.request(), u = new URL(req.url()), m = req.method(), p = u.pathname, q = u.searchParams;
    const who = db.byToken.get((req.headers().authorization || '').replace(/^Bearer /, ''));
    db.calls.push(`${m} ${p}${u.search}`);
    const sg = /^\/storage\/v1\/object\/sign\/(avatars|chat-media)\/(.+)$/.exec(p);
    if (m === 'GET' && sg) { const f = db.files.get(`${sg[1]}/${sg[2]}`); return f ? route.fulfill({ status: 200, contentType: f.bytes ? f.type : 'image/png', body: f.bytes ?? SQUARE_PNG }) : route.fulfill({ status: 400 }); }
    if (req.headers().apikey !== KEY) return json(route, 401, { message: 'no api key' });
    const body = () => { try { return JSON.parse(req.postData() || 'null'); } catch { return null; } };

    // ---------------------------------------------------------- auth
    if (m === 'POST' && p === '/auth/v1/signup') {
      const b = body();
      if ([...db.users.values()].some(x => x.email === b.email)) return json(route, 422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' });
      if ((b.password || '').length < 10) return json(route, 422, { error_code: 'weak_password' });
      const user = { id: randomUUID(), email: b.email, password: b.password };
      db.users.set(user.id, user);
      db.profiles.set(user.id, { id: user.id, display_name: (b.data?.display_name || '').trim() || 'Membre', avatar_seed: randomBytes(8).toString('hex'), avatar_path: null });
      return json(route, 200, session(user));
    }
    if (m === 'POST' && p === '/auth/v1/token') {
      const b = body();
      if (q.get('grant_type') === 'password') {
        const user = [...db.users.values()].find(x => x.email === b.email && x.password === b.password);
        return user ? json(route, 200, session(user)) : json(route, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      }
      const id = db.refresh.get(b.refresh_token); db.refresh.delete(b.refresh_token);
      return id && db.users.has(id) ? json(route, 200, session(db.users.get(id))) : json(route, 400, { error_code: 'refresh_token_not_found' });
    }
    if (m === 'POST' && p === '/auth/v1/logout') { db.byToken.delete((req.headers().authorization || '').slice(7)); return route.fulfill({ status: 204 }); }
    if (!who || !db.users.has(who)) return json(route, 401, { code: 'PGRST301', message: 'JWT expired' });

    // ---------------------------------------------------------- functions (rpc)
    const rpc = /^\/rest\/v1\/rpc\/(\w+)$/.exec(p);
    if (m === 'POST' && rpc) {
      const a = body() || {};
      switch (rpc[1]) {
        case 'create_workspace': {
          if (a.p_mode === 'couple' && db.members.some(x => x.user_id === who && x.status === 'active' && db.spaces.get(x.workspace_id)?.mode === 'couple')) return pgErr(route, 409, '23505', 'already in a couple space');
          const id = randomUUID(), t = now();
          db.spaces.set(id, { id, name: a.p_name.trim(), mode: a.p_mode, max_members: a.p_mode === 'couple' ? 2 : (a.p_max_members ?? 10), owner_id: who, created_at: t });
          db.members.push({ workspace_id: id, user_id: who, role: 'owner', status: 'active', joined_at: t });
          return json(route, 200, id);
        }
        case 'create_invitation': {
          if (owner(a.p_workspace) !== who) return pgErr(route, 403, '42501', 'only the owner can invite');
          const token = randomBytes(24).toString('base64url');
          db.invites.push({ id: randomUUID(), token, workspace_id: a.p_workspace, created_by: who, max_uses: a.p_max_uses ?? 1, uses: 0, expires_at: new Date(Date.now() + 72 * 3600e3).toISOString(), revoked_at: null, created_at: now() });
          return json(route, 200, token);
        }
        case 'revoke_invitation': { const i = db.invites.find(x => x.id === a.p_invitation && owner(x.workspace_id) === who && !x.revoked_at); if (!i) return pgErr(route, 400, 'P0002', 'invitation not found'); i.revoked_at = now(); return route.fulfill({ status: 204 }); }
        case 'peek_invitation': {
          const i = db.invites.find(x => x.token === a.p_token && !x.revoked_at && x.uses < x.max_uses);
          if (!i) return json(route, 200, []);
          const s = db.spaces.get(i.workspace_id);
          return json(route, 200, [{ workspace_name: s.name, mode: s.mode, invited_by: db.profiles.get(i.created_by)?.display_name ?? null, members: db.members.filter(x => x.workspace_id === s.id && x.status === 'active').length, max_members: s.max_members }]);
        }
        case 'accept_invitation': {
          const i = db.invites.find(x => x.token === a.p_token);
          if (!i || i.revoked_at || i.uses >= i.max_uses) return pgErr(route, 400, '22023', 'invalid or expired invitation');
          const s = db.spaces.get(i.workspace_id);
          if (active(s.id, who)) return json(route, 200, s.id);
          if (db.members.some(x => x.workspace_id === s.id && x.status === 'active' && blocked(x.user_id, who))) return pgErr(route, 400, '22023', 'invalid or expired invitation');
          if (db.members.filter(x => x.workspace_id === s.id && x.status === 'active').length >= s.max_members) return pgErr(route, 400, '23514', 'this space is full');
          const old = db.members.find(x => x.workspace_id === s.id && x.user_id === who);
          if (old) Object.assign(old, { status: 'active', role: 'member', joined_at: now() }); else db.members.push({ workspace_id: s.id, user_id: who, role: 'member', status: 'active', joined_at: now() });
          i.uses++; return json(route, 200, s.id);
        }
        case 'leave_workspace': { const x = active(a.p_workspace, who); if (!x) return pgErr(route, 400, 'P0002', 'not a member'); x.status = 'left'; keepOwner(a.p_workspace); return route.fulfill({ status: 204 }); }
        case 'remove_member': {
          if (owner(a.p_workspace) !== who) return pgErr(route, 403, '42501', 'only the owner can remove');
          const x = active(a.p_workspace, a.p_user); if (!x) return pgErr(route, 400, 'P0002', 'not a member'); x.status = 'removed'; return route.fulfill({ status: 204 });
        }
        case 'transfer_ownership': {
          if (owner(a.p_workspace) !== who) return pgErr(route, 403, '42501', 'only the owner can transfer');
          const x = active(a.p_workspace, a.p_user); if (!x) return pgErr(route, 400, 'P0002', 'not an active member');
          active(a.p_workspace, who).role = 'member'; x.role = 'owner'; db.spaces.get(a.p_workspace).owner_id = a.p_user; return route.fulfill({ status: 204 });
        }
        case 'delete_message': {
          const x = db.messages.find(y => y.id === a.p_message && y.author_id === who && !y.deleted_at);
          if (!x) return pgErr(route, 400, 'P0002', 'message not found');
          Object.assign(x, { body: null, image_path: null, deleted_at: now() }); publish('messages', 'UPDATE', x); return route.fulfill({ status: 204 });
        }
      }
      return json(route, 404, { message: 'rpc not in the stand-in: ' + rpc[1] });
    }

    // ---------------------------------------------------------- tables (reads follow the read rules)
    const tbl = /^\/rest\/v1\/(\w+)$/.exec(p)?.[1];
    if (tbl === 'profiles') {
      if (m === 'GET') {
        const ids = eq(q, 'id') ? [eq(q, 'id')] : ((/^in\.\((.*)\)$/.exec(q.get('id') || '') || [])[1] || '').split(',');
        return json(route, 200, ids.filter(id => db.profiles.has(id) && (id === who || shares(who, id))).map(id => pick(db.profiles.get(id), q.get('select'))));
      }
      if (m === 'PATCH') { if (eq(q, 'id') === who) Object.assign(db.profiles.get(who), body()); return route.fulfill({ status: 204 }); }
    }
    if (tbl === 'workspaces' && m === 'GET') {
      let list = [...db.spaces.values()].filter(s => active(s.id, who));
      if (eq(q, 'id')) list = list.filter(s => s.id === eq(q, 'id'));
      return json(route, 200, list.sort((a, b) => a.created_at.localeCompare(b.created_at)).map(s => pick(s, q.get('select'))));
    }
    if (tbl === 'workspace_members' && m === 'GET') {
      let list = db.members.filter(x => active(x.workspace_id, who) && x.status === 'active');
      if (eq(q, 'workspace_id')) list = list.filter(x => x.workspace_id === eq(q, 'workspace_id'));
      return json(route, 200, list.sort((a, b) => a.joined_at.localeCompare(b.joined_at)).map(x => pick(x, q.get('select'))));
    }
    if (tbl === 'workspace_invitations' && m === 'GET')
      return json(route, 200, db.invites.filter(i => i.workspace_id === eq(q, 'workspace_id') && owner(i.workspace_id) === who && !i.revoked_at).map(i => pick(i, q.get('select'))));
    if (tbl === 'user_blocks') {
      if (m === 'GET') return json(route, 200, db.blocks.filter(b => b.blocker_id === who).map(b => pick(b, q.get('select'))));
      if (m === 'POST') { const b = body(); if (b.blocker_id !== who) return pgErr(route, 403, '42501', 'row-level security'); if (!blocked(who, b.blocked_id)) db.blocks.push({ blocker_id: who, blocked_id: b.blocked_id }); return route.fulfill({ status: 201 }); }
      if (m === 'DELETE') { db.blocks = db.blocks.filter(b => !(b.blocker_id === who && b.blocked_id === eq(q, 'blocked_id'))); return route.fulfill({ status: 204 }); }
    }
    if (tbl === 'messages') {
      if (m === 'GET') {
        let list = db.messages.filter(x => x.workspace_id === eq(q, 'workspace_id') && canRead(who, x));
        const lt = (q.get('created_at') || '').replace(/^lt\./, ''); if (lt) list = list.filter(x => x.created_at < lt);
        list.sort((a, b) => b.created_at.localeCompare(a.created_at));
        return json(route, 200, list.slice(0, Number(q.get('limit') || 1000)).map(x => pick(x, q.get('select'))));
      }
      if (m === 'POST') {
        const b = body();
        if (b.author_id !== who || !active(b.workspace_id, who)) return pgErr(route, 403, '42501', 'new row violates row-level security policy');
        if (b.image_path && b.image_path.split('/')[1] !== who) return pgErr(route, 403, '42501', 'new row violates row-level security policy');
        if (db.messages.some(x => x.author_id === who && x.client_id === b.client_id)) return pgErr(route, 409, '23505', 'duplicate key value violates unique constraint');
        const row = { id: randomUUID(), client_id: b.client_id, workspace_id: b.workspace_id, author_id: who, body: b.body ?? null, image_path: b.image_path ?? null, created_at: now(), deleted_at: null };
        db.messages.push(row); publish('messages', 'INSERT', row);
        return json(route, 201, [row]);
      }
    }

    // ---------------------------------------------------------- storage
    const obj = /^\/storage\/v1\/object\/(avatars|chat-media)\/(.+)$/.exec(p);
    if (m === 'POST' && obj && !p.includes('/sign/')) {
      const parts = obj[2].split('/');
      const ownFolder = obj[1] === 'avatars' ? parts[0] === who : parts[1] === who && !!active(parts[0], who);
      if (!ownFolder) return json(route, 400, { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' });
      if (db.files.has(`${obj[1]}/${obj[2]}`)) return json(route, 409, { statusCode: '409', error: 'Duplicate' });
      db.files.set(`${obj[1]}/${obj[2]}`, { type: req.headers()['content-type'], bytes: req.postDataBuffer() ?? null, owner: who }); return json(route, 200, { Key: `${obj[1]}/${obj[2]}` });
    }
    const del = /^\/storage\/v1\/object\/(avatars|chat-media)$/.exec(p);
    if (m === 'DELETE' && del) { for (const n of body().prefixes) { const f = db.files.get(`${del[1]}/${n}`); if (f?.owner === who) db.files.delete(`${del[1]}/${n}`); } return json(route, 200, []); }
    if (m === 'POST' && sg) {
      const name = sg[2], f = db.files.get(`${sg[1]}/${name}`);
      const may = f && (f.owner === who || (sg[1] === 'avatars' ? shares(who, name.split('/')[0]) : db.messages.some(x => x.image_path === name && canRead(who, x))));
      return may ? json(route, 200, { signedURL: `/object/sign/${sg[1]}/${name}?token=t` }) : json(route, 400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
    }

    // ---------------------------------------------------------- account deletion function
    if (m === 'POST' && p === '/functions/v1/delete-account') {
      if (body()?.confirm !== 'DELETE') return json(route, 400, { error: 'confirmation missing' });
      for (const [k, f] of [...db.files]) if (f.owner === who) db.files.delete(k);
      for (const x of db.messages) if (x.author_id === who) { x.author_id = null; x.image_path = null; }
      for (const x of db.members) if (x.user_id === who && x.status === 'active') { x.status = 'left'; keepOwner(x.workspace_id); }
      db.users.delete(who); db.profiles.delete(who); return json(route, 200, { deleted: true });
    }
    return json(route, 404, { error: 'not in the stand-in: ' + m + ' ' + p });
  }

  // Realtime over WebSocket (Phoenix protocol, the frames the app sends)
  async function socket(ws) {
    const s = { ws, uid: null, topic: null, table: null, filter: null };
    ws.onMessage(raw => {
      let msg; try { msg = JSON.parse(String(raw)); } catch { return; }
      if (msg.event === 'phx_join') {
        const pc = msg.payload?.config?.postgres_changes?.[0];
        s.uid = db.byToken.get(msg.payload?.access_token); s.topic = msg.topic; s.table = pc?.table; s.filter = pc?.filter;
        if (!s.uid) return ws.send(JSON.stringify({ topic: msg.topic, event: 'phx_reply', payload: { status: 'error', response: { reason: 'invalid token' } }, ref: msg.ref }));
        db.sockets.add(s);
        ws.send(JSON.stringify({ topic: msg.topic, event: 'phx_reply', payload: { status: 'ok', response: { postgres_changes: [{ id: 1, ...pc }] } }, ref: msg.ref }));
      } else if (msg.event === 'access_token') { s.uid = db.byToken.get(msg.payload?.access_token) ?? s.uid; }
      else if (msg.event === 'heartbeat') ws.send(JSON.stringify({ topic: 'phoenix', event: 'phx_reply', payload: { status: 'ok', response: {} }, ref: msg.ref }));
    });
    ws.onClose(() => db.sockets.delete(s));
  }
  return { db, handle, socket };
}

/** Wire a browser context to the stand-in. */
export async function useStandIn(ctx, sb) {
  await ctx.route(SB + '/**', route => sb.handle(route));
  await ctx.routeWebSocket(/\/realtime\/v1\/websocket/, ws => sb.socket(ws));
}
