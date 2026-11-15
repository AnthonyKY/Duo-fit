import { useState, type FormEvent } from 'react';
import { checkDisplayName, checkEmail, checkPassword } from '@collabfit/domain';
import { useI18n } from '../../app/i18n.tsx';
import { BackendError, signIn, signUp } from '../../shared/backend.ts';
import { readSession } from '../../shared/storage.ts';

// signed in with an invitation waiting: show it straight away
const toInvite = () => { if (readSession('collabfit-invite')) location.hash = '#/spaces'; };

// Sign-up / sign-in with e-mail + password. Real <form> fields with the right autocomplete hints, so the iPhone offers
// a strong password and saves it in the Keychain. The page never navigates (the security policy forbids form posts).
export function AuthCard({ defaultName }: { defaultName: string }) {
  const { t } = useI18n();
  const a = t.acc;
  const [mode, setMode] = useState<'up' | 'in'>('up');
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const val = (e: Event) => (e.target as HTMLInputElement).value;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const n = checkDisplayName(name), m = checkEmail(email), p = checkPassword(pw);
    if (mode === 'up' && !n.ok) return setMsg({ ok: false, text: n.error === 'too-long' ? t.nameLong : t.nameEmpty });
    if (!m.ok) return setMsg({ ok: false, text: m.error === 'empty' ? a.field.emailEmpty : a.field.emailInvalid });
    if (mode === 'in' && !pw) return setMsg({ ok: false, text: a.field.pwEmpty });
    if (mode === 'up' && !p.ok) return setMsg({ ok: false, text: p.error === 'empty' ? a.field.pwEmpty : p.error === 'long' ? a.field.pwLong : a.field.pwShort });
    setBusy(true); setMsg(null);
    try {
      if (mode === 'up') {
        const r = await signUp(m.value, pw, n.ok ? n.value : '');
        if (r === 'check-email') setMsg({ ok: true, text: a.checkEmail }); else toInvite();
      } else { await signIn(m.value, pw); toInvite(); }
    } catch (err) {
      setMsg({ ok: false, text: a.problem[err instanceof BackendError ? err.problem : 'unknown'] });
    } finally { setBusy(false); }
  };

  return (
    <form className="card" onSubmit={submit} noValidate aria-labelledby="acc-title">
      <h2 id="acc-title">{a.title}</h2>
      <div className="seg wide" role="tablist">
        {(['up', 'in'] as const).map(x => (
          <button key={x} type="button" role="tab" aria-selected={mode === x} className={mode === x ? 'on' : ''}
            onClick={() => { setMode(x); setMsg(null); }}>{x === 'up' ? a.signUpTab : a.signInTab}</button>
        ))}
      </div>
      {mode === 'up' && (
        <label className="field"><span>{t.displayName}</span>
          <input name="nickname" value={name} maxLength={60} autoComplete="nickname" onInput={e => setName(val(e.nativeEvent))} /></label>
      )}
      <label className="field"><span>{a.email}</span>
        <input name="email" type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false}
          autoComplete={mode === 'up' ? 'email' : 'username'} value={email} onInput={e => setEmail(val(e.nativeEvent))} /></label>
      <label className="field"><span>{a.password}</span>
        <span className="pw">
          <input name="password" type={showPw ? 'text' : 'password'} autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
            minLength={mode === 'up' ? 10 : undefined} value={pw} onInput={e => setPw(val(e.nativeEvent))} />
          <button type="button" className="ghost" aria-pressed={showPw} onClick={() => setShowPw(!showPw)}>{showPw ? a.hide : a.show}</button>
        </span></label>
      {mode === 'up' && <p className="muted small">{a.passwordHint}</p>}
      <button type="submit" className="primary block" disabled={busy}>{busy ? a.working : mode === 'up' ? a.create : a.signIn}</button>
      {msg && <p className={msg.ok ? 'note ok' : 'note err'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
    </form>
  );
}
