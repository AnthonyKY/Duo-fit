// CollabFit's training engine. The calculations are DUOFIT's own code (duofit-engine.generated.js, copied verbatim and
// proven identical by test/characterize.mjs); this file only gives them types and the few steps DUOFIT does inside its
// screens (starting a workout, building the saved workout), mirrored line for line and checked against DUOFIT too.
// State = DUOFIT's own format (one profile per person here), so a DUOFIT backup can later be imported as a COPY.
import { createEngine, DUOFIT_VERSION } from './duofit-engine.generated.js';

export { DUOFIT_VERSION };
export type Lang = 'fr' | 'en';
/** DUOFIT's two programmes: M = upper-body priority (shoulders, chest, back — V shape), F = lower-body priority (glutes, legs). */
export type Programme = 'M' | 'F';
export type Day = 'A' | 'B' | 'C';
/** A planned exercise: [id, sets, low reps, high reps, rest s, reps in reserve, step, slot]. */
export type Entry = [string, number, number, number, number, number, number?, number?];
export interface SetDone { w: number; r: number }
export interface DraftSet { w: number | ''; r: number | ''; ok: 0 | 1 }
export interface Plan { ex: Entry[]; budget: number; wm: number; cm: number; unavailable?: boolean; tooShort?: boolean; [k: string]: unknown }
export interface Suggestion { w: number | ''; text: string; reps: number | null }
export interface NextTarget { w: number; r: number; k: string; n: number; lo: number; hi: number; [k: string]: unknown }
export interface WorkoutLog {
  pr: string[]; date: number; wk: Day; dur: number; durSec: number; ex: Record<string, SetDone[]>; note: string; sets: number; vol: number;
  tg: Record<string, [number, number, number, number]>; nx: Record<string, Pick<NextTarget, 'w' | 'r' | 'k' | 'n' | 'lo' | 'hi'>>;
  mode?: string; budget?: number; back?: number; cardio?: number; clock?: number; xs?: number; wu?: number;
}
export interface Draft { wk: Day; start: number; pl: Entry[]; ex: DraftSet[][]; note: string; back: number | null; mode: string; budget: number }
export interface ExerciseInfo { id: string; name: string; muscles: string; equipment: string; level: number; how: string; mistakes: string; alternatives: string[]; timed: boolean; bodyweight: boolean }

type State = { p: Programme; lg: Lang; d: Record<Programme, { logs: WorkoutLog[]; sched: Record<string, Day>; pf: Record<string, unknown>; [k: string]: unknown }>; [k: string]: unknown };

