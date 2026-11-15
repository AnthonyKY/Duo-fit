# CollabFit — où on en est

Chef d'orchestre : Claude. Assistant : Astra (ChatGPT), sur des branches `astra/…`, relues avant intégration.
Rien n'est fusionné dans `main` sans l'accord d'Invictus. DUOFIT (racine du dépôt) n'est pas modifié et reste testé.
DUOFIT reste en place pour de bon ; toute reprise de ses données = une copie, avec l'accord d'Invictus avant (ADR 0004).
App de test : https://luxury-brigadeiros-384c85.netlify.app (Supabase de test « collabfit-staging », Paris).

| Étape | Contenu | État |
|-------|---------|------|
| 0 | Audit de la PR #5, architecture modulaire, CI | ✅ fait (branche `claude/collabfit-foundation`) |
| 1 | Schéma sécurisé + tests d'attaque + relectures d'Astra (photos liées aux messages, suppression de compte) | ✅ fait : 117 vérifications sur PostgreSQL, installé et vérifié sur le Supabase de test (droits réels, scénario avec comptes fictifs) |
| 2 | Comptes (e-mail + mot de passe), profil, avatar ou photo, déconnexion, suppression du compte | ✅ sur l'app de test (inscription sans e-mail de confirmation sur le test uniquement) ; à valider sur l'iPhone d'Invictus |
| 3 | Espaces Couple / Amis, invitations (lien partagé ou collé dans l'app), membres, retrait, transfert, blocage, départ | ✅ sur l'app de test, parcours réel à deux comptes vert (Chromium + WebKit) |
| 4 | Messages en direct (Supabase Realtime), photos privées (liens 60 s), suppression, envoi hors ligne sans doublon | ✅ sur l'app de test : messages reçus en 0,3–0,9 s sur le vrai Supabase |
| 5 | Notifications (séance commencée / terminée, nouveaux messages), opt-in | ⏳ décision d'Invictus : d'où viennent les séances (DUOFIT et CollabFit n'ont pas la même adresse) |
| 6 | Appels audio / vidéo | ⏳ en dernier ; décision d'Invictus : service de relais (Cloudflare, 1 000 Go/mois gratuits) |

Règle : une fois le schéma installé sur le Supabase de test, il n'est plus modifié ; chaque changement devient un nouveau fichier de migration.
