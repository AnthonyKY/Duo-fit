import { useEffect, useState, type ReactNode } from 'react';
import type { Day, Draft, Entry, Programme, Trainer, WorkoutLog } from '@collabfit/training';
import { useI18n } from '../../app/i18n.tsx';
import { ConfirmButton } from '../../shared/ui.tsx';
import { abandonWorkout, finishWorkout, loadTraining, onTraining, setupTraining, startWorkout, training, updateDraft, type Setup } from './store.ts';

const DAYS = [1, 2, 3, 4, 5, 6, 0];
function useTraining() {
  const [, tick] = useState(0);
  useEffect(() => onTraining(() => tick(n => n + 1)), []);
  return training();
}
const Chip = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) =>
  <button type="button" className={on ? 'on' : ''} aria-pressed={on} onClick={onClick}>{children}</button>;

function SetupForm({ t0, onDone }: { t0: Trainer | null; onDone: () => void }) {
  const { t, lang } = useI18n();
  const pf = (t0?.profile.pf ?? {}) as Record<string, unknown>;
  const [x, setX] = useState<Setup>(() => ({
    programme: t0?.programme ?? 'M', level: (pf.lvl as Setup['level']) ?? 'int', minutes: Number(pf.time) || 60, back: Boolean(pf.back ?? false),
    gear: (pf.gear as string[]) ?? ['M', 'DB', 'C', 'SM'], goal: (pf.goal as Setup['goal']) ?? 'gain',
    days: t0 ? Object.keys(t0.profile.sched).map(Number) : [1, 3, 5],
  }));
  const set = (p: Partial<Setup>) => setX(v => ({ ...v, ...p }));
  const toggle = <T,>(list: T[], v: T) => list.includes(v) ? list.filter(y => y !== v) : [...list, v];
  const dayNames = lang === 'fr' ? ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return (
    <form className="card setup" onSubmit={e => { e.preventDefault(); setupTraining(x, lang); onDone(); }}>
      <h2>{t.tr.setupTitle}</h2>
      <p className="muted small">{t.tr.setupIntro}</p>
      <p className="lb">{t.tr.programme}</p>
      <div className="stack">{(['M', 'F'] as Programme[]).map(p => <Chip key={p} on={x.programme === p} onClick={() => set({ programme: p })}>{p === 'M' ? t.tr.progM : t.tr.progF}</Chip>)}</div>
      <p className="lb">{t.tr.level}</p>
      <div className="seg wide">{(['beg', 'int', 'adv'] as const).map(l => <Chip key={l} on={x.level === l} onClick={() => set({ level: l })}>{t.tr[l]}</Chip>)}</div>
      <p className="lb">{t.tr.minutes}</p>
      <div className="seg wide">{[30, 45, 60, 75, 90].map(m => <Chip key={m} on={x.minutes === m} onClick={() => set({ minutes: m })}>{m}</Chip>)}</div>
      <p className="lb">{t.tr.days}</p>
      <div className="seg wide days">{DAYS.map(d => <Chip key={d} on={x.days.includes(d)} onClick={() => set({ days: toggle(x.days, d) })}>{dayNames[d]}</Chip>)}</div>
      <p className="lb">{t.tr.gear}</p>
      <div className="seg wide">{(['M', 'DB', 'C', 'SM'] as const).map(g => <Chip key={g} on={x.gear.includes(g)} onClick={() => set({ gear: toggle(x.gear, g) })}>{t.tr[`gear${g}`]}</Chip>)}</div>
      <p className="lb">{t.tr.goal}</p>
      <div className="seg wide wrap">{(['gain', 'recomp', 'loss', 'maint'] as const).map(g => <Chip key={g} on={x.goal === g} onClick={() => set({ goal: g })}>{t.tr[g]}</Chip>)}</div>
      <label className="check"><input type="checkbox" checked={x.back} onChange={e => set({ back: e.target.checked })} /> {t.tr.back}</label>
      <p className="muted small">{t.tr.backHint}</p>
      <button type="submit" className="primary block" disabled={!x.days.length || !x.gear.length}>{t.tr.saveSetup}</button>
    </form>
  );
}

function PlanCard({ tr, day, onStart }: { tr: Trainer; day: Day; onStart: () => void }) {
  const { t } = useI18n();
  const plan = tr.plan(day);
  if (plan.unavailable) return <div className="card"><h2>{tr.programmeName(day)}</h2><p role="status">{t.tr.unavailable}</p></div>;
  return (
    <div className="card plan" data-day={day}>
      <h2>{day} — {tr.programmeName(day)}</h2>
      <p className="muted small">{t.tr.total(plan.budget)} · {t.tr.warm(plan.wm)}</p>
      <ol className="exlist">
        {plan.ex.map(e => { const g = tr.suggest(e[0], e, day); return (
          <li key={e[0]}><b>{tr.exercise(e[0]).name}</b> <span className="muted">{t.tr.planned(e[1], e[2], e[3])}{tr.exercise(e[0]).timed ? ' s' : ''}{typeof g.w === 'number' && g.w > 0 ? ' · ' + tr.loadText(g.w) + ' kg' : ''}</span></li>
        ); })}
      </ol>
      <button type="button" className="primary block" onClick={onStart}>{t.tr.start}</button>
    </div>
  );
}

