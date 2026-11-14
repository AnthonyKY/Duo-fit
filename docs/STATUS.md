# CollabFit — où on en est

Chef d'orchestre : Claude. Assistant : Astra (ChatGPT), sur des branches `astra/…`, relues avant intégration.
Rien n'est fusionné dans `main` sans l'accord d'Invictus. DUOFIT (racine du dépôt) n'est pas modifié et reste testé.

| Étape | Contenu | État |
|-------|---------|------|
| 0 | Audit de la PR #5, architecture modulaire, CI | ✅ fait (branche `claude/collabfit-foundation`) |
| 1 | Schéma sécurisé + tests d'attaque (5 utilisateurs, entrées simultanées) + relecture d'Astra (3 failles corrigées) | ✅ fait, 98 vérifications sur PostgreSQL ; Supabase de test en cours de création |
| 2 | Comptes (lien e-mail), profil, avatar | ⏳ demande le Supabase de test (docs/GUIDE-SUPABASE.md) |
| 3 | Espaces Couple / Amis, invitations | ⏳ |
| 4 | Messages, photos privées, envoi hors ligne | ⏳ |
| 5 | Notifications de séance (opt-in) | ⏳ |
| 6 | Appels audio / vidéo | ⏳ en dernier |

Règle : une fois le schéma installé sur le Supabase de test, il n'est plus modifié ; chaque changement devient un nouveau fichier de migration.
