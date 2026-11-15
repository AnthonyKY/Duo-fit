// Push notifications on this device. Off until the person turns them on (the system asks permission at that moment).
// On iPhone they exist only in the app opened from the home screen (iOS 16.4+), not in a Safari tab.
// The device's address and keys are saved to the account (save_push_subscription); the server encrypts each notification
// for this device only. Signing out removes this device from the account, so it never shows someone else's messages.
import { asUser, currentSession, onSession, rpc, rest } from '../../shared/backend.ts';
import { config } from '../../shared/config.ts';
import { readLocal, writeLocal } from '../../shared/storage.ts';

export type PushState = 'unsupported' | 'install-first' | 'denied' | 'off' | 'on';
const g = globalThis as unknown as { navigator?: Navigator & { standalone?: boolean }; Notification?: typeof Notification; PushManager?: unknown; matchMedia?: (q: string) => MediaQueryList };
export const isIOS = () => /iPhone|iPad|iPod/.test(g.navigator?.userAgent ?? '') || (g.navigator?.platform === 'MacIntel' && (g.navigator?.maxTouchPoints ?? 0) > 1);
export const installed = () => g.navigator?.standalone === true || !!g.matchMedia?.('(display-mode: standalone)').matches;
const supported = () => !!g.navigator && 'serviceWorker' in g.navigator && !!g.PushManager && !!g.Notification;
const wanted = (uid: string) => `collabfit-push-${uid}`;

const b64u = (b: ArrayBuffer | null) => b ? btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : '';
const unb64u = (s: string) => { const t = s.replace(/-/g, '+').replace(/_/g, '/'); return Uint8Array.from(atob(t + '='.repeat((4 - (t.length % 4)) % 4)), c => c.charCodeAt(0)); };

let keyCache: Promise<string> | null = null;
/** the server's public key (needed to subscribe); fetched once */
export function serverKey(): Promise<string> {
  keyCache ??= fetch(`${config.supabaseUrl}/functions/v1/push`, { headers: { apikey: config.anonKey } })
    .then(async r => { const j = await r.json() as { key?: string }; if (!r.ok || !j.key) throw new Error('no key'); return j.key; })
    .catch(e => { keyCache = null; throw e; });
  return keyCache;
}
export async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!supported()) return null;
  try { return await navigator.serviceWorker.register('sw.js'); } catch { return null; }
}
const save = (s: PushSubscription, lang: 'fr' | 'en') => {
  const j = s.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  return rpc<null>('save_push_subscription', { p_endpoint: s.endpoint, p_p256dh: j.keys?.p256dh ?? b64u(s.getKey('p256dh')), p_auth: j.keys?.auth ?? b64u(s.getKey('auth')), p_lang: lang });
};
const mine = async (endpoint: string) =>
  (await rest<{ endpoint: string }[]>(`push_subscriptions?select=endpoint&endpoint=eq.${encodeURIComponent(endpoint)}`)).length > 0;

/** where this device stands for the signed-in person */
export async function pushState(): Promise<PushState> {
  if (!supported()) return isIOS() && !installed() ? 'install-first' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub || Notification.permission !== 'granted') return 'off';
  try { return await mine(sub.endpoint) ? 'on' : 'off'; } catch { return 'on'; }
}

/** turns them on for this device: call it straight from the tap (the system shows its permission question) */
export async function enablePush(reg: ServiceWorkerRegistration, key: string, lang: 'fr' | 'en'): Promise<PushState> {
  // subscribe() itself asks the permission: nothing slow before it, so the tap still counts as the person's own gesture
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(key) });
  await save(sub, lang);
  const uid = currentSession()?.user.id; if (uid) writeLocal(wanted(uid), '1');
  return 'on';
}
export async function disablePush(): Promise<void> {
  const uid = currentSession()?.user.id; if (uid) writeLocal(wanted(uid), null);
  const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
  if (!sub) return;
  await rpc('delete_push_subscription', { p_endpoint: sub.endpoint });
  await sub.unsubscribe().catch(() => { /* already gone */ });
}
/** "send me a test": the server notifies this person's own devices */
export const testPush = () => asUser('/functions/v1/push', { method: 'POST', body: { kind: 'test' } }) as Promise<{ devices: number; sent: number }>;
/** tells the others about a message / a workout just posted (best effort: the app shows it anyway when opened) */
export function announce(kind: 'message' | 'workout', id: string): void {
  if (!config.backendReady) return;
  void asUser('/functions/v1/push', { method: 'POST', body: { kind, id } }).catch(() => { /* offline or not configured */ });
}
/** before signing out: this device stops receiving this person's notifications */
export async function forgetThisDevice(): Promise<void> {
  try {
    const sub = supported() ? await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription() : null;
    if (sub) await rpc('delete_push_subscription', { p_endpoint: sub.endpoint });
  } catch { /* offline: the server forgets it when the push service says it is gone */ }
}
/** at start: a person who turned them on keeps them, even if the system renewed the device's address */
export async function keepPushAlive(lang: 'fr' | 'en'): Promise<void> {
  const uid = currentSession()?.user.id;
  if (!uid || readLocal(wanted(uid)) !== '1' || !supported() || Notification.permission !== 'granted') return;
  try {
    const reg = await registration(); if (!reg) return;
    const sub = await reg.pushManager.getSubscription() ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(await serverKey()) });
    if (!(await mine(sub.endpoint))) await save(sub, lang);
  } catch { /* next time */ }
}

if (typeof addEventListener === 'function' && supported()) {
  // a tap on a notification while the app is open: go to the conversation it is about
  navigator.serviceWorker.addEventListener('message', e => {
    const to = (e.data as { open?: unknown })?.open;
    if (typeof to === 'string' && /^#\/[\w/-]*$/.test(to)) location.hash = to;
  });
  const lang = () => readLocal('collabfit-lang') === 'en' ? 'en' : 'fr';
  onSession(s => { if (s) void keepPushAlive(lang()); });
  if (currentSession()) void keepPushAlive(lang());
}
