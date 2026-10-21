# Notice : sources d'inspiration de la refonte

Refonte « Legends League » (octobre 2026). Ce fichier liste les composants tiers consultés pendant la refonte et ce
qu'on en a gardé. Les ressources effectivement servies (polices, logo, images) sont dans `CREDITS.md`.

## Catalogue 21st.dev

Consulté avec le compte du founder (offre payante), le 2026-10-21. Règle suivie : un composant n'entre que s'il sert
l'idée de preuve, et il est réécrit à la charte, jamais collé. **Aucune ligne de code de 21st.dev n'est livrée** : ni
composant, ni dépendance (`motion`, `lucide-react`, `@radix-ui`, `class-variance-authority` absents du dépôt). Le
registre n'indique pas de licence pour ces trois composants ; nous n'en avons repris que l'idée, réécrite en HTML et
CSS sans script, et nous la créditons quand même.

| Composant | Auteur sur 21st.dev | Idée reprise | Où, et comment |
|---|---|---|---|
| Timeline (id 35051) | kuratlielia | Un fil vertical daté dont le connecteur se dessine d'une étape à la suivante. | Trace de preuve de la fiche profil (`packages/hub/src/profile-styles.ts`) : ligne en CSS, visible sans animation, dessinée seulement sous `prefers-reduced-motion: no-preference`. |
| Stamp (id 3417) | designali-in | Le tampon comme geste de validation. | Le poinçon de garantie de la marque, dessiné pour Proofseen (`packages/brand/scripts/marks.py`) ; la frappe sur un fait vérifié est écrite en CSS. Ni tracé ni code repris. |
| Audit Log (id 25163) | corr | Un journal horodaté avec acteur, type et statut. | Structure des faits vérifiés : la source, la date et qui a vérifié, en HTML serveur. |

Écartés (badges lumineux, cartes en verre ou inclinées, grilles d'équipe) : voir `.war-room/design/21ST_SHORTLIST.md`.
