// Copies DUOFIT's training engine — the calculation code only, VERBATIM — into packages/training, so CollabFit computes
// exactly what DUOFIT computes (progression, next targets, variety, time budget, warm-up, loads). DUOFIT is not changed:
// this reads its index.html. The copy is checked against DUOFIT itself by packages/training/test/characterize.mjs.
//   node scripts/extract-duofit-engine.mjs [path/to/duofit/index.html]   (default: the commit in packages/training/SOURCE.json)
//   --check  fails if the committed copy differs from what DUOFIT gives today
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ts = require('typescript');

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), check = args.includes('--check'), file = args.find(a => !a.startsWith('--'));
const source = JSON.parse(readFileSync(path.join(here, '..', 'packages', 'training', 'SOURCE.json'), 'utf8'));
// the DUOFIT commit named in packages/training/SOURCE.json (reproducible), unless a file is given
export const duofitHtml = () => file ? readFileSync(file, 'utf8') : execFileSync('git', ['show', `${source.duofitCommit}:index.html`], { cwd: path.join(here, '..'), encoding: 'utf8', maxBuffer: 1 << 26 });
const html = duofitHtml();
const m = /<script>([\s\S]*)<\/script>/.exec(html);
if (!m) throw new Error('DUOFIT script not found');
const code = m[1];
const version = /const VER="([^"]+)"/.exec(code)?.[1] ?? 'unknown';

// what the engine is for: everything these need is copied, nothing else
const ROOTS = ['nextOf', 'sug', 'eff', 'draw', 'est', 'rph', 'tgr', 'fitRange', 'incOf', 'rnd', 'rdn', 'r2', 'isBW', 'isT', 'workoutTotals',
  'readSet', 'num', 'nxText', 'nxTarget', 'times', 'timeText', 'mmss', 'needsBack', 'painReplacement', 'eligible', 'allowed', 'slotOf',
  'vmode', 'known', 'last', 'readState', 'freshState', 'mk', 'PFD', 'GR', 'GN', 'EQ', 'LV', 'E', 'P', 'SL', 'PAT', 'BON', 'XR', 'TM', 'WU', 'INC0', 'INCO', 'SAFE', 'AX'];
// provided by the host app (state and language), never copied
const HOST = new Set(['S', 'U', 'save', 'go', 'notice', '$', 'document', 'window',
  'localStorage', 'location', 'history', 'askAction', 'closeAction', 'navigate', 'scrollTo', 'setTimeout', 'clearTimeout',
  'setInterval', 'clearInterval', 'requestAnimationFrame', 'fetch', 'Date', 'Math', 'Number', 'String', 'Object', 'Array', 'JSON', 'Set',
  'Map', 'Boolean', 'Intl', 'console', 'isFinite', 'isNaN', 'parseInt', 'parseFloat', 'undefined', 'NaN', 'Infinity', 'Error', 'RegExp',
  'Symbol', 'Promise', 'structuredClone', 'encodeURIComponent', 'decodeURIComponent', 'globalThis']);

const sf = ts.createSourceFile('duofit.js', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const decl = new Map(); // name → statement
for (const st of sf.statements) {
  if (ts.isFunctionDeclaration(st) && st.name) decl.set(st.name.text, st);
  else if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) decl.set(d.name.text, st);
}
// names a statement uses from the top level: identifiers that are not property names and not declared inside it
function refs(node) {
  const out = new Set(), local = new Set();
  const bind = b => { if (!b) return; if (ts.isIdentifier(b)) local.add(b.text); else if (ts.isObjectBindingPattern(b) || ts.isArrayBindingPattern(b)) for (const e of b.elements) if (!ts.isOmittedExpression(e)) bind(e.name); };
  const collect = n => {
    if ((ts.isVariableDeclaration(n) || ts.isParameter(n) || ts.isBindingElement(n)) && n !== node) bind(n.name);
    if ((ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n)) && n.name && n !== node) local.add(n.name.text);
    if (ts.isCatchClause(n) && n.variableDeclaration) bind(n.variableDeclaration.name);
    ts.forEachChild(n, collect);
  };
  // the statement's own top-level names are not locals
  if (ts.isFunctionDeclaration(node)) { for (const p of node.parameters) bind(p.name); ts.forEachChild(node.body, collect); }
  else if (ts.isVariableStatement(node)) for (const d of node.declarationList.declarations) { if (d.initializer) collect(d.initializer); }
  else collect(node);
  const walk = n => {
    if (ts.isIdentifier(n)) {
      const p = n.parent;
      const isProp = (p && ts.isPropertyAccessExpression(p) && p.name === n) || (p && ts.isPropertyAssignment(p) && p.name === n)
        || (p && ts.isMethodDeclaration(p) && p.name === n) || (p && ts.isBindingElement(p) && p.propertyName === n);
      if (!isProp && !local.has(n.text)) out.add(n.text);
    }
    ts.forEachChild(n, walk);
  };
  walk(node);
  return out;
}
const keep = new Set(), external = new Map();
const queue = [...ROOTS, 'L', 't', 'li', 'nm', 'D', 'prog'];
// statements that complete copied data (Object.assign(E, …), Object.assign(L.fr, …), loops filling L or BF), never UI ones
const UI = new Set(['$', 'document', 'window', 'navigator', 'localStorage', 'location', 'go', 'tick', 'upd', 'initialLoad', 'closeAction',
  'restControl', 'pendingAction', 'actionWord', 'setInterval', 'notice']);
