# GO DEPLOY — mise en ligne de l'application sur proofseen.com

> GO DEPLOY donné par le founder le 2026-10-10. Stripe reste pour la fin du projet : on met en ligne sans paiement.
> But : que les profils, les missions et les pages métiers existent publiquement, pour pouvoir être indexés et cités.

## Choix de la War Room (révisé le 2026-10-14)

- **Hébergeur : le VPS IONOS de Zak** (82.165.57.191, Debian 13, 16 vCPU, 62 Go), avec l'accord de Zak.
  - Vercel est abandonné : l'offre gratuite refuse une tâche planifiée toutes les 5 minutes, et l'usage commercial.
  - Le VPS sert déjà DEMOMEA (d-ai.fr) derrière un Caddy (`demomea-caddy`) qui tient les ports 80 et 443. Proofseen
    passe par ce même Caddy, qui obtient seul le certificat HTTPS.
- **Base : Railway**, inchangée. Migrations à jour.
- **Les 10 pages de l'ancien site statique** restent à leur adresse exacte, servies par l'application
  (`apps/web/public/legacy`, `src/lib/legacy-pages.ts`). Rien de ce que Google a indexé ne disparaît.

## Ce qui tourne sur le VPS

| Élément | Où |
|---|---|
| Code (archive de la branche, sans secret) | `/root/proofseen/app` |
| Variables de production (`chmod 600`, jamais dans git) | `/root/proofseen/app/.env.production` |
| Conteneur `proofseen-web` (Next.js, port 3100, réseau `demoema_web`) | `deploy/vps/docker-compose.yml`, `Dockerfile` |
| Bloc Caddy `proofseen.com, www.proofseen.com` ajouté en fin de `/root/DEMOEMA/Caddyfile` | `deploy/vps/Caddyfile.proofseen` ; sauvegarde `Caddyfile.bak-2026-10-14` |
| Tâche planifiée toutes les 5 minutes (cron installé pour l'occasion) | `deploy/vps/cron.sh`, journal `/var/log/proofseen-cron.log` |

Accès : clé SSH dédiée `~/.ssh/proofseen_vps` (jamais de mot de passe). Le build prend 37 s sur le VPS.

## Mettre à jour la production

Depuis la racine du dépôt, sur `main` à jour :

```bash
S="ssh -i ~/.ssh/proofseen_vps root@82.165.57.191"
$S 'rm -rf /root/proofseen/src.new && mkdir /root/proofseen/src.new'
git archive --format=tar HEAD | $S 'tar -x -C /root/proofseen/src.new'
$S 'cp -p /root/proofseen/app/.env.production /root/proofseen/src.new/ && rm -rf /root/proofseen/app && mv /root/proofseen/src.new /root/proofseen/app'
$S 'cd /root/proofseen/app/deploy/vps && docker compose --env-file ../../.env.production up -d --build'
```

Toute modification du Caddyfile de DEMOMEA : sauvegarde, `caddy validate`, puis `caddy reload` (jamais de redémarrage
du conteneur, qui couperait d-ai.fr), et contrôle que d-ai.fr répond toujours.

## Bascule du domaine (founder, chez IONOS)

DNS de proofseen.com :
- **A** `@` : `216.198.79.1` (Vercel) → **`82.165.57.191`** ;
- **CNAME** `www` → `proofseen.com` (il n'y en avait pas) ;
- aucun AAAA ; rien d'autre ne change.

Après la bascule, les projets Vercel peuvent être supprimés.

## Contrôles

| Contrôle | État |
|---|---|
| Pages, sitemaps, `robots.txt`, 10 anciennes adresses, santé, clé IndexNow (dans le conteneur) | ✅ 2026-10-14 |
| Caddy route proofseen.com vers le conteneur ; d-ai.fr répond toujours | ✅ 2026-10-14 |
| Tâche planifiée : une exécution réussie | ✅ 2026-10-14 |
| HTTPS sur proofseen.com, puis `marketplace-verify --base-url https://proofseen.com` | après la bascule DNS |
| Instance de production Clerk (`pk_live_`) : inscription et connexion réelles | founder |
| Bing Webmaster Tools et Google Search Console : soumettre `https://proofseen.com/sitemap.xml` | founder |

Après la bascule : soumission IndexNow des pages publiques, puis une mesure de conquête à J+30 (2026-11-19) pour suivre
la part de citations de proofseen.com face à Malt et LinkedIn.
