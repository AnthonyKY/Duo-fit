import { useEffect, useRef, useState } from 'react';
import { avatarPath, checkDisplayName } from '@collabfit/domain';
import { useI18n } from '../../app/i18n.tsx';
import { forgetThisDevice } from '../notifications/push.ts';
import { BackendError, deleteAccount, myProfile, removeFile, signOut, updateProfile, uploadFile, type Profile, type Session } from '../../shared/backend.ts';
import { PhotoOrAvatar } from './PhotoOrAvatar.tsx';
import { newSeed } from './localProfile.ts';
import { squarePhoto } from './photo.ts';

type Msg = { ok: boolean; text: string } | null;

export function AccountProfile({ session }: { session: Session }) {
  const { t } = useI18n();
  const a = t.acc;
  const [p, setP] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [photoMsg, setPhotoMsg] = useState<Msg>(null);
  const [del, setDel] = useState<{ open: boolean; word: string; msg: Msg }>({ open: false, word: '', msg: null });
  const fileInput = useRef<HTMLInputElement>(null);
  const fail = (e: unknown) => a.problem[e instanceof BackendError ? e.problem : 'unknown'];

  useEffect(() => {
    let live = true;
    myProfile().then(x => { if (live && x) { setP(x); setName(x.display_name); } }).catch(e => live && setMsg({ ok: false, text: fail(e) }));
    return () => { live = false; };
  }, [session.user.id]);

  const run = async (job: () => Promise<void>, set: (m: Msg) => void, ok: string) => {
    if (busy) return; setBusy(true); set(null);
    try { await job(); set({ ok: true, text: ok }); } catch (e) { set({ ok: false, text: fail(e) }); } finally { setBusy(false); }
  };
  const saveName = () => {
    const c = checkDisplayName(name);
    if (!c.ok) return setMsg({ ok: false, text: c.error === 'too-long' ? t.nameLong : t.nameEmpty });
    return run(async () => { await updateProfile({ display_name: c.value }); setName(c.value); setP(x => x && { ...x, display_name: c.value }); }, setMsg, a.saved);
  };
  const otherAvatar = () => run(async () => { const seed = newSeed(); await updateProfile({ avatar_seed: seed }); setP(x => x && { ...x, avatar_seed: seed }); }, setMsg, a.saved);
  const pickPhoto = async (file: File | undefined) => {
    if (!file || !p) return;
    const blob = await squarePhoto(file);
    if (typeof blob === 'string') return setPhotoMsg({ ok: false, text: a.photoProblem[blob] });
    const old = p.avatar_path;
    await run(async () => {
      const path = avatarPath(session.user.id, crypto.randomUUID(), 'jpg');
      await uploadFile('avatars', path, blob);
      await updateProfile({ avatar_path: path });
      setP(x => x && { ...x, avatar_path: path });
      if (old) await removeFile('avatars', old).catch(() => { /* removed at account deletion anyway */ });
    }, setPhotoMsg, a.photoSaved);
  };
  const removePhoto = () => run(async () => {
    const old = p?.avatar_path; if (!old) return;
    await updateProfile({ avatar_path: null }); setP(x => x && { ...x, avatar_path: null });
    await removeFile('avatars', old).catch(() => { /* removed at account deletion anyway */ });
  }, setPhotoMsg, a.saved);
  const confirmDelete = async () => {
    if (del.word.trim().toUpperCase() !== a.deleteWord || busy) return;
    setBusy(true);
    try { await deleteAccount(); } catch (e) { setDel(d => ({ ...d, msg: { ok: false, text: fail(e) } })); } finally { setBusy(false); }
  };

  if (!p) return <div className="card"><p className="muted">{msg ? <span className="err" role="alert">{msg.text}</span> : a.working}</p></div>;
  return (
    <>
      <div className="card">
        <div className="row">
          <PhotoOrAvatar p={p} />
          <div className="grow">
            <b>{p.display_name}</b>
            <p className="muted small">{a.signedInAs} {session.user.email}</p>
          </div>
        </div>
        <label className="field"><span>{t.displayName}</span>
          <input value={name} maxLength={60} autoComplete="nickname" onInput={e => { setName((e.target as HTMLInputElement).value); setMsg(null); }} /></label>
        <div className="row wrap">
          <button type="button" className="primary" disabled={busy} onClick={saveName}>{t.save}</button>
          {!p.avatar_path && <button type="button" disabled={busy} onClick={otherAvatar}>{t.newAvatar}</button>}
        </div>
        {msg && <p className={msg.ok ? 'note ok' : 'note err'} role="status">{msg.text}</p>}
      </div>
      <div className="card">
        <b>{a.photo}</b>
        <input ref={fileInput} className="hidden" type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; void pickPhoto(f); }} />
        <div className="row wrap">
          <button type="button" disabled={busy} onClick={() => fileInput.current?.click()}>{a.choosePhoto}</button>
          {p.avatar_path && <button type="button" disabled={busy} onClick={removePhoto}>{a.removePhoto}</button>}
        </div>
        <p className="muted small">{a.photoHint}</p>
        {photoMsg && <p className={photoMsg.ok ? 'note ok' : 'note err'} role="status">{photoMsg.text}</p>}
      </div>
      <div className="card">
        <button type="button" className="block" disabled={busy} onClick={() => void forgetThisDevice().then(signOut)}>{a.signOut}</button>
        <p className="muted small">{a.staging}</p>
      </div>
      <div className="card danger">
        <b>{a.deleteTitle}</b>
        <p className="muted small">{a.deleteExplain}</p>
        {!del.open ? <button type="button" className="danger-btn" onClick={() => setDel({ open: true, word: '', msg: null })}>{a.deleteTitle}</button> : (
          <>
            <label className="field"><span>{a.deleteAsk}</span>
              <input value={del.word} autoCapitalize="characters" autoComplete="off" onInput={e => setDel(d => ({ ...d, word: (e.target as HTMLInputElement).value }))} /></label>
            <div className="row wrap">
              <button type="button" className="danger-btn" disabled={busy || del.word.trim().toUpperCase() !== a.deleteWord} onClick={() => void confirmDelete()}>{busy ? a.working : a.deleteGo}</button>
              <button type="button" disabled={busy} onClick={() => setDel({ open: false, word: '', msg: null })}>{a.cancel}</button>
            </div>
            {del.msg && <p className="note err" role="alert">{del.msg.text}</p>}
          </>
        )}
      </div>
    </>
  );
}
