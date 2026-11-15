// Messages wait here until they reach the server: offline, a network error, a busy moment. Each keeps the id the phone
// gave it (client_id); the database refuses a second copy with the same id, so a retry can never duplicate a message.
// Texts survive closing the app (stored on this phone, per account). A picture waits in memory until uploaded; after
// that only its storage path remains, so it survives closing the app too.
import { chatMediaPath, Outbox, type OutboxItem } from '@collabfit/domain';
import { BackendError, currentSession, insert, onSession, uploadFile } from '../../shared/backend.ts';
import { readLocal, writeLocal } from '../../shared/storage.ts';
import { announce } from '../notifications/push.ts';

export interface Pending { workspaceId: string; body: string | null; hasPhoto: boolean; imagePath: string | null }
export interface SentRow { id: string; client_id: string; author_id: string | null; body: string | null; image_path: string | null; created_at: string; deleted_at: string | null }
type Listener = () => void;

const photos = new Map<string, Blob>();
const listeners = new Set<Listener>();
const delivered = new Set<(row: SentRow) => void>();
let box = new Outbox<Pending>();
let owner = '';
let timer: ReturnType<typeof setTimeout> | undefined;
let flushing = false;

const key = (uid: string) => `collabfit-outbox-${uid}`;
const valid = (p: unknown): p is Pending => !!p && typeof p === 'object' && typeof (p as Pending).workspaceId === 'string'
  && ((p as Pending).body === null || typeof (p as Pending).body === 'string') && typeof (p as Pending).hasPhoto === 'boolean';
function load(uid: string) {
  owner = uid;
  let raw: unknown = [];
  try { raw = JSON.parse(readLocal(key(uid)) ?? '[]'); } catch { /* damaged: start empty */ }
  box = Outbox.from<Pending>(raw, valid);
  for (const i of box.items) if (i.payload.hasPhoto && !i.payload.imagePath && !photos.has(i.clientId)) box.failed(i.clientId, Date.now(), 'photo-lost', true);
}
function save() {
  if (!owner) return;
  // a picture not uploaded yet cannot be kept once the app is closed: only what can be resent is stored
  const keep = box.toJSON().filter(i => !i.payload.hasPhoto || i.payload.imagePath);
  writeLocal(key(owner), keep.length ? JSON.stringify(keep) : null);
  for (const l of listeners) l();
}
function ensureOwner() {
  const uid = currentSession()?.user.id ?? '';
  if (uid !== owner) { photos.clear(); if (uid) load(uid); else { owner = ''; box = new Outbox<Pending>(); } }
  return uid;
}
onSession(() => { ensureOwner(); for (const l of listeners) l(); schedule(0); });

export function pendingFor(workspaceId: string): readonly OutboxItem<Pending>[] {
  ensureOwner();
  return box.items.filter(i => i.payload.workspaceId === workspaceId);
}
export function onOutbox(l: Listener): () => void { listeners.add(l); return () => listeners.delete(l); }
export function onDelivered(l: (row: SentRow) => void): () => void { delivered.add(l); return () => delivered.delete(l); }

export function queue(workspaceId: string, body: string | null, photo: Blob | null): string {
  ensureOwner();
  const clientId = crypto.randomUUID();
  if (photo) photos.set(clientId, photo);
  box.add(clientId, { workspaceId, body, hasPhoto: !!photo, imagePath: null }, Date.now());
  save(); schedule(0);
  return clientId;
}
export function retry(clientId: string) { box.retry(clientId, Date.now()); save(); schedule(0); }
export function drop(clientId: string) { photos.delete(clientId); box.sent(clientId); save(); }

const permanent = (e: unknown) => e instanceof BackendError && ['invalid-input', 'not-allowed', 'not-found'].includes(e.problem);
async function deliver(item: OutboxItem<Pending>, me: string): Promise<void> {
  const p = item.payload;
  if (p.hasPhoto && !p.imagePath) {
    const blob = photos.get(item.clientId);
    if (!blob) throw new BackendError('not-found', 0);
    const path = chatMediaPath(p.workspaceId, me, crypto.randomUUID(), 'jpg');
    await uploadFile('chat-media', path, blob);
    p.imagePath = path; photos.delete(item.clientId); save();
  }
  try {
    const rows = await insert('messages', { client_id: item.clientId, workspace_id: p.workspaceId, author_id: me, body: p.body, image_path: p.imagePath }, true) as SentRow[];
    if (rows?.[0]) { for (const d of delivered) d(rows[0]); announce('message', rows[0].id); }
  } catch (e) {
    if (e instanceof BackendError && e.problem === 'duplicate') return; // already arrived on an earlier try
    throw e;
  }
}
async function flush() {
  if (flushing) return;
  const me = ensureOwner();
  if (!me) return;
  flushing = true;
  try {
    for (const item of box.due(Date.now())) {
      try { await deliver(item, me); box.sent(item.clientId); }
      catch (e) {
        box.failed(item.clientId, Date.now(), e instanceof BackendError ? e.problem : 'unknown', permanent(e));
        if (e instanceof BackendError && e.problem === 'offline') break; // the rest waits for the network
      }
      save();
    }
  } finally { flushing = false; }
  const next = box.items.filter(i => !i.dead).map(i => i.nextAt);
  if (next.length) schedule(Math.max(500, Math.min(...next) - Date.now()));
}
function schedule(ms: number) { clearTimeout(timer); timer = setTimeout(() => void flush(), ms); }
if (typeof addEventListener === 'function') {
  addEventListener('online', () => { for (const i of box.items) if (!i.dead) i.nextAt = Date.now(); schedule(0); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') schedule(0); });
}
