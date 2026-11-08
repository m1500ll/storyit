# Hébergement du site sur Cloudflare (Workers, fichiers statiques)

- Projet Cloudflare : **storyit** (Workers & Pages), relié au dépôt GitHub `m1500ll/storyit`.
- Branche de production : `fix/gemini-models-tts`. Chaque envoi sur cette branche reconstruit et publie le site.
- Construction : `npm run build` (dossier `dist`), publication : `npx wrangler deploy` (réglages dans `wrangler.jsonc`).
- Variables de construction (Settings → Build → Variables and secrets) : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- En-têtes (sécurité, cache) : `public/_headers`. Les adresses inconnues renvoient `index.html` (application d'une page).
