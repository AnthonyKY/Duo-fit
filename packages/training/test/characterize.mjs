// Proof that CollabFit's training engine computes exactly what DUOFIT computes. DUOFIT itself (the commit named in
// packages/training/SOURCE.json) runs in a real browser; the copy runs here; both get the same random people, histories,
// dates and random draws, and every result must be identical:
//   plan of the day (variety, time budget, warm-up, level, back, equipment, exclusions), suggested loads and texts,
//   target reps per set, next targets from random sets, and a whole workout started then saved (DUOFIT's own
//   start() and fin() against Trainer.start / Trainer.finish).
//   node packages/training/test/characterize.mjs   [CASES=300]
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { Trainer } from '../src/index.ts';
const require = createRequire(import.meta.url);
const BR = require('../../../tests/browser.js');

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const { duofitCommit } = JSON.parse(readFileSync(path.join(root, 'packages', 'training', 'SOURCE.json'), 'utf8'));
const html = execFileSync('git', ['show', `${duofitCommit}:index.html`], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 });
const CASES = Number(process.env.CASES || 300);

const server = http.createServer((req, res) => {
  if (new URL(req.url, 'http://x').pathname !== '/Duo-fit/') { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/Duo-fit/`;

// the same random draws on both sides
const PRNG = 'globalThis.__seed=s=>{let x=s>>>0||1;Math.random=()=>{x^=x<<13;x>>>=0;x^=x>>>17;x^=x<<5;x>>>=0;return x/4294967296}};';
eval(PRNG); // eslint-disable-line no-eval
const RealDate = Date;
function at(T, fn) { // the copy sees the same clock as the page
  class FakeDate extends RealDate { constructor(...a) { super(...(a.length ? a : [T])); } static now() { return T; } }
  globalThis.Date = FakeDate;
  try { return fn(); } finally { globalThis.Date = RealDate; }
}

let fails = 0, checks = 0;
const R = [];
function diff(a, b, at = '') { // first place where two JSON values differ
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (a && b && typeof a === 'object' && typeof b === 'object') { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const d = diff(a[k], b[k], at + '.' + k); if (d) return d; } }
  return `${at}: mine ${JSON.stringify(a)?.slice(0, 160)} · DUOFIT ${JSON.stringify(b)?.slice(0, 160)}`;
}
const ok = (n, c, x = '') => { checks++; if (!c) { fails++; R.push('FAIL ' + n + (x ? ' — ' + String(x).slice(0, 400) : '')); } };

const b = await BR.launch();
const ctx = await b.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris' });
await ctx.addInitScript(PRNG);
const p = await ctx.newPage();
const T0 = Date.UTC(2026, 10, 16, 8);
await p.clock.install({ time: T0 }); await p.clock.pauseAt(T0 + 1000);
await p.goto(url);
await p.waitForFunction(() => typeof eff === 'function');

let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const pick = a => a[Math.floor(rnd() * a.length)];

for (let c = 0; c < CASES; c++) {
  if (process.env.VERBOSE) console.log('case', c);
  // a random person: programme, level, budget, back, equipment, variety mode, increments, exclusions, language
  const programme = pick(['M', 'F']), lang = pick(['fr', 'en']);
  const fresh = new Trainer(null, programme, lang);
  const pf = fresh.profile.pf;
  Object.assign(pf, {
    lvl: pick(['beg', 'int', 'adv']), time: pick([20, 30, 45, 60, 75, 90]), back: rnd() < 0.4, goal: pick(['loss', 'recomp', 'maint', 'gain']),
    var: pick(['fix', 'bal', 'max']), noOverhead: rnd() < 0.15,
    gear: ['M', 'DB', 'C', 'SM'].filter(() => rnd() < 0.8), inc: { DB: pick([1, 2, 2.5]), M: pick([2.5, 5]), C: pick([1.25, 2.5, 5]), SM: pick([2.5, 5]) },
  });
  if (!pf.gear.length) pf.gear = ['M'];
  const T = T0 + Math.floor(rnd() * 60) * 864e5 + Math.floor(rnd() * 12) * 36e5;
  // a random history built by the copy itself through whole workouts
  const n = Math.floor(rnd() * 7);
  for (let k = 0; k < n; k++) {
    const day = pick(['A', 'B', 'C']), when = T - (n - k) * 2 * 864e5;
    globalThis.__seed(c * 100 + k);
    const d = at(when, () => { try { return fresh.start(day, when); } catch { return null; } });
    if (!d) continue;
    d.ex.forEach((sets, i) => { const e = d.pl[i]; sets.forEach(s => { s.w = typeof s.w === 'number' && s.w > 0 ? s.w : pick([5, 10, 20, 40]); s.r = Math.max(1, e[2] - 2 + Math.floor(rnd() * (e[3] - e[2] + 5))); s.ok = 1; }); });
    fresh.record(at(when + 3000e3, () => fresh.finish(d, when + 3000e3)));
  }
  const json = fresh.toJSON();
  for (const day of ['A', 'B', 'C']) {
    const s = c * 7 + day.charCodeAt(0);
    const mine = (() => { const t = new Trainer(json, programme, lang); globalThis.__seed(s); return at(T, () => {
      const plan = t.plan(day);
      const per = (plan.ex || []).map(e => ({ id: e[0], sug: t.suggest(e[0], e, day), reps: Array.from({ length: e[1] }, (_, j) => t.targetReps(e[0], e, j, day)) }));
      return { plan, per, draw: t.profile.draw };
    }); })();
    await p.clock.setFixedTime(T);
    const theirs = await p.evaluate(([json, day, s]) => {
      S = readState(json); __seed(s); // eslint-disable-line no-global-assign
      const plan = eff(day);
      const per = (plan.ex || []).map(e => { const g = sug(e[0], e, day); return { id: e[0], sug: { w: g.w, text: g.t, reps: Number.isSafeInteger(g.r) ? g.r : null }, reps: Array.from({ length: e[1] }, (_, j) => +tgr(e[0], e, j, day)) }; });
      return JSON.parse(JSON.stringify({ plan, per, draw: D().draw }));
    }, [json, day, s]);
    ok(`case ${c} ${programme}/${day}: plan of the day`, JSON.stringify(mine.plan) === JSON.stringify(theirs.plan), diff(mine.plan, theirs.plan));
    ok(`case ${c} ${programme}/${day}: suggested loads, texts, target reps`, JSON.stringify(mine.per) === JSON.stringify(theirs.per), diff(mine.per, theirs.per));
  }
  // next targets from random sets
  const t = new Trainer(json, programme, lang);
  for (let k = 0; k < 4; k++) {
    const e = pick(t.plan(pick(['A', 'B', 'C'])).ex || []); if (!e) continue;
    const sets = Array.from({ length: 1 + Math.floor(rnd() * e[1]) }, () => ({ w: pick([0, 5, 7.5, 11.25, 20, 22.5, 40, 60, 62.5]), r: 1 + Math.floor(rnd() * (e[3] + 6)) }));
    const back = pick([null, null, null, 1, 2]);
    const mine = t.nextTarget(e[0], sets, e, back), theirs = await p.evaluate(([json, id, sets, e, back]) => { S = readState(json); return nextOf(id, sets, e, back); }, [json, e[0], sets, e, back]); // eslint-disable-line no-global-assign
    ok(`case ${c}: next target ${e[0]} ${JSON.stringify(sets)}`, JSON.stringify(mine) === JSON.stringify(theirs), JSON.stringify({ mine, theirs }));
    ok(`case ${c}: next target text`, t.nextText(e[0], mine) === await p.evaluate(([json, id, o]) => { S = readState(json); return nxText(id, o); }, [json, e[0], theirs]));
  }
  // a whole workout: DUOFIT's start() + fin() against Trainer.start / finish
  if (c % 5 === 0) {
    const day = pick(['A', 'B', 'C']), s = 9000 + c, end = T + 2400e3;
    const fill = []; // the same entries on both sides
    const draft = (() => { const tt = new Trainer(json, programme, lang); globalThis.__seed(s); return at(T, () => { try { return tt.start(day, T); } catch { return null; } }); })();
    if (draft) {
      draft.ex.forEach((sets, i) => sets.forEach((st, j) => { const v = rnd(); if (v < 0.8) { const w = pick([st.w || 10, 12.5, 20]), r = 6 + Math.floor(rnd() * 10); fill.push([i, j, w, r]); st.w = w; st.r = r; st.ok = 1; } }));
      const tt = new Trainer(json, programme, lang);
      const mine = at(end, () => tt.finish(draft, end, 2400));
      await p.clock.setFixedTime(T);
      await p.evaluate(([json, day, s, T, fill]) => {
        S = readState(json); __seed(s); // eslint-disable-line no-global-assign
        start(day); const c = cur(); c.start = T;
        for (const [i, j, w, r] of fill) { const st = c.ex[i][j]; st.w = w; st.r = r; st.ok = 1; }
      }, [json, day, s, T, fill]);
      await p.clock.setFixedTime(end);
      const theirs = await p.evaluate(() => { fin(); document.querySelector('#action-accept')?.click(); return JSON.parse(JSON.stringify(D().logs.at(-1))); });
      const keys = ['pr', 'wk', 'dur', 'durSec', 'ex', 'note', 'sets', 'vol', 'tg', 'nx', 'mode', 'budget'];
      const pickK = o => Object.fromEntries(keys.map(k => [k, o?.[k]]));
      ok(`case ${c} ${programme}/${day}: a whole workout saved like DUOFIT`, JSON.stringify(pickK(mine)) === JSON.stringify(pickK(theirs)), diff(pickK(mine), pickK(theirs)));
    }
  }
}
for (const l of R.slice(0, 12)) console.log(l);
const line = `${checks - fails}/${checks} identical to DUOFIT (${CASES} random people, ${duofitCommit.slice(0, 7)})`;
console.log((fails ? 'FAIL ' : 'PASS ') + line);
await b.close(); server.close(); process.exit(fails ? 1 : 0);
