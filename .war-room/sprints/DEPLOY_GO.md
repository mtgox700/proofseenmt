# GO DEPLOY — mise en ligne de l'application sur proofseen.com

> GO DEPLOY donné par le founder le 2026-10-10. Stripe reste pour la fin du projet : on met en ligne sans paiement.
> But : que les profils, les missions et les pages métiers existent publiquement, pour pouvoir être indexés et cités.

## Choix de la War Room

- **Hébergeur : Vercel**, là où proofseen.com est déjà servi.
  - Next.js y tourne sans adaptation.
  - Vercel réécrit `x-real-ip`, dont dépend la limite par adresse de l'API.
  - **Offre Pro (20 $/mois)** : l'offre gratuite interdit l'usage commercial et ne lance la tâche planifiée qu'une fois
    par jour, alors qu'il en faut une toutes les 5 minutes.
- **Base : Railway**, inchangée. Migrations à jour.
- **Les 10 pages de l'ancien site statique** restent à leur adresse exacte, servies par l'application
  (`apps/web/public/legacy`, `src/lib/legacy-pages.ts`). Rien de ce que Google a indexé ne disparaît.

## Étapes du founder (comptes et réglages qu'on ne fait pas à ta place)

1. **Vercel → Add New → Project**.
   - Importer le dépôt GitHub `Ayoubhm07/Proofseen`.
   - **Root Directory : `apps/web`**. Framework : Next.js (détecté).
   - Laisser les commandes d'installation et de build par défaut : Vercel installe tout le monorepo avec pnpm.
2. **Région des fonctions** : dans Railway → service Postgres → *Settings*, relever la région de la base. Dans Vercel →
   projet → *Settings → Functions*, choisir la région la plus proche (par exemple `cdg1` Paris pour une base en Europe de
   l'Ouest). Chaque page fait plusieurs requêtes : une base sur un autre continent rendrait le site lent.
3. **Railway** : service Postgres → désactiver la mise en veille (*App Sleeping*). Une base endormie met 6 s à se réveiller.
4. **Clerk, instance de production**.
   - Dans le tableau de bord Clerk : *Create production instance*, domaine `proofseen.com`.
   - Clerk donne des enregistrements DNS (des CNAME : `clerk`, `accounts`, et ceux de l'e-mail). Les ajouter chez
     **IONOS**, puis attendre que Clerk les voie verts.
   - Copier les nouvelles clés `pk_live_…` et `sk_live_…`.
   - Les comptes de test restent sur l'instance de développement.
5. **Vercel → Settings → Environment Variables** (environnement *Production*). Les valeurs sont dans
   `apps/web/.env.local`, sauf les trois premières :

   | Variable | Valeur |
   |---|---|
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | la nouvelle `pk_live_…` |
   | `CLERK_SECRET_KEY` | la nouvelle `sk_live_…` |
   | `PROOFSEEN_PUBLIC_URL` | `https://proofseen.com` |
   | `INDEXNOW_KEY` | `e674e36a3ec97955b65dcad2c280054e`, la clé déjà publiée par le site statique ; elle est publique par nature |
   | `DATABASE_URL` | l'URL publique Railway, comme dans `.env.local` |
   | `DATABASE_POOL_MAX` | `3` |
   | `PROOFSEEN_ACCESS_SECRET`, `CRON_SECRET` | comme dans `.env.local` (**obligatoires**) |
   | `OPERATOR_EMAILS` | comme dans `.env.local` |
   | `PROOFSEEN_LEGAL_NAME`, `PROOFSEEN_SIRET`, `PROOFSEEN_VAT_NUMBER`, `PROOFSEEN_ADDRESS_LINE1`, `PROOFSEEN_ADDRESS_POSTAL_CODE`, `PROOFSEEN_ADDRESS_CITY`, `PROOFSEEN_ADDRESS_COUNTRY` | comme dans `.env.local` (e-kigai) |
   | `PROOFSEEN_COMMISSION_BP` | `1000` |
   | `ANTHROPIC_API_KEY` | comme dans `.env.local` (recherche par phrase) |

   Pas encore : `STRIPE_*`, `RESEND_API_KEY` et `NOTIFY_FROM` (e-mails, à brancher juste après).
6. **Lancer le premier déploiement**, sur l'adresse `…vercel.app` que donne Vercel, sans toucher au domaine. **Me donner
   cette adresse** : je fais les contrôles de la section suivante avant la bascule.
7. **Bascule du domaine**, une fois mes contrôles verts.
   - Vercel → l'ancien projet du site statique → *Domains* : retirer `proofseen.com`.
   - Vercel → le nouveau projet → *Domains* : ajouter `proofseen.com`.
   - Le DNS IONOS pointe déjà vers Vercel : rien à changer chez IONOS pour le site lui-même.
8. **Moteurs**.
   - **Bing Webmaster Tools** (ChatGPT et Perplexity s'appuient sur Bing) : ajouter `proofseen.com` et soumettre
     `https://proofseen.com/sitemap.xml`.
   - **Google Search Console** : soumettre le même `sitemap.xml`.

## Contrôles de la War Room, sur l'adresse `…vercel.app` puis sur proofseen.com

| Contrôle | Comment |
|---|---|
| Ce que voient les robots sur un profil, une mission, une page métier | `marketplace-verify --base-url https://…` |
| Les 10 anciennes adresses répondent 200 avec la même page | relevé adresse par adresse |
| `robots.txt`, `sitemap.xml` et les quatre sitemaps | 200, contenu attendu |
| Santé et services configurés | `/api/health` avec le secret |
| Tâche planifiée | une exécution réussie dans les journaux Vercel |
| Inscription et connexion sur l'instance de production Clerk | parcours réel, par le founder |
| Lighthouse ≥ 95 sur les pages publiques | profil, mission, métier, index des missions |

Après la bascule : soumission IndexNow des pages publiques, puis une mesure de conquête à J+30 pour suivre la part de
citations de proofseen.com face à Malt et LinkedIn.
