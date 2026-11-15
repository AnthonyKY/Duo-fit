import { useEffect, useState } from 'react';
import { checkWorkspaceName, friendsCapacity, parseInvite, type WorkspaceMode } from '@collabfit/domain';
import { useI18n } from '../../app/i18n.tsx';
import { config } from '../../shared/config.ts';
import { readSession, writeSession } from '../../shared/storage.ts';
import { useSession } from '../../shared/useSession.ts';
import { Note, problemText, useAction } from '../../shared/ui.tsx';
import { acceptInvitation, createSpace, memberCounts, mySpaces, peekInvitation, type InvitePreview, type Space } from './api.ts';

// An invitation link is kept for this visit only (session storage, never long-term), until the person signs in and decides.
export function keepInvite(token: string): boolean {
  const ok = parseInvite(token) !== null;
  writeSession('collabfit-invite', ok ? token : null);
  return ok;
}
const go = (hash: string) => { location.hash = hash; };

function PendingInvite({ token, onDone }: { token: string; onDone: () => void }) {
  const { t } = useI18n();
  const [preview, setPreview] = useState<InvitePreview | null | 'loading' | 'invalid'>('loading');
  const [err, setErr] = useState<string | null>(null);
  const act = useAction();
  useEffect(() => {
    let live = true;
    peekInvitation(token).then(p => live && setPreview(p ?? 'invalid')).catch(e => { if (live) { setPreview(null); setErr(problemText(t, e)); } });
    return () => { live = false; };
  }, [token]);
  const forget = () => { writeSession('collabfit-invite', null); onDone(); };
  if (preview === 'loading') return <p className="card muted">{t.sp.checking}</p>;
  if (preview === 'invalid' || preview === null) return (
    <div className="card"><p className="note err" role="alert">{err ?? t.acc.problem['invite-invalid']}</p><button type="button" onClick={forget}>{t.sp.ignore}</button></div>
  );
  const mode = preview.mode === 'couple' ? t.sp.couple : t.sp.friends;
  return (
    <div className="card invite" aria-labelledby="inv-title">
      <h2 id="inv-title">{t.sp.inviteTitle}</h2>
      <p>{t.sp.inviteFrom(preview.invited_by ?? '—', preview.workspace_name, mode)}</p>
      <p className="muted small">{t.sp.people(preview.members, preview.max_members)}</p>
      <div className="row wrap">
        <button type="button" className="primary" disabled={act.busy} onClick={() => void act.run(async () => {
          const id = await acceptInvitation(token); writeSession('collabfit-invite', null); go(`#/space/${id}`);
        })}>{t.sp.join}</button>
        <button type="button" disabled={act.busy} onClick={forget}>{t.sp.ignore}</button>
      </div>
      <Note msg={act.msg} />
    </div>
  );
}

