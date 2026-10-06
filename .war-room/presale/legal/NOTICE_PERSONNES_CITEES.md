# PROJET — à valider par un juriste avant toute publication

# Vous avez peut-être été cité par une IA dans nos mesures — ce que nous faisons de votre nom

> Version 0.1 du 2026-09-18 · Rédigé par Legal & Trust (War Room) · **Ce n'est pas un avis juridique.**
> Notice publique d'information au titre de l'art. 14 du RGPD (Règl. (UE) 2016/679), publiée en application de l'art. 14(5)(b).
> Sources : `foundations/CONFORMITE.md` §2 (T2, T3, T5, T10) et §3 ; `foundations/research/R3_CONFORMITE.md` §1.2 et §1.3.

---

## 1. Pourquoi cette notice

Proofseen aide des freelances à savoir s'ils ressortent quand un recruteur interroge une IA.

Pour cela, nous posons à des IA (modèles d'OpenAI, d'Anthropic et de Perplexity) des questions du type : « trouve-moi des freelances pour
cette mission ». Les réponses peuvent **citer d'autres professionnels**. Votre nom a donc pu apparaître dans une réponse, sans que nous
l'ayons cherché.

Nous ne connaissons pas vos coordonnées. Pour vous prévenir individuellement, il faudrait collecter **plus** de données sur vous.
Nous publions donc cette notice à la place (art. 14(5)(b) du RGPD).

## 2. Qui est responsable

[RAISON SOCIALE], [FORME], [SIÈGE], RCS [RCS].
Contact pour vos données : **[DPO/CONTACT RGPD]**.

## 3. Ce que nous faisons, et ne faisons pas, avec votre nom

**Ce que nous faisons**

- Quand une réponse arrive, votre nom est **détecté et masqué en mémoire, avant toute écriture** sur un disque.
- Pour le contrôle technique et les contestations, nous gardons une version de la réponse où **les noms sont remplacés par des jetons**
  (pseudonymisation), **chiffrée**.
- Cette version est **supprimée automatiquement au bout de 72 heures au plus**. La suppression est journalisée.
- Nous ne gardons durablement que les **domaines des grandes plateformes** cités (par exemple LinkedIn, GitHub, Malt). Tout autre domaine,
  dont un site personnel, est réduit à la catégorie « autre ».

**Ce que nous ne faisons jamais**

- Nous ne **cherchons** pas votre nom. Nous ne constituons **aucun profil** sur vous.
- Nous ne **montrons** jamais votre nom à nos clients. Nous ne leur disons jamais qui apparaît à leur place.
- Nous ne **vendons** ni ne partageons aucune donnée vous concernant.
- Nous ne **réutilisons** pas ce que les IA disent de vous. Ces informations peuvent être fausses : nous ne les affichons pas.
- Nous n'utilisons pas ces données pour **entraîner** un modèle.

**Étalonnage manuel.** Pour contrôler nos mesures, nous consultons parfois à la main des applications d'IA grand public. Nous ne notons que
« oui/non » et le rang de notre client. Nous ne gardons aucune capture d'écran non caviardée.

## 4. Pourquoi nous pouvons le faire (base légale)

**Intérêt légitime** (art. 6(1)(f) du RGPD) : mesurer, pour notre client, s'il est cité par les IA.

Nous estimons que cet intérêt ne l'emporte pas sur vos droits, car :

- votre nom arrive **par hasard** : nous ne pouvons pas empêcher une IA de le citer ;
- il est masqué **avant tout stockage** ;
- la version pseudonymisée est **supprimée sous 72 heures** ;
- **aucune décision** n'est prise à votre sujet et **rien n'est diffusé**.

Nous tenons une note de mise en balance à disposition de la CNIL. [À RÉDIGER avant le premier rapport vendu ; ne pas publier cette phrase avant.]

## 5. Qui peut recevoir ces données

