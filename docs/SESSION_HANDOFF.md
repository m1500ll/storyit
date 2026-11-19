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
- Depuis le 15/11, **tous** les mails de `mailing` (campagnes, automatiques, branded, direct) ont par défaut
  `reply_to` = e-mail du propriétaire (`REPLY_TO`, modifiable par le secret `MAIL_REPLY_TO`) : « Répondre » arrive chez lui.
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
- **Storytelling (15/11)** : les phases créatives (3 idées, script, relecture-critique) sont écrites par **Claude Opus 5.5**
  (`_shared/claudeWriter.ts`, effort `low` pour tenir dans les ~135 s d'une requête, ~66 s mesurées, ~0,15 $ par script),
  avec la méthode « salle des scénaristes », la BIBLIOTHÈQUE DE HOOKS et les PLANS MINUTÉS du MASTER_PROMPT. Les phases
  techniques (images, Grok, légende) restent sur gpt-5-mini. Échec Claude = repli automatique. Coupure : secret
  `CLAUDE_WRITER=off`. Test opérateur payant : `scripts/call-function.py llm-health '' --get 'writer_test=1'`.
- Vidéos : dialogues ~3,3 mots/s, une intonation (`tone`) par réplique transmise à Grok, règles anti-hallucinations
  (2 personnages par clip, caméra fluide, liste d'interdits « FAISABLE PAR L'IA »).

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

## AI clipping ("Découper une vidéo", Nov 17 2026)
- Ported from the owner's Clipit app (m1500ll/clipit). Routes `/app/clips`, `/app/clips/new`, `/app/clips/:projectId`, `/app/clips/:projectId/:clipId`.
- The video stays in the browser (IndexedDB `storyit-clips`); ffmpeg.wasm extracts the audio (mono 16 kHz, 24 kbps), uploaded to the private
  `clip-audio` bucket; the `clips-analyze` Edge Function (Gemini, inline audio) returns 2-8 moments, saves them, charges
  `CREDIT_COSTS.clipMinute` (100 credits per started minute, owner's choice) only on success via `charge_credits`, and deletes the audio.
- Migration 0046 (applied): `clip_projects`, `clips`, `credit_transactions.clip_project_id`, `charge_credits`, bucket, RLS, realtime.
- ONE shared ffmpeg engine and queue: `src/lib/ffmpeg.ts` (assemble.ts and compress.ts go through `exclusive`).
- Needs Gemini credit (the prepaid balance was empty on Nov 17): without it the analysis fails cleanly, no credits charged.

## Two Stripe accounts (Nov 17 2026)
- 'legacy' = original account (STRIPE_SECRET_KEY, STRIPE_PRICE_*, STRIPE_WEBHOOK_SECRET); 'new' = company account ETO Core - F.Z.E
  (same names + _NEW; key is a restricted rk_live, "full access except sensitive operations"). Helper: `_shared/stripeAccount.ts`.
- `profiles.stripe_account` (migration 0047, applied): null with a customer id = legacy. New customers go to 'new' only when
  the secret STRIPE_NEW_ACCOUNT_LIVE is not 'off' (set to on Nov 17: the new account can charge; the legacy one is restricted). The legacy account is abandoned (owner, Nov 17): billing moves any legacy customer to a new customer on the new account at their next action; legacy subscriptions will not renew.
- The webhook verifies with both signing secrets; billing, auto-topup, trial-convert pick the customer's account.
- New account catalogue/webhook/portal created by `llm-health?stripe_setup_new=1` (idempotent). Status: `llm-health?stripe_account_status=1`.
- To finish: when the new account can charge, set STRIPE_NEW_ACCOUNT_LIVE to 'on'; later ask Stripe to migrate customers, then
  move subscriptions and set stripe_account='new'. admin-stats still reads only the legacy account.

## Auth e-mails and confirmation (Nov 17 2026)
- E-mail confirmation is ON (`mailer_autoconfirm=false`). Every auth e-mail (sign-up confirmation, reset, e-mail change) goes through the Send Email hook → Edge Function `auth-email` (Resend, Storyit look, FR/EN from `user_metadata.lang`). Deploy with `--no-verify-jwt`. Hook secret: `SEND_EMAIL_HOOK_SECRET` (function secret) = `hook_send_email_secrets` (auth config). Email rate limit: 300/h.
- AuthPage: "Renvoyer l'e-mail" button after sign-up or on "Email not confirmed".
- Clipping access: subscribers only, 1 video during the $1 trial, admins unlimited (`clips-analyze` + `src/lib/clipAccess.ts`).
- Google sign-in: the button shows automatically once the Google provider is enabled in Supabase (owner creates the OAuth client in Google Cloud; callback `https://hubkgvfiiszthzqyfguf.supabase.co/auth/v1/callback`).

## AI clipping, clipper look (Nov 18 2026)
- Analysed @liuclipper. New defaults for clips: title `tiktok` (TikTok Sans SemiBold on white bands, AI writes the clipper-style title with CAPS + emojis), captions `clipper` + `word` (Anton, one word at a time, AI keywords in yellow, *REACTION* tags where nobody speaks), layout `auto`.
- Layouts (`src/lib/clipLayout.ts`, one plan drawn by the canvas preview AND the ffmpeg export): auto, split (facecam top + gameplay), stack (2 cams + gameplay), track (follows who speaks), zoom (4:5 on blur), fill, fit. Neon divider option.
- Face analysis runs in the browser (`src/lib/clipFraming.ts`, MediaPipe Face Landmarker: wasm from jsdelivr pinned 1.2.2, model in `public/models/face_landmarker.task`); corners are zoomed to find small facecams; result saved in `clips.framing` (migration 0050).
- Playwright: route `cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/wasm/*` to node_modules (the sandbox blocks jsdelivr).

## Conversion (Nov 18 2026)
- "Your video is ready" sheet (Paywall reason `video`): $1 trial, Stripe `return_to` brings the customer back to their video; wizard draft kept in localStorage.
- Reminder e-mails (`mailing` → `nudges`, hourly cron `storyit-nudges`, migration 0051): nudge_video_1 (2 h after a story without video), nudge_video_2 (+24 h), nudge_start_1 (24 h after sign-up, nothing made). LIVE since Nov 18 (secret NUDGES_LIVE=on); first run sent 13. Dry run: `{"nudges":{"dry":true}}`.
- Google Pay on (new Stripe account). Wow moments: WelcomeIntro (once, accounts < 3 days) and StoryTrailer on the project page (no AI cost).
- Owner refused: free first video (cost), landing page changes for partner traffic.

## Payments, Nov 19 2026
- **$1 trial removed** everywhere (front `TRIAL_ENABLED=false`; billing ignores `trial` unless the secret `TRIAL_ENABLED=true`; old $1 campaigns refused by mailing). New users: 3,000 free credits, then plans at full price.
- Stripe (new account) paused for review; Whop live for card payments (`BILLING_PROVIDER=whop`) but payouts blocked: its business verification form fails with "Failed to submit" (bug reported to Whop support).
- **Paddle** (merchant of record) integrated and waiting for Paddle's account verification: `_shared/paddle.ts`, `paddle-webhook`, migration 0054, page `/pay` (Paddle.js overlay). Products/prices/webhook/client token created (`llm-health?paddle_setup=1`, ids in integration_settings). Operator passthrough: `llm-health?paddle_api=/path` (POST with `&paddle_method=POST` and a JSON body). Webhook tested with a Paddle simulation (signature OK). **To switch once Paddle approves: secret `BILLING_PROVIDER=paddle`**, then a real test purchase.
- Legal: `/refunds` (14-day money-back), `/pricing`, terms with Paddle reseller wording, operator = ETO Core - F.Z.E (Ajman Free Zone address).
- Storage cleanup: worker deletes its working frames/clips after each job (renders bucket 1.7 GB → 0.18 GB). Library (customers' final videos, ~1.5 GB) kept; Supabase Pro needed to go over 1 GB.
- Nov 19 later: **Paddle refused** Storyit (generative AI not allowed by its policy) and **Stripe closed the new account**. **Dodo Payments** integrated (AI-friendly MoR): `_shared/dodo.ts`, `dodo-webhook` (Standard Webhooks, tested), migration 0055, 8 products + webhook created (`llm-health?dodo_setup=1`), passthrough `llm-health?dodo_api=/path`. Waiting for Dodo's verification (API answers MERCHANT_NOT_LIVE). **Switch: secret `BILLING_PROVIDER=dodo`**, then a real test purchase. Terms/refunds/privacy now name Dodo + Whop.
- Payments were paused on Nov 19, **reopened the same day on Whop** (PAYMENTS_PAUSED=false, secret BILLING_PAUSED deleted). Earlier note: **Payments paused** (Nov 19): front `PAYMENTS_PAUSED=true` in src/services/billing.ts (buttons open a maintenance notice) + secret `BILLING_PAUSED=true` (billing refuses checkouts). To reopen: set both back (false / delete the secret) once Dodo is live and `BILLING_PROVIDER=dodo`.