function RestBanner({ until, onSkip }: { until: number; onSkip: () => void }) {
  const { t } = useI18n();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const k = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(k); }, []);
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  useEffect(() => { if (left === 0) onSkip(); }, [left]);
  return <div className="rest" role="timer"><span>{t.tr.restT} <b>{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</b></span><button type="button" onClick={onSkip}>{t.tr.skip}</button></div>;
}

function ExerciseCard({ tr, d, i, onChange, onRest }: { tr: Trainer; d: Draft; i: number; onChange: (d: Draft) => void; onRest: (s: number) => void }) {
  const { t } = useI18n();
  const e = d.pl[i] as Entry, id = e[0], info = tr.exercise(id), g = tr.suggest(id, e, d.wk);
  const [open, setOpen] = useState(false);
  const sets = d.ex[i] ?? [];
  const edit = (j: number, k: 'w' | 'r', v: string) => {
    const next: Draft = { ...d, ex: d.ex.map((s, ii) => ii !== i ? s : s.map((x, jj) => jj !== j ? x : { ...x, [k]: v as unknown as number })) };
    onChange(next);
  };
  const check = (j: number) => {
    const s = sets[j]!;
    if (s.ok) { onChange({ ...d, ex: d.ex.map((x, ii) => ii !== i ? x : x.map((y, jj) => jj !== j ? y : { ...y, ok: 0 })) }); return; }
    const v = tr.readSet({ w: s.w === '' && info.bodyweight ? 0 : s.w, r: s.r }, id, tr.targetReps(id, e, j, d.wk));
    if (!v) return;
    const ex = d.ex.map((x, ii) => ii !== i ? x : x.map((y, jj) => jj === j ? { w: v.w, r: v.r, ok: 1 as const } : jj === j + 1 && !y.ok ? { ...y, w: v.w } : y));
    onChange({ ...d, ex }); onRest(e[4]);
  };
  return (
    <div className="card ex" data-ex={id}>
      <div className="row between"><h3>{info.name}</h3><button type="button" className="tiny" aria-expanded={open} onClick={() => setOpen(!open)}>ℹ︎</button></div>
      <p className="muted small">{t.tr.planned(e[1], e[2], e[3])}{info.timed ? ' s' : ' reps'} · RIR {e[5]} · {t.tr.restT.toLowerCase()} {e[4]} s</p>
      <p className="tip">{g.text}</p>
      {open && <div className="howto"><p><b>{t.tr.how}</b> {info.how}</p><p><b>{t.tr.mistakes}</b> {info.mistakes}</p></div>}
      {sets.map((s, j) => (
        <div key={j} className={'setrow' + (s.ok ? ' ok' : '')} data-set={`${i}-${j}`}>
          <span className="muted">{j + 1}</span>
          <input inputMode="decimal" aria-label={`${info.name} · ${j + 1} · ${t.tr.load}`} placeholder={info.bodyweight ? '0' : t.tr.kg} value={String(s.w ?? '')}
            disabled={!!s.ok} onInput={ev => edit(j, 'w', (ev.target as HTMLInputElement).value)} />
          <input inputMode="numeric" aria-label={`${info.name} · ${j + 1} · ${t.tr.reps}`} placeholder={String(tr.targetReps(id, e, j, d.wk))} value={String(s.r ?? '')}
            disabled={!!s.ok} onInput={ev => edit(j, 'r', (ev.target as HTMLInputElement).value)} />
          <button type="button" className={s.ok ? 'primary' : ''} aria-pressed={!!s.ok} aria-label="✓" onClick={() => check(j)}>✓</button>
        </div>
      ))}
    </div>
  );
}

function Session({ tr, d }: { tr: Trainer; d: Draft }) {
  const { t } = useI18n();
  const [rest, setRest] = useState<number | null>(null);
  const done = d.ex.flat().filter(s => s.ok).length, all = d.ex.flat().length;
  return (
    <section className="screen session">
      <h1>{d.wk} — {tr.programmeName(d.wk)}</h1>
      <div className="bar"><i style={{ width: `${(done / Math.max(1, all)) * 100}%` }} /></div>
      <p className="muted small">{done}/{all}</p>
      {rest && <RestBanner until={rest} onSkip={() => setRest(null)} />}
      {d.pl.map((_, i) => <ExerciseCard key={i} tr={tr} d={d} i={i} onChange={updateDraft} onRest={s => setRest(Date.now() + s * 1000)} />)}
      <textarea className="note" aria-label="notes" placeholder="📝" value={d.note} onInput={ev => updateDraft({ ...d, note: (ev.target as HTMLTextAreaElement).value })} />
      <button type="button" className="primary block" onClick={() => { const log = finishWorkout(); window.dispatchEvent(new CustomEvent('collabfit-finished', { detail: log })); }}>{t.tr.finish}</button>
      <ConfirmButton className="block danger-btn" onConfirm={abandonWorkout}>{t.tr.abandon}</ConfirmButton>
    </section>
  );
}

