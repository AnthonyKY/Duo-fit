// Production build with esbuild: one script, one stylesheet, a strict security policy (no inline code at all).
// Public settings come from the environment at build time; nothing secret ever goes into the bundle.
//   COLLABFIT_SUPABASE_URL      https://<project>.supabase.co     (stage 2, public)
//   COLLABFIT_SUPABASE_ANON_KEY the project's PUBLISHABLE key (sb_publishable_…, public by design, protected by row level security)
//   COLLABFIT_LEGACY_URL        where DUOFIT lives (default https://anthonyky.github.io/Duo-fit/)
import { build } from 'esbuild';
import { mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, 'dist');
const env = process.env;
const supabaseUrl = (env.COLLABFIT_SUPABASE_URL || '').trim();
if (supabaseUrl && !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(supabaseUrl)) throw new Error('COLLABFIT_SUPABASE_URL must look like https://<project>.supabase.co');
const anonKey = (env.COLLABFIT_SUPABASE_ANON_KEY || '').trim();
// only the public key may be built in: a "sb_secret_..." key, or an old-style key whose role is service_role, stops the build
const jwtRole = k => { try { return JSON.parse(Buffer.from(k.split('.')[1] ?? '', 'base64url').toString('utf8')).role ?? null; } catch { return null; } };
if (/^sb_secret_/.test(anonKey) || (anonKey.startsWith('eyJ') && jwtRole(anonKey) !== 'anon'))
  throw new Error('That is a SECRET key. Only the public "publishable" key (sb_publishable_…) may be used here.');
if (anonKey && !/^sb_publishable_[A-Za-z0-9_-]+$/.test(anonKey) && !anonKey.startsWith('eyJ')) throw new Error('COLLABFIT_SUPABASE_ANON_KEY does not look like a Supabase publishable key');
// DUOFIT stays where it is and stays the owner's app: "Ouvrir DUOFIT" opens it at its own address
const legacyUrl = (env.COLLABFIT_LEGACY_URL || 'https://anthonyky.github.io/Duo-fit/').trim();
if (!/^(https:\/\/[^\s"'<>]+|\.\.?\/)$/.test(legacyUrl)) throw new Error('COLLABFIT_LEGACY_URL must be an https address (or ../)');
const commit = (env.COLLABFIT_VERSION || env.COMMIT_REF || '').trim(); // Netlify sets COMMIT_REF
const config = { supabaseUrl, anonKey, legacyUrl, version: commit ? commit.slice(0, 7) : 'dev' };

await rm(out, { recursive: true, force: true });
await mkdir(path.join(out, 'assets'), { recursive: true });
await build({
  entryPoints: [path.join(root, 'src/main.tsx')],
  bundle: true, format: 'esm', target: ['es2022', 'safari16'], minify: true, sourcemap: true, jsx: 'automatic',
  outfile: path.join(out, 'assets/app.js'),
  define: { __COLLABFIT_CONFIG__: JSON.stringify(config), 'process.env.NODE_ENV': '"production"' },
  nodePaths: env.NODE_PATH ? env.NODE_PATH.split(path.delimiter) : [],
  logLevel: 'warning',
});
await copyFile(path.join(root, 'src/styles.css'), path.join(out, 'assets/app.css'));
const connect = ["'self'", supabaseUrl, supabaseUrl && supabaseUrl.replace('https://', 'wss://')].filter(Boolean).join(' ');
const csp = `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:${supabaseUrl ? ' ' + supabaseUrl : ''}; `
  + `connect-src ${connect}; manifest-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'`;
const html = (await readFile(path.join(root, 'index.html'), 'utf8')).replace('%CSP%', csp);
await writeFile(path.join(out, 'index.html'), html);
await writeFile(path.join(out, 'version.txt'), (commit || 'dev') + '\n'); // lets the tests know which commit is online
console.log('built apps/web/dist', supabaseUrl ? '(backend configured)' : '(no backend configured yet)');
