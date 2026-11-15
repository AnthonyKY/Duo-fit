// Two made-up people on the test app as Netlify serves it, with the REAL staging Supabase: Couple space, invitation by
// link, sign-up through the link, live messages both ways (Realtime), a picture, a deleted message; both accounts are
// then deleted from the app (and through the API if a step fails, so nothing is left behind).
//   SMOKE_URL=https://….netlify.app/ SUPABASE_URL=… SUPABASE_KEY=sb_publishable_…  [BROWSER=webkit DEVICE=…]
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
const require = createRequire(import.meta.url);
const BR = require('../../../tests/browser.js');
const IOS = require('../../../tests/iosinit.js');
const url = process.env.SMOKE_URL, SB = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_KEY;
if (!/^https:\/\/[a-z0-9-]+\.netlify\.app\/$/.test(url || '') || !SB || !KEY) { console.log('CRASH SMOKE_URL / SUPABASE_URL / SUPABASE_KEY missing'); process.exit(1); }

const R = []; let fails = 0;
const ok = (n, c, x = '') => { const l = (c ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + String(x).slice(0, 240) : ''); R.push(l); console.log(l); if (!c) fails++; };
const run = randomBytes(3).toString('hex');
const people = { A: { name: `Alice ${run}`, email: `collabfit-ui-a-${run}@example.com`, pw: randomBytes(15).toString('base64url') },
  B: { name: `Bob ${run}`, email: `collabfit-ui-b-${run}@example.com`, pw: randomBytes(15).toString('base64url') } };
