import { useEffect, useState } from 'react';
// Hash routes work on any static host, including a sub-folder, without server rules.
export type Route = { name: 'home' | 'training' | 'spaces' | 'profile' } | { name: 'join'; token: string };
export function parseRoute(hash: string): Route {
  const h = hash.replace(/^#\/?/, '');
  const join = /^join\/([^/]+)\/?$/.exec(h);
  if (join?.[1]) return { name: 'join', token: join[1] };
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
