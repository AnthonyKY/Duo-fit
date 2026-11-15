import { useEffect, useState } from 'react';
import { useI18n } from '../../app/i18n.tsx';
import { config } from '../../shared/config.ts';
import { problemText } from '../../shared/ui.tsx';
import { useSession } from '../../shared/useSession.ts';
import { Chat } from '../chat/Chat.tsx';
import { getSpace, type Space } from './api.ts';
import { Members } from './Members.tsx';

export function SpaceScreen({ id, tab }: { id: string; tab: 'chat' | 'members' }) {
  const { t } = useI18n();
  const session = useSession();
  const [space, setSpace] = useState<Space | null | 'gone'>(null);
  const [err, setErr] = useState<string | null>(null);
  const [n, reload] = useState(0);
  useEffect(() => {
    if (!session) return;
    let live = true;
    getSpace(id).then(s => live && setSpace(s ?? 'gone')).catch(e => live && setErr(problemText(t, e)));
    return () => { live = false; };
  }, [id, n, session?.user.id]);
  if (!config.backendReady || !session) return (
    <section className="screen"><h1>{t.sp.title}</h1><div className="card"><p>{t.sp.signInFirst}</p><a className="button primary block" href="#/profile">{t.sp.goProfile}</a></div></section>
  );
  return (
    <section className="screen">
      <a className="back" href="#/spaces">{t.sp.back}</a>
      {err && <p className="card note err" role="alert">{err}</p>}
      {space === 'gone' && <p className="card note err" role="alert">{t.acc.problem['not-found']}</p>}
      {space === null && !err && <p className="card muted">{t.acc.working}</p>}
      {space && space !== 'gone' && (
        <>
          <h1>{space.name} <span className="muted small">{space.mode === 'couple' ? t.sp.couple : t.sp.friends}</span></h1>
          <div className="seg wide" role="tablist">
            {(['chat', 'members'] as const).map(x => (
              <a key={x} role="tab" aria-selected={tab === x} className={`button ${tab === x ? 'on' : ''}`} href={`#/space/${space.id}${x === 'members' ? '/members' : ''}`}>{t.sp.tabs[x]}</a>
            ))}
          </div>
          {tab === 'chat' ? <Chat key={space.id} space={space} /> : <Members space={space} onChange={() => reload(n + 1)} />}
        </>
      )}
    </section>
  );
}
