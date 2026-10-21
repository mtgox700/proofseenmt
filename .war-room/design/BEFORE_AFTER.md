# Avant / après : refonte « Legends League »

> Avant : production `proofseen.com` capturée le 2026-10-21 à 04:18 (`before/`). Après : `main` avec la branche
> `sprint/design-legends-polish`, sur l'aperçu privé du VPS, le 2026-10-21 (`after/`). Sombre, mouvement réduit,
> 1440×900 et 375×812. Rien n'est déployé : la production montre toujours l'avant.

## Les pages, une par une

| Page | Avant | Après | Ce qui a changé |
|---|---|---|---|
| Accueil, bureau | ![](before/desktop-01-accueil.png) | ![](after/desktop-01-accueil.png) | Vitrine refaite en bureau de garantie. Le relevé des 780 réponses est un SVG serveur de 2,5 Ko (avant : 214 Ko de données envoyées au navigateur). Plus de prix public. Page indexable, avec son JSON-LD. |
| Accueil, téléphone | ![](before/mobile-01-accueil.png) | ![](after/mobile-01-accueil.png) | Même ordre de lecture ; menu sur sa propre largeur, qui s'estompe là où il défile. |
| Annuaire des freelances | ![](before/desktop-02-annuaire-freelances.png) | ![](after/desktop-02-annuaire-freelances.png) | Devient le registre public : légende vérifié / déclaré, une seule carte profil pour le hub et l'appli, ordre par date de mise à jour, jamais par score. |
| Annuaire, téléphone | ![](before/mobile-02-annuaire-freelances.png) | ![](after/mobile-02-annuaire-freelances.png) | Filtres dans un tiroir, cibles de 44 px. |
| Fiche profil | ![](before/desktop-03-profil.png) | ![](after/desktop-03-profil.png) | Trace de preuve datée ; le vert seulement sur une pièce vérifiée par un tiers ; « Pas encore de pièce vérifiée » quand il n'y en a pas. |
| Fiche, téléphone | ![](before/mobile-03-profil.png) | ![](after/mobile-03-profil.png) | Même trace, lisible sans JavaScript. |
| Missions | ![](before/desktop-04-missions.png) | ![](after/desktop-04-missions.png) | Un état vide qui dit pourquoi et propose trois issues ; légende de l'état des entreprises au répertoire officiel ; colonne alignée sur l'en-tête. |
| Entreprises | ![](before/desktop-05-entreprises.png) | ![](after/desktop-05-entreprises.png) | Trois registres séparés : vérifié (daté, seul vert), mesuré sur Proofseen (avec son n), déclaré. |
| Baromètre | ![](before/desktop-06-barometre.png) | ![](after/desktop-06-barometre.png) | Chaque chiffre porte son n et sa date ; sous le seuil de 10, la page le dit et montre la distance au seuil au lieu d'un chiffre. |
| Blog | ![](before/desktop-07-blog.png) | ![](after/desktop-07-blog.png) | Les baromètres présentés comme jeux de données CC BY ; articles sur 66 caractères, sources numérotées. |
| Simulateur | ![](before/desktop-08-simulateur.png) | ![](after/desktop-08-simulateur.png) | Reprend la marque (en-tête, typographie, champs) ; son calcul n'a pas changé. |
| 404 | ![](before/desktop-09-404.png) | ![](after/desktop-09-404.png) | Page d'erreur à la marque, avec des issues réelles. |

## Les chiffres

Lighthouse mobile, 3 passages par page, mesuré sur le VPS contre l'aperçu (`MAMORI_REPORT.md`). Aucun Lighthouse n'a
été mesuré avant la refonte : on compare donc les poids, mesurés des deux côtés.

| Page | Perf | Accessibilité | Bonnes pratiques | SEO | LCP | CLS |
|---|---|---|---|---|---|---|
| Accueil | 0,96 à 0,98 | 1 | 0,96 (aperçu) | 1 | 2,3 à 2,7 s | 0 |
| Profil | 0,99 à 1 | 1 | 0,93 (aperçu) | 1 | 1,3 s | 0 |
| Freelances | 0,99 | 1 | 1 | 1 | 1,4 s | 0,001 |
| Missions | 0,99 | 1 | 1 | 1 | 1,4 à 1,5 s | 0,0003 |
| Baromètre | 1 | 1 | 1 | 1 | 1,3 s | 0 |
| Blog | 1 | 1 | 1 | 1 | 1,4 s | 0 |

Les bonnes pratiques sous 1 viennent de l'adresse de l'aperçu, pas du design : la clé Clerk de production refuse
127.0.0.1 (deux 400 dans la console) et la photo du profil, servie par proofseen.com avec
`Cross-Origin-Resource-Policy: same-site`, est bloquée depuis 127.0.0.1. À remesurer en production après le GO DEPLOY.

| Poids | Avant | Après |
|---|---|---|
| HTML de l'accueil | 240 875 o, dont 214 378 caractères pour les 780 points du graphique | 189 579 o, le relevé en SVG de 2 553 o |
| Captures d'une interface retirée sur l'accueil | 8 images WebP et un script d'onglets | aucune |

## Ce qui n'a pas bougé, volontairement

- Sitemaps, `robots.txt` et `llms.txt` identiques à la production ; les 39 adresses des sitemaps répondent 200.
- Pages du hub : HTML serveur, aucun script hors JSON-LD, rien de caché en attendant une animation.
- Mouvement réduit : aucune animation ne tourne (`getAnimations()` vaut 0 sur les 7 pages mesurées).
