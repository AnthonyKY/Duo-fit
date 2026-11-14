import { parseInvite } from '@collabfit/domain';
import { useI18n } from '../../app/i18n.tsx';
import { readSession, writeSession } from '../../shared/storage.ts';

// An invitation link opened before accounts exist is kept for this visit only (never in long-term storage).
export function keepInvite(token: string): boolean {
  const ok = parseInvite(token) !== null;
  writeSession('collabfit-invite', ok ? token : null);
  return ok;
}
export function SpacesScreen({ invite }: { invite?: 'ok' | 'bad' }) {
  const { t } = useI18n();
  const pending = readSession('collabfit-invite');
  return (
    <section className="screen">
      <h1>{t.spacesTitle}</h1>
      {invite === 'bad' && <p className="card note err" role="alert">{t.inviteInvalid}</p>}
      {(invite === 'ok' || pending) && invite !== 'bad' && <p className="card note ok" role="status">{t.inviteReceived}</p>}
      <div className="card"><p>{t.spacesSoon}</p><ul>{t.spacesRules.map(r => <li key={r}>{r}</li>)}</ul></div>
    </section>
  );
}
