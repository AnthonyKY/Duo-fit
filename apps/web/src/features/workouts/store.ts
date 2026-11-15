// A person's training: DUOFIT's engine (packages/training) + their state in DUOFIT's format, kept on this phone and
// synced to their account (Invictus' choice 1A). Saving is optimistic: the phone writes over the version it read; if
// another phone saved meanwhile, both histories are merged (no workout is ever lost), then saved again.
// Body measurements are not part of CollabFit's training and are never sent.
import { Trainer, type Day, type Draft, type Lang, type Programme, type WorkoutLog } from '@collabfit/training';
import { BackendError, currentSession, onSession, rest, rpc } from '../../shared/backend.ts';
import { readLocal, writeLocal } from '../../shared/storage.ts';
import { announce } from '../notifications/push.ts';

export type SyncState = 'saved' | 'saving' | 'offline' | 'error';
export interface Setup { programme: Programme; level: 'beg' | 'int' | 'adv'; minutes: number; back: boolean; gear: string[]; days: number[]; goal: 'loss' | 'recomp' | 'maint' | 'gain' }
type Listener = () => void;
type Row = { data: unknown; version: number };

const listeners = new Set<Listener>();
let uid = '', trainer: Trainer | null = null, version = 0, dirty = false, sync: SyncState = 'saved', loaded = false, timer: ReturnType<typeof setTimeout> | undefined;
let edits = 0, pushing = false; // a change made while a save is on its way is sent by the next save, never dropped
let draft: Draft | null = null;
const k = (what: string) => `collabfit-${what}-${uid}`;
const emit = () => { for (const l of listeners) l(); };

export const onTraining = (l: Listener): (() => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const training = () => ({ trainer, loaded, sync, draft, needsSetup: loaded && !trainer });

function keepLocal() {
  if (!uid) return;
  writeLocal(k('training'), trainer ? JSON.stringify({ data: trainer.toJSON(), version, dirty }) : null);
  writeLocal(k('draft'), draft ? JSON.stringify(draft) : null);
}
/** what is sent: the state without body measurements (they stay on the phone) and without the running workout */
function outgoing(t: Trainer): Record<string, unknown> {
  const s = JSON.parse(t.toJSON()) as { d: Record<string, Record<string, unknown>> };
  for (const p of Object.values(s.d)) { p.body = []; p.hd = []; p.ms = []; p.cur = null; }
  return s as unknown as Record<string, unknown>;
}
// the settings (programme, planning, level, length, back, equipment, goal, chosen exercises) travel as one block,
// stamped with the time they were last changed on a phone: when two phones disagree, the latest change wins
const SETTINGS = ['pf', 'sched', 'sub', 'notes', 'draw'] as const;
export const settingsTime = (t: Trainer) => Number((t.state as { cfAt?: unknown }).cfAt) || 0;
/** two phones → one state: every workout kept once (same date and day = same workout), the latest settings win */
function merge(local: Trainer, server: unknown, lang: Lang): Trainer {
  const theirs = new Trainer(JSON.stringify(server), local.programme, lang, changed);
  if (settingsTime(local) > settingsTime(theirs)) {
    const S = theirs.state as Record<string, unknown>;
    S.p = local.state.p; S.cfAt = settingsTime(local);
    for (const p of ['M', 'F'] as const) for (const k of SETTINGS) (theirs.state.d[p] as Record<string, unknown>)[k] = structuredClone(local.state.d[p][k] as unknown);
  }
  for (const p of ['M', 'F'] as const) {
    const a = local.state.d[p].logs, b = theirs.state.d[p].logs, seen = new Set(b.map(l => `${l.date}|${l.wk}`));
    for (const l of a) if (!seen.has(`${l.date}|${l.wk}`)) b.push(l);
    b.sort((x, y) => x.date - y.date);
  }
  return theirs;
}

async function push(): Promise<void> {
  if (!trainer || !dirty || !uid) return;
  if (pushing) { schedule(500); return; }
  pushing = true;
  try { await pushNow(); } finally { pushing = false; }
}
async function pushNow(): Promise<void> {
  if (!trainer) return;
  const at = edits;
  sync = 'saving'; emit();
  const lang = (trainer.state.lg as Lang) ?? 'fr';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      version = await rpc<number>('save_training', { p_data: outgoing(trainer!), p_version: version });
      if (edits === at) { dirty = false; sync = 'saved'; } else schedule(0); // changed meanwhile: one more save
      keepLocal(); emit(); return;
    } catch (e) {
      if (e instanceof BackendError && e.problem === 'conflict') {
        const row = (await rest<Row[]>(`training_profiles?select=data,version&user_id=eq.${uid}`))[0];
        if (row) { trainer = merge(trainer!, row.data, lang); version = row.version; continue; }
        version = 0; continue;
      }
      sync = e instanceof BackendError && e.problem === 'offline' ? 'offline' : 'error'; keepLocal(); emit();
      schedule(sync === 'offline' ? 15_000 : 60_000); return;
    }
  }
}
function schedule(ms = 800) { clearTimeout(timer); timer = setTimeout(() => void push(), ms); }
/** something changed in the training state: kept on the phone at once, sent to the account shortly after */
export function changed() { edits++; dirty = true; if (sync === 'saved') sync = 'saving'; keepLocal(); emit(); schedule(); }

