import { useI18n } from './i18n.tsx';
import { useRoute } from './router.ts';
import { TrainingScreen } from '../features/workouts/TrainingScreen.tsx';
import { SpacesScreen, keepInvite } from '../features/workspaces/SpacesScreen.tsx';
import { SpaceScreen } from '../features/workspaces/SpaceScreen.tsx';
import { ProfileScreen } from '../features/profile/ProfileScreen.tsx';
import { config } from '../shared/config.ts';

function Home() {
  const { t } = useI18n();
  return (
    <section className="screen">
      <h1>{t.homeTitle} 👋</h1>
      <p>{t.homeIntro}</p>
      <div className="card"><b>{t.stageNow}</b><ul>{(config.backendReady ? t.stageItemsAccount : t.stageItems).map(x => <li key={x}>✅ {x}</li>)}</ul></div>
      <div className="card"><b>{t.stageNext}</b><ol>{(config.backendReady ? t.nextItems.slice(3) : t.nextItems).map(x => <li key={x}>{x}</li>)}</ol></div>
    </section>
  );
}
const TABS = ['home', 'training', 'spaces', 'profile'] as const;
export function App() {
  const { t } = useI18n();
  const route = useRoute();
  const tab = route.name === 'join' || route.name === 'space' ? 'spaces' : route.name;
  return (
    <>
      <main id="main">
        {route.name === 'home' && <Home />}
        {route.name === 'training' && <TrainingScreen />}
        {route.name === 'spaces' && <SpacesScreen />}
        {route.name === 'join' && <SpacesScreen invite={keepInvite(route.token) ? 'ok' : 'bad'} />}
        {route.name === 'space' && <SpaceScreen id={route.id} tab={route.tab} />}
        {route.name === 'profile' && <ProfileScreen />}
      </main>
      <nav className="tabs" aria-label={t.appName}>
        {TABS.map(x => <a key={x} href={x === 'home' ? '#/' : `#/${x}`} aria-current={tab === x ? 'page' : undefined} className={tab === x ? 'on' : ''}>{t.tabs[x]}</a>)}
      </nav>
    </>
  );
}
