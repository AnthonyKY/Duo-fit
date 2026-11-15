// Two phones, two people, against the stand-in Supabase: Alice creates the Couple space and invites Bob by link; Bob,
// not signed up yet, opens it, creates his account and joins; they chat live, send a picture, a message typed offline
// leaves when the network is back, a message is deleted, blocking hides, the full couple refuses a third person,
// ownership moves, Alice leaves. Needs the build made for the stand-in (see accounts.mjs).
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
// WebKit (only) logs a request cut short by a reload as "… due to access control checks": not an app error
const webkitAbort = text => (process.env.BROWSER || '') === 'webkit' && /due to access control checks/i.test(text) && text.includes(new URL(SB).host);
const ok = (n, c, x = '') => { const l = (c ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + String(x).slice(0, 240) : ''); R.push(l); console.log(l); if (!c) fails++; };
const b = await BR.launch();
const sb = standIn();
const webkit = (process.env.BROWSER || '') === 'webkit';
async function phone(dev) {
  const ctx = await b.newContext({ ...BR.dev(dev), locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  await ctx.addInitScript(IOS);
  await useStandIn(ctx, sb);
  if (!webkit) await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: url.slice(0, -1) });
  const p = await ctx.newPage(); p.setDefaultTimeout(8000);
  const errs = [], refused = [];
  p.on('pageerror', e => { if (!webkitAbort(e.message)) errs.push(e.message); });
  p.on('console', m => { if (m.type() !== 'error') return; if ((m.location().url || '').startsWith(SB) && /Failed to load resource/i.test(m.text()) || webkitAbort(m.text())) refused.push(m.text()); else errs.push(m.text()); });
  const text = async () => (await p.textContent('body')).replace(/[  ]/g, ' ');
  const type = (sel, v) => p.locator(sel).first().evaluate((el, v) => { el.focus(); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  return { ctx, p, errs, refused, text, type };
}
async function signUp(ph, name, email) {
  await ph.p.waitForSelector('#acc-title');
  await ph.type('input[name=nickname]', name); await ph.type('input[name=email]', email); await ph.type('input[name=password]', 'correct-horse-42');
  await ph.p.click('button[type=submit]');
}
const devA = BR.device || 'iPhone 16 Plus', devB = BR.device || 'iPhone SE';
const A = await phone(devA), B = await phone(devB);
const tag = `[${devA} + ${devB}] `;

// Alice: account, then the Couple space
await A.p.goto(url + '#/profile'); await signUp(A, 'Alice', 'alice@example.com'); await A.p.waitForSelector('text=Connecté avec');
await A.p.click('nav a[href="#/spaces"]'); await A.p.waitForSelector('text=Mes espaces');
ok(tag + 'Spaces: none yet, both kinds offered', (await A.text()).includes('Tu n’as pas encore d’espace') && (await A.text()).includes('Créer un groupe d’amis'));
await A.p.click('text=Créer notre espace Couple'); await A.p.click('form[data-create=couple] button[type=submit]');
await A.p.waitForSelector('text=Inviter quelqu’un');
ok(tag + 'Couple space created: Alice is owner, 1/2', (await A.text()).includes('Nous deux') && (await A.text()).includes('propriétaire') && (await A.text()).includes('1/2 personnes'));
await A.p.click('text=Créer le lien'); await A.p.waitForSelector('.linkbox input');
const link = await A.p.inputValue('.linkbox input');
ok(tag + 'Invitation link: this app, #/join/ + secret', link.startsWith(url + '#/join/') && /#\/join\/[A-Za-z0-9_-]{32}$/.test(link), link);
if (!webkit) { await A.p.click('text=Copier le lien'); await A.p.waitForSelector('text=Lien copié.'); ok(tag + '"Copier le lien" copies it', (await A.p.evaluate(() => navigator.clipboard.readText())) === link); }
ok(tag + 'Open link listed (1 place)', (await A.text()).includes('Liens en cours') && (await A.text()).includes('1 place'));

// Bob: opens the link without an account
await B.p.goto(link); await B.p.waitForSelector('text=Aller au profil');
ok(tag + 'Bob without account: asked to create one, invitation kept for this visit', (await B.text()).includes('Crée ton compte') && await B.p.evaluate(() => !!sessionStorage.getItem('collabfit-invite')));
await B.p.click('text=Aller au profil'); await signUp(B, 'Bob', 'bob@example.com');
await B.p.waitForSelector('text=Rejoindre');
ok(tag + 'After sign-up Bob sees who invites him, to what', (await B.text()).includes('Alice t’invite dans « Nous deux » (Couple).') && (await B.text()).includes('1/2 personnes'));
await B.p.click('button:has-text("Rejoindre")'); await B.p.waitForSelector('.composer textarea');
ok(tag + 'Bob joins: straight into the conversation', (await B.text()).includes('Nous deux') && (await B.text()).includes('Aucun message'));
ok(tag + 'Invitation forgotten once used', await B.p.evaluate(() => sessionStorage.getItem('collabfit-invite') === null));

// live conversation
await A.p.click('a[role=tab]:has-text("Messages")'); await A.p.waitForSelector('.chat[data-live=live]');
await B.p.waitForSelector('.chat[data-live=live]');
ok(tag + 'Both phones connected live', true);
await B.type('.composer textarea', 'Salut Alice 👋'); await B.p.click('.composer button[type=submit]');
await A.p.waitForSelector('.msg:not(.mine) >> text=Salut Alice 👋', { timeout: 4000 });
await A.p.waitForSelector('.msg:not(.mine) .who >> text=Bob', { timeout: 4000 });
ok(tag + 'Bob → Alice: arrives live, with his name', true);
ok(tag + 'On Bob\'s phone: his own bubble, sent', await B.p.isVisible('.msg.mine >> text=Salut Alice 👋') && !(await B.p.isVisible('.msg.pending')));
const png = await A.p.evaluate(async () => { const c = document.createElement('canvas'); c.width = 3000; c.height = 2000; const g = c.getContext('2d'); g.fillStyle = '#36c'; g.fillRect(0, 0, 3000, 2000);
  const bl = await new Promise(r => c.toBlob(r, 'image/png')); return Array.from(new Uint8Array(await bl.arrayBuffer())); });
await A.p.setInputFiles('.composer input[type=file]', { name: 'IMG_0100.png', mimeType: 'image/png', buffer: Buffer.from(png) });
await B.p.waitForSelector('.msg:not(.mine) img.chat-photo', { timeout: 6000 });
const up = [...sb.db.files.entries()].find(([k]) => k.startsWith('chat-media/'));
ok(tag + 'Alice → Bob: picture arrives live through a 60-second private link', (await B.p.getAttribute('.msg:not(.mine) img.chat-photo', 'src')).startsWith(SB + '/storage/v1/object/sign/chat-media/'));
ok(tag + 'Picture shrunk on the phone (JPEG' + (up?.[1].bytes ? ', 1600 px max' : '') + ') into Alice\'s own folder',
  !!up && up[0].split('/')[2] === [...sb.db.users.values()].find(u => u.email === 'alice@example.com').id && up[1].type === 'image/jpeg');

// offline: typed, kept, sent when the network is back (Chromium can cut the network; WebKit's switch is a no-op here)
if (!webkit) {
  await B.ctx.setOffline(true);
  await B.p.evaluate(() => dispatchEvent(new Event('offline')));
  await B.type('.composer textarea', 'Écrit dans le métro'); await B.p.click('.composer button[type=submit]');
  await B.p.waitForSelector('.msg.pending >> text=Écrit dans le métro');
  ok(tag + 'Offline: message shown as waiting, kept on the phone', (await B.text()).includes('en attente de connexion') && await B.p.evaluate(() => Object.keys(localStorage).some(k => k.startsWith('collabfit-outbox-') && localStorage.getItem(k).includes('métro'))));
  await B.ctx.setOffline(false); await B.p.evaluate(() => dispatchEvent(new Event('online')));
  await A.p.waitForSelector('.msg:not(.mine) >> text=Écrit dans le métro', { timeout: 6000 });
  ok(tag + 'Back online: sent once, arrives', sb.db.messages.filter(m => m.body === 'Écrit dans le métro').length === 1 && !(await B.p.isVisible('.msg.pending')));
}

// deletion
await A.type('.composer textarea', 'Message à effacer'); await A.p.click('.composer button[type=submit]');
await B.p.waitForSelector('.msg:not(.mine) >> text=Message à effacer');
const mine = A.p.locator('.msg.mine', { hasText: 'Message à effacer' });
await mine.locator('button.tiny').click(); await mine.locator('button.tiny').click();
await B.p.waitForSelector('.msg:not(.mine) >> text=Message supprimé', { timeout: 4000 });
ok(tag + 'Alice deletes her message: gone for Bob too, a trace remains', !(await B.text()).includes('Message à effacer'));

// members: blocking, full couple, ownership, leaving
await B.p.click('a[role=tab]:has-text("Membres")'); await B.p.waitForSelector('[data-member=other]');
const other = B.p.locator('[data-member=other]');
await other.locator('button:has-text("Bloquer")').click(); await other.locator('button:has-text("Confirmer")').click();
await B.p.waitForSelector('.badge.warn');
await B.p.click('a[role=tab]:has-text("Messages")'); await B.p.waitForSelector('.composer');
await B.p.waitForTimeout(300);
await B.p.waitForSelector('.msg.mine >> text=Salut Alice 👋');
ok(tag + 'Bob blocks Alice: her messages and picture disappear for him', (await B.p.locator('.msg:not(.mine)').count()) === 0 && (await B.p.locator('img.chat-photo').count()) === 0);
await B.p.click('a[role=tab]:has-text("Membres")'); await B.p.click('[data-member=other] button:has-text("Débloquer")');
await B.p.waitForSelector('[data-member=other] button:has-text("Bloquer")');
await B.p.click('a[role=tab]:has-text("Messages")'); await B.p.waitForSelector('.msg:not(.mine) img.chat-photo');
ok(tag + 'Unblocked: visible again', true);

await A.p.click('a[role=tab]:has-text("Membres")'); await A.p.waitForSelector('[data-member=other]');
ok(tag + 'Couple full (2/2): no more invitation possible', (await A.text()).includes('2/2 personnes') && (await A.text()).includes('Espace complet.'));
await A.p.click('[data-member=other] button:has-text("Nommer propriétaire")'); await A.p.click('[data-member=other] button:has-text("Confirmer")');
await A.p.waitForSelector('[data-member=other] .badge');
ok(tag + 'Alice makes Bob the owner: one owner, Alice stays a member', (await A.p.textContent('[data-member=other]')).includes('propriétaire') && !(await A.p.textContent('[data-member=me]')).includes('propriétaire'));
await A.p.click('button.danger-btn:has-text("Quitter l’espace")'); await A.p.click('button.danger-btn:has-text("Confirmer")');
await A.p.waitForSelector('text=Mes espaces');
ok(tag + 'Alice leaves: back to her spaces, none left, she can create a couple again', (await A.text()).includes('Tu n’as pas encore d’espace') && (await A.text()).includes('Créer notre espace Couple'));
await B.p.click('a[role=tab]:has-text("Membres")'); await B.p.reload(); await B.p.waitForSelector('[data-member=me]');
ok(tag + 'Bob: alone, owner, can invite again', (await B.text()).includes('1/2 personnes') && (await B.text()).includes('Inviter quelqu’un'));

// pasting a link inside the app (on iPhone, links from Messages open in Safari, not in the home-screen app)
await B.p.click('a[role=tab]:has-text("Messages")'); await B.p.click('a.back');
await B.p.waitForSelector('text=Mes espaces');
await A.p.click('text=Créer un groupe d’amis'); await A.type('form[data-create=friends] input', 'Running du dimanche');
await A.p.selectOption('form[data-create=friends] select', '6'); await A.p.click('form[data-create=friends] button[type=submit]');
await A.p.waitForSelector('text=Inviter quelqu’un');
ok(tag + 'Friends group: Alice chose 6 places', (await A.text()).includes('1/6 personnes'));
await A.p.selectOption('[data-invite] select', '3'); await A.p.click('text=Créer le lien'); await A.p.waitForSelector('.linkbox input');
const link2 = await A.p.inputValue('.linkbox input');
ok(tag + 'Link for 3 people listed', (await A.text()).includes('3 places'));
await B.p.click('text=J’ai reçu un lien d’invitation'); await B.type('[data-paste] input', 'pas un lien'); await B.p.click('[data-paste] button[type=submit]');
ok(tag + 'Pasting something else: refused', (await B.text()).includes('Ce lien d’invitation n’est pas valide.'));
await B.type('[data-paste] input', '  ' + link2 + ' '); await B.p.click('[data-paste] button[type=submit]');
await B.p.waitForSelector('button:has-text("Rejoindre")');
ok(tag + 'Pasting the link: the invitation shows', (await B.text()).includes('« Running du dimanche » (Amis)'));
await B.p.click('button:has-text("Rejoindre")'); await B.p.waitForSelector('.composer textarea');
await A.p.reload(); await A.p.waitForSelector('[data-member=other]');
ok(tag + 'Bob joined the group: 2/6, the link has 2 places left', (await A.text()).includes('2/6 personnes') && (await A.text()).includes('2 places'));

for (const [who, ph] of [['Alice', A], ['Bob', B]]) {
  ok(tag + `${who}: fits the screen`, await ph.p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  ok(tag + `${who}: no errors, no blocked content, no native dialogs`, !ph.errs.length && await ph.p.evaluate(() => window.__nd.length === 0), ph.errs.join(' | '));
}
console.log(`\n${R.length - fails}/${R.length} passed`);
await b.close(); server.close(); process.exit(fails ? 1 : 0);
