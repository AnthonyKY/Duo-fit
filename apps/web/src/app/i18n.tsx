import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { readLocal, writeLocal } from '../shared/storage.ts';

const fr = {
  appName: 'CollabFit', tabs: { home: 'Accueil', training: 'Entraînement', spaces: 'Groupe', profile: 'Profil' },
  homeTitle: 'Bonjour', homeIntro: 'Ton entraînement reste dans DUOFIT. CollabFit ajoute le partage avec ton couple ou tes amis, à ton rythme et seulement si tu le choisis.',
  stageNow: 'Disponible maintenant', stageNext: 'Prochaines étapes',
  stageItems: ['Avatar généré et nom affiché (sur ce téléphone)', 'Résumé de tes séances DUOFIT (lecture seule)'],
  nextItems: ['Compte et connexion sécurisée', 'Espace Couple (2 personnes) ou Amis (jusqu’à 20) sur invitation', 'Messages et photos privés', 'Notifications de séance, si tu les actives', 'Appels audio / vidéo (en dernier)'],
  trainingTitle: 'Entraînement', openDuofit: 'Ouvrir DUOFIT', him: 'Lui', her: 'Elle', sessions: (n: number) => `${n} séance${n > 1 ? 's' : ''}`,
  lastSession: 'Dernière séance', inProgress: 'Séance en cours', noLegacy: 'Aucune donnée DUOFIT sur ce téléphone pour l’instant.',
  unreadable: 'Les données DUOFIT de ce téléphone sont illisibles ici : DUOFIT reste utilisable normalement.',
  readOnly: 'Lecture seule : CollabFit ne modifie jamais tes séances.', minutes: (m: number) => `${m} min`, workout: 'Séance',
  spacesTitle: 'Couple & amis', spacesSoon: 'Les espaces partagés arrivent à l’étape suivante : il faut d’abord un compte sécurisé.',
  spacesRules: ['Couple : exactement 2 personnes, sur invitation.', 'Amis : 2 à 20 personnes, sur invitation.', 'Tes mesures et ton historique restent privés : seul ce que tu choisis de partager est visible.'],
  inviteReceived: 'Invitation reçue. Elle sera utilisable dès que les comptes seront ouverts.', inviteInvalid: 'Ce lien d’invitation n’est pas valide.',
  profileTitle: 'Profil', displayName: 'Nom affiché', save: 'Enregistrer', saved: 'Enregistré sur ce téléphone.', newAvatar: 'Autre avatar',
  nameEmpty: 'Entre un nom.', nameLong: 'Nom trop long (40 caractères au plus).', language: 'Langue', backend: 'Serveur', backendOff: 'pas encore relié (étape 2)', backendOn: 'relié', version: 'Version',
};
const en: typeof fr = {
  appName: 'CollabFit', tabs: { home: 'Home', training: 'Training', spaces: 'Group', profile: 'Profile' },
  homeTitle: 'Hello', homeIntro: 'Your training stays in DUOFIT. CollabFit adds sharing with your partner or friends, at your pace and only if you choose to.',
  stageNow: 'Available now', stageNext: 'Next steps',
  stageItems: ['Generated avatar and display name (on this phone)', 'Summary of your DUOFIT workouts (read only)'],
  nextItems: ['Account and secure sign-in', 'Couple (2 people) or Friends (up to 20) space, by invitation', 'Private messages and photos', 'Workout notifications, if you turn them on', 'Audio / video calls (last)'],
  trainingTitle: 'Training', openDuofit: 'Open DUOFIT', him: 'Him', her: 'Her', sessions: (n: number) => `${n} workout${n > 1 ? 's' : ''}`,
  lastSession: 'Last workout', inProgress: 'Workout in progress', noLegacy: 'No DUOFIT data on this phone yet.',
  unreadable: 'DUOFIT data on this phone cannot be read here: DUOFIT itself keeps working.',
  readOnly: 'Read only: CollabFit never changes your workouts.', minutes: (m: number) => `${m} min`, workout: 'Workout',
  spacesTitle: 'Couple & friends', spacesSoon: 'Shared spaces come in the next step: a secure account is needed first.',
  spacesRules: ['Couple: exactly 2 people, by invitation.', 'Friends: 2 to 20 people, by invitation.', 'Your measurements and history stay private: only what you choose to share is visible.'],
  inviteReceived: 'Invitation received. It can be used as soon as accounts open.', inviteInvalid: 'This invitation link is not valid.',
  profileTitle: 'Profile', displayName: 'Display name', save: 'Save', saved: 'Saved on this phone.', newAvatar: 'Another avatar',
  nameEmpty: 'Enter a name.', nameLong: 'Name too long (40 characters at most).', language: 'Language', backend: 'Server', backendOff: 'not connected yet (step 2)', backendOn: 'connected', version: 'Version',
};
export type Lang = 'fr' | 'en';
export type Texts = typeof fr;
const DICT: Record<Lang, Texts> = { fr, en };
const Ctx = createContext<{ lang: Lang; t: Texts; setLang: (l: Lang) => void }>({ lang: 'fr', t: fr, setLang: () => {} });

export function I18nProvider({ children }: { children: ReactNode }) {
  const initial: Lang = readLocal('collabfit-lang') === 'en' ? 'en' : readLocal('collabfit-lang') === 'fr' ? 'fr'
    : (globalThis.navigator?.language ?? 'fr').startsWith('fr') ? 'fr' : 'en';
  const [lang, set] = useState<Lang>(initial);
  const value = useMemo(() => ({ lang, t: DICT[lang], setLang: (l: Lang) => { writeLocal('collabfit-lang', l); document.documentElement.lang = l; set(l); } }), [lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useI18n = () => useContext(Ctx);