- **Les fournisseurs d'IA** qui produisent la réponse (OpenAI, Anthropic, Perplexity). Ils conservent leurs échanges selon leurs propres règles,
  de 0 à 30 jours selon le fournisseur [À CONFIRMER pour Anthropic], sauf accord de zéro rétention.
- **Notre hébergeur** [HÉBERGEUR], pour le stockage chiffré de 72 heures.
- Personne d'autre. **Pas nos clients.**

Certains de ces prestataires sont établis aux États-Unis. Les transferts sont encadrés par les clauses contractuelles types de la Commission
européenne. Détails : [POLITIQUE DE CONFIDENTIALITÉ].

## 6. D'où viennent ces données

Des **réponses des IA** interrogées. Ces IA s'appuient sur leurs connaissances et sur leur recherche web. Nous ne savons pas précisément
quelles sources elles ont utilisées pour vous citer.

## 7. Vos droits

Vous pouvez vous **opposer** à ce traitement, et demander l'**accès**, l'**effacement** ou la **limitation**.

Écrivez à **[DPO/CONTACT RGPD]**.

**Ce que nous pouvons faire concrètement**

- Au-delà de 72 heures, **nous n'avons plus rien** : la version pseudonymisée est supprimée, et les statistiques ne contiennent que des domaines
  de plateforme.
- Avant 72 heures, votre nom est remplacé par un jeton. [À CONFIRMER : conservons-nous ou non une table de correspondance nom ↔ jeton ?]
  Si nous ne pouvons pas vous identifier, nous vous le disons. Nous ne sommes pas tenus de collecter des données supplémentaires pour vous
  retrouver (art. 11 du RGPD).
- Si vous nous donnez des informations qui permettent de vous identifier dans une réponse encore conservée, nous la supprimons.
- [À TRANCHER : ajout de votre nom à une liste d'exclusion. Attention : cela suppose de conserver votre nom. Nous ne le ferons qu'avec votre accord explicite.]

Nous gardons la trace de votre demande et de notre réponse pendant [DURÉE — À TRANCHER].

**Réclamation** : vous pouvez saisir la **CNIL**, www.cnil.fr. [Référence juridique à confirmer par le juriste.]

## 8. Recruteurs nommés dans une offre d'emploi

Nos clients nous transmettent des offres d'emploi. Avant tout envoi à une IA, nous retirons les e-mails, les téléphones, les URL et
**les noms de recruteurs** présents dans l'offre. Base légale : intérêt légitime (art. 6(1)(f)) pour ces données résiduelles.
Vous pouvez exercer vos droits à la même adresse.

---

## Points à trancher par le juriste

1. **Suffisance de l'avis public** (art. 14(5)(b)) pour des personnes dont nous ne connaissons que le nom cité par une IA. Documentation de la
   mise en balance « effort disproportionné » (considérant 62).
2. **Articulation avec l'art. 11** : réponse type à une demande d'accès ou d'opposition quand la personne n'est plus identifiable.
3. **Table de correspondance des jetons** : si elle existe, les données restent personnelles pendant 72 h ; si elle n'existe pas, le brut est-il
   encore une donnée personnelle ? Impact sur la rédaction de la section 7.
4. **Liste d'exclusion** : faut-il la proposer, alors qu'elle impose de conserver le nom de la personne qui s'oppose ? Base légale et durée.
5. **Mise en balance de l'intérêt légitime** : la durée de 72 h est-elle défendable ? Faut-il publier la note ou la tenir à disposition ?
6. **Durées chez les fournisseurs** (Anthropic : 30 j ou aucune ; Perplexity : DPA non lu) et mention « 0 à 30 jours ».
7. **Section 8 (recruteurs)** : faut-il une notice distincte ? Les noms de recruteurs retirés de l'offre sont-ils conservés dans l'offre d'origine
   stockée au titre de T2 ?
8. **Catégories de données** : un nom cité par une IA peut être accompagné d'informations (ville, compétences, employeur). Faut-il les lister
   comme catégories, alors qu'elles sont masquées ou non conservées ?
