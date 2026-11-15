import { readDuofit } from '@collabfit/domain';
import { useI18n } from '../../app/i18n.tsx';
import { config } from '../../shared/config.ts';
import { readLocal } from '../../shared/storage.ts';
import { useSession } from '../../shared/useSession.ts';
import { Training } from './Training.tsx';

export function TrainingScreen() {
  const session = useSession();
  if (config.backendReady && session) return <Training />;
  return <Legacy signedOut={config.backendReady} />;
}

// without an account (or a build without a server): DUOFIT's own data on this phone, read only, and the way to DUOFIT
function Legacy({ signedOut }: { signedOut: boolean }) {
  const { t, lang } = useI18n();
  const data = readDuofit(readLocal('duofit'));
  const day = (ms: number) => new Date(ms).toLocaleDateString(lang, { weekday: 'short', day: 'numeric', month: 'short' });
  return (
    <section className="screen">
      <h1>{t.trainingTitle}</h1>
      {signedOut && <div className="card"><p>{t.tr.signIn}</p><a className="button block" href="#/profile">{t.sp.goProfile}</a></div>}
      <a className="button primary block" href={config.legacyUrl}>{t.openDuofit}</a>
      {!data.ok && <p className="card muted">{data.reason === 'missing' ? t.noLegacy : t.unreadable}</p>}
      {data.ok && data.profiles.map(s => (
        <div className="card" key={s.profile} data-profile={s.profile}>
          <div className="row between"><b>{s.profile === 'M' ? t.him : t.her}</b><span className="muted">{t.sessions(s.sessions)}</span></div>
          {s.inProgress && <p className="live">● {t.inProgress} · {t.workout} {s.inProgress.workout}</p>}
          {s.last && <p>{t.lastSession} : {t.workout} {s.last.workout} · {day(s.last.date)}{s.last.minutes ? ' · ' + t.minutes(s.last.minutes) : ''}</p>}
        </div>
      ))}
      <p className="muted small">{t.readOnly}</p>
    </section>
  );
}
