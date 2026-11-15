// Accounts on a build made for a Supabase project, against a STAND-IN Supabase (in this test, no network, no key):
// sign-up, mistakes explained, staying signed in, expired session refreshed, name, photo (re-drawn on the phone),
// sign-out, sign-in, complete deletion. The real Supabase is exercised by scripts/staging-e2e.mjs and the deployed test.
// Needs a build with COLLABFIT_SUPABASE_URL=https://abcdefghijklmnopqrst.supabase.co (see package.json "test:accounts").
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { SB, standIn, useStandIn } from './standin.mjs';
const require = createRequire(import.meta.url);
const BR = require('../../../tests/browser.js');
const IOS = require('../../../tests/iosinit.js');

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
const ok = (n, c, x = '') => { const l = (c ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + String(x).slice(0, 240) : ''); R.push(l); console.log(l); if (!c) fails++; };
const b = await BR.launch();
for (const dev of BR.device ? [BR.device] : ['iPhone SE', 'iPhone 16 Plus']) {
  const ctx = await b.newContext({ ...BR.dev(dev), locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  await ctx.addInitScript(IOS);
  const sb = standIn();
  await useStandIn(ctx, sb);
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
  ok(tag + 'Photo uploaded into my own folder', files.length === 1 && files[0][0].startsWith('avatars/' + uid + '/') && /\.jpg$/.test(files[0][0]));
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