export class Trainer {
  readonly #host: { S: State; U: Record<string, unknown>; save: () => boolean; setTimeout: typeof setTimeout };
  readonly #e: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  /** from saved JSON (DUOFIT format, normalised by DUOFIT's own reader) or a fresh state */
  constructor(saved: string | null, programme: Programme = 'M', lang: Lang = 'fr', onChange: () => void = () => {}) {
    const boot = createEngine({ S: null, U: {}, save: () => true, setTimeout });
    let S: State;
    try { S = boot.readState(saved ?? JSON.stringify(boot.freshState())); } catch { S = boot.readState(JSON.stringify(boot.freshState())); }
    if (!saved) S.p = programme;
    S.lg = lang;
    this.#host = { S, U: { per: 12 }, save: () => { onChange(); return true; }, setTimeout };
    this.#e = createEngine(this.#host);
  }
  get state(): State { return this.#host.S; }
  toJSON(): string { return JSON.stringify(this.#host.S); }
  get programme(): Programme { return this.#host.S.p; }
  set programme(p: Programme) { this.#host.S.p = p; }
  set lang(l: Lang) { this.#host.S.lg = l; }
  get profile() { return this.#host.S.d[this.#host.S.p]; }
  get logs(): readonly WorkoutLog[] { return this.profile.logs; }
  /** the workout planned for today in this person's week (Plan), or null on a rest day */
  today(now = new Date()): Day | null { return (this.profile.sched[now.getDay()] as Day | undefined) ?? null; }
  programmeName(day: Day): string { return this.#e.prog()[day].n[this.#e.li()]; }
  plan(day: Day): Plan { return this.#e.eff(day); }
  exercise(id: string): ExerciseInfo {
    const x = this.#e.E[id], k = this.#e.li();
    return { id, name: x[k], muscles: x[2 + k], equipment: this.#e.EQ[x[4]]?.[k] ?? x[4], level: x[5], how: x[6 + k], mistakes: x[8 + k], alternatives: x[10] ?? [], timed: this.#e.isT(id), bodyweight: this.#e.isBW(id) };
  }
  suggest(id: string, entry: Entry, day: Day): Suggestion { const g = this.#e.sug(id, entry, day); return { w: g.w, text: g.t, reps: Number.isSafeInteger(g.r) ? g.r : null }; }
  /** the reps a set aims for: today's target ("vise 11 reps"), else last time's */
  targetReps(id: string, entry: Entry, set: number, day: Day): number { return +this.#e.tgr(id, entry, set, day); }
  nextTarget(id: string, sets: SetDone[], entry: Entry, back: number | null = null): NextTarget | null { return this.#e.nextOf(id, sets, entry, back); }
  nextText(id: string, o: NextTarget | null): string { return this.#e.nxText(id, o); }
  readSet(set: { w: unknown; r: unknown }, id: string, fallbackReps?: number): SetDone | null { return this.#e.readSet(set, id, fallbackReps); }
  last(id: string, day?: Day): WorkoutLog | undefined { return this.#e.last(id, 0, day); }
  loadText(w: number): string { return this.#e.fw(w); }

  /** DUOFIT's start(): the plan of the day, every set pre-filled with the suggested load (no back check-in here yet) */
  start(day: Day, now = Date.now()): Draft {
    const plan = this.plan(day);
    if (plan.unavailable) throw new Error('no plan for this day with the current equipment and time');
    const ex = plan.ex.map(entry => { const w = this.suggest(entry[0], entry, day).w; return Array.from({ length: entry[1] }, () => ({ w, r: '' as const, ok: 0 as const })); });
    return { wk: day, start: now, pl: plan.ex.map(e => [...e] as Entry), ex, note: '', back: null, mode: this.#e.vmode(), budget: plan.budget };
  }
  /** DUOFIT's fin(): the workout as saved — totals, records, the targets of the day and the next target per exercise */
  finish(d: Draft, end = Date.now(), seconds = Math.max(0, Math.floor((end - d.start) / 1000))): WorkoutLog {
    const ex: Record<string, SetDone[]> = {};
    d.pl.forEach((entry, i) => {
      for (const set of d.ex[i] ?? []) {
        if (!set.ok && String(set.r ?? '').trim() === '') continue;
        const v = this.readSet(set, entry[0]);
        if (v) (ex[entry[0]] ??= []).push(v);
      }
    });
    const ents: Record<string, Entry> = {}; d.pl.forEach(e => { ents[e[0]] = e; });
    const prs: string[] = [];
    for (const [id, sets] of Object.entries(ex)) {
      const past = this.logs.flatMap(l => l.ex[id] ?? []), top = Math.max(...sets.map(s => s.w));
      if (past.length && past.every(s => s.w < top)) prs.push(this.#e.nm(id) + ' ' + this.#e.fw(top) + ' kg');
    }
    const tg: WorkoutLog['tg'] = {}; d.pl.forEach(e => { tg[e[0]] = [e[1], e[2], e[3], e[5]]; });
    const nx: WorkoutLog['nx'] = {};
    for (const [id, sets] of Object.entries(ex)) { const o = this.nextTarget(id, sets, ents[id]!, d.back); if (o) nx[id] = { w: o.w, r: o.r, k: o.k, n: o.n, lo: o.lo, hi: o.hi }; }
    const totals = this.#e.workoutTotals(ex) as { sets: number; vol: number };
    const log: WorkoutLog = { pr: prs, date: end, wk: d.wk, dur: Math.round(seconds / 60), durSec: seconds, ex, note: d.note, ...totals, tg, nx, mode: d.mode, budget: d.budget };
    if (d.back != null) log.back = d.back;
    return log;
  }
  /** saves a finished workout in the history (sorted by date, like DUOFIT) */
  record(log: WorkoutLog): void { const l = this.profile.logs; l.push(log); l.sort((a, b) => a.date - b.date); this.#host.save(); }
}
