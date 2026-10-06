# C7 — Mise en production · procédure

> Écrite le 2026-10-06. **Rien de ce qui suit n'est exécuté sans le « GO DEPLOY » du founder.** L'hébergeur de
> l'application n'est pas encore choisi ; la base est sur Railway.

## 1. Variables d'environnement (noms seulement, jamais de valeur dans un fichier versionné)

| Variable | Rôle | Sans elle |
|---|---|---|
| `DATABASE_URL` | Postgres Railway (URL interne si l'application tourne sur Railway, publique sinon) | site public sans base : pages missions/profils/métiers absentes, API « non-configuré » |
| `DATABASE_POOL_MAX` | taille du pool (5 par défaut) | défaut |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | connexion (`pk_…`, `sk_…`) | espace connecté désactivé |
| `OPERATOR_EMAILS` | adresses opérateur (liste) | aucun opérateur |
| `PROOFSEEN_ACCESS_SECRET` | HMAC du limiteur de débit et des liens d'espace (≥ 32 caractères) | limiteur partagé désactivé |
| `CRON_SECRET` | appel de la tâche planifiée et détail de `/api/health` (≥ 32 caractères) | tâche planifiée refusée (401) |
| `PROOFSEEN_PUBLIC_URL` | adresse publique (sitemaps, IndexNow, liens des e-mails) | adresse déduite de la requête |
| `INDEXNOW_KEY` | notification Bing/Yandex à chaque publication | aucune notification |
| `RESEND_API_KEY`, `NOTIFY_FROM` | e-mails | notifications en file, rien d'envoyé |
| `STRIPE_SECRET_KEY` (`sk_test_…`), `STRIPE_WEBHOOK_SECRET` | séquestre, mode test | paiements « non configurés » |
| `PROOFSEEN_COMMISSION_BP` | taux de commission en points de base (**décision founder**) | aucun paiement ne s'ouvre |
| `PROOFSEEN_LEGAL_NAME`, `PROOFSEEN_SIRET`, `PROOFSEEN_VAT_NUMBER`, `PROOFSEEN_ADDRESS_LINE1`, `PROOFSEEN_ADDRESS_POSTAL_CODE`, `PROOFSEEN_ADDRESS_CITY`, `PROOFSEEN_ADDRESS_COUNTRY` | émetteur des factures de commission | aucun versement (facture impossible) |
| `PROOFSEEN_PAYMENTS_LIVE` | `GO` seulement après « GO PAIEMENT LIVE » | les clés `sk_live_` sont refusées |
| `NEXT_PUBLIC_PAYMENT_LINK_AUDIT`, `NEXT_PUBLIC_PAYMENT_LINK_TURNKEY` | liens de prévente existants | boutons masqués |

## 2. Étapes, dans l'ordre

1. **Founder** : rotation du mot de passe Railway (il a circulé en clair), puis `DATABASE_URL` dans l'environnement.
2. Préproduction d'abord (base et application séparées de la production) :
   `pnpm --filter @proofseen/db exec prisma migrate deploy` — c'est la **première** application de la migration
   initiale ; à partir de là, toute évolution passe par une nouvelle migration et `prisma/init/regenerate.sh` est retiré.
3. Build et démarrage : `pnpm --filter @proofseen/web build`, puis `next start`.
4. Tâche planifiée : `GET /api/cron/notifications` avec `Authorization: Bearer $CRON_SECRET`, toutes les 5 minutes.
5. Surveillance : `GET /api/health` toutes les minutes (200 attendu, 503 = base injoignable).
6. Webhook Stripe (mode test) vers `/api/webhooks/stripe`.

## 3. Vérifications après déploiement (preuves à coller dans `TEAM_MEMORY.md`)

| Contrôle | Commande ou geste |
|---|---|
| Pages publiques telles que les robots les voient | `pnpm tsx apps/cli/src/main.ts marketplace-verify --base-url https://…` |
| Santé et services configurés | `curl -H "Authorization: Bearer …" https://…/api/health` |
| Effacement connecté (non exécutable en local) | compte de test : `DELETE /api/me` avec `{"confirm":true}`, puis reconnexion impossible et export vide |
| Verrous d'effacement sur Postgres réel | deux derniers membres d'une entreprise sous contrat qui s'effacent en même temps : un seul réussit |
| Séquestre de bout en bout en mode test | carte de test Stripe, validation, versement, deux factures |
| Lighthouse ≥ 95 | profil, mission, métier, index des missions |
| Entonnoir | `pnpm tsx apps/cli/src/main.ts funnel` chaque semaine, chiffres réels consignés |