function CreateSpace({ mode, onCreated }: { mode: WorkspaceMode; onCreated: () => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(mode === 'couple' ? t.sp.coupleDefault : t.sp.friendsDefault);
  const [cap, setCap] = useState(10);
  const act = useAction();
  if (!open) return <button type="button" className={mode === 'couple' ? 'primary block' : 'block'} onClick={() => setOpen(true)}>{mode === 'couple' ? t.sp.newCouple : t.sp.newFriends}</button>;
  const submit = () => {
    const c = checkWorkspaceName(name);
    if (!c.ok) return act.setMsg({ ok: false, text: c.error === 'too-long' ? t.nameLong : t.nameEmpty });
    void act.run(async () => { const id = await createSpace(c.value, mode, friendsCapacity(cap)); onCreated(); go(`#/space/${id}/members`); });
  };
  return (
    <form className="card" onSubmit={e => { e.preventDefault(); submit(); }} data-create={mode}>
      <b>{mode === 'couple' ? t.sp.newCouple : t.sp.newFriends}</b>
      <label className="field"><span>{t.sp.name}</span>
        <input value={name} maxLength={80} onInput={e => setName((e.target as HTMLInputElement).value)} /></label>
      {mode === 'friends' && (
        <label className="field"><span>{t.sp.capacity}</span>
          <select value={cap} onChange={e => setCap(Number(e.target.value))}>
            {Array.from({ length: 19 }, (_, k) => k + 2).map(n => <option key={n} value={n}>{n}</option>)}
          </select></label>
      )}
      <div className="row wrap">
        <button type="submit" className="primary" disabled={act.busy}>{t.sp.create}</button>
        <button type="button" disabled={act.busy} onClick={() => setOpen(false)}>{t.acc.cancel}</button>
      </div>
      <Note msg={act.msg} />
    </form>
  );
}

function MySpaces() {
  const { t } = useI18n();
  const [spaces, setSpaces] = useState<Space[] | null>(null);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(() => readSession('collabfit-invite'));
  const [n, reload] = useState(0);
  useEffect(() => {
    let live = true;
    Promise.all([mySpaces(), memberCounts()]).then(([s, c]) => { if (live) { setSpaces(s); setCounts(c); } }).catch(e => live && setErr(problemText(t, e)));
    return () => { live = false; };
  }, [n]);
  const hasCouple = spaces?.some(s => s.mode === 'couple');
  return (
    <>
      {pending && <PendingInvite token={pending} onDone={() => { setPending(null); reload(n + 1); if (location.hash.startsWith('#/join')) go('#/spaces'); }} />}
      {err && <p className="card note err" role="alert">{err}</p>}
      {spaces === null && !err && <p className="card muted">{t.acc.working}</p>}
      {spaces && (
        <div className="card">
          <b>{t.sp.mine}</b>
          {!spaces.length && <p className="muted">{t.sp.none}</p>}
          <ul className="list">
            {spaces.map(s => (
              <li key={s.id}><a className="space-link" href={`#/space/${s.id}`}>
                <span><b>{s.name}</b><br /><span className="muted small">{s.mode === 'couple' ? t.sp.couple : t.sp.friends} · {t.sp.people(counts.get(s.id) ?? 1, s.max_members)}</span></span>
                <span aria-hidden="true">›</span></a></li>
            ))}
          </ul>
        </div>
      )}
      {spaces && !hasCouple && <CreateSpace mode="couple" onCreated={() => reload(n + 1)} />}
      {spaces && <CreateSpace mode="friends" onCreated={() => reload(n + 1)} />}
      <div className="card muted small"><ul>{t.spacesRules.map(r => <li key={r}>{r}</li>)}</ul></div>
    </>
  );
}

export function SpacesScreen({ invite }: { invite?: 'ok' | 'bad' }) {
  const { t } = useI18n();
  const session = useSession();
  const pending = readSession('collabfit-invite');
  if (config.backendReady && session) return (
    <section className="screen">
      <h1>{t.sp.title}</h1>
      {invite === 'bad' && <p className="card note err" role="alert">{t.inviteInvalid}</p>}
      <MySpaces key={`${session.user.id}-${invite ?? ''}`} />
    </section>
  );
  return (
    <section className="screen">
      <h1>{t.spacesTitle}</h1>
      {invite === 'bad' && <p className="card note err" role="alert">{t.inviteInvalid}</p>}
      {(invite === 'ok' || pending) && invite !== 'bad' && <p className="card note ok" role="status">{config.backendReady ? t.sp.inviteTitle + ' : ' + t.sp.signInFirst : t.inviteReceived}</p>}
      {config.backendReady
        ? <div className="card"><p>{t.sp.signInFirst}</p><a className="button primary block" href="#/profile">{t.sp.goProfile}</a></div>
        : <div className="card"><p>{t.spacesSoon}</p><ul>{t.spacesRules.map(r => <li key={r}>{r}</li>)}</ul></div>}
    </section>
  );
}
