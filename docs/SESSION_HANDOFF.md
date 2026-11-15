# Storyit — passation entre sessions (état au 15/11/2026)

À lire en entier avant toute action. Le propriétaire est débutant et parle français : réponses simples, une action par
étape. Il veut être prévenu avant toute dépense payante (OpenAI, Grok, Stripe…), et il doit voir les mails « [APERÇU] »
avant tout envoi à des clients.

## Règles permanentes
- Ne lance aucune dépense payante (génération d'images/vidéos, débit Stripe) sans accord explicite du propriétaire.
- Secrets uniquement dans les secrets des Edge Functions / réseau de l'environnement. Jamais dans le chat, jamais en `VITE_`.
  Plus besoin du MAILING_TOKEN : mails et campagnes passent par `scripts/send-branded-mail.py` / `scripts/call-function.py` (jeton cron du coffre).
- Aucun fichier avec des e-mails clients dans le dépôt. Pas d'identifiant de modèle dans les commits.
- CLAUDE.md : skills `storyit-ux` + `ui-ux-pro-max` avant toute UI ; données via `src/services` ; vérifier avec
  `npx tsc -b && npm run build`, `npx vitest run` et une capture Playwright (ordinateur + iPhone) avant de pousser.
- Pousser sur `feat/animated-studio` ET `fix/gemini-models-tts` (Vercel déploie la prod) :
  `git push -q origin feat/animated-studio && git push -q origin feat/animated-studio:fix/gemini-models-tts`
- Le worker Modal se redéploie tout seul (GitHub Action) quand `render-engine/**` change.
- Mails d'aperçu au propriétaire : toujours « [APERÇU] » dans le titre (`test_to` le fait automatiquement).

## Accès techniques
- Supabase projet `hubkgvfiiszthzqyfguf`. SQL : `POST https://api.supabase.com/v1/projects/hubkgvfiiszthzqyfguf/database/query`
  (le jeton est injecté par le proxy ; il avait expiré le 14/11 et a été remplacé).
- Déployer une fonction : `SUPABASE_ACCESS_TOKEN=sbp_000…(factice, le proxy remplace) npx supabase functions deploy <fn>
  --project-ref hubkgvfiiszthzqyfguf --use-api --yes` + `--no-verify-jwt` pour : prompts, prompt-videos, mailing,
  stripe-webhook, affiliate, llm-health, trial-convert, auto-topup, (characters : JWT vérifié, normal).
- Appeler une fonction protégée par le jeton cron : via SQL `net.http_post/http_get` avec
  `(select decrypted_secret from vault.decrypted_secrets where name='publisher_cron_token')`, puis lire `net._http_response`.
- `llm-health` (jeton cron) : `?balances=1` (soldes fournisseurs), `?stripe_customer=cus_…` (abonnements + factures),
  `?stripe_webhooks=1` / `?stripe_webhook_add=<event>`, `?stripe_methods=1`, `?image=1` (POST {prompt,size,quality} :
  génère une image OpenAI, renvoie du base64 — payant).
- OpenAI n'est pas joignable directement depuis la session : passer par `llm-health?image=1`.

## Envoyer un e-mail (IMPORTANT : jamais de texte brut improvisé)
- **Un mail à une personne** (partenariat, client, test) : `python3 scripts/send-branded-mail.py mail.json`.
  Le mail sort au style Storyit (bannière noire, carte blanche, boutons violets #7c3aed, encadrés #f4f0ff, signature
  « À très vite, L'équipe Storyit »), depuis hello@storyit.fun. Les blocs HTML à copier sont en tête du script.
  Toujours un **aperçu au propriétaire d'abord** (« [APERÇU] » devant le sujet), envoi réel seulement après son « envoie ».
  `reply_to` = l'e-mail du propriétaire (table auth.users, id 433ced9f-142d-4daf-92f2-40cabbaba0f0) pour qu'il reçoive les réponses.
- **Une campagne à tous les inscrits** : l'ajouter dans `CAMPAIGNS` (`supabase/functions/mailing/index.ts`, mêmes blocs
  + lien de désinscription via `shell(inner, unsub)`), déployer, puis
  `python3 scripts/call-function.py mailing '{"campaign":"<id>","test_to":"<email du propriétaire>"}'` (aperçu étiqueté
  automatiquement), et seulement après accord : `'{"campaign":"<id>"}'` (jamais deux fois à la même personne).
- Appeler n'importe quelle fonction avec le jeton cron : `python3 scripts/call-function.py <fn> '<json>'` ou `--get '<query>'`.
  Plus besoin du MAILING_TOKEN.

## Produit (ce qui est en ligne)
- **Animated Studio : en pause** (`src/components/layout/AnimatedPause.tsx`, `ANIMATED_PAUSED = true`). Caché partout,
  admins seulement (« Animated Studio (caché) » dans le menu admin). Ne pas le remettre sans demande.
- **Creative Studio** (ex « Prompt Studio », renommé partout) = produit principal, 1er dans le menu, onglet « Créer » sur mobile.
  - Page `/app/prompts` = **parcours en 5 étapes** (`src/components/prompts/CreateWizard.tsx`) : Univers → Personnages →
    Durée (30/45/60 s) → Personnalise (sous-titres + musique) → Ton histoire + récap crédits → « Générer ».
    Aperçu téléphone animé (`WizardPreview.tsx`). Mode avancé (ancien studio) : `/app/prompts?mode=avance`.
  - « Générer » = **tout automatique** côté serveur : la fonction `prompts` débite projet (1 500) + vidéo, puis enchaîne
    review → images → videos → pack → commande vidéo via `queue_prompt_step` (migration 0041, pg_net) ; 2 réessais par
    étape puis remboursement de la vidéo. Progression : `data.auto` du projet, affichée par `AutoProgress.tsx`.
  - Univers (`supabase/functions/_shared/characters.ts`, `UNIVERSES`) : realiste, matieres, fruits, humains, animaux,
    objets, horreur, pate, anime, perso. Règle : visages d'ADULTES réalistes, grands (≈7,5 têtes), jamais de bébé cartoon.
    Images des cases : `public/studio/universes/*.webp` (scènes, parcours) et `public/characters/universes/*.webp` (persos).
  - Règle « images grand public » ajoutée à tous les scripts (pas de sang, arme, cadavre, enfant). Le worker adoucit
    automatiquement une scène refusée par le filtre et réessaie (4 essais, `soften()` dans `render-engine/promptvideo/run.py`).
- **Personnages** (`/app/characters`, `CharactersPage.tsx`) : univers + une phrase (+ photo avec consentement),
  1 000 crédits (`CHARACTER_COST`), planche dessinée en arrière-plan, remboursée si échec. Table `user_characters`,
  bucket privé `characters` (migration 0040), fonction `characters`. Bibliothèque Storyit `LIBRARY` : **vide** (le
  propriétaire n'a pas aimé les premiers essais ; à refaire seulement avec son accord et dans le nouveau style).
  Les personnages choisis sont figés dans le projet (`cast_chars`) et leurs planches jointes à chaque image.
- **Sous-titres** (karaoke / simple / italique / none) brûlés par le worker depuis les minutages du script ; **musique**
  mixée sous les voix (loudnorm + ducking). Bibliothèque `MUSIC_TRACKS` (`_shared/promptVideo.ts`, fichiers
  `public/music/*.mp3`) : 5 sons fournis par le propriétaire (il déclare en avoir les droits) — yara-yara (défaut),
  batida-funk, meow-meow, deep-slowed, la-polizia — + 6 musiques originales (`render-engine/scripts/make_music.py`).
  « Importer ma musique » : bucket privé `music` (migration 0042), lien signé pour le worker.
- **Prix vidéo** (Éco seulement) : 30 s = 4 500, 45 s = 7 000, 60 s = 9 000 ; + projet 1 500. Compteurs du site
  (`videosFor`) = projet + vidéo 30 s (6 000 crédits).
- **Essai 1 $** : 3 jours, 7 000 crédits ; passe à l'abonnement dès qu'il reste **1 500 crédits ou moins** (migration 0043,
  `TRIAL.switchAt = 1500`) ou au bout de 3 jours. Le parcours choisit 30 s si le solde ne paie pas 45 s.
- **Paiement échoué** : webhook `invoice.payment_failed` → mail « Votre paiement Storyit n'est pas passé » avec le lien
  Stripe pour payer / changer de carte. Stripe : relances intelligentes par défaut.
- **Communauté Discord** : https://discord.gg/S3A9Jg5xe — bouton dans le menu, carte sur l'accueil appli, bandeau
  landing, icône navbar (`src/components/community/Community.tsx`). Campagne mail `discord_launch` envoyée à 73 comptes.
  Annoncé : « offres exclusives bientôt réservées aux membres du Discord » (à concrétiser : code promo Stripe ?).
- Partenaires : 15 % du premier paiement (7 jours après le clic), lien `storyit.fun/?via=code`, tableau de bord, paiement
  des commissions au choix (crypto USDT recommandé, virement UE, PayPal) quand le partenaire le demande.

## Fait le 15/11
- Jeton Supabase : secret réseau de l'environnement (hôte `api.supabase.com`, en-tête Authorization, préfixe Bearer). Plus
  besoin d'en-tête dans curl, le proxy l'ajoute.
- **Panne vidéo du 14/11 ~20 h → 15/11 12 h : limite de dépense Modal atteinte (7 $).** Le propriétaire l'a montée à 20 $.
  Symptôme : `prompt_videos` en `queued` avec `attempts = 0`. Commande Animated bloquée annulée et remboursée.
- Migration 0044 appliquée (+ `email_key` rempli pour les anciens comptes). Attention : « Confirm email » est désactivé
  dans Supabase Auth (`mailer_autoconfirm = true`), donc la condition « e-mail confirmé » ne filtre rien ; les règles
  jetable + alias gmail fonctionnent. Crédits retirés (accord) : hamzaboudouaia29, hamzaboudouaia011, motivationnouhan.
- Migration 0045 : alerte au propriétaire si une vidéo n'est pas finie 50 min après la commande (cron 10 min, 1 mail / 3 h,
  via `notify-signup` mode `alert`, propriétaire uniquement).
- `MAILING_TOKEN` régénéré (accord). Ne plus le régénérer : depuis le 15/11 au soir, `mailing` accepte aussi le jeton cron
  (campagnes + mails « branded »), voir la section « Envoyer un e-mail ». Aperçus aux beaux couleurs : rendre le
  HTML avec `shell()` de `mailing/index.ts`, l'envoyer au propriétaire via `notify-signup` `{alert:{subject:"[APERÇU] …",html}}`.
- Relance « Votre paiement n'est pas passé » envoyée à Baptiste et Nouhan (paiement de 29 $ refusé le 13/11, avant que le
  mail automatique existe).

