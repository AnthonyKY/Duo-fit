// The test app as Netlify serves it, with the REAL staging Supabase: the path a person follows on an iPhone.
// A made-up account is created, used, then deleted from the app itself (and deleted anyway if a step fails).
//   SMOKE_URL=https://….netlify.app/  [BROWSER=webkit DEVICE="iPhone 16 Plus"]  node apps/web/test/deployed.mjs
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
const require = createRequire(import.meta.url);
const BR = require('../../../tests/browser.js');
const IOS = require('../../../tests/iosinit.js');
const url = process.env.SMOKE_URL;
const DUOFIT = 'https://anthonyky.github.io/Duo-fit/';
if (!/^https:\/\/[a-z0-9-]+\.netlify\.app\/$/.test(url || '')) { console.log('CRASH SMOKE_URL must be the Netlify address ending with /'); process.exit(1); }

const R = []; let fails = 0;
const ok = (n, c, x = '') => { const l = (c ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + String(x).slice(0, 240) : ''); R.push(l); console.log(l); if (!c) fails++; };
const b = await BR.launch();
for (const dev of BR.device ? [BR.device] : ['iPhone SE', 'iPhone 16 Plus']) {
  const ctx = await b.newContext({ ...BR.dev(dev), locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  await ctx.addInitScript(IOS);
  // Netlify's free plan injects its "Powered by" badge script; the app's policy blocks what it injects. Not the app's code.
  await ctx.route('**/.netlify/scripts/**', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  const p = await ctx.newPage(); p.setDefaultTimeout(15000);
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const text = async () => (await p.textContent('body')).replace(/[  ]/g, ' ');
  const type = (sel, v) => p.locator(sel).evaluate((el, v) => { el.focus(); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  const tag = `[${dev}] `;
  const email = `collabfit-ui-${randomBytes(4).toString('hex')}@example.com`, pw = randomBytes(15).toString('base64url');
  try {
    await p.goto(url);
    ok(tag + 'Online, home in French with the account available', (await text()).includes('Compte sécurisé'));
    await p.click('nav a[href="#/training"]');
    const href = await p.getAttribute('a.button.primary', 'href');
    ok(tag + '"Ouvrir DUOFIT" points to ' + DUOFIT, href === DUOFIT, href);
    await Promise.all([p.waitForURL(DUOFIT + '**'), p.click('a.button.primary')]);
    ok(tag + 'It opens DUOFIT at its own address (DUOFIT itself untouched)', p.url().startsWith(DUOFIT) && /duo/i.test(await p.title()), p.url() + ' · ' + await p.title());
    await p.goto(url + '#/profile'); await p.waitForSelector('#acc-title');

    await type('input[name=nickname]', 'Testeur iPhone'); await type('input[name=email]', email); await type('input[name=password]', pw);
    await p.click('button[type=submit]'); await p.waitForSelector('text=Connecté avec');
    ok(tag + 'Real sign-up: signed in at once', (await text()).includes('Testeur iPhone') && (await text()).includes(email));
    await p.reload(); await p.waitForSelector('text=Connecté avec');
    ok(tag + 'Still signed in after reopening', true);
    await type('.card input[autocomplete=nickname]', 'Testeur 16'); await p.click('button.primary:has-text("Enregistrer")');
    await p.waitForSelector('text=Enregistré.');
    await p.reload(); await p.waitForSelector('text=Connecté avec');
    ok(tag + 'Name saved on the real server', (await text()).includes('Testeur 16'));

    const png = await p.evaluate(async () => { const c = document.createElement('canvas'); c.width = 1200; c.height = 900; const g = c.getContext('2d'); g.fillStyle = '#e60'; g.fillRect(0, 0, 1200, 900);
      const bl = await new Promise(r => c.toBlob(r, 'image/png')); return Array.from(new Uint8Array(await bl.arrayBuffer())); });
    await p.setInputFiles('input[type=file]', { name: 'IMG_0002.png', mimeType: 'image/png', buffer: Buffer.from(png) });
    await p.waitForSelector('text=Photo enregistrée.'); await p.waitForSelector('img.avatar.photo');
    await p.waitForFunction(() => { const i = document.querySelector('img.avatar.photo'); return i && i.complete && i.naturalWidth > 0; });
    ok(tag + 'Photo uploaded to the private bucket and shown through a short-lived link',
      await p.evaluate(() => { const i = document.querySelector('img.avatar.photo'); return i.naturalWidth === 512 && /\/storage\/v1\/object\/sign\/avatars\//.test(i.src); }));

    await p.click('text=Se déconnecter'); await p.waitForSelector('#acc-title');
    await p.click('[role=tab]:has-text("Se connecter")');
    await type('input[name=email]', email); await type('input[name=password]', pw); await p.click('button[type=submit]');
    await p.waitForSelector('text=Connecté avec'); await p.waitForSelector('img.avatar.photo');
    ok(tag + 'Sign out, then sign in again: name and photo are back', (await text()).includes('Testeur 16'));

    await p.click('button.danger-btn:has-text("Supprimer mon compte")'); await type('.danger input', 'SUPPRIMER');
    await p.click('button.danger-btn:has-text("Supprimer définitivement")'); await p.waitForSelector('#acc-title');
    await p.click('[role=tab]:has-text("Se connecter")');
    await type('input[name=email]', email); await type('input[name=password]', pw); await p.click('button[type=submit]');
    await p.waitForSelector('text=E-mail ou mot de passe incorrect.');
    ok(tag + 'Account deleted from the app: it no longer exists', true);
    const provoked = errs.filter(e => /status of 400/.test(e)).length; // the sign-in attempt just above, on purpose
    ok(tag + 'No errors, no blocked content, no native dialogs', errs.length === provoked && provoked <= 1 && await p.evaluate(() => window.__nd.length === 0), errs.join(' | '));
  } catch (e) {
    ok(tag + 'run', false, String(e));
    // never leave a test account behind: sign in through the API with the made-up credentials and delete it
    const SB = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_KEY;
    if (SB && KEY) {
      const r = await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: pw }) });
      if (r.ok) {
        const { access_token } = await r.json();
        const d = await fetch(`${SB}/functions/v1/delete-account`, { method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' }, body: '{"confirm":"DELETE"}' });
        console.log(`clean-up: test account ${email} deleted: HTTP ${d.status}`);
      } else console.log(`clean-up: no test account left for ${email} (HTTP ${r.status})`);
    }
  }
  await ctx.close();
}
console.log(`\n${R.length - fails}/${R.length} passed`);
await b.close(); process.exit(fails ? 1 : 0);
