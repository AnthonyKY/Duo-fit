# CollabFit — où on en est

Chef d'orchestre : Claude. Assistant : Astra (ChatGPT), sur des branches `astra/…`, relues avant intégration.
Rien n'est fusionné dans `main` sans l'accord d'Invictus. DUOFIT (racine du dépôt) n'est pas modifié et reste testé.
DUOFIT reste en place pour de bon ; toute reprise de ses données = une copie, avec l'accord d'Invictus avant (ADR 0004).
CollabFit = app complète et autonome (entraînement + social), à commercialiser plus tard ; moteur d'entraînement = celui de DUOFIT, copié à l'identique et prouvé (ADR 0005).
Corrections DUOFIT : PR #8 fusionnée dans `main` le 15/11/2026 avec l'accord d'Invictus (avance rapide, commit testé f0bd7d6 = v2026-11-15a, en ligne sur GitHub Pages, copie de version gardée ; v2026-11-14q reste disponible). Le moteur de CollabFit est copié de ce même commit. L'aperçu /duofit-preview/ est désormais identique au vrai DUOFIT : à retirer au prochain déploiement de l'app.
App de test : https://luxury-brigadeiros-384c85.netlify.app (Supabase de test « collabfit-staging », Paris). Elle n'est reconstruite (15 crédits Netlify) que si un chemin de `scripts/app-paths.txt` change — liste unique pour Netlify et le workflow de test, vérifiée par `scripts/check-app-paths.mjs`.

| Étape | Contenu | État |
|-------|---------|------|
| 0 | Audit de la PR #5, architecture modulaire, CI | ✅ fait (branche `claude/collabfit-foundation`) |
| 1 | Schéma sécurisé + tests d'attaque + relectures d'Astra (photos liées aux messages, suppression de compte) | ✅ fait : 117 vérifications sur PostgreSQL, installé et vérifié sur le Supabase de test (droits réels, scénario avec comptes fictifs) |
| 2 | Comptes (e-mail + mot de passe), profil, avatar ou photo, déconnexion, suppression du compte | ✅ sur l'app de test (inscription sans e-mail de confirmation sur le test uniquement) ; à valider sur l'iPhone d'Invictus |
| 3 | Espaces Couple / Amis, invitations (lien partagé ou collé dans l'app), membres, retrait, transfert, blocage, départ | ✅ sur l'app de test, parcours réel à deux comptes vert (Chromium + WebKit) |
| 4 | Messages en direct (Supabase Realtime), photos privées (liens 60 s), suppression, envoi hors ligne sans doublon | ✅ sur l'app de test : messages reçus en 0,3–0,9 s sur le vrai Supabase |
| 4b | Entraînement dans CollabFit : réglages, séance du jour (moteur DUOFIT), séance guidée, historique, synchronisé au compte (choix 1A), « a commencé / a terminé sa séance » partagé si activé | ✅ sur l'app de test ; moteur identique à DUOFIT (2 822/2 822) ; parcours réel vert (Chromium + WebKit) ; deux téléphones : séances réunies, réglages les plus récents gardés (relecture d'Astra) |
| 5 | Notifications push (messages, séances des autres), opt-in par appareil et par espace (ADR 0006) | 🧪 code et tests faits (base 36 vérifications, chiffrement prouvé contre l'implémentation de référence, appli 17 vérifications) ; installé sur le Supabase de test ; à déployer sur l'appli de test puis à essayer sur l'iPhone (app ouverte depuis l'écran d'accueil) |
| 6 | Appels audio / vidéo | ⏳ en dernier ; décidé : relais Cloudflare (gratuit à cette échelle), compte à créer par Invictus |
| — | Dans la séance CollabFit, encore à reprendre de DUOFIT : minuteurs d'exercice, échauffement guidé, mode « dos », remplacer / ajouter un exercice, composition corporelle, sauvegarde/import (copie) | ⏳ |

Règle : une fois le schéma installé sur le Supabase de test, il n'est plus modifié ; chaque changement devient un nouveau fichier de migration.