## En attente / à faire
1. ~~Migration 0044~~ (faite le 15/11). Ancienne note : **Migration 0044 anti-abus NON appliquée** (`supabase/migrations/0044_welcome_bonus_guard.sql`) : crédits de bienvenue
   seulement après confirmation de l'e-mail, pas d'e-mail jetable, une fois par vraie boîte (alias gmail). Le propriétaire
   a signalé quelqu'un qui crée plusieurs comptes. L'appliquer via l'API SQL, puis repérer les doublons
   (`email_key`) et demander au propriétaire s'il faut retirer les crédits.
2. Dire d'où viennent les derniers inscrits (métadonnées `via`, `affiliate_id`, fournisseur Google/e-mail).
3. Un client « s'est abonné » (à vérifier : créateur TikTok partenaire ? Baptiste / Nouhan, dont le paiement de 29 $
   avait échoué ?).
4. Vérifier le rendu réel des univers (seule vidéo test : « 3h17 », Horreur, réussie après correctif).
5. Côté propriétaire : descripteur Stripe « STORYIT », Google OAuth, recharge Gemini (légendes), ImprovMX pour
   hello@storyit.fun, résultat de la validation de l'app TikTok.

## Fichiers clés
`supabase/functions/prompts/index.ts` (phases + chaîne auto + story_idea), `_shared/promptStudio.ts` (prompts, univers,
casting), `_shared/promptVideo.ts` (prix, plan vidéo, musiques, sous-titres), `_shared/characters.ts`,
`supabase/functions/prompt-videos/index.ts`, `render-engine/promptvideo/run.py` (worker), `supabase/functions/mailing/index.ts`,
`supabase/functions/stripe-webhook/index.ts`, `supabase/functions/billing/index.ts`, `src/pages/PromptStudioPage.tsx`,
`src/components/prompts/*`, `src/components/characters/*`, `src/pages/CharactersPage.tsx`, `brand-logo/` (logos, bannières, pdp).