const loose = sf.statements.filter(st => !ts.isFunctionDeclaration(st) && !ts.isVariableStatement(st));
const extra = [];
function grow() {
  while (queue.length) {
    const name = queue.shift();
    if (keep.has(name) || HOST.has(name)) continue;
    const st = decl.get(name);
    if (!st) continue; // a local name, a parameter, a global
    keep.add(name);
    for (const r of refs(st)) {
      if (process.env.WHY && decl.has(r) && !keep.has(r) && !HOST.has(r)) console.log(`why ${r} ← ${name}`);
      if (HOST.has(r)) { external.set(r, (external.get(r) ?? new Set()).add(name)); continue; }
      if (decl.has(r) && !keep.has(r)) queue.push(r);
    }
  }
}
for (let changed = true; changed;) {
  grow(); changed = false;
  for (const st of loose) {
    if (extra.includes(st)) continue;
    const r = refs(st);
    if (![...r].some(n => keep.has(n)) || [...r].some(n => UI.has(n))) continue;
    extra.push(st); changed = true;
    for (const n of r) if (decl.has(n) && !keep.has(n) && !HOST.has(n)) queue.push(n);
  }
}
// statements in DUOFIT's order, each once (a statement may declare several names)
const stmts = [...new Set([...[...keep].map(n => decl.get(n)), ...extra])].sort((a, b) => a.pos - b.pos);
const names = [...new Set(stmts.flatMap(st => ts.isFunctionDeclaration(st) ? [st.name.text]
  : ts.isVariableStatement(st) ? st.declarationList.declarations.map(d => d.name.text) : []))];
const body = stmts.map(st => code.slice(st.getStart(sf), st.end)).join('\n');
const usedHost = [...external.keys()].filter(k => !['Date', 'Math', 'Number', 'String', 'Object', 'Array', 'JSON', 'Set', 'Map', 'Boolean',
  'Intl', 'isFinite', 'isNaN', 'parseInt', 'parseFloat', 'undefined', 'NaN', 'Infinity', 'Error', 'RegExp', 'Symbol', 'Promise', 'console',
  'globalThis'].includes(k)).sort();

const out = `// GENERATED by scripts/extract-duofit-engine.mjs from DUOFIT ${version} — do not edit by hand.
// DUOFIT's calculation code, copied verbatim (${stmts.length} declarations); the host provides: ${usedHost.join(', ')}.
/* eslint-disable */
// @ts-nocheck
export const DUOFIT_VERSION = ${JSON.stringify(version)};
export function createEngine(host) {
  let { ${usedHost.join(', ')} } = host;
${body}
  return { ${names.join(', ')} };
}
`;
const target = path.join(here, '..', 'packages', 'training', 'src', 'duofit-engine.generated.js');
if (check) {
  let current = '';
  try { current = readFileSync(target, 'utf8'); } catch { /* missing */ }
  if (current !== out) { console.error(`packages/training is not up to date with DUOFIT ${version}: run node scripts/extract-duofit-engine.mjs`); process.exit(1); }
  console.log(`packages/training matches DUOFIT ${version}`);
} else {
  writeFileSync(target, out);
  console.log(`copied ${stmts.length} declarations (${names.length} names) from DUOFIT ${version}`);
  console.log('host must provide:', usedHost.join(', '));
  for (const [k, v] of external) if (usedHost.includes(k)) console.log(`  ${k} ← ${[...v].slice(0, 12).join(', ')}${v.size > 12 ? '…' : ''}`);
}
