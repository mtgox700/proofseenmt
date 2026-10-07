# C11 — Grands comptes et ESN · reprise

> Mis à jour le 2026-10-07, branche `sprint/c11-grands-comptes`. Décisions du sprint : `C11_DECISIONS.md`.

## Fait

| Brique | Fichiers |
|---|---|
| Validation à deux niveaux (deux administrateurs distincts, tenue par la base), jamais plus de validations que d'administrateurs, validations figées | `packages/db/src/contracts.ts` (`complete`), migrations `…_large_accounts`, `…_large_accounts_hardening` |
| Réglage par le propriétaire (refusé avec un seul administrateur) | `largeAccounts.setApprovalLevels`, `PUT /api/organisations/[id]/settings` |
| Centre de coûts par contrat, figé dès la facture de mission | `largeAccounts.setCostCenter`, `PUT /api/contracts/[id]/cost-center` |
| Vivier privé : freelances déjà payés, par des faits, sans score | `largeAccounts.talentPool`, `GET /api/organisations/[id]/talent-pool` |
| Clés d'API par entreprise : montrées une fois, empreinte SHA-256, 10 actives au plus, révoquées par la base quand leur créateur part, perd son rôle ou efface son compte | `packages/db/src/api-keys.ts`, `GET/POST /api/organisations/[id]/api-keys`, `DELETE …/api-keys/[keyId]` |
| API de lecture : contrats et factures de mission de l'entreprise appelante, paginés ; jamais la facture de commission ; identité légale du freelance seulement une fois le contrat signé | `packages/db/src/company-api.ts`, `GET /api/v1/contracts`, `GET /api/v1/invoices` (`Authorization: Bearer psk_…`) |
| Export comptable CSV (point-virgule, virgule décimale, BOM, garde contre l'injection de formules, période en jours de Paris) | `packages/invoicing/src/accounting-csv.ts`, `GET /api/v1/invoices/export`, `GET /api/organisations/[id]/accounting-export` |
| Facture de mission en code 380 (tiers mandaté), plus 389 | `packages/invoicing/src/cii.ts` |
| Délais de transaction adaptés à une base distante | `packages/db/src/client.ts` |

**« Équipe » = centre de coûts.** Le test « entreprise à trois équipes » (`packages/db/test/company-api.test.ts`) fait
jouer à trois administrateurs, chacun avec son centre de coûts, le parcours mission → contrat → paiement → double
validation → versement. Il n'y a pas de modèle « équipe » à part : à créer seulement si un vrai client le demande.

**Exécuté sur Railway le 2026-10-07** (serveur de dev, `scripts/api-key-check.ts`, entreprise jetable effacée ensuite) :
- sans clé : 401 ; clé inventée : 401 « clé invalide » ; clé dans l'URL : ignorée, 401 ;
- avec la clé : `contracts` et `invoices` répondent 200 ; `limit=500` répond 400 ;
- l'export CSV répond 200 en `text/csv` avec un nom de fichier ; une période inversée répond 422 ;
- après révocation, la même clé répond 401 ;
- la date de dernière utilisation est bien écrite.

Ce passage a trouvé un vrai défaut, invisible des tests : une transaction expirait à 5 s face à Railway.

Relecture sécurité : 0 critique, 0 haute ; 4 moyennes et 6 basses, toutes corrigées et testées, sauf la dixième, qui
relève du déploiement. Les migrations `…_large_accounts`, `…_api_keys` et `…_large_accounts_hardening` sont appliquées
sur Railway.

## Reste à faire

1. **Lot C : commission de fidélité à 5 %** (`PROOFSEEN_REPEAT_COMMISSION_BP`), dès qu'un freelance a déjà été payé
   par la même entreprise. Taux figé au contrat et affiché avant signature (voir `C11_DECISIONS.md`).
2. **Frais client Vivier+ à 3 %**, en même temps que les paiements réels (GO PAIEMENT LIVE). Il faudra une troisième
   facture, de Proofseen à l'entreprise.
3. **Au déploiement** : vérifier que l'hébergeur réécrit `x-real-ip`. Sinon, la limite par adresse de l'API de lecture
   peut être visée par un tiers ; la limite de 600 appels par heure et par clé tient quand même.
4. **Écrans** (session design) :
   - réglage des deux niveaux ;
   - centre de coûts ;
   - vivier ;
   - clés d'API, avec la clé affichée une seule fois ;
   - bouton d'export comptable.
5. **Super PDP** : bac à sable avec la mise en production, et réponses aux questions listées dans `C11_DECISIONS.md`.
