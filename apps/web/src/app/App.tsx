import { useI18n } from './i18n.tsx';
import { useRoute } from './router.ts';
import { TrainingScreen } from '../features/workouts/TrainingScreen.tsx';
import { SpacesScreen, keepInvite } from '../features/workspaces/SpacesScreen.tsx';
import { ProfileScreen } from '../features/profile/ProfileScreen.tsx';

function Home() {
  const { t } = useI18n();
  return (
    <section className="screen">
      <h1>{t.homeTitle} 👋</h1>
      <p>{t.homeIntro}</p>
      <div className="card"><b>{t.stageNow}</b><ul>{t.stageItems.map(x => <li key={x}>✅ {x}</li>)}</ul></div>
      <div className="card"><b>{t.stageNext}</b><ol>{t.nextItems.map(x => <li key={x}>{x}</li>)}</ol></div>
    </section>
  );
}
const TABS = ['home', 'training', 'spaces', 'profile'] as const;
export function App() {
  const { t } = useI18n();
  const route = useRoute();
  const tab = route.name === 'join' ? 'spaces' : route.name;
  return (
    <>
      <main id="main">
        {route.name === 'home' && <Home />}
        {route.name === 'training' && <TrainingScreen />}
        {route.name === 'spaces' && <SpacesScreen />}
        {route.name === 'join' && <SpacesScreen invite={keepInvite(route.token) ? 'ok' : 'bad'} />}
        {route.name === 'profile' && <ProfileScreen />}
      </main>
      <nav className="tabs" aria-label={t.appName}>
        {TABS.map(x => <a key={x} href={x === 'home' ? '#/' : `#/${x}`} aria-current={tab === x ? 'page' : undefined} className={tab === x ? 'on' : ''}>{t.tabs[x]}</a>)}
      </nav>
    </>
  );
}
