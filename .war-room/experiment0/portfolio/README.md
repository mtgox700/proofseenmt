# Rendre `ayoubdevspace.vercel.app` lisible par les robots — pas à pas

## Le problème, mesuré le 2026-09-24

```
Texte visible dans le HTML brut : 73 caractères
« Ayoub Hammoudi — Dev Space. You need to enable JavaScript to run this app. »
robots.txt : 404   ·   sitemap.xml : 404   ·   données structurées : 0
```

Le portfolio est une application React construite dans le navigateur. Un visiteur voit tout ; un robot d'IA reçoit une
page vide. **Google sait exécuter le JavaScript, les robots d'IA non** (OAI-SearchBot, PerplexityBot, ClaudeBot).
C'est la cause première : avant de parler de notoriété du domaine, il n'y a simplement **rien à lire**.

## Étape 0 — Les captures, AVANT toute modification (5 min)

Sinon la photo de départ est faussée et la mesure J0 perd son point de comparaison.

- [ ] Recherche `site:ayoubdevspace.vercel.app` sur Brave → capture.
- [ ] Même recherche sur Google et sur Bing → captures.
- [ ] Ranger les captures hors du dépôt, avec la date dans le nom.

## Étape 1 — Déposer les deux fichiers (10 min)

Ils sont prêts dans ce dossier. Dans ton projet React, ils vont dans **`public/`** : Vercel sert ce dossier tel quel,
sans passer par l'application.

- [ ] Copier `robots.txt` → `public/robots.txt`
- [ ] Copier `sitemap.xml` → `public/sitemap.xml`
- [ ] Déployer, puis vérifier que `https://ayoubdevspace.vercel.app/robots.txt` répond bien (et non une 404).

## Étape 2 — Publier une page lisible sans JavaScript (30 min)

C'est l'étape qui change tout. On ne touche pas à ton application : on ajoute **à côté** une page statique que les
robots lisent directement.

- [ ] Remplir `hub-profile.draft.json` :
  - `summary` : 3 à 5 phrases, **uniquement des faits vérifiables**.
  - `missions` : 2 à 4 missions réelles. Pour chacune : titre, client (nom public **ou** description anonymisée du
    type « scale-up SaaS B2B »), période, rôle, résumé, **faits chiffrés avec leur source**, stack.
  - **Règle absolue** : aucun chiffre que tu ne peux pas prouver. Une échelle vérifiable vaut mieux qu'un pourcentage
    inventé — un chiffre faux se retourne contre toi en entretien comme en mission.
- [ ] Générer la page :
      `node --import tsx apps/cli/src/main.ts hub --profile .war-room/experiment0/portfolio/hub-profile.draft.json --out hub-dist`
- [ ] Copier le contenu de `hub-dist/` dans `public/profil/` de ton portfolio.
- [ ] Ajouter un lien visible vers `/profil/` depuis ta page d'accueil.
- [ ] Déployer.

## Étape 3 — Vérifier comme un robot, pas comme un humain (5 min)

- [ ] `node --import tsx apps/cli/src/main.ts hub-verify --profile .war-room/experiment0/portfolio/hub-profile.draft.json`

La commande va chercher les pages en ligne **sans exécuter de JavaScript** et échoue si le texte n'y est pas, si un
robot est bloqué, si le sitemap est absent ou si l'hébergeur a ajouté un `noindex`.

## Étape 4 — Déclarer le site aux moteurs (20 min)

- [ ] **Google Search Console** : ajouter la propriété, la valider, soumettre `sitemap.xml`.
- [ ] **Bing Webmaster Tools** : idem (l'import depuis Search Console va plus vite).
- [ ] Demander l'indexation de `/` et de `/profil/`.
- [ ] Refaire les captures : ce sera l'état **après** correction, à comparer avec l'étape 0.

## Ce que ça ne garantit pas

Être lisible et indexé est **nécessaire**, pas suffisant. Nos propres mesures le montrent : les citations vont
massivement à Malt (39 %) et LinkedIn (26,5 %), et Anthropic ne consulte aucune source dans 90,8 % de ses réponses.
Aucune de ces étapes ne promet une citation — elles rendent seulement la citation **possible**.
