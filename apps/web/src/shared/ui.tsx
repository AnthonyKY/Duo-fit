import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '../app/i18n.tsx';
import { BackendError } from './backend.ts';

export type Msg = { ok: boolean; text: string } | null;

/** One action at a time, with a clear message after it (never a native alert: they block iPhone web apps). */
export function useAction() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const run = useCallback(async (job: () => Promise<unknown>, okText?: string): Promise<boolean> => {
    if (busy) return false;
    setBusy(true); setMsg(null);
    try { await job(); if (alive.current) setMsg(okText ? { ok: true, text: okText } : null); return true; }
    catch (e) { if (alive.current) setMsg({ ok: false, text: problemText(t, e) }); return false; }
    finally { if (alive.current) setBusy(false); }
  }, [busy, t]);
  return { busy, msg, setMsg, run };
}
export function problemText(t: ReturnType<typeof useI18n>['t'], e: unknown): string {
  return t.acc.problem[e instanceof BackendError ? e.problem : 'unknown'];
}
export function Note({ msg }: { msg: Msg }) {
  return msg ? <p className={msg.ok ? 'note ok' : 'note err'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p> : null;
}
/** Two taps for anything hard to undo: the first turns the button into "Confirmer ?", the second acts. */
export function ConfirmButton({ children, onConfirm, disabled, className = '' }: { children: ReactNode; onConfirm: () => void; disabled?: boolean; className?: string }) {
  const { t } = useI18n();
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const k = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(k); }, [armed]);
  return (
    <button type="button" className={`${className} ${armed ? 'armed' : ''}`} disabled={disabled}
      onClick={() => { if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}>
      {armed ? t.sp.confirm : children}
    </button>
  );
}
