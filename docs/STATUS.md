# CollabFit — où on en est

Chef d'orchestre : Claude. Assistant : Astra (ChatGPT), sur des branches `astra/…`, relues avant intégration.
Rien n'est fusionné dans `main` sans l'accord d'Invictus. DUOFIT (racine du dépôt) n'est pas modifié et reste testé.

| Étape | Contenu | État |
|-------|---------|------|
| 0 | Audit de la PR #5, architecture modulaire, CI | ✅ fait (branche `claude/collabfit-foundation`) |
| 1 | Schéma sécurisé + tests d'attaque (5 utilisateurs, entrées simultanées) | ✅ fait, testé sur PostgreSQL ; pas encore sur Supabase |
| 2 | Comptes (lien e-mail), profil, avatar | ⏳ demande le Supabase de test (docs/GUIDE-SUPABASE.md) |
| 3 | Espaces Couple / Amis, invitations | ⏳ |
| 4 | Messages, photos privées, envoi hors ligne | ⏳ |
| 5 | Notifications de séance (opt-in) | ⏳ |
| 6 | Appels audio / vidéo | ⏳ en dernier |
