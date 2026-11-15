// Notifications against the stand-in Supabase: turning them on for a device (its address and keys saved to the
// account), the test button, the per-space choices, a message announced once it is stored, signing out removing the
// device — and, in Chromium, the real service worker showing a pushed notification. On iPhone (WebKit) in a Safari
// tab: the app explains to add it to the home screen first. Needs the build made for the stand-in (see accounts.mjs).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { SB, PUSH_KEY, standIn, useStandIn } from './standin.mjs';
const require = createRequire(import.meta.url);
const BR = require('../../../tests/browser.js');
const IOS = require('../../../tests/iosinit.js');

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.map': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
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
const webkit = (process.env.BROWSER || '') === 'webkit';
const webkitAbort = text => webkit && /due to access control checks/i.test(text) && text.includes(new URL(SB).host);
// full Chromium (not the headless shell) so the notification permission and the service worker's display are real
const b = await BR.launch(webkit ? {} : { channel: 'chromium' });
const sb = standIn();
// the device's push subscription, as a browser gives it (headless browsers have no push service): address + keys
const FAKE = { endpoint: 'https://fcm.googleapis.com/fcm/send/test-device-', p256dh: 'BJkMSuZOWdNeKx9bHvz7-gUKPF-AmR6tUxXV5Bl1kyR0eB4OfE15-EqxaFZL_UugT9m6oPkRi8_U3aIoCyXpf8E', auth: 'Zcl2MylPk7P00ykn6vqVMA' };
async function phone(dev, name, safariTab = false) {
  const ctx = await b.newContext({ ...BR.dev(dev), locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  await ctx.addInitScript(IOS);
  if (!webkit) await ctx.grantPermissions(['notifications'], { origin: url.slice(0, -1) });
  // an iPhone's Safari tab has no push at all (only the app opened from the home screen has it)
  if (safariTab) await ctx.addInitScript(() => { delete window.PushManager; });
  else {
    await ctx.addInitScript(f => {
      if (!('PushManager' in window)) return;
      const KEY = '__fake_push';
      const make = () => { const endpoint = f.endpoint + f.name;
        return { endpoint, getKey: () => null, toJSON: () => ({ endpoint, keys: { p256dh: f.p256dh, auth: f.auth } }),
          unsubscribe: async () => { localStorage.removeItem(KEY); return true; } }; };
      PushManager.prototype.subscribe = async function (o) {
        const k = o.applicationServerKey; localStorage.setItem('__fake_push_key', btoa(String.fromCharCode(...new Uint8Array(k.buffer ?? k))));
        localStorage.setItem(KEY, '1'); return make(); };
      PushManager.prototype.getSubscription = async function () { return localStorage.getItem(KEY) ? make() : null; };
      // headless browsers answer "denied" without asking: the permission follows the fake subscription instead
      const real = Object.getOwnPropertyDescriptor(Notification, 'permission');
      window.__realPermission = () => real.get.call(Notification);
      Object.defineProperty(Notification, 'permission', { configurable: true, get: () => localStorage.getItem(KEY) ? 'granted' : 'default' });
    }, { ...FAKE, name });
  }
  await useStandIn(ctx, sb);
  const p = await ctx.newPage(); p.setDefaultTimeout(8000);
  const errs = [];
  p.on('pageerror', e => { if (!webkitAbort(e.message)) errs.push(e.message); });
  p.on('console', m => { if (m.type() === 'error' && !webkitAbort(m.text())) errs.push(m.text()); });
  const text = async () => (await p.textContent('body')).replace(/[  ]/g, ' ');
  const type = (sel, v) => p.locator(sel).first().evaluate((el, v) => { el.focus(); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  return { ctx, p, errs, text, type };
}
async function signUp(ph, name, email) {
  await ph.p.goto(url + '#/profile'); await ph.p.waitForSelector('#acc-title');
  await ph.type('input[name=nickname]', name); await ph.type('input[name=email]', email); await ph.type('input[name=password]', 'correct-horse-42');
  await ph.p.click('button[type=submit]'); await ph.p.waitForSelector('text=Connecté avec');
}
const dev = BR.device || 'iPhone 16 Plus', tag = `[${dev}] `;
const A = await phone(dev, 'alice'), B = await phone(dev, 'bob'), T = await phone(dev, 'tab', true);
await signUp(T, 'Tess', 'tess@push.example'); await T.p.waitForSelector('[data-push]');
ok(tag + 'iPhone, Safari tab: explains that notifications need the app on the home screen first',
  await T.p.getAttribute('[data-push]', 'data-push') === 'install-first' && (await T.text()).includes('Sur l’écran d’accueil') && (await T.text()).includes('ouvre CollabFit depuis cette icône'));
await signUp(A, 'Alice', 'alice@push.example');
await A.p.waitForSelector('[data-push]');
const state = await A.p.getAttribute('[data-push]', 'data-push');
{
  ok(tag + 'Notifications off until the person turns them on', state === 'off' && (await A.text()).includes('Activer sur cet appareil'), state);
  ok(tag + 'Nothing saved before that', sb.db.push.size === 0);
  await A.p.click('[data-push] button.primary:not([disabled])');
  await A.p.waitForSelector('[data-push=on]');
  const dA = [...sb.db.push.values()][0];
  ok(tag + 'Turned on: this device (address + keys) saved to Alice\'s account, French texts', sb.db.push.size === 1 && dA.user_id === [...sb.db.users.values()].find(u => u.email === 'alice@push.example').id && dA.endpoint === FAKE.endpoint + 'alice' && dA.p256dh === FAKE.p256dh && dA.auth === FAKE.auth && dA.lang === 'fr', JSON.stringify(dA));
  ok(tag + 'Subscribed with the server\'s public key', await A.p.evaluate(() => localStorage.getItem('__fake_push_key')) === Buffer.from(PUSH_KEY, 'base64url').toString('base64'));
  await A.p.click('[data-push] button:has-text("M’envoyer un test")'); await A.p.waitForSelector('text=Envoyé : il doit arriver');
  ok(tag + '"Send me a test" asks the server', sb.db.announced.some(x => x.kind === 'test'));
  await A.p.reload(); await A.p.waitForSelector('[data-push=on]');
  ok(tag + 'Still on after reopening', true);

  // a space with Bob; Bob turns them on too, then writes: the message is announced once stored
  await signUp(B, 'Bob', 'bob@push.example');
  await B.p.waitForSelector('[data-push=off]'); await B.p.click('[data-push] button.primary:not([disabled])'); await B.p.waitForSelector('[data-push=on]');
  await A.p.click('nav a[href="#/spaces"]'); await A.p.click('text=Créer notre espace Couple'); await A.p.click('form[data-create=couple] button[type=submit]');
  await A.p.click('text=Créer le lien'); await A.p.waitForSelector('.linkbox input');
  await B.p.goto(await A.p.inputValue('.linkbox input')); await B.p.click('button:has-text("Rejoindre")'); await B.p.waitForSelector('.composer textarea');
  await B.type('.composer textarea', 'On s’entraîne ce soir ?'); await B.p.click('.composer button[type=submit]');
  await B.p.waitForSelector('.msg.mine >> text=On s’entraîne ce soir ?'); await B.p.waitForTimeout(300);
  const msg = sb.db.messages.find(m => m.body === 'On s’entraîne ce soir ?');
  const ann = sb.db.announced.filter(x => x.kind === 'message');
  ok(tag + 'A message is announced by its author once stored (the server decides who is told)', ann.length === 1 && ann[0].id === msg.id && ann[0].who === msg.author_id, JSON.stringify(ann));

  // per-space choices
  await A.p.click('a[role=tab]:has-text("Membres")'); await A.p.waitForSelector('[data-notify-messages] input');
  ok(tag + 'In the space: messages on, the others\' workouts off (until chosen)', await A.p.isChecked('[data-notify-messages] input') && !(await A.p.isChecked('[data-notify-workouts] input')));
  await A.p.click('[data-notify-messages] input'); await A.p.click('[data-notify-workouts] input'); await A.p.waitForTimeout(400);
  const mA = sb.db.members.find(m => m.user_id === dA.user_id);
  ok(tag + 'Alice mutes the messages and asks for the workouts: saved', mA.notify_messages === false && mA.notify_workouts === true, JSON.stringify(mA));
  await A.p.reload(); await A.p.waitForSelector('[data-notify-messages] input');
  ok(tag + '…and still so after reopening', !(await A.p.isChecked('[data-notify-messages] input')) && await A.p.isChecked('[data-notify-workouts] input'));

  // the real service worker shows what is pushed (Chromium can deliver a push to it)
  if (!webkit && await A.p.evaluate(() => window.__realPermission() === 'granted')) {
    const cdp = await A.ctx.newCDPSession(A.p);
    const shownNow = () => A.p.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map(n => ({ title: n.title, body: n.body, tag: n.tag, to: n.data?.to })));
    const until = async test => { for (let i = 0; i < 50; i++) { const s = await shownNow(); if (test(s)) return s; await A.p.waitForTimeout(100); } return shownNow(); };
    const reg = new Promise(r => cdp.on('ServiceWorker.workerRegistrationUpdated', e => { const x = e.registrations.find(g => g.scopeURL === url && !g.isDeleted); if (x) r(x.registrationId); }));
    await cdp.send('ServiceWorker.enable');
    const id = await reg;
    await cdp.send('ServiceWorker.deliverPushMessage', { origin: url.slice(0, -1), registrationId: id, data: JSON.stringify({ title: 'Nous deux', body: 'Bob : On s’entraîne ce soir ?', url: '#/space/abc', tag: 'space-abc' }) });
    const shown = await until(s => s.length > 0);
    ok(tag + 'Service worker: a pushed message is shown (space, "Bob : …", link to the space)', JSON.stringify(shown) === JSON.stringify([{ title: 'Nous deux', body: 'Bob : On s’entraîne ce soir ?', tag: 'space-abc', to: '#/space/abc' }]), JSON.stringify(shown));
    await cdp.send('ServiceWorker.deliverPushMessage', { origin: url.slice(0, -1), registrationId: id, data: JSON.stringify({ title: 'x', body: 'y', url: 'https://evil.example/' }) });
    const evil = (await until(s => s.some(n => n.title === 'x'))).find(n => n.title === 'x');
    ok(tag + 'A link outside the app is never followed (replaced by the app\'s home)', evil?.to === '#/', JSON.stringify(evil));
  } else if (!webkit) console.log('info: this Chromium build has no notification permission (headless shell): service worker display not checked here');

  // signing out takes the device off the account
  await A.p.click('nav a[href="#/profile"]'); await A.p.click('button:has-text("Se déconnecter")'); await A.p.waitForSelector('#acc-title');
  ok(tag + 'Signing out: this device no longer receives Alice\'s notifications', ![...sb.db.push.values()].some(d => d.user_id === dA.user_id) && sb.db.push.size === 1);
}
for (const [who, ph] of [['Alice', A], ['Bob', B], ['Tess', T]]) ok(tag + who + ': no errors, no native dialogs', !ph.errs.length && await ph.p.evaluate(() => window.__nd.length === 0), ph.errs.join(' | '));
console.log(`\n${R.length - fails}/${R.length} passed`);
await b.close(); server.close(); process.exit(fails ? 1 : 0);
