// Training on the test app as Netlify serves it, with the REAL staging Supabase: set-up, a workout from DUOFIT's engine,
// saved to the account, found again on a second phone; the made-up account is then deleted (through the API if a step fails).
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
const who = { email: `collabfit-ui-t-${randomBytes(3).toString('hex')}@example.com`, pw: randomBytes(15).toString('base64url') };
const b = await BR.launch(), dev = BR.device || 'iPhone 16 Plus', tag = `[${dev}] `;
async function phone() {
  // serviceWorkers 'block': the app's worker only shows notifications (push.mjs); with one attached, WebKit's test driver
  // stops routing requests (stand-in server, Netlify badge stub)
  const ctx = await b.newContext({ ...BR.dev(dev), locale: 'fr-FR', timezoneId: 'Europe/Paris', serviceWorkers: 'block' });
  await ctx.addInitScript(IOS);
  await ctx.route('**/.netlify/scripts/**', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' })); // Netlify's badge, not the app
  const p = await ctx.newPage(); p.setDefaultTimeout(20000);
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const type = (sel, v) => p.locator(sel).first().evaluate((el, v) => { el.focus(); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  return { p, errs, type };
}
const saved = ph => ph.p.waitForFunction(() => document.querySelector('[data-sync]')?.getAttribute('data-sync') === 'saved', null, { timeout: 20000 });
const A = await phone();
try {
  await A.p.goto(url + '#/profile'); await A.p.waitForSelector('#acc-title');
  await A.type('input[name=nickname]', 'Testeur séance'); await A.type('input[name=email]', who.email); await A.type('input[name=password]', who.pw);
  await A.p.click('button[type=submit]'); await A.p.waitForSelector('text=Connecté avec');
  await A.p.click('nav a[href="#/training"]'); await A.p.waitForSelector('form.setup');
  await A.p.click('form.setup button[type=submit]'); await A.p.waitForSelector('.history'); await saved(A);
  await A.p.click('.seg button:has-text("B")'); await A.p.waitForSelector('.plan[data-day=B]');
  ok(tag + 'Real account: set-up saved, plan of the day shown (DUOFIT engine)', (await A.p.locator('.plan .exlist li').count()) >= 3);
  await A.p.click('.plan button.primary'); await A.p.waitForSelector('.session');
  const n = await A.p.locator('.card.ex').count();
  for (let i = 0; i < n; i++) { await A.type(`[data-set="${i}-0"] input[inputmode=decimal]`, '25'); await A.p.click(`[data-set="${i}-0"] button`); }
  await A.p.click('button:has-text("Terminer et enregistrer")'); await A.p.waitForSelector('text=Séance enregistrée');
  await A.p.click('button:has-text("Retour")'); await saved(A);
  ok(tag + 'Workout saved to the real account', (await A.p.textContent('.history')).includes('25 ×'));
  const A2 = await phone();
  await A2.p.goto(url + '#/profile'); await A2.p.waitForSelector('#acc-title'); await A2.p.click('[role=tab]:has-text("Se connecter")');
  await A2.type('input[name=email]', who.email); await A2.type('input[name=password]', who.pw); await A2.p.click('button[type=submit]'); await A2.p.waitForSelector('text=Connecté avec');
  await A2.p.click('nav a[href="#/training"]'); await A2.p.waitForSelector('.history');
  ok(tag + 'Second phone: programme and workout found on the account', (await A2.p.textContent('.history')).includes('25 ×') && !(await A2.p.isVisible('form.setup')));
  for (const [w, ph] of [['phone 1', A], ['phone 2', A2]]) ok(tag + `${w}: no errors, no native dialogs`, !ph.errs.length && await ph.p.evaluate(() => window.__nd.length === 0), ph.errs.join(' | '));
  await A.p.goto(url + '#/profile'); await A.p.waitForSelector('text=Connecté avec');
  await A.p.click('button.danger-btn:has-text("Supprimer mon compte")'); await A.type('.danger input', 'SUPPRIMER');
  await A.p.click('button.danger-btn:has-text("Supprimer définitivement")'); await A.p.waitForSelector('#acc-title');
  ok(tag + 'Account deleted from the app (its training data goes with it)', true);
} catch (e) { ok(tag + 'run', false, String(e).slice(0, 300)); }
finally {
  const r = await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: who.email, password: who.pw }) });
  if (r.ok) { const { access_token } = await r.json(); const d = await fetch(`${SB}/functions/v1/delete-account`, { method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' }, body: '{"confirm":"DELETE"}' }); console.log(`clean-up ${who.email}: deleted through the API (HTTP ${d.status})`); }
}
console.log(`\n${R.length - fails}/${R.length} passed`);
await b.close(); process.exit(fails ? 1 : 0);
