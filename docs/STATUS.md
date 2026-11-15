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
| 3 | Espaces Couple / Amis, invitations | ⏳ |
| 4 | Messages, photos privées, envoi hors ligne | ⏳ |
| 5 | Notifications de séance (opt-in) | ⏳ |
| 6 | Appels audio / vidéo | ⏳ en dernier |

Règle : une fois le schéma installé sur le Supabase de test, il n'est plus modifié ; chaque changement devient un nouveau fichier de migration.
