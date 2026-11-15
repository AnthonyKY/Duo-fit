import { useState } from 'react';
import { checkDisplayName } from '@collabfit/domain';
import { useI18n } from '../../app/i18n.tsx';
import { config } from '../../shared/config.ts';
import { Avatar } from './Avatar.tsx';
import { loadProfile, newSeed, saveProfile } from './localProfile.ts';
import { AccountProfile } from './AccountProfile.tsx';
import { AuthCard } from '../auth/AuthCard.tsx';
import { useSession } from '../../shared/useSession.ts';

function LanguageCard() {
  const { t, lang, setLang } = useI18n();
  return (
    <>
    {/* DUOFIT stays the owner's own app, at its own address (ADR 0004): always one tap away, signed in or not */}
    <div className="card" data-duofit><a className="button block duofit-link" href={config.legacyUrl}>{t.openDuofit}</a></div>
    <div className="card">
      <div className="row between"><span>{t.language}</span>
        <span className="seg">{(['fr', 'en'] as const).map(l => <button key={l} type="button" aria-pressed={lang === l} className={lang === l ? 'on' : ''} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}</span>
      </div>
      <p className="muted">{t.backend} : {config.backendReady ? t.backendOn : t.backendOff} · {t.version} {config.version}</p>
    </div>
    </>
  );
}

export function ProfileScreen() {
  const { t } = useI18n();
  const session = useSession();
  if (config.backendReady) return (
    <section className="screen">
      <h1>{t.profileTitle}</h1>
      {session ? <AccountProfile key={session.user.id} session={session} /> : <AuthCard defaultName={loadProfile().name} />}
      <LanguageCard />
    </section>
  );
  return <LocalProfileScreen />;
}

function LocalProfileScreen() {
  const { t } = useI18n();
  const [p, setP] = useState(loadProfile);
  const [name, setName] = useState(p.name);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = () => {
    const c = checkDisplayName(name);
    if (!c.ok) { setMsg({ ok: false, text: c.error === 'too-long' ? t.nameLong : t.nameEmpty }); return; }
    const next = { ...p, name: c.value };
    setP(next); setName(c.value);
    setMsg(saveProfile(next) ? { ok: true, text: t.saved } : { ok: false, text: '⚠️' });
  };
  return (
    <section className="screen">
      <h1>{t.profileTitle}</h1>
      <div className="card row">
        <Avatar seed={p.seed} name={name || p.name} />
        <button type="button" onClick={() => { const next = { ...p, seed: newSeed() }; setP(next); saveProfile(next); }}>{t.newAvatar}</button>
      </div>
      <div className="card">
        <label className="field">
          <span>{t.displayName}</span>
          <input value={name} maxLength={60} autoComplete="nickname" onInput={e => { setName((e.target as HTMLInputElement).value); setMsg(null); }} />
        </label>
        <button type="button" className="primary" onClick={save}>{t.save}</button>
        {msg && <p className={msg.ok ? 'note ok' : 'note err'} role="status">{msg.text}</p>}
      </div>
      <LanguageCard />
    </section>
  );
}
