# Mise en route de la distribution multicomptes (TikTok + Instagram)

Ce guide liste **uniquement** les actions qui demandent votre intervention, dans l'ordre.
Rien ici ne touche vos clients : faites le pilote avec **vos propres comptes** (voir `docs/PILOT_TEST.md`).

## 0. Avant tout : sauvegarde
Les migrations 0006/0007 ne modifient aucune table existante (elles ajoutent seulement des tables, des fonctions,
un bucket et une tâche planifiée), mais faites quand même une copie :
- Supabase → **Database → Backups** : si votre plan en propose, notez la date de la dernière sauvegarde.
- Sinon, copie manuelle (terminal ; l'URL est dans Project Settings → Database → Connection string) :
```bash
npx supabase db dump --db-url "VOTRE_URL_DE_CONNEXION" -f backup_schema.sql
```
```bash
npx supabase db dump --db-url "VOTRE_URL_DE_CONNEXION" --data-only -f backup_data.sql
```
Retour arrière complet : `docs/rollback_0006_0007.sql` (à lancer à la main, uniquement si besoin).

## 1. Base de données (Supabase → SQL Editor)
Prérequis : 0001 à 0005 déjà appliquées (c'est le cas).
1. Collez `supabase/migrations/0006_distribution.sql` → **Run**. Vérifiez « Success ».
2. **Ne lancez pas encore 0007** : le moteur ne doit tourner qu'une fois les fonctions déployées (étape 4).

## 2. Secrets (Supabase → Edge Functions → Secrets)
| Secret | Valeur |
|---|---|
| `TOKEN_ENCRYPTION_KEY` | 32 octets aléatoires en base64 : `openssl rand -base64 32`. Ne plus jamais la changer (sinon reconnexion de tous les comptes). Gardez-en une copie dans un gestionnaire de mots de passe. |
| `APP_URL` | l'adresse de votre site (retour après connexion), ex. `https://storyit.io` |
| `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | depuis l'app TikTok (étape 3) |
| `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` | depuis l'app Meta (étape 3) |
| `PUBLISHER_DISABLED` | (optionnel) `true` = arrêt d'urgence du moteur sans toucher la base |
Ne mettez **pas** `TIKTOK_APP_AUDITED` tant que TikTok n'a pas audité l'app.

## 3. Applications des plateformes
**TikTok** (developers.tiktok.com) :
- Produits **Login Kit** + **Content Posting API** (activer *Direct Post*).
- Scopes : `user.info.basic`, `user.info.profile`, `video.publish`.
- Redirect URI : `https://hubkgvfiiszthzqyfguf.supabase.co/functions/v1/social/callback/tiktok`
- Avant audit : posts **privés uniquement** (« Only me ») et nombre d'utilisateurs limité. Pour l'audit, TikTok vérifie
  l'écran de publication : Storyit affiche le nom du créateur, la visibilité à choisir, les interactions, la divulgation
  commerciale et la déclaration exigée.

**Meta / Instagram** (developers.facebook.com) :
- Produit **Instagram → API with Instagram Login**.
- Permissions : `instagram_business_basic`, `instagram_business_content_publish`.
- Redirect URI : `https://hubkgvfiiszthzqyfguf.supabase.co/functions/v1/social/callback/instagram`
- En mode développement, ajoutez votre compte Instagram comme **testeur** de l'app (rôles de l'app). Les comptes des
  clients nécessiteront l'**App Review** de Meta.
- Le compte doit être **professionnel** (Business ou Créateur).

## 4. Déployer les fonctions (terminal)
```bash
npx supabase functions deploy social --project-ref hubkgvfiiszthzqyfguf --no-verify-jwt
```
```bash
npx supabase functions deploy publisher --project-ref hubkgvfiiszthzqyfguf --no-verify-jwt
```
```bash
npx supabase functions deploy captions --project-ref hubkgvfiiszthzqyfguf
```
`social` et `publisher` vérifient eux-mêmes qui les appelle (`publisher` n'accepte que la clé service).

## 5. Activer le moteur (chaque minute)
1. Supabase → Project Settings → **Vault** → *New secret* : nom `publisher_service_key`, valeur = clé **service_role**
   (Project Settings → API ; la même que le secret `SUPABASE_SERVICE_ROLE_KEY` des fonctions).
2. SQL Editor : collez `supabase/migrations/0007_publisher_cron.sql` → **Run**.
3. Contrôle (SQL Editor) — doit lister des appels avec le statut 200 après 2 minutes :
```sql
select status_code, left(content::text, 120), created from net._http_response order by created desc limit 5;
```

## Arrêter le moteur
- Immédiat, sans toucher la base : secret `PUBLISHER_DISABLED=true`.
- Arrêt de la tâche planifiée : `select cron.unschedule('storyit-publisher');`
- Une campagne précise : bouton **Pause** dans le Calendrier (plus aucune publication de cette campagne ne part).
