// Training in CollabFit against the stand-in Supabase: first set-up, plan of the day from DUOFIT's engine, a guided
// workout (targets, rest timer, next targets), history, the workout following the account to a second phone, two
// phones saving at the same time (nothing lost), and "a commencé / a terminé sa séance" in a space where the person
// turned sharing on. Needs the build made for the stand-in (see accounts.mjs).
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
  const p = new URL(req.url, 'http://x').pathname, file = path.join(dist, p === '/' ? 'index.html' : p);
  if (!file.startsWith(dist)) { res.writeHead(403); return res.end(); }
  try { const body = await readFile(file); res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' }); res.end(body); } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;
if (!(await readFile(path.join(dist, 'assets/app.js'), 'utf8')).includes(SB)) { console.log('CRASH build is not configured for ' + SB); process.exit(1); }

const R = []; let fails = 0;
const ok = (n, c, x = '') => { const l = (c ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + String(x).slice(0, 260) : ''); R.push(l); console.log(l); if (!c) fails++; };
const b = await BR.launch(), sb = standIn();
async function phone(dev) {
  const ctx = await b.newContext({ ...BR.dev(dev), locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  await ctx.addInitScript(IOS); await useStandIn(ctx, sb);
  const p = await ctx.newPage(); p.setDefaultTimeout(8000);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !((m.location().url || '').startsWith(SB) && /Failed to load resource/i.test(m.text()))) errs.push(m.text()); });
  const text = async () => (await p.textContent('body')).replace(/[  ]/g, ' ');
  const type = (sel, v) => p.locator(sel).first().evaluate((el, v) => { el.focus(); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  return { ctx, p, errs, text, type };
}
async function signUp(ph, name, email, mode = 'up') {
  await ph.p.goto(url + '#/profile'); await ph.p.waitForSelector('#acc-title');
  if (mode === 'in') await ph.p.click('[role=tab]:has-text("Se connecter")'); else await ph.type('input[name=nickname]', name);
  await ph.type('input[name=email]', email); await ph.type('input[name=password]', 'correct-horse-42');
  await ph.p.click('button[type=submit]'); await ph.p.waitForSelector('text=Connecté avec');
}
const savedAll = ph => ph.p.waitForFunction(() => document.querySelector('[data-sync]')?.getAttribute('data-sync') === 'saved', null, { timeout: 8000 });
async function doWorkout(ph, day, load = '20', reps = null) {
  await ph.p.click('nav a[href="#/training"]'); await ph.p.waitForSelector('.history');
  await ph.p.click(`.seg button:has-text("${day}")`); await ph.p.waitForSelector(`.plan[data-day=${day}]`);
  await ph.p.click('.plan button.primary'); await ph.p.waitForSelector('.session');
  const cards = await ph.p.locator('.card.ex').count();
  for (let i = 0; i < cards; i++) {
    await ph.type(`[data-set="${i}-0"] input[inputmode=decimal]`, load);
    if (reps) await ph.type(`[data-set="${i}-0"] input[inputmode=numeric]`, reps);
    await ph.p.click(`[data-set="${i}-0"] button`);
  }
  return cards;
}
const dev = BR.device || 'iPhone 16 Plus';
const tag = `[${dev}] `;
const A = await phone(dev);

// first set-up
await signUp(A, 'Alice', 'alice@example.com');
await A.p.click('nav a[href="#/training"]'); await A.p.waitForSelector('form.setup');
ok(tag + 'First visit: the programme set-up (priority, level, length, days, equipment, goal, back)', (await A.text()).includes('Haut du corps') && (await A.text()).includes('Jours d’entraînement') && (await A.text()).includes('Dos sensible'));
await A.p.click('form.setup button:has-text("Intermédiaire")'); await A.p.click('form.setup button:has-text("45")');
await A.p.click('form.setup button[type=submit]'); await A.p.waitForSelector('.seg button:has-text("A")');
await A.p.click('.seg button:has-text("A")'); await A.p.waitForSelector('.plan');
ok(tag + 'Plan of the day from the DUOFIT engine: exercises with sets × reps, length', (await A.p.locator('.plan .exlist li').count()) >= 3 && (await A.text()).includes('≈ 45 min'), (await A.p.textContent('.plan')).slice(0, 200));
await savedAll(A);
ok(tag + 'Saved to the account right away (version 1, no body data sent)', [...sb.db.training.values()][0]?.version >= 1 && JSON.stringify([...sb.db.training.values()][0]?.data.d.M.body) === '[]');

// a workout
const cards = await doWorkout(A, 'A', '20');
ok(tag + 'Workout: one card per exercise, advice text, reps field shows the target', cards >= 3 && (await A.p.textContent('.card.ex .tip')).length > 10 && /^\d+$/.test(await A.p.getAttribute('[data-set="0-1"] input[inputmode=numeric]', 'placeholder')));
ok(tag + 'A set validated: rest timer shown, next set takes the same load', await A.p.isVisible('.rest') && (await A.p.inputValue('[data-set="0-1"] input[inputmode=decimal]')) === '20');
await A.p.click('.rest button');
await A.p.reload(); await A.p.waitForSelector('.session');
ok(tag + 'Closing the app mid-workout: the workout is still there', (await A.p.locator('.setrow.ok').count()) === cards);
await A.p.click('button:has-text("Terminer et enregistrer")'); await A.p.waitForSelector('text=Séance enregistrée');
ok(tag + 'Finish: saved, with the next target per exercise', (await A.text()).includes('La prochaine fois') && (await A.p.locator('.list li').count()) === cards);
await A.p.click('button:has-text("Retour")'); await A.p.waitForSelector('.history');
ok(tag + 'History shows the workout (date, sets, loads)', (await A.p.textContent('.history')).includes('20 ×'));
await savedAll(A);
const uid = [...sb.db.users.values()].find(u => u.email === 'alice@example.com').id;
ok(tag + 'On the account: 1 workout', sb.db.training.get(uid)?.data.d.M.logs.length === 1, JSON.stringify(sb.db.calls.filter(c => /training|save_training/.test(c)).slice(-8)) + ' errs=' + A.errs.join('|').slice(0,200) + ' sync=' + await A.p.getAttribute('[data-sync]','data-sync'));

// a slow network: the workout ends while the previous save is on its way, and that save's answer comes back
// just after — the workout must still reach the account (it used to be marked as sent and stay on the phone)
let release; sb.db.saveGate = new Promise(r => { release = r; }); sb.db.held = 0;
await doWorkout(A, 'B', '22,5');                          // starting saved the drawn exercises: that save is held
await A.p.waitForFunction(() => true); for (let k = 0; k < 40 && !sb.db.held; k++) await new Promise(r => setTimeout(r, 100));
await A.p.click('button:has-text("Terminer et enregistrer")'); await A.p.waitForSelector('text=Séance enregistrée');
sb.db.saveGate = null; release();                          // the old answer arrives now
await A.p.click('button:has-text("Retour")'); await new Promise(r => setTimeout(r, 2500)); await savedAll(A);
ok(tag + 'Workout finished while a save was on its way: it still reaches the account (2 workouts)', sb.db.training.get(uid)?.data.d.M.logs.length === 2, String(sb.db.training.get(uid)?.data.d.M.logs.length));
sb.db.training.get(uid).data.d.M.logs = sb.db.training.get(uid).data.d.M.logs.filter(l => l.wk !== 'B'); // back to 1 for the next checks
sb.db.training.get(uid).version++;
await A.p.reload(); await A.p.waitForSelector('.history');

// the same account on a second phone
const A2 = await phone(dev);
await signUp(A2, 'Alice', 'alice@example.com', 'in');
await A2.p.click('nav a[href="#/training"]'); await A2.p.waitForSelector('.history');
ok(tag + 'Second phone: the programme and the workout are there (followed the account)', (await A2.p.textContent('.history')).includes('20 ×') && !(await A2.p.isVisible('form.setup')));

// two phones saving at the same time: nothing lost
await doWorkout(A2, 'B', '30'); await A2.p.click('button:has-text("Terminer et enregistrer")'); await A2.p.waitForSelector('text=Séance enregistrée');
await A2.p.click('button:has-text("Retour")'); await savedAll(A2);
await doWorkout(A, 'C', '40'); await A.p.click('button:has-text("Terminer et enregistrer")'); await A.p.waitForSelector('text=Séance enregistrée');
await A.p.click('button:has-text("Retour")'); await savedAll(A);
const logs = sb.db.training.get(uid).data.d.M.logs.map(l => l.wk).sort().join('');
ok(tag + 'Phone 1 saved after phone 2: merged, all 3 workouts kept (A, B, C)', logs === 'ABC', logs);
await A2.p.reload(); await A2.p.waitForSelector('.history');
ok(tag + 'Phone 2 after reopening: the 3 workouts', (await A2.p.locator('.history .list li').count()) === 3);

// sharing "a commencé / terminé sa séance" in a space
const B = await phone(dev);
await A.p.click('nav a[href="#/spaces"]'); await A.p.click('text=Créer notre espace Couple'); await A.p.click('form[data-create=couple] button[type=submit]');
await A.p.waitForSelector('text=Créer le lien'); await A.p.click('text=Créer le lien'); await A.p.waitForSelector('.linkbox input');
const link = await A.p.inputValue('.linkbox input');
await signUp(B, 'Bob', 'bob@example.com');
await B.p.click('nav a[href="#/spaces"]'); await B.p.click('text=J’ai reçu un lien d’invitation'); await B.type('[data-paste] input', link); await B.p.click('[data-paste] button[type=submit]');
await B.p.click('button:has-text("Rejoindre")'); await B.p.waitForSelector('.composer');
await B.p.click('a[role=tab]:has-text("Membres")'); await B.p.waitForSelector('[data-share]');
ok(tag + 'Sharing workouts is off until the person turns it on', !(await B.p.isChecked('[data-share] input')));
await B.p.check('[data-share] input'); await B.p.waitForFunction(() => document.querySelector('[data-share] input').checked);
await A.p.click('a[role=tab]:has-text("Messages")'); await A.p.waitForSelector('.chat[data-live=live]');
await B.p.click('nav a[href="#/training"]'); await B.p.waitForSelector('form.setup'); await B.p.click('form.setup button[type=submit]'); await B.p.waitForSelector('.history');
await doWorkout(B, 'A', '10');
await A.p.waitForSelector('[data-moment=started]', { timeout: 5000 });
ok(tag + 'Bob starts: Alice sees "💪 Bob a commencé sa séance" live in the space', (await A.p.textContent('[data-moment=started]')).includes('Bob a commencé sa séance'));
await B.p.click('button:has-text("Terminer et enregistrer")');
await A.p.waitForSelector('[data-moment=completed]', { timeout: 5000 });
ok(tag + '…and "✅ Bob a terminé sa séance" — nothing else (no load, no history)', (await A.p.textContent('[data-moment=completed]')).includes('Bob a terminé sa séance') && sb.db.events.every(e => Object.keys(e).sort().join() === 'created_at,event_type,id,user_id,workout_ref,workspace_id'));

for (const [who, ph] of [['Alice', A], ['Alice (2nd phone)', A2], ['Bob', B]]) {
  ok(tag + `${who}: fits the screen`, await ph.p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  ok(tag + `${who}: no errors, no native dialogs`, !ph.errs.length && await ph.p.evaluate(() => window.__nd.length === 0), ph.errs.join(' | '));
}
console.log(`\n${R.length - fails}/${R.length} passed`);
await b.close(); server.close(); process.exit(fails ? 1 : 0);