const b = await BR.launch();
async function phone(dev) {
  // serviceWorkers 'block': the app's worker only shows notifications (push.mjs); with one attached, WebKit's test driver
  // stops routing requests (stand-in server, Netlify badge stub)
  const ctx = await b.newContext({ ...BR.dev(dev), locale: 'fr-FR', timezoneId: 'Europe/Paris', serviceWorkers: 'block' });
  await ctx.addInitScript(IOS);
  await ctx.route('**/.netlify/scripts/**', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' })); // Netlify's badge, not the app
  const p = await ctx.newPage(); p.setDefaultTimeout(20000);
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const frames = []; p.on('websocket', ws => ws.on('framereceived', f => { if (frames.length < 8) frames.push(String(f.payload).slice(0, 220)); }));
  const text = async () => (await p.textContent('body')).replace(/[  ]/g, ' ');
  const type = (sel, v) => p.locator(sel).first().evaluate((el, v) => { el.focus(); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  return { ctx, p, errs, frames, text, type };
}
async function signUp(ph, who) {
  await ph.p.waitForSelector('#acc-title');
  await ph.type('input[name=nickname]', who.name); await ph.type('input[name=email]', who.email); await ph.type('input[name=password]', who.pw);
  await ph.p.click('button[type=submit]');
}
async function deleteViaApi(who) {
  const r = await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: who.email, password: who.pw }) });
  if (!r.ok) return `no account (HTTP ${r.status})`;
  const { access_token } = await r.json();
  const d = await fetch(`${SB}/functions/v1/delete-account`, { method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' }, body: '{"confirm":"DELETE"}' });
  return `deleted through the API: HTTP ${d.status}`;
}
const devA = BR.device || 'iPhone 16 Plus', devB = BR.device || 'iPhone SE';
const tag = `[${devA} + ${devB}] `;
const A = await phone(devA), B = await phone(devB);
try {
  await A.p.goto(url + '#/profile'); await signUp(A, people.A); await A.p.waitForSelector('text=Connecté avec');
  await A.p.click('nav a[href="#/spaces"]'); await A.p.waitForSelector('text=Mes espaces');
  await A.p.click('text=Créer notre espace Couple'); await A.p.click('form[data-create=couple] button[type=submit]');
  await A.p.waitForSelector('text=Inviter quelqu’un');
  ok(tag + 'Real Couple space created, Alice owner (1/2)', (await A.text()).includes('1/2 personnes') && (await A.text()).includes('propriétaire'));
  await A.p.click('text=Créer le lien'); await A.p.waitForSelector('.linkbox input');
  const link = await A.p.inputValue('.linkbox input');
  ok(tag + 'Invitation link points to the test app', link.startsWith(url + '#/join/'), link.replace(/[A-Za-z0-9_-]{32}$/, '…'));

  await B.p.goto(link); await B.p.click('text=Aller au profil'); await signUp(B, people.B);
  await B.p.waitForSelector('button:has-text("Rejoindre")');
  ok(tag + 'Bob signs up from the link and sees the real invitation', (await B.text()).includes(`${people.A.name} t’invite dans « Nous deux » (Couple).`));
  await B.p.click('button:has-text("Rejoindre")'); await B.p.waitForSelector('.composer textarea');
  ok(tag + 'Bob joined the space', true);

  await A.p.click('a[role=tab]:has-text("Messages")'); await A.p.waitForSelector('.composer textarea');
  let liveA = true, liveB = true;
  try { await A.p.waitForSelector('.chat[data-live=live]', { timeout: 15000 }); } catch { liveA = false; }
  try { await B.p.waitForSelector('.chat[data-live=live]', { timeout: 15000 }); } catch { liveB = false; }
  ok(tag + 'Both phones connected to Supabase Realtime (live)', liveA && liveB, `Alice ${liveA ? 'live' : 'not live'}, Bob ${liveB ? 'live' : 'not live'}`);
  console.log('DIAG Realtime frames received by Alice:\n  ' + A.frames.join('\n  '));

  let t0 = Date.now();
  await B.type('.composer textarea', `Salut ${run} 👋`); await B.p.click('.composer button[type=submit]');
  try { await A.p.waitForSelector(`.msg:not(.mine) >> text=Salut ${run} 👋`, { timeout: 20000 }); }
  catch (e) { // diagnosis: was it sent? does a fresh read show it?
    console.log('DIAG Bob pending:', JSON.stringify(await B.p.evaluate(() => [...document.querySelectorAll('.msg.pending')].map(x => x.getAttribute('data-pending') + ' ' + x.textContent))));
    console.log('DIAG Bob outbox:', await B.p.evaluate(() => Object.entries(localStorage).filter(([k]) => k.startsWith('collabfit-outbox-')).map(([, v]) => v).join(' ').slice(0, 400)));
    console.log('DIAG Bob errors:', B.errs.join(' | ').slice(0, 400));
    await A.p.reload(); await A.p.waitForSelector('.composer');
    console.log('DIAG Alice after reload sees it:', await A.p.isVisible(`.msg:not(.mine) >> text=Salut ${run} 👋`));
    throw e;
  }
  const d1 = Date.now() - t0;
  ok(tag + `Bob → Alice arrives (${(d1 / 1000).toFixed(1)} s)`, d1 < 5000, d1 >= 5000 ? 'slower than live: delivered by the 15-second re-read' : '');
  t0 = Date.now();
  await A.type('.composer textarea', `Coucou ${run}`); await A.p.click('.composer button[type=submit]');
  await B.p.waitForSelector(`.msg:not(.mine) >> text=Coucou ${run}`, { timeout: 20000 });
  const d2 = Date.now() - t0;
  ok(tag + `Alice → Bob arrives (${(d2 / 1000).toFixed(1)} s)`, d2 < 5000);
  await A.p.waitForSelector(`.msg:not(.mine) .who >> text=${people.B.name}`);
  ok(tag + 'Names shown on the bubbles', true);

  const png = await A.p.evaluate(async () => { const c = document.createElement('canvas'); c.width = 2400; c.height = 1600; const g = c.getContext('2d'); g.fillStyle = '#2a6'; g.fillRect(0, 0, 2400, 1600);
    const bl = await new Promise(r => c.toBlob(r, 'image/png')); return Array.from(new Uint8Array(await bl.arrayBuffer())); });
  await A.p.setInputFiles('.composer input[type=file]', { name: 'IMG_0200.png', mimeType: 'image/png', buffer: Buffer.from(png) });
  await B.p.waitForSelector('.msg:not(.mine) img.chat-photo', { timeout: 20000 });
  await B.p.waitForFunction(() => { const i = document.querySelector('.msg:not(.mine) img.chat-photo'); return i && i.complete && i.naturalWidth > 0; });
  ok(tag + 'Picture: uploaded to the private bucket, shown to Bob (1600 px max)', await B.p.evaluate(() => document.querySelector('.msg:not(.mine) img.chat-photo').naturalWidth === 1600));

  const mine = A.p.locator('.msg.mine', { hasText: `Coucou ${run}` });
  await mine.locator('button.tiny').click(); await mine.locator('button.tiny').click();
  await B.p.waitForSelector('.msg:not(.mine) >> text=Message supprimé', { timeout: 20000 });
  ok(tag + 'Deleted message disappears on Bob\'s phone', !(await B.text()).includes(`Coucou ${run}`));

  for (const [who, ph] of [['Alice', A], ['Bob', B]]) {
    await ph.p.goto(url + '#/profile'); await ph.p.waitForSelector('text=Connecté avec');
    await ph.p.click('button.danger-btn:has-text("Supprimer mon compte")'); await ph.type('.danger input', 'SUPPRIMER');
    await ph.p.click('button.danger-btn:has-text("Supprimer définitivement")'); await ph.p.waitForSelector('#acc-title');
    ok(tag + `${who}'s account deleted from the app`, true);
    ok(tag + `${who}: no errors, no blocked content, no native dialogs`, !ph.errs.length && await ph.p.evaluate(() => window.__nd.length === 0), ph.errs.join(' | '));
  }
} catch (e) {
  ok(tag + 'run', false, String(e).slice(0, 300));
} finally {
  for (const who of [people.A, people.B]) console.log(`clean-up ${who.email}: ${await deleteViaApi(who)}`);
}
console.log(`\n${R.length - fails}/${R.length} passed`);
await b.close(); process.exit(fails ? 1 : 0);
