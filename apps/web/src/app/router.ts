import { useEffect, useState } from 'react';
// Hash routes work on any static host, including a sub-folder, without server rules.
export type Route = { name: 'home' | 'training' | 'spaces' | 'profile' } | { name: 'join'; token: string } | { name: 'space'; id: string; tab: 'chat' | 'members' };
export function parseRoute(hash: string): Route {
  const h = hash.replace(/^#\/?/, '');
  const join = /^join\/([^/]+)\/?$/.exec(h);
  if (join?.[1]) return { name: 'join', token: join[1] };
  const sp = /^space\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/(members))?\/?$/.exec(h);
  if (sp?.[1]) return { name: 'space', id: sp[1], tab: sp[2] === 'members' ? 'members' : 'chat' };
  if (h === 'training' || h === 'spaces' || h === 'profile') return { name: h };
  return { name: 'home' };
}
export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(globalThis.location?.hash ?? ''));
  useEffect(() => {
    const on = () => setRoute(parseRoute(location.hash));
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return route;
}