function Summary({ tr, log, onClose }: { tr: Trainer; log: WorkoutLog; onClose: () => void }) {
  const { t, lang } = useI18n();
  return (
    <section className="screen">
      <h1>{log.sets ? t.tr.doneT : t.tr.abandon}</h1>
      {!log.sets ? <p className="card">{t.tr.nothing}</p> : <>
        <div className="card"><b>{tr.programmeName(log.wk)}</b><p className="muted">{t.tr.sets(log.sets)} · {t.tr.vol(log.vol.toLocaleString(lang))}</p>
          {log.pr.length > 0 && <p>🏆 {t.tr.prs} : {log.pr.join(', ')}</p>}</div>
        <div className="card"><b>{t.tr.next}</b>
          <ul className="list">{Object.keys(log.ex).map(id => { const e = Object.values(log.tg).length ? [id, ...log.tg[id]!.slice(0, 3), 0, log.tg[id]![3]] as unknown as Entry : null;
            const o = e ? tr.nextTarget(id, log.ex[id]!, e, log.back ?? null) : null;
            return <li key={id}><b>{tr.exercise(id).name}</b><br /><span className="small">{tr.nextText(id, o)}</span></li>; })}</ul></div>
      </>}
      <button type="button" className="primary block" onClick={onClose}>{t.tr.back2}</button>
    </section>
  );
}

function History({ tr }: { tr: Trainer }) {
  const { t, lang } = useI18n();
  const logs = [...tr.logs].reverse().slice(0, 30);
  return (
    <div className="card history">
      <b>{t.tr.history}</b>
      {!logs.length ? <p className="muted">{t.tr.none}</p> : (
        <ul className="list">{logs.map(l => (
          <li key={l.date + l.wk}><b>{l.wk} — {tr.programmeName(l.wk)}</b> <span className="muted small">{new Date(l.date).toLocaleDateString(lang, { weekday: 'short', day: 'numeric', month: 'short' })} · {t.tr.sets(l.sets)} · {l.vol.toLocaleString(lang)} kg</span>
            <div className="small muted">{Object.entries(l.ex).map(([id, sets]) => `${tr.exercise(id).name} : ${sets.map(s => (s.w ? tr.loadText(s.w) + ' × ' : '') + s.r).join(', ')}`).join(' · ')}</div></li>
        ))}</ul>
      )}
    </div>
  );
}

export function Training() {
  const { t, lang } = useI18n();
  const st = useTraining();
  const [editing, setEditing] = useState(false);
  const [pick, setPick] = useState<Day | null>(null);
  const [summary, setSummary] = useState<WorkoutLog | null>(null);
  useEffect(() => { void loadTraining(lang); }, [lang]);
  useEffect(() => { const h = (e: Event) => setSummary((e as CustomEvent<WorkoutLog | null>).detail); addEventListener('collabfit-finished', h); return () => removeEventListener('collabfit-finished', h); }, []);
  const tr = st.trainer;
  if (!st.loaded) return <section className="screen"><h1>{t.tr.title}</h1><p className="card muted">{t.acc.working}</p></section>;
  if (!tr || editing) return <section className="screen"><h1>{t.tr.title}</h1><SetupForm t0={tr} onDone={() => setEditing(false)} /></section>;
  if (summary) return <Summary tr={tr} log={summary} onClose={() => setSummary(null)} />;
  if (st.draft) return <Session tr={tr} d={st.draft} />;
  const day = pick ?? tr.today();
  return (
    <section className="screen">
      <h1>{t.tr.title}</h1>
      <p className="muted small sync" data-sync={st.sync}>{t.tr.sync[st.sync]}</p>
      {!pick && !tr.today() && <p className="muted">{t.tr.rest}</p>}
      <div className="seg wide">{(['A', 'B', 'C'] as Day[]).map(x => <Chip key={x} on={day === x} onClick={() => setPick(x)}>{x}</Chip>)}</div>
      {day && <PlanCard tr={tr} day={day} onStart={() => startWorkout(day)} />}
      <History tr={tr} />
      <button type="button" className="block" onClick={() => setEditing(true)}>{t.tr.editSetup}</button>
    </section>
  );
}
