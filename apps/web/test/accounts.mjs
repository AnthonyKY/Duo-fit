// Accounts on a build made for a Supabase project, against a STAND-IN Supabase (in this test, no network, no key):
// sign-up, mistakes explained, staying signed in, expired session refreshed, name, photo (re-drawn on the phone),
// sign-out, sign-in, complete deletion. The real Supabase is exercised by scripts/staging-e2e.mjs and the deployed test.
// Needs a build with COLLABFIT_SUPABASE_URL=https://abcdefghijklmnopqrst.supabase.co (see package.json "test:accounts").
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
const require = createRequire(import.meta.url);
const BR = require('../../../tests/browser.js');
const IOS = require('../../../tests/iosinit.js');

const SB = 'https://abcdefghijklmnopqrst.supabase.co';
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.map': 'application/json', '.txt': 'text/plain' };
const server = http.createServer(async (req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  const file = path.join(dist, p === '/' ? 'index.html' : p);
  if (!file.startsWith(dist)) { res.writeHead(403); return res.end(); }
  try { const body = await readFile(file); res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;
if (!(await readFile(path.join(dist, 'assets/app.js'), 'utf8')).includes(SB)) { console.log('CRASH build is not configured for ' + SB); process.exit(1); }

const R = []; let fails = 0;
// WebKit does not hand uploaded file bytes to the test tool (Playwright limitation): the stand-in then serves this
// 512×512 picture, and the byte checks run in Chromium (WebKit's real upload is checked on the deployed app)
const SQUARE_PNG = await (async () => { const { deflateSync } = await import('node:zlib'); const crc = b => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(512, 0); ihdr.writeUInt32BE(512, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc(512 * (1 + 512 * 3)); return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]); })();
const ok = (n, c, x = '') => { const l = (c ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + String(x).slice(0, 240) : ''); R.push(l); console.log(l); if (!c) fails++; };

// ------------------------------------------------------------------ stand-in Supabase (only what the app calls)
function standIn() {
  const db = { users: new Map(), byToken: new Map(), refresh: new Map(), profiles: new Map(), files: new Map(), calls: [] };
  const session = u => {
    const access = `h.${Buffer.from(randomUUID()).toString('base64url')}.s`, refresh = randomUUID();
    db.byToken.set(access, u.id); db.refresh.set(refresh, u.id);
    return { access_token: access, refresh_token: refresh, expires_in: 3600, token_type: 'bearer', user: { id: u.id, email: u.email } };
  };
  const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: body === undefined ? '' : JSON.stringify(body) });
  async function handle(route) {
    const req = route.request(), u = new URL(req.url()), m = req.method(), p = u.pathname;
    const who = db.byToken.get((req.headers().authorization || '').replace(/^Bearer /, ''));
    db.calls.push(`${m} ${p}${u.search}`);
    if (req.headers().apikey !== 'sb_publishable_test_only') return json(route, 401, { message: 'no api key' });
    const body = () => { try { return JSON.parse(req.postData() || 'null'); } catch { return null; } };
    if (m === 'POST' && p === '/auth/v1/signup') {
      const b = body();
      if ([...db.users.values()].some(x => x.email === b.email)) return json(route, 422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' });
      if ((b.password || '').length < 10) return json(route, 422, { error_code: 'weak_password' });
      const user = { id: randomUUID(), email: b.email, password: b.password };
      db.users.set(user.id, user);
      db.profiles.set(user.id, { display_name: (b.data?.display_name || '').trim() || 'Membre', avatar_seed: 'a1b2c3d4e5f60718', avatar_path: null });
      return json(route, 200, session(user));
    }
    if (m === 'POST' && p === '/auth/v1/token') {
      const b = body();
      if (u.searchParams.get('grant_type') === 'password') {
        const user = [...db.users.values()].find(x => x.email === b.email && x.password === b.password);
        return user ? json(route, 200, session(user)) : json(route, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      }
      const id = db.refresh.get(b.refresh_token); db.refresh.delete(b.refresh_token);
      return id && db.users.has(id) ? json(route, 200, session(db.users.get(id))) : json(route, 400, { error_code: 'refresh_token_not_found' });
    }
    if (m === 'POST' && p === '/auth/v1/logout') { db.byToken.delete((req.headers().authorization || '').slice(7)); return route.fulfill({ status: 204 }); }
    if (!who || !db.users.has(who)) return json(route, 401, { code: 'PGRST301', message: 'JWT expired' });
    if (p === '/rest/v1/profiles') {
      const id = (u.searchParams.get('id') || '').replace(/^eq\./, '');
      if (m === 'GET') return json(route, 200, id === who && db.profiles.has(id) ? [db.profiles.get(id)] : []);
      if (m === 'PATCH') { if (id === who) Object.assign(db.profiles.get(id), body()); return route.fulfill({ status: 204 }); }
    }
    const obj = /^\/storage\/v1\/object\/(avatars)\/(.+)$/.exec(p);
    if (m === 'POST' && obj) {
      if (!obj[2].startsWith(who + '/')) return json(route, 400, { statusCode: '403', error: 'Unauthorized' });
      db.files.set(obj[2], { type: req.headers()['content-type'], bytes: req.postDataBuffer() ?? null }); return json(route, 200, { Key: `avatars/${obj[2]}` });
    }
    if (m === 'DELETE' && p === '/storage/v1/object/avatars') { for (const n of body().prefixes) if (n.startsWith(who + '/')) db.files.delete(n); return json(route, 200, []); }
    const sign = /^\/storage\/v1\/object\/sign\/avatars\/(.+)$/.exec(p);
    if (m === 'POST' && sign) return db.files.has(sign[1]) ? json(route, 200, { signedURL: `/object/sign/avatars/${sign[1]}?token=t` }) : json(route, 400, { error: 'not_found' });
    if (m === 'POST' && p === '/functions/v1/delete-account') {
      if (body()?.confirm !== 'DELETE') return json(route, 400, { error: 'confirmation missing' });
      for (const n of [...db.files.keys()]) if (n.startsWith(who + '/')) db.files.delete(n);
      db.users.delete(who); db.profiles.delete(who); return json(route, 200, { deleted: true });
    }
    return json(route, 404, { error: 'not in the stand-in: ' + m + ' ' + p });
  }
  return { db, handle };
}

const b = await BR.launch();
for (const dev of BR.device ? [BR.device] : ['iPhone SE', 'iPhone 16 Plus']) {
  const ctx = await b.newContext({ ...BR.dev(dev), locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  await ctx.addInitScript(IOS);
  const sb = standIn();
  // signed picture links are plain GETs (no key): served from the stand-in's files
  await ctx.route(SB + '/**', route => {
    const u = new URL(route.request().url());
    const g = /^\/storage\/v1\/object\/sign\/avatars\/(.+)$/.exec(u.pathname);
    if (route.request().method() === 'GET' && g) { const f = sb.db.files.get(g[1]); return f ? route.fulfill({ status: 200, contentType: f.bytes ? f.type : 'image/png', body: f.bytes ?? SQUARE_PNG }) : route.fulfill({ status: 400 }); }
    return sb.handle(route);
  });
  const p = await ctx.newPage(); p.setDefaultTimeout(8000);
  const errs = [], refused = []; p.on('pageerror', e => errs.push(e.message));
  // the browser itself reports each refused request; the two refusals this test provokes on purpose are counted apart
  p.on('console', m => { if (m.type() !== 'error') return; if ((m.location().url || '').startsWith(SB + '/auth/v1/') && /Failed to load resource/i.test(m.text())) refused.push(m.text()); else errs.push(m.text()); });
  const text = async () => (await p.textContent('body')).replace(/[  ]/g, ' ');
  const type = (sel, v) => p.locator(sel).evaluate((el, v) => { el.focus(); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  const tag = `[${dev}] `;
  const email = `alice.${dev.replace(/\W/g, '')}@example.com`, pw = 'correct-horse-42';

  await p.goto(url);
  ok(tag + 'Home lists the secure account as available', (await text()).includes('Compte sécurisé'));
  await p.click('nav a[href="#/profile"]'); await p.waitForSelector('#acc-title');
  ok(tag + 'Profile without account: sign-up form', (await text()).includes('Créer mon compte'));
  ok(tag + 'Fields carry the hints iPhone uses for its password manager',
    (await p.getAttribute('input[name=email]', 'autocomplete')) === 'email' && (await p.getAttribute('input[name=password]', 'autocomplete')) === 'new-password');

  const before = sb.db.calls.length;
  await type('input[name=nickname]', 'Alice'); await type('input[name=email]', 'alice@'); await type('input[name=password]', pw);
  await p.click('button[type=submit]');
  ok(tag + 'Invalid e-mail explained, nothing sent', (await text()).includes('Cet e-mail ne semble pas valide.') && sb.db.calls.length === before);
  await type('input[name=email]', email); await type('input[name=password]', 'short');
  await p.click('button[type=submit]');
  ok(tag + 'Short password explained, nothing sent', (await text()).includes('Au moins 10 caractères.') && sb.db.calls.length === before);
  await p.click('button[aria-pressed]');
  ok(tag + '"Afficher" reveals the password', (await p.getAttribute('input[name=password]', 'type')) === 'text');

  await type('input[name=password]', pw); await p.click('button[type=submit]');
  await p.waitForSelector('text=Connecté avec');
  ok(tag + 'Sign-up: signed in at once, name kept', (await text()).includes('Alice') && (await text()).includes(email));
  ok(tag + 'Session kept on this phone only (not in session storage, password never stored)',
    await p.evaluate(pw => { const s = localStorage.getItem('collabfit-session') || ''; return s.includes('refresh_token') && !s.includes(pw) && !JSON.stringify(sessionStorage).includes(pw) && !JSON.stringify(localStorage).includes(pw); }, pw));
  await p.reload(); await p.waitForSelector('text=Connecté avec');
  ok(tag + 'Still signed in after reopening', true);

  // an expired access token is renewed quietly
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('collabfit-session')); s.expires_at = 1; localStorage.setItem('collabfit-session', JSON.stringify(s)); });
  const refreshes = sb.db.calls.filter(c => c.includes('grant_type=refresh_token')).length;
  await p.reload(); await p.waitForSelector('text=Connecté avec');
  ok(tag + 'Expired session renewed without asking again', sb.db.calls.filter(c => c.includes('grant_type=refresh_token')).length === refreshes + 1);

  await type('.card input[autocomplete=nickname]', '  Alice   M. ');
  await p.click('button.primary:has-text("Enregistrer")'); await p.waitForSelector('text=Enregistré.');
  const uid = [...sb.db.users.keys()][0];
  ok(tag + 'Name saved on the account, cleaned', sb.db.profiles.get(uid).display_name === 'Alice M.');

  // profile photo: a 900×600 PNG picked from the library → square 512 JPEG, nothing else
  const png = await p.evaluate(async () => { const c = document.createElement('canvas'); c.width = 900; c.height = 600; const g = c.getContext('2d'); g.fillStyle = '#0a7'; g.fillRect(0, 0, 900, 600);
    const b = await new Promise(r => c.toBlob(r, 'image/png')); return Array.from(new Uint8Array(await b.arrayBuffer())); });
  await p.setInputFiles('input[type=file]', { name: 'IMG_0001.png', mimeType: 'image/png', buffer: Buffer.from(png) });
  await p.waitForSelector('text=Photo enregistrée.');
  const files = [...sb.db.files.entries()];
  const jpg = files[0]?.[1];
  ok(tag + 'Photo uploaded into my own folder', files.length === 1 && files[0][0].startsWith(uid + '/') && /\.jpg$/.test(files[0][0]));
  ok(tag + 'Re-drawn on the phone: JPEG' + (jpg?.bytes ? ', no hidden metadata block' : ' (bytes not visible to the tool in this engine)'),
    jpg?.type === 'image/jpeg' && (!jpg.bytes || (jpg.bytes[0] === 0xff && jpg.bytes[1] === 0xd8 && !jpg.bytes.includes(Buffer.from('Exif')))));
  await p.waitForSelector('img.avatar.photo');
  ok(tag + 'Photo shown through a short-lived private link', (await p.getAttribute('img.avatar.photo', 'src')).startsWith(SB + '/storage/v1/object/sign/avatars/'));
  ok(tag + 'Square 512 px', await p.evaluate(() => { const i = document.querySelector('img.avatar.photo'); return i.complete && i.naturalWidth === 512 && i.naturalHeight === 512; }));
  await p.setInputFiles('input[type=file]', { name: 'note.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
  ok(tag + 'Not a photo: refused with an explanation', (await text()).includes('Choisis une photo'));
  await p.click('text=Retirer la photo'); await p.waitForSelector('img.avatar:not(.photo)');
  ok(tag + 'Photo removed: file deleted, generated avatar back', sb.db.files.size === 0 && sb.db.profiles.get(uid).avatar_path === null);

  await p.click('text=Se déconnecter'); await p.waitForSelector('#acc-title');
  ok(tag + 'Signed out: session forgotten on this phone', await p.evaluate(() => localStorage.getItem('collabfit-session') === null));
  await type('input[name=email]', email); await type('input[name=password]', pw + 'x'); await type('input[name=nickname]', 'Alice');
  await p.click('button[type=submit]'); await p.waitForSelector('[role=alert]');
  ok(tag + 'Same e-mail again: told to sign in', (await text()).includes('Un compte existe déjà'));
  await p.click('[role=tab]:has-text("Se connecter")');
  ok(tag + 'Sign-in form asks the iPhone for the saved password', (await p.getAttribute('input[name=password]', 'autocomplete')) === 'current-password');
  await type('input[name=email]', email); await type('input[name=password]', 'wrong-password-1');
  await p.click('button[type=submit]'); await p.waitForSelector('text=E-mail ou mot de passe incorrect.');
  ok(tag + 'Wrong password: clear message', true);
  await type('input[name=password]', pw); await p.click('button[type=submit]'); await p.waitForSelector('text=Connecté avec');
  ok(tag + 'Signed in again', (await text()).includes('Alice M.'));

  await p.click('button.danger-btn:has-text("Supprimer mon compte")');
  ok(tag + 'Deletion asks for the word first', await p.isDisabled('button.danger-btn:has-text("Supprimer définitivement")'));
  await type('.danger input', 'supprimer');
  await p.click('button.danger-btn:has-text("Supprimer définitivement")'); await p.waitForSelector('#acc-title');
  ok(tag + 'Account deleted: gone from the server, signed out here', sb.db.users.size === 0 && sb.db.profiles.size === 0 && await p.evaluate(() => localStorage.getItem('collabfit-session') === null));
  ok(tag + 'Fits the screen', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  ok(tag + 'No errors, no blocked content, no native dialogs (only the 2 refusals provoked on purpose)', !errs.length && refused.length <= 2 && await p.evaluate(() => window.__nd.length === 0), [...errs, ...refused].join(' | '));
  await ctx.close();
}
console.log(`\n${R.length - fails}/${R.length} passed`);
await b.close(); server.close(); process.exit(fails ? 1 : 0);
