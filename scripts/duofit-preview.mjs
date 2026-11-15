// A copy of a DUOFIT version under review (a pull request), served by the TEST site at /duofit-preview/ so it can be
// tried on a real iPhone before anything reaches main. It lives on the test site's own address: the real DUOFIT
// (https://anthonyky.github.io/Duo-fit/) and its data are never touched, and the preview starts empty.
// Kept in _previews/ (a folder GitHub Pages never publishes) so it can never run next to the real DUOFIT data.
//   node scripts/duofit-preview.mjs <commit> [pr]   copy that DUOFIT commit
//   node scripts/duofit-preview.mjs --check          the copy is exactly the commit named in _previews/duofit/SOURCE.json
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, '_previews', 'duofit');
export const FILES = ['index.html', 'sw.js', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
const show = (commit, f) => execFileSync('git', ['show', `${commit}:${f}`], { cwd: root, maxBuffer: 1 << 26 });
const ver = html => (/const VER="([^"]+)"/.exec(html) ?? [])[1] ?? '?';

if (process.argv[2] === '--check') {
  const src = JSON.parse(readFileSync(path.join(dir, 'SOURCE.json'), 'utf8'));
  let bad = 0;
  for (const f of FILES) {
    const same = show(src.commit, f).equals(readFileSync(path.join(dir, f)));
    console.log(`${same ? 'PASS' : 'FAIL'} DUOFIT preview: ${f} = DUOFIT ${src.commit.slice(0, 7)}`); if (!same) bad++;
  }
  const v = ver(readFileSync(path.join(dir, 'index.html'), 'utf8'));
  console.log(`${v === src.ver ? 'PASS' : 'FAIL'} DUOFIT preview version ${v}`); if (v !== src.ver) bad++;
  process.exit(bad ? 1 : 0);
}
const commit = execFileSync('git', ['rev-parse', process.argv[2] ?? ''], { cwd: root, encoding: 'utf8' }).trim();
mkdirSync(dir, { recursive: true });
for (const f of FILES) writeFileSync(path.join(dir, f), show(commit, f));
const v = ver(show(commit, 'index.html').toString('utf8'));
writeFileSync(path.join(dir, 'SOURCE.json'), JSON.stringify({ commit, pr: Number(process.argv[3]) || null, ver: v,
  note: 'Test copy only. Served at /duofit-preview/ on the test site; never published by GitHub Pages; the real DUOFIT stays at its address.' }, null, 2) + '\n');
console.log(`DUOFIT ${commit.slice(0, 7)} (VER ${v}) copied to _previews/duofit`);
