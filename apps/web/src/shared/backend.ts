// Minimal client for the Supabase APIs CollabFit uses (Auth, database REST, Storage, Functions): plain fetch, no extra
// library to trust. Only the PUBLIC key is used; every right is enforced by the database (row level security).
// The session (short-lived access token + refresh token) stays on this phone so the app opens signed in; the strict
// security policy (no inline or outside script) is what keeps other code from reading it.
import { authProblem, type AuthProblem } from '@collabfit/domain';
import { config } from './config.ts';
import { readLocal, writeLocal } from './storage.ts';

export interface Session { access_token: string; refresh_token: string; expires_at: number; user: { id: string; email: string } }
export class BackendError extends Error {
  constructor(public problem: AuthProblem, public status: number) { super(problem); }
}
const KEY = 'collabfit-session';

async function request(path: string, init: { method?: string; token?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { apikey: config.anonKey, ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}), ...init.headers };
  let body: BodyInit | undefined;
  if (init.body instanceof Blob) body = init.body;
  else if (init.body !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(init.body); }
  let r: Response;
  const req: RequestInit = { method: init.method ?? 'GET', headers, cache: 'no-store' };
  if (body !== undefined) req.body = body;
  try { r = await fetch(config.supabaseUrl + path, req); }
  catch { throw new BackendError('offline', 0); }
  const text = await r.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  if (!r.ok) throw new BackendError(authProblem(r.status, json), r.status);
  return json;
}

// ---------------------------------------------------------------- session (shared by every screen)
type Listener = (s: Session | null) => void;
const listeners = new Set<Listener>();
let current: Session | null = load();
function load(): Session | null {
  try {
    const s = JSON.parse(readLocal(KEY) ?? 'null') as Session | null;
    return s && typeof s.access_token === 'string' && typeof s.refresh_token === 'string' && typeof s.user?.id === 'string' ? s : null;
  } catch { return null; }
}
function set(s: Session | null) {
  current = s;
  writeLocal(KEY, s ? JSON.stringify(s) : null);
  for (const l of listeners) l(s);
}
export const currentSession = () => current;
export function onSession(l: Listener): () => void { listeners.add(l); return () => listeners.delete(l); }

function fromAuth(j: unknown): Session | null {
  const a = j as { access_token?: string; refresh_token?: string; expires_in?: number; expires_at?: number; user?: { id: string; email?: string } };
  if (!a?.access_token || !a.refresh_token || !a.user?.id) return null;
  const expires_at = a.expires_at ?? Math.floor(Date.now() / 1000) + (a.expires_in ?? 3600);
  return { access_token: a.access_token, refresh_token: a.refresh_token, expires_at, user: { id: a.user.id, email: a.user.email ?? '' } };
}

/** 'signed-in', or 'check-email' when the project asks for an e-mail confirmation first (production). */
export async function signUp(email: string, password: string, displayName: string): Promise<'signed-in' | 'check-email'> {
  const j = await request('/auth/v1/signup', { method: 'POST', body: { email, password, data: { display_name: displayName } } });
  const s = fromAuth(j);
  if (s) { set(s); return 'signed-in'; }
  return 'check-email';
}
export async function signIn(email: string, password: string): Promise<void> {
  const s = fromAuth(await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } }));
  if (!s) throw new BackendError('unknown', 200);
  set(s);
}
export async function signOut(): Promise<void> {
  const s = current; set(null);
  if (s) await request('/auth/v1/logout', { method: 'POST', token: s.access_token }).catch(() => { /* already gone */ });
}
export const forgetSession = () => set(null);

let refreshing: Promise<Session | null> | null = null;
/** A valid access token, refreshed when it is about to expire; null when signed out or the session ended. */
export async function token(): Promise<string | null> {
  const s = current;
  if (!s) return null;
  if (s.expires_at - 60 > Date.now() / 1000) return s.access_token;
  refreshing ??= request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: s.refresh_token } })
    .then(j => { const n = fromAuth(j); set(n); return n; })
    .catch((e: unknown) => { if (e instanceof BackendError && e.problem !== 'offline') set(null); throw e; })
    .finally(() => { refreshing = null; });
  return (await refreshing)?.access_token ?? null;
}
/** A request as the signed-in user; a refused session signs out on this phone. */
export async function asUser(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const tk = await token();
  if (!tk) throw new BackendError('session-expired', 401);
  try { return await request(path, { ...init, token: tk }); }
  catch (e) { if (e instanceof BackendError && e.status === 401) set(null); throw e; }
}

// ---------------------------------------------------------------- profile, avatar, account
export interface Profile { display_name: string; avatar_seed: string; avatar_path: string | null }
export async function myProfile(): Promise<Profile | null> {
  const id = current?.user.id;
  const rows = await asUser(`/rest/v1/profiles?select=display_name,avatar_seed,avatar_path&id=eq.${id}`) as Profile[];
  return rows[0] ?? null;
}
export async function updateProfile(patch: Partial<Profile>): Promise<void> {
  await asUser(`/rest/v1/profiles?id=eq.${current?.user.id}`, { method: 'PATCH', body: patch, headers: { Prefer: 'return=minimal' } });
}
export async function uploadFile(bucket: 'avatars' | 'chat-media', path: string, file: Blob): Promise<void> {
  await asUser(`/storage/v1/object/${bucket}/${path}`, { method: 'POST', body: file, headers: { 'Content-Type': file.type, 'x-upsert': 'false', 'cache-control': '3600' } });
}
export async function removeFile(bucket: 'avatars' | 'chat-media', path: string): Promise<void> {
  await asUser(`/storage/v1/object/${bucket}`, { method: 'DELETE', body: { prefixes: [path] } });
}
/** A short-lived link to a private file (the storage rules decide who may get one). */
export async function signedUrl(bucket: 'avatars' | 'chat-media', path: string, seconds: number): Promise<string> {
  const j = await asUser(`/storage/v1/object/sign/${bucket}/${path}`, { method: 'POST', body: { expiresIn: seconds } }) as { signedURL?: string };
  if (!j?.signedURL) throw new BackendError('unknown', 200);
  return `${config.supabaseUrl}/storage/v1${j.signedURL}`;
}
/** Deletes the account and all its files (Edge Function delete-account), then forgets the session here. */
export async function deleteAccount(): Promise<void> {
  await asUser('/functions/v1/delete-account', { method: 'POST', body: { confirm: 'DELETE' } });
  set(null);
}
