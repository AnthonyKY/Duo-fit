// Public build-time settings (see scripts/build.mjs). The anon key is public by design: data is protected by the
// database's row level security, never by hiding this key. A secret key must never appear here.
declare const __COLLABFIT_CONFIG__: { supabaseUrl: string; anonKey: string; legacyUrl: string; version: string } | undefined;
const raw = typeof __COLLABFIT_CONFIG__ === 'object' && __COLLABFIT_CONFIG__ ? __COLLABFIT_CONFIG__ : { supabaseUrl: '', anonKey: '', legacyUrl: '../', version: 'dev' };
export const config = Object.freeze({ ...raw, backendReady: Boolean(raw.supabaseUrl && raw.anonKey) });