export async function loadTraining(lang: Lang): Promise<void> {
  const s = currentSession();
  if (!s) { uid = ''; trainer = null; draft = null; loaded = false; emit(); return; }
  if (s.user.id === uid && loaded) return;
  uid = s.user.id; loaded = false; trainer = null; draft = null;
  let local: { data: string; version: number; dirty: boolean } | null = null;
  try { local = JSON.parse(readLocal(k('training')) ?? 'null'); } catch { /* damaged: the account copy is used */ }
  try { draft = JSON.parse(readLocal(k('draft')) ?? 'null'); } catch { draft = null; }
  if (local) { trainer = new Trainer(local.data, 'M', lang, changed); version = local.version; dirty = local.dirty; loaded = true; emit(); }
  try {
    const row = (await rest<Row[]>(`training_profiles?select=data,version&user_id=eq.${uid}`))[0];
    if (row && (!trainer || (!dirty && row.version > version))) { trainer = new Trainer(JSON.stringify(row.data), 'M', lang, changed); version = row.version; }
    else if (row && dirty && row.version > version && trainer) { trainer = merge(trainer, row.data, lang); version = row.version; }
    sync = 'saved';
  } catch (e) { sync = e instanceof BackendError && e.problem === 'offline' ? 'offline' : 'error'; }
  if (trainer) trainer.lang = lang;
  loaded = true; keepLocal(); emit();
  if (dirty) schedule(0);
}
onSession(s => { if (!s || s.user.id !== uid) { clearTimeout(timer); uid = ''; trainer = null; draft = null; loaded = false; emit(); } });
if (typeof addEventListener === 'function') addEventListener('online', () => { if (dirty) schedule(0); });

export function setupTraining(x: Setup, lang: Lang): void {
  const t = trainer ?? new Trainer(null, x.programme, lang, changed);
  t.programme = x.programme;
  const pf = t.profile.pf as Record<string, unknown>;
  Object.assign(pf, { lvl: x.level, time: x.minutes, back: x.back, gear: x.gear.length ? x.gear : ['M'], goal: x.goal });
  const order: Day[] = ['A', 'B', 'C'], sched: Record<string, Day> = {};
  [...x.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).forEach((d, i) => { sched[d] = order[i % 3]!; });
  t.profile.sched = sched;
  t.profile.draw = {}; // a new set-up draws the exercises again
  (t.state as Record<string, unknown>).cfAt = Date.now(); // the settings' time, for merging with another phone
  trainer = t; changed();
}

// ---------------------------------------------------------------- the running workout (kept on this phone until saved)
export function startWorkout(day: Day): Draft | null {
  if (!trainer) return null;
  draft = trainer.start(day); keepLocal(); emit(); changed();
  void shareMoment('started', draft.start);
  return draft;
}
export function updateDraft(next: Draft) { draft = next; keepLocal(); emit(); }
export function abandonWorkout() { draft = null; keepLocal(); emit(); }
export function finishWorkout(): WorkoutLog | null {
  if (!trainer || !draft) return null;
  const log = trainer.finish(draft);
  const start = draft.start;
  draft = null;
  if (log.sets > 0) { trainer.record(log); changed(); void shareMoment('completed', start); } else { keepLocal(); emit(); }
  return log;
}

// "X a commencé / terminé sa séance" in the spaces where the person turned sharing on — nothing else is sent
async function shareMoment(type: 'started' | 'completed', start: number) {
  try {
    const rows = await rest<{ workspace_id: string }[]>(`workspace_members?select=workspace_id&user_id=eq.${uid}&status=eq.active&share_workouts=is.true`);
    for (const r of rows) await rpc<string>('publish_workout_event', { p_workspace: r.workspace_id, p_type: type, p_workout_ref: 's' + start.toString(36) })
      .then(id => { if (typeof id === 'string') announce('workout', id); }).catch(() => { /* best effort */ });
  } catch { /* offline: the moment is not worth replaying later */ }
}
