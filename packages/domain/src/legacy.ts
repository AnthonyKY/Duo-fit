// Read-only bridge to the data DUOFIT keeps in the browser ("duofit" in localStorage, same address).
// It never writes: DUOFIT stays the source of truth for workouts until a migration is explicitly chosen and tested.
export type LegacyProfile = 'M' | 'F';
export interface LegacySummary {
  profile: LegacyProfile;
  sessions: number;
  last: { date: number; workout: string; minutes: number | null } | null;
  inProgress: { workout: string; startedAt: number } | null;
}
export type LegacyRead = { ok: true; active: LegacyProfile; profiles: LegacySummary[] } | { ok: false; reason: 'missing' | 'unreadable' };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function summarize(key: LegacyProfile, p: unknown): LegacySummary {
  const prof = isObj(p) ? p : {};
  const logs = (Array.isArray(prof.logs) ? prof.logs : []).filter((l): l is Obj => isObj(l) && Number.isFinite(l.date) && typeof l.wk === 'string');
  const lastLog = logs.reduce<Obj | null>((a, l) => (!a || (l.date as number) > (a.date as number) ? l : a), null);
  const minutes = (l: Obj): number | null =>
    Number.isFinite(l.durSec) && (l.durSec as number) > 0 ? Math.round((l.durSec as number) / 60) : Number.isFinite(l.dur) && (l.dur as number) > 0 ? Math.round(l.dur as number) : null;
  const cur = isObj(prof.cur) && typeof prof.cur.wk === 'string' && Number.isFinite(prof.cur.start) ? prof.cur : null;
  return {
    profile: key,
    sessions: logs.length,
    last: lastLog ? { date: lastLog.date as number, workout: lastLog.wk as string, minutes: minutes(lastLog) } : null,
    inProgress: cur ? { workout: cur.wk as string, startedAt: cur.start as number } : null,
  };
}

export function readDuofit(raw: string | null): LegacyRead {
  if (raw == null) return { ok: false, reason: 'missing' };
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return { ok: false, reason: 'unreadable' }; }
  if (!isObj(data) || !isObj(data.d)) return { ok: false, reason: 'unreadable' };
  const d = data.d;
  return { ok: true, active: data.p === 'F' ? 'F' : 'M', profiles: [summarize('M', d.M), summarize('F', d.F)] };
}

/** "started" / "completed" moments of one DUOFIT profile after a date, with stable references (no workout content) */
export function legacyWorkoutEvents(raw: string | null, profile: LegacyProfile, since: number): Array<{ type: 'started' | 'completed'; ref: string; at: number }> {
  if (raw == null) return [];
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return []; }
  const p = isObj(data) && isObj(data.d) && isObj(data.d[profile]) ? (data.d[profile] as Obj) : null;
  if (!p) return [];
  const out: Array<{ type: 'started' | 'completed'; ref: string; at: number }> = [];
  for (const l of Array.isArray(p.logs) ? p.logs : []) {
    if (isObj(l) && Number.isFinite(l.date) && (l.date as number) > since) out.push({ type: 'completed', ref: 'c' + Math.trunc(l.date as number), at: l.date as number });
  }
  if (isObj(p.cur) && Number.isFinite(p.cur.start) && (p.cur.start as number) > since) out.push({ type: 'started', ref: 's' + Math.trunc(p.cur.start as number), at: p.cur.start as number });
  return out.sort((a, b) => a.at - b.at);
}
