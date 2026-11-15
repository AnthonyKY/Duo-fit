# Créer le Supabase de test (étape 2) — à faire par Invictus, pas à pas

Rien de tout cela n'est utile tant que l'étape 2 (comptes) n'a pas commencé. Claude te dira quand.
**Ne colle jamais dans le chat** : la clé secrète (`sb_secret_…` ou l'ancienne `service_role`), le mot de passe de la base,
un code reçu par e-mail. La seule clé qui peut circuler est la clé **publishable** (`sb_publishable_…`), faite pour être publique.

1. Va sur supabase.com → **Start your project** → crée un compte (GitHub ou e-mail). Active la double authentification
   dans ton compte Supabase (Account → Security).
2. **New project** :
   - Organisation : la tienne (offre gratuite).
   - Nom : `collabfit-staging` (le « de test »). La production sera un AUTRE projet, plus tard.
   - Mot de passe de la base : clique sur **Generate**, enregistre-le dans l'app Mots de passe de l'iPhone. Ne le partage pas.
   - Région : **West EU (Paris)** (`eu-west-3`).
   - Crée le projet, attends 1 à 2 minutes.
3. **Appliquer le schéma** : menu **SQL Editor** → **New query** → colle le contenu de
   `supabase/migrations/202611140001_collabfit_foundation.sql` → **Run**. Puis pareil avec `…0002_collabfit_storage.sql`.
   (Claude te donnera les fichiers prêts à copier.) Vérifie dans **Table Editor** que les tables `profiles`, `workspaces`… existent.
4. **Connexion par lien e-mail** : **Authentication → Sign In / Providers** → Email activé. **Authentication → URL
   Configuration** → Site URL = l'adresse de l'app de test que Claude te donnera.
5. **Les deux valeurs publiques** : **Settings → API Keys** (ou bouton **Connect**) :
   - Project URL : `https://<lettres>.supabase.co`
   - Publishable key : `sb_publishable_…`
   Mets-les dans GitHub, pas dans le chat : dépôt Duo-fit → **Settings → Secrets and variables → Actions → onglet
   Variables → New repository variable** : `COLLABFIT_SUPABASE_URL` puis `COLLABFIT_SUPABASE_ANON_KEY`.
6. Dis à Claude « c'est fait ». Il construira l'app de test avec ces valeurs et lancera les essais à deux comptes.

Bon à savoir : un projet gratuit se met en pause après 7 jours sans activité ; on le relance dans le tableau de bord
(Resume project), les données sont conservées.
