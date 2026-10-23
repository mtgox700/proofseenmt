# Crédits des ressources de marque

Chaque ressource tierce servie par `apps/web`, avec son auteur, sa source et sa licence. Mis à jour par Sumi.

## Polices

| Fichier | Famille d'origine | Auteur | Source officielle | Licence | Modification |
|---|---|---|---|---|---|
| `public/fonts/ps-display-v1.woff2` | Source Serif 4, version 4.005 (variable, romain) | Frank Grießhammer pour Adobe | https://github.com/adobe-fonts/source-serif/releases/tag/4.005R | SIL Open Font License 1.1, texte dans `public/fonts/OFL-source-serif-4.txt` | taille optique figée à 48, graisse 400 à 700 conservée, sous-ensemble latin, renommée « PS Display » |
| `public/fonts/ps-mono-v1.woff2` | Source Code Pro, version variable 1.026 (droit) | Paul D. Hunt pour Adobe | https://github.com/adobe-fonts/source-code-pro/releases/tag/2.042R-u%2F1.062R-i%2F1.026R-vf | SIL Open Font License 1.1, texte dans `public/fonts/OFL-source-code-pro.txt` | graisse figée à 500, sous-ensemble latin, renommée « PS Mono » |

« Source » est un nom de fonte réservé (Reserved Font Name) au sens de l'OFL : un sous-ensemble est une version
modifiée, il ne peut donc pas porter ce nom. D'où « PS Display » et « PS Mono » dans la table `name` des fichiers et
dans les `@font-face`. Les mentions de copyright d'Adobe (identifiants de nom 0 et 7) sont conservées dans les fichiers.

## Logo, icônes, cartes de partage

Dessinés pour Proofseen (`packages/brand/scripts/marks.py`, `build_brand.py`). Les lettres du logotype et des cartes
de partage sont les contours de PS Display et PS Mono ci-dessus, convertis en tracés : l'OFL autorise l'usage des
glyphes dans un document ou une image.

## Images

Photos de la refonte v2, dans `public/images/v2/`. Toutes viennent d'Unsplash, sous la **licence Unsplash**
(https://unsplash.com/license) : usage commercial permis, attribution non obligatoire, que nous donnons quand même.
Pour chaque photo, l'auteur, la page et la mention « Free to use under the Unsplash License » ont été relevés sur la
page de la photo le 2026-10-23, avant le téléchargement des originaux depuis `images.unsplash.com` (largeur 2000 px).

Chaque photo est servie en 4 fichiers : `<nom>-768` et `<nom>-1536`, en `.webp` (qualité 78) et `.avif` (qualité 50),
métadonnées EXIF retirées. Les personnes photographiées nous sont inconnues : aucune n'est un client, un
freelance ou un témoin de Proofseen, et aucune légende ne doit le laisser croire (voir `.war-room/brand/BRAND_BOOK_V2.md` §6).

| Fichiers | Auteur | Page de la photo | Publiée le | Modification | Licence | Relevé le |
|---|---|---|---|---|---|---|
| `images/v2/freelance-code-night-{768,1536}.{webp,avif}` | Mohammad Rahmani (@afgprogrammer) | https://unsplash.com/photos/man-in-black-long-sleeve-shirt-using-computer-_Fx34KeqIEw | 2021-06-12 | redimensionnée ; logo d'une canette de soda flouté | Unsplash License | 2026-10-23 |
| `images/v2/code-screen-violet-{768,1536}.{webp,avif}` | Mohammad Rahmani (@afgprogrammer) | https://unsplash.com/photos/laptop-screen-displaying-colorful-code-8qEB0fTe9Vw | 2020-12-12 | redimensionnée ; aucune | Unsplash License | 2026-10-23 |
| `images/v2/developer-focus-code-{768,1536}.{webp,avif}` | charlesdeluvio (@charlesdeluvio) | https://unsplash.com/photos/person-facing-computer-desktop-pjAH2Ax4uWk | 2017-11-22 | redimensionnée ; recadrée en bas (barre d'icônes d'applications retirée) | Unsplash License | 2026-10-23 |
| `images/v2/developer-desk-overhead-{768,1536}.{webp,avif}` | Max Duzij (@max_duz) | https://unsplash.com/photos/man-facing-three-computer-monitors-while-sitting-qAjJk-un3BI | 2019-02-17 | redimensionnée ; marques du clavier et du casque floutées | Unsplash License | 2026-10-23 |
| `images/v2/hands-keyboard-terminal-{768,1536}.{webp,avif}` | Mikhail Fesenko (@proggga) | https://unsplash.com/photos/a-person-sitting-at-a-desk-with-a-laptop-and-a-computer-monitor-p6YWrjhmjhM | 2021-09-14 | redimensionnée ; recadrée (marque de l'écran et nom de l'ordinateur retirés), marque du clavier floutée | Unsplash License | 2026-10-23 |
| `images/v2/developer-woman-office-{768,1536}.{webp,avif}` | ThisisEngineering (@thisisengineering) | https://unsplash.com/photos/woman-in-green-shirt-sitting-in-front-of-computer-64YrPKiguAE | 2020-02-05 | redimensionnée ; aucune | Unsplash License | 2026-10-23 |
| `images/v2/contract-signature-{768,1536}.{webp,avif}` | Jakub Żerdzicki (@jakubzerdzicki) | https://unsplash.com/photos/man-signing-a-document-with-a-pen-QI6NLgN5XnM | 2025-11-21 | redimensionnée ; aucune (texte du document illisible aux tailles servies) | Unsplash License | 2026-10-23 |
| `images/v2/handshake-deal-dark-{768,1536}.{webp,avif}` | Rock Staar (@rockstaar_) | https://unsplash.com/photos/two-people-shaking-hands-over-a-wooden-table-NzIV4vOBA7s | 2021-11-30 | redimensionnée ; aucune | Unsplash License | 2026-10-23 |
| `images/v2/handshake-hiring-desk-{768,1536}.{webp,avif}` | Mina Rad (@miinrad) | https://unsplash.com/photos/a-man-and-a-woman-shaking-hands-in-front-of-a-laptop-qFSQFSmfZkA | 2023-06-14 | redimensionnée ; aucune | Unsplash License | 2026-10-23 |
| `images/v2/client-freelance-brief-{768,1536}.{webp,avif}` | Headway (@headwayio) | https://unsplash.com/photos/person-gesturing-during-meeting-with-laptop-5QgIuuBxKwM | 2018-01-29 | redimensionnée ; aucune | Unsplash License | 2026-10-23 |
| `images/v2/mission-scoping-whiteboard-{768,1536}.{webp,avif}` | Kaleidico (@kaleidico) | https://unsplash.com/photos/two-people-drawing-on-whiteboard-26MJGnCM0Wc | 2018-07-26 | redimensionnée ; marque des feutres floutée | Unsplash License | 2026-10-23 |
| `images/v2/remote-freelance-coffee-{768,1536}.{webp,avif}` | Parker Byrd (@parkerabyrd) | https://unsplash.com/photos/gray-laptop-computer-on-brown-wooden-table-beside-person-sitting-on-chair-gxD8hCmi0IQ | 2016-09-20 | redimensionnée ; aucune | Unsplash License | 2026-10-23 |

Aucune illustration tierce. Aucun logo de marque tierce n'est visible : les marques présentes sur les photos
d'origine ont été recadrées ou floutées (colonne Modification), ce que la licence Unsplash permet.
