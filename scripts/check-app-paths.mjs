// What the test site is built from is listed ONCE, in scripts/app-paths.txt. Netlify rebuilds only when one of those
// paths changes (netlify.toml "ignore"), and the staging workflow waits for and checks the build when one changes.
// This check makes sure the list stays complete and that all three really use it — then proves it on real commits:
// a change to the training engine alone must rebuild the site; a change to the docs alone must not.
//   node scripts/check-app-paths.mjs
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, copyFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const R = []; let fails = 0;
const ok = (n, c, x = '') => { const l = (c ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + x : ''); R.push(l); console.log(l); if (!c) fails++; };
const read = f => readFileSync(path.join(root, f), 'utf8');
const list = read('scripts/app-paths.txt').split('\n').map(s => s.trim()).filter(Boolean);
const listed = p => list.some(l => p === l || p.startsWith(l + '/'));

// 1. every listed path exists, and everything the web app is built from is listed
const missing = list.filter(p => !existsSync(path.join(root, p)));
ok('every path in scripts/app-paths.txt exists', !missing.length, missing.join(', '));
const needed = new Set(['apps/web/src', 'apps/web/index.html', 'apps/web/scripts', 'apps/web/package.json', 'apps/web/tsconfig.json', 'tsconfig.base.json', 'package.json', 'package-lock.json', '_previews', 'netlify.toml']);
const seen = new Set(), queue = ['apps/web'];
const dirOf = name => ['packages', 'apps'].map(d => d + '/' + name.replace('@collabfit/', '')).find(d => existsSync(path.join(root, d, 'package.json')));
while (queue.length) {
  const dir = queue.shift(); if (seen.has(dir)) continue; seen.add(dir);
  const pkg = JSON.parse(read(dir + '/package.json'));
  for (const dep of Object.keys(pkg.dependencies ?? {}).filter(d => d.startsWith('@collabfit/'))) {
    const d = dirOf(dep); if (!d) { ok(`workspace package ${dep} found`, false); continue; }
    for (const f of ['src', 'package.json', 'tsconfig.json', 'SOURCE.json']) if (existsSync(path.join(root, d, f))) needed.add(`${d}/${f}`);
    queue.push(d);
  }
}
const unlisted = [...needed].filter(p => !listed(p));
ok(`the web app and every workspace package it uses are listed (${[...seen].slice(1).join(', ')})`, !unlisted.length, unlisted.join(', '));

// 2. Netlify and the staging workflow read that same list
const toml = read('netlify.toml'), ignore = (/^\s*ignore\s*=\s*"(.*)"\s*$/m.exec(toml) ?? [])[1] ?? '';
ok('netlify.toml rebuilds from scripts/app-paths.txt', ignore.includes('$(cat scripts/app-paths.txt)'), ignore);
const wf = read('.github/workflows/supabase-staging.yml');
ok('the staging workflow waits for the build of the same list', /app=\$\(cat scripts\/app-paths\.txt\)/.test(wf));
const filters = JSON.parse(((/^\s*paths:\s*(\[.*\])\s*$/m.exec(wf) ?? [])[1] ?? '[]').replace(/'/g, '"'));
const covered = p => filters.some(f => f === p || (f.endsWith('/**') && (p + '/').startsWith(f.slice(0, -2))));
const uncovered = list.filter(p => !covered(p));
ok('the staging workflow starts for every listed path', !uncovered.length, uncovered.join(', '));
ok('the staging workflow checks the engine and the DUOFIT preview online', wf.includes('engine.txt') && wf.includes('duofit-preview'));

// 3. on real commits: Netlify's exact command, in a throwaway copy of the repository
const tmp = mkdtempSync(path.join(tmpdir(), 'app-paths-'));
const git = (...a) => execFileSync('git', ['-c', 'user.name=check', '-c', 'user.email=check@example.com', ...a], { cwd: tmp, encoding: 'utf8' }).trim();
try {
  execFileSync('git', ['worktree', 'add', '-q', '--detach', tmp, 'HEAD'], { cwd: root });
  // the list and the command as they are now (also before they are committed)
  for (const f of ['scripts/app-paths.txt', 'netlify.toml']) copyFileSync(path.join(root, f), path.join(tmp, f));
  git('add', '-A'); git('commit', '-q', '--allow-empty', '-m', 'base');
  const netlify = (from, to, cmd = ignore) => spawnSync('bash', ['-c', cmd], { cwd: tmp, env: { ...process.env, CACHED_COMMIT_REF: from, COMMIT_REF: to } }).status;
  const change = (file, msg) => { mkdirSync(path.dirname(path.join(tmp, file)), { recursive: true }); appendFileSync(path.join(tmp, file), '\n// ' + msg + '\n'); git('add', '-A'); git('commit', '-q', '-m', msg); return git('rev-parse', 'HEAD'); };
  const base = git('rev-parse', 'HEAD');
  const engine = change('packages/training/src/duofit-engine.generated.js', 'engine only');
  ok('a commit that changes ONLY the training engine rebuilds the test site', netlify(base, engine) === 1, 'Netlify ignore exit ' + netlify(base, engine) + ' (1 = build)');
  ok('…and starts the staging workflow, which waits for that build', covered('packages/training/src/duofit-engine.generated.js'));
  git('reset', '-q', '--hard', base);
  writeFileSync(path.join(tmp, 'docs/STATUS.md'), read('docs/STATUS.md') + '\n<!-- docs only -->\n'); git('commit', '-q', '-am', 'docs only');
  ok('a commit that changes only the docs does not spend a deploy', netlify(base, git('rev-parse', 'HEAD')) === 0);
  git('reset', '-q', '--hard', base);
  const preview = change('_previews/duofit/sw.js', 'preview only');
  ok('a new DUOFIT preview alone rebuilds the test site', netlify(base, preview) === 1);
  const before = 'git diff --quiet $CACHED_COMMIT_REF $COMMIT_REF -- apps/web/src apps/web/index.html apps/web/scripts apps/web/package.json packages/domain/src packages/domain/package.json package.json package-lock.json';
  console.log(`info: with the former list, the engine-only commit would have been skipped: exit ${netlify(base, engine, before)} (0 = no build)`);
} finally {
  execFileSync('git', ['worktree', 'remove', '--force', tmp], { cwd: root }); rmSync(tmp, { recursive: true, force: true });
}
console.log(`\n${R.length - fails}/${R.length} passed`);
process.exit(fails ? 1 : 0);
