# C1 — Socle de la marketplace · plan

> Sprint ouvert le 2026-10-05. Prompt : `.war-room/PROMPTS_CONQUETE.md`, section C1.
> Périmètre de cette session : **données, logique, API** (`packages/`, `apps/cli`, routes `api/`). Les écrans restent à
> la session design.

## Écart au prompt, corrigé avant de commencer

| Prompt | Réalité | Décision |
|---|---|---|
| Base Neon | Le founder a créé une base **Railway** | Railway. Prisma s'y branche pareil ; seule l'URL change. Utiliser `DATABASE_PUBLIC_URL` (la variable `DATABASE_URL` de Railway pointe vers `postgres.railway.internal`, injoignable hors Railway). |
| Prisma (version libre) | L'étiquette npm `latest` de `prisma` pointe vers **`8.0.0-rc.20`**, une release candidate ; le client stable est **7.10.0** | CLI et client figés sur **7.10.0**. Pas de RC sous une marketplace. Syntaxe v7 vérifiée sur prisma.io/docs/orm/v7 (générateur `prisma-client`, URL dans `prisma.config.ts`, adaptateur `@prisma/adapter-pg`). |

## Tâches

| Id | Tâche | Responsable | Dépend de | Definition of Done |
|---|---|---|---|---|
| C1-1 | Paquet `packages/db` : Prisma 7.10.0, `prisma.config.ts`, client avec adaptateur pg | Backend | — | `prisma validate` vert, client généré |
| C1-2 | Schéma de la marketplace (§ Modèle) | Architect + Backend | C1-1 | Revue database-reviewer ; SQL de migration généré sans base |
| C1-3 | Couche dépôt derrière des interfaces, implémentations Prisma | Backend | C1-2 | Tests sur une base réelle, pas sur un faux |
| C1-4 | Autorisations par objet | Security Sentinel | C1-3 | Accès au bien d'un autre refusé, test collé |
| C1-5 | Brancher `IntakeSink`, `client-store`, messagerie sur la base | Backend | C1-3 | Vérifié en exécution |
| C1-6 | Export et suppression RGPD de bout en bout | Backend + Legal & Trust | C1-3 | Parcours exécuté, preuve collée |
| C1-7 | Limiteur de débit partagé sur les routes publiques d'écriture | Backend | C1-1 | Tient sur deux instances (stocké en base) |
| C1-8 | Veille Malt / Free-Work → `research/CONQUETE_PARITE.md` | Victoria + Growth | — | Chaque ligne sourcée ou « À VÉRIFIER » |
| F-1 | **[FOUNDER]** `DATABASE_URL` = `DATABASE_PUBLIC_URL` de Railway, dans `.env` | Founder | — | Ligne présente |

## État au 2026-10-05 (soir)

| Id | État | Preuve |
|---|---|---|
| C1-1 | ✅ | `prisma validate` vert, client 7.10.0 généré |
| C1-2 | ✅ | 24 tables, 39 CHECK, 11 déclencheurs (dont 5 de mise à jour, ajoutés après la relecture adverse) ; migration exécutée et attaquée dans PGlite (`test/migration.test.ts`, 11 scénarios) |
| C1-3 | ✅ (PGlite) · ⏳ Railway | `test/repositories.test.ts` sur Prisma réel + Postgres embarqué |
| C1-4 | 🟡 messagerie faite | accès d'un tiers → `null`, 404 côté API ; à étendre aux missions/devis en C2-C3 |
| C1-5 | ✅ (hors base réelle) | `/api/intake` → base ; `/api/conversations*` exposées ; client-store reste sur disque (dossiers d'audit, outil opérateur) |
| C1-6 | ✅ (PGlite) | `test/gdpr.test.ts` : export, effacement freelance et recruteur |
| C1-7 | ✅ | limiteur partagé ; route exécutée : 5 × 400 puis 429 |
| C1-8 | ✅ | `research/CONQUETE_PARITE.md` ; 6 points Malt à vérifier à la main par le founder |
| F-1 | ⏳ founder | `DATABASE_URL` absente du `.env` |

## Modèle, principes retenus

- **Argent en centimes entiers**, devise explicite. Jamais de flottant.
- **Aucun champ de score ou de classement de personnes** (AI Act) : le schéma n'en offre pas la place.
- **Aucun nom de tiers stocké** : aucune colonne pour le client final d'une mission ; le type de client est un
  vocabulaire fermé, comme dans `@proofseen/profiles`.
- **Suppression RGPD par cascade** depuis `User`, pensée dans le schéma et non ajoutée après.
- **Ce qui se paie se rattache à un contrat**, et un avis ne peut exister sans contrat : la contrainte est dans le schéma.
