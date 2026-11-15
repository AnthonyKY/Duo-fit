import { useEffect, useState } from 'react';
import { currentSession, onSession, type Session } from './backend.ts';
export function useSession(): Session | null {
  const [s, setS] = useState(currentSession);
  useEffect(() => onSession(setS), []);
  return s;
}
