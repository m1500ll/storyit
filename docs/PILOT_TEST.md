# Test pilote — avec VOS comptes uniquement

Distinction importante :
- **Tests automatiques** (`npm test`, 107 tests) : simulés. Ils prouvent la logique, pas que TikTok/Instagram acceptent.
- **Ce pilote** : réel. Une publication n'est « réussie » que si la plateforme la confirme ET que vous la voyez dans l'app.

Prérequis : `docs/DISTRIBUTION_SETUP.md` étapes 0 à 5 terminées. Si une autorisation manque, **arrêtez-vous** à l'étape concernée.

| # | Action | Résultat attendu | Si ça échoue |
|---|---|---|---|
| 1 | Comptes sociaux → **Connect Instagram** (compte pro, testeur de l'app) | Retour sur Storyit, compte « Connected », Publishing « Allowed » | Message d'erreur affiché : compte personnel, testeur manquant ou permission refusée |
| 2 | **Connect TikTok** (compte de test) | « Connected » + mention « not audited… posts are private » | Scopes manquants dans l'app TikTok |
| 3 | Bibliothèque → importer une vidéo 9:16 de 10–30 s (< 50 Mo) | Barre de progression, durée et résolution affichées, statut « Available » | Format/taille refusés : message explicite |
| 4 | Distribuer → Simultané → la vidéo, les 2 comptes, heure = dans 10 min | Récapitulatif « 2 publications » | Destinations bloquées listées avec la raison |
| 5 | Calendrier → ouvrir chaque publication : écrire la légende ; côté TikTok, vérifier le **nom du créateur**, choisir la visibilité (**Only me** imposé avant audit), cocher la déclaration → **Approve** | Badge « Caption to approve » disparaît | Bouton grisé tant qu'un réglage manque |
| 6 | Attendre l'heure prévue (navigateur **fermé**) | Statut « Uploading » → « Processing on platform » → « Published » | Voir l'erreur dans la ligne (Retry proposé si sûr) |
| 7 | Vérifier dans les apps | Reel visible sur Instagram ; vidéo **privée** sur TikTok | Si Storyit dit « Published » mais rien dans l'app : ne republiez pas, notez-le |
| 8 | Historique → event log ; relancer la distribution de la même vidéo vers les mêmes comptes | Événements complets ; « 2 skipped, already on that account » | — |
| 9 | Pause : créer une 2e publication dans 10 min, l'inclure dans une campagne en pause ou l'annuler | Rien ne part | — |
| 10 | Expiration : dans Instagram → Paramètres → Apps et sites web, retirer Storyit, puis « Check » le compte | Statut « Authorization expired », publications futures en échec clair « reconnect » | — |
| 11 | Erreur réseau : non provoquable proprement en production ; couverte par les tests simulés (incertain → « Check manually », jamais renvoyé) | — | — |

Contrôle anti-doublon (SQL Editor) — doit renvoyer 0 ligne :
```sql
select media_id, account_id, count(*) from scheduled_publications
where status in ('published','submitted','needs_attention') group by 1,2 having count(*) > 1;
```
