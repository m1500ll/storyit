# Mise en route de la distribution multicomptes (TikTok + Instagram)

Ce guide liste **uniquement** les actions qui demandent votre intervention. Faites-les dans l'ordre.

## 1. Base de données (Supabase → SQL Editor)
1. Ouvrez `supabase/migrations/0006_distribution.sql`, copiez tout, collez dans le SQL Editor, cliquez **Run**.
2. Supabase → Project Settings → **Vault** → *New secret* : nom `publisher_service_key`, valeur = votre clé `service_role` (Project Settings → API).
3. Ouvrez `supabase/migrations/0007_publisher_cron.sql`, copiez, collez, **Run**. Le moteur tourne alors chaque minute, même navigateur fermé.

## 2. Clé de chiffrement des tokens
Supabase → Edge Functions → **Secrets** → ajoutez `TOKEN_ENCRYPTION_KEY`.
Valeur : 32 octets aléatoires en base64. Pour la générer, dans un terminal :
```bash
openssl rand -base64 32
```
Ne la changez plus ensuite (sinon les comptes devront être reconnectés).

## 3. Application TikTok (developers.tiktok.com)
1. Créez une app, ajoutez les produits **Login Kit** et **Content Posting API** (avec *Direct Post*).
2. Scopes : `user.info.basic`, `user.info.profile`, `video.publish`.
3. Redirect URI : `https://hubkgvfiiszthzqyfguf.supabase.co/functions/v1/social/callback/tiktok`
4. Secrets Supabase : `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`.
5. Tant que TikTok n'a pas **audité** l'app : toutes les publications sont **privées** (visibles seulement par le propriétaire du compte), et le nombre d'utilisateurs est limité. Après l'audit, ajoutez le secret `TIKTOK_APP_AUDITED=true`.

## 4. Application Instagram (developers.facebook.com)
1. Créez une app Meta avec le produit **Instagram → API with Instagram Login**.
2. Permissions : `instagram_business_basic`, `instagram_business_content_publish` (accès avancé = **App Review** de Meta pour les comptes de vos clients).
3. Redirect URI : `https://hubkgvfiiszthzqyfguf.supabase.co/functions/v1/social/callback/instagram`
4. Secrets Supabase : `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`.
5. Les comptes Instagram doivent être **professionnels** (Business ou Créateur). Les comptes personnels ne peuvent pas publier via l'API.

## 5. Déployer les fonctions
```bash
npx supabase functions deploy social --project-ref hubkgvfiiszthzqyfguf --no-verify-jwt
```
```bash
npx supabase functions deploy publisher --project-ref hubkgvfiiszthzqyfguf
```
```bash
npx supabase functions deploy captions --project-ref hubkgvfiiszthzqyfguf
```
Et `APP_URL` (adresse de votre site) dans les secrets, pour le retour après connexion.

## 6. Premier test (avec VOS comptes, pas ceux d'un client)
1. Connectez 1 compte TikTok et 1 compte Instagram professionnel dans **Comptes sociaux**.
2. Importez une courte vidéo 9:16 dans la **Bibliothèque**.
3. **Distribuer → Simultané** : la vidéo, les 2 comptes, dans 5 minutes.
4. **Calendrier** : écrivez/approuvez la légende de chaque publication.
5. Attendez : statut *Processing on platform* puis *Published*. Côté TikTok non audité, le post sera privé.
