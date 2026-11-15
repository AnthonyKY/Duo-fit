// Profile → Notifications: one switch for this device, a test, and what to do on iPhone when it cannot work yet.
import { useEffect, useState } from 'react';
import { useI18n } from '../../app/i18n.tsx';
import { Note, useAction } from '../../shared/ui.tsx';
import { disablePush, enablePush, pushState, registration, serverKey, testPush, type PushState } from './push.ts';

export function NotificationsCard() {
  const { t, lang } = useI18n();
  const n = t.push;
  const [state, setState] = useState<PushState | null>(null);
  const [ready, setReady] = useState<{ reg: ServiceWorkerRegistration; key: string } | null>(null);
  const act = useAction();
  useEffect(() => {
    let live = true;
    void pushState().then(s => { if (live) setState(s); });
    // prepared in advance, so the tap goes straight to the system's question (iPhone requires it)
    void Promise.all([registration(), serverKey()]).then(([reg, key]) => { if (live && reg) setReady({ reg, key }); }).catch(() => { /* shown as not ready */ });
    return () => { live = false; };
  }, []);
  if (!state) return null;
  return (
    <div className="card" data-push={state}>
      <b>{n.title}</b>
      {state === 'install-first' && <p className="muted small">{n.installFirst}</p>}
      {state === 'unsupported' && <p className="muted small">{n.unsupported}</p>}
      {state === 'denied' && <p className="muted small">{n.denied}</p>}
      {state === 'off' && <>
        <p className="muted small">{n.offHint}</p>
        <button type="button" className="primary block" disabled={act.busy || !ready}
          onClick={() => { if (ready) void act.run(async () => setState(await enablePush(ready.reg, ready.key, lang)), n.onNow)
            .then(async okd => { if (!okd) setState(await pushState()); }); }}>{n.enable}</button>
      </>}
      {state === 'on' && <>
        <p className="muted small">{n.onHint}</p>
        <div className="row wrap">
          <button type="button" disabled={act.busy} onClick={() => { let r = { devices: 0, sent: 0 };
            void act.run(async () => { r = await testPush(); }).then(okd => { if (okd) act.setMsg(r.sent ? { ok: true, text: n.testSent } : { ok: false, text: r.devices ? n.testFailed : n.testWait }); }); }}>{n.test}</button>
          <button type="button" disabled={act.busy} onClick={() => void act.run(async () => { await disablePush(); setState('off'); }, n.offNow)}>{n.disable}</button>
        </div>
      </>}
      <Note msg={act.msg} />
    </div>
  );
}
