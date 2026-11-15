import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { readLocal, writeLocal } from '../shared/storage.ts';

const fr = {
  appName: 'CollabFit', tabs: { home: 'Accueil', training: 'Entraînement', spaces: 'Groupe', profile: 'Profil' },
  homeTitle: 'Bonjour', homeIntro: 'Ton entraînement reste dans DUOFIT. CollabFit ajoute le partage avec ton couple ou tes amis, à ton rythme et seulement si tu le choisis.',
  stageNow: 'Disponible maintenant', stageNext: 'Prochaines étapes',
  stageItems: ['Avatar généré et nom affiché (sur ce téléphone)', 'Résumé de tes séances DUOFIT (lecture seule)'],
  stageItemsAccount: ['Compte sécurisé : nom, avatar ou photo de profil', 'Résumé de tes séances DUOFIT (lecture seule)'],
  nextItems: ['Compte et connexion sécurisée', 'Espace Couple (2 personnes) ou Amis (jusqu’à 20) sur invitation', 'Messages et photos privés', 'Notifications de séance, si tu les actives', 'Appels audio / vidéo (en dernier)'],
  trainingTitle: 'Entraînement', openDuofit: 'Ouvrir DUOFIT', him: 'Lui', her: 'Elle', sessions: (n: number) => `${n} séance${n > 1 ? 's' : ''}`,
  lastSession: 'Dernière séance', inProgress: 'Séance en cours', noLegacy: 'Aucune donnée DUOFIT sur ce téléphone pour l’instant.',
  unreadable: 'Les données DUOFIT de ce téléphone sont illisibles ici : DUOFIT reste utilisable normalement.',
  readOnly: 'Lecture seule : CollabFit ne modifie jamais tes séances.', minutes: (m: number) => `${m} min`, workout: 'Séance',
  spacesTitle: 'Couple & amis', spacesSoon: 'Les espaces partagés arrivent à l’étape suivante : il faut d’abord un compte sécurisé.',
  spacesRules: ['Couple : exactement 2 personnes, sur invitation.', 'Amis : 2 à 20 personnes, sur invitation.', 'Tes mesures et ton historique restent privés : seul ce que tu choisis de partager est visible.'],
  inviteReceived: 'Invitation reçue. Elle sera utilisable dès que les comptes seront ouverts.', inviteInvalid: 'Ce lien d’invitation n’est pas valide.',
  profileTitle: 'Profil', displayName: 'Nom affiché', save: 'Enregistrer', saved: 'Enregistré sur ce téléphone.', newAvatar: 'Autre avatar',
  acc: {
    title: 'Compte', signUpTab: 'Créer un compte', signInTab: 'Se connecter', email: 'E-mail', password: 'Mot de passe',
    passwordHint: 'Au moins 10 caractères. Ton iPhone peut en proposer un solide et le retenir pour toi.',
    show: 'Afficher', hide: 'Masquer', create: 'Créer mon compte', signIn: 'Me connecter', working: 'Un instant…',
    checkEmail: 'Compte créé. Ouvre l’e-mail de confirmation, puis reviens te connecter.',
    signedInAs: 'Connecté avec', signOut: 'Se déconnecter', saved: 'Enregistré.',
    photo: 'Photo de profil', choosePhoto: 'Choisir une photo', removePhoto: 'Retirer la photo', photoSaved: 'Photo enregistrée.',
    photoHint: 'Ta photo est recadrée sur ce téléphone avant l’envoi : sa position GPS et ses autres détails cachés ne partent jamais. Visible seulement par les personnes de tes groupes.',
    staging: 'Version de test : les comptes peuvent être effacés pendant les essais.',
    deleteTitle: 'Supprimer mon compte', deleteExplain: 'Efface ton compte, ton profil, ta photo et les photos que tu as envoyées. Tes séances DUOFIT ne sont pas touchées.',
    deleteAsk: 'Pour confirmer, écris SUPPRIMER', deleteWord: 'SUPPRIMER', deleteGo: 'Supprimer définitivement', cancel: 'Annuler', deleted: 'Ton compte a été supprimé.',
    localOnly: 'Les comptes ne sont pas disponibles sur cette version : ton nom et ton avatar restent sur ce téléphone.',
    field: { emailEmpty: 'Entre ton e-mail.', emailInvalid: 'Cet e-mail ne semble pas valide.', pwEmpty: 'Entre ton mot de passe.', pwShort: 'Au moins 10 caractères.', pwLong: 'Mot de passe trop long.' },
    problem: {
      'invalid-credentials': 'E-mail ou mot de passe incorrect.', 'email-taken': 'Un compte existe déjà avec cet e-mail : connecte-toi.',
      'weak-password': 'Mot de passe trop faible : au moins 10 caractères.', 'rate-limited': 'Trop d’essais. Attends une minute et réessaie.',
      'email-invalid': 'Cet e-mail n’est pas accepté.', 'signup-closed': 'Les inscriptions sont fermées pour le moment.',
      'not-confirmed': 'Confirme d’abord ton e-mail avec le lien reçu.', 'session-expired': 'Ta session a expiré : reconnecte-toi.',
      offline: 'Pas de connexion internet. Réessaie une fois en ligne.', unknown: 'Un problème est survenu. Réessaie.',
    },
    photoProblem: { type: 'Choisis une photo (JPEG, PNG ou WebP).', size: 'Photo trop lourde.', empty: 'Photo vide.', unreadable: 'Cette photo n’a pas pu être lue.' },
  },
  nameEmpty: 'Entre un nom.', nameLong: 'Nom trop long (40 caractères au plus).', language: 'Langue', backend: 'Serveur', backendOff: 'pas encore relié (étape 2)', backendOn: 'relié', version: 'Version',
};
const en: typeof fr = {
  appName: 'CollabFit', tabs: { home: 'Home', training: 'Training', spaces: 'Group', profile: 'Profile' },
  homeTitle: 'Hello', homeIntro: 'Your training stays in DUOFIT. CollabFit adds sharing with your partner or friends, at your pace and only if you choose to.',
  stageNow: 'Available now', stageNext: 'Next steps',
  stageItems: ['Generated avatar and display name (on this phone)', 'Summary of your DUOFIT workouts (read only)'],
  stageItemsAccount: ['Secure account: name, avatar or profile photo', 'Summary of your DUOFIT workouts (read only)'],
  nextItems: ['Account and secure sign-in', 'Couple (2 people) or Friends (up to 20) space, by invitation', 'Private messages and photos', 'Workout notifications, if you turn them on', 'Audio / video calls (last)'],
  trainingTitle: 'Training', openDuofit: 'Open DUOFIT', him: 'Him', her: 'Her', sessions: (n: number) => `${n} workout${n > 1 ? 's' : ''}`,
  lastSession: 'Last workout', inProgress: 'Workout in progress', noLegacy: 'No DUOFIT data on this phone yet.',
  unreadable: 'DUOFIT data on this phone cannot be read here: DUOFIT itself keeps working.',
  readOnly: 'Read only: CollabFit never changes your workouts.', minutes: (m: number) => `${m} min`, workout: 'Workout',
  spacesTitle: 'Couple & friends', spacesSoon: 'Shared spaces come in the next step: a secure account is needed first.',
  spacesRules: ['Couple: exactly 2 people, by invitation.', 'Friends: 2 to 20 people, by invitation.', 'Your measurements and history stay private: only what you choose to share is visible.'],
  inviteReceived: 'Invitation received. It can be used as soon as accounts open.', inviteInvalid: 'This invitation link is not valid.',
  profileTitle: 'Profile', displayName: 'Display name', save: 'Save', saved: 'Saved on this phone.', newAvatar: 'Another avatar',
  acc: {
    title: 'Account', signUpTab: 'Create an account', signInTab: 'Sign in', email: 'E-mail', password: 'Password',
    passwordHint: 'At least 10 characters. Your iPhone can suggest a strong one and remember it for you.',
    show: 'Show', hide: 'Hide', create: 'Create my account', signIn: 'Sign me in', working: 'One moment…',
    checkEmail: 'Account created. Open the confirmation e-mail, then come back to sign in.',
    signedInAs: 'Signed in as', signOut: 'Sign out', saved: 'Saved.',
    photo: 'Profile photo', choosePhoto: 'Choose a photo', removePhoto: 'Remove the photo', photoSaved: 'Photo saved.',
    photoHint: 'Your photo is cropped on this phone before upload: its GPS position and other hidden details never leave. Only people in your groups can see it.',
    staging: 'Test version: accounts may be wiped during testing.',
    deleteTitle: 'Delete my account', deleteExplain: 'Erases your account, profile, photo and the pictures you sent. Your DUOFIT workouts are not touched.',
    deleteAsk: 'To confirm, type DELETE', deleteWord: 'DELETE', deleteGo: 'Delete for good', cancel: 'Cancel', deleted: 'Your account has been deleted.',
    localOnly: 'Accounts are not available in this version: your name and avatar stay on this phone.',
    field: { emailEmpty: 'Enter your e-mail.', emailInvalid: 'This e-mail does not look valid.', pwEmpty: 'Enter your password.', pwShort: 'At least 10 characters.', pwLong: 'Password too long.' },
    problem: {
      'invalid-credentials': 'Wrong e-mail or password.', 'email-taken': 'An account already uses this e-mail: sign in.',
      'weak-password': 'Password too weak: at least 10 characters.', 'rate-limited': 'Too many tries. Wait a minute and try again.',
      'email-invalid': 'This e-mail is not accepted.', 'signup-closed': 'Sign-ups are closed for now.',
      'not-confirmed': 'First confirm your e-mail with the link you received.', 'session-expired': 'Your session expired: sign in again.',
      offline: 'No internet connection. Try again once online.', unknown: 'Something went wrong. Try again.',
    },
    photoProblem: { type: 'Choose a photo (JPEG, PNG or WebP).', size: 'Photo too large.', empty: 'Empty photo.', unreadable: 'This photo could not be read.' },
  },
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
