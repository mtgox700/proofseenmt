# Verdict du Shogun : refonte « Legends League »

> 2026-10-21. Branche `sprint/design-legends-polish` sur `main` (lots a à g déjà fusionnés, PR #72 à #77). Rien de
> déployé : la production attend le GO DEPLOY du founder.

## Le verdict

**La porte passe pour la surface publique, pas encore pour tout le produit.** La marque, le relevé des 780 réponses et
la frappe du poinçon tiennent, et surtout le site dit maintenant la vérité sur ce qui vérifie une mission ; mais
l'espace connecté n'a reçu que la marque et le nettoyage du vert, pas sa refonte, et l'accueil touche le seuil de
performance sur un passage sur trois.

## Les sept questions de la porte

1. **Un moment d'arrêt ?** Oui : le relevé, où chaque réponse d'IA est une case et où « cité 0 fois sur 780 » se lit
   d'un coup d'œil ; la frappe du poinçon sur un fait vérifié ; le passage au guichet entre la carte et la fiche.
2. **Chaque image a-t-elle un sens ?** Oui, et c'est pour ça que les captures d'une interface retirée ont quitté la
   vitrine. Il n'y a plus une image décorative : le relevé est fait des données, le poinçon marque un fait.
3. **Un défaut qui casse la magie ?** Kensa en a trouvé 3 bloquants et 7 majeurs en première passe, tous corrigés et
   vérifiés en seconde passe ; puis 3 phrases qui promettaient une vérification sur document, corrigées et tenues
   par un test de vocabulaire. Le plus grave n'était pas visuel : le site promettait un contrôle « sur pièce » que le
   code ne fait pas. Il dit maintenant : confirmée par le client, ou payée sur Proofseen.
4. **Mobile ?** Aucun débordement à 375 px, y compris tableau ouvert ; menu qui montre qu'il défile ; cibles de
   44 px.
5. **Sans JS ?** Tout le hub est du HTML serveur, aucun script hors JSON-LD, rien de caché en attendant une
   animation ; l'accueil a tout son texte dans le HTML.
6. **Budgets ?** Perf mobile 0,95 à 1 sur toutes les pages mesurées, accessibilité et SEO à 1, CLS ≤ 0,001. Les
   bonnes pratiques (0,96 et 0,93) ne tombent que sur l'adresse de l'aperçu : à remesurer en production.
7. **Vérité ?** Oui : chaque chiffre porte son n et sa date, aucun prix public sur les pages liées, aucun classement de
   personnes (le tri par nombre de faits vérifiés est retiré), le vert ne marque qu'un fait vérifié.

## Ce qui reste, et à qui

| Point | À qui | Pourquoi |
|---|---|---|
| Page « Commander » (49 € et 490 €, noindex, liée de nulle part) | founder | page de paiement : la garder, la rediriger ou la retirer est une décision de paiement |
| Pages `/n/ayoub-hammoudi/` et `/p/FR-7H2XK/` : la pseudonyme reprend le texte de la nominative, et « Disponible » est figé au 24 septembre | founder | c'est son profil ; décider s'il garde la page nominative |
| Tirets cadratins dans le rapport d'audit client et quatre courriels | tâche séparée proposée | hors du site, à purger avant tout envoi |
| Espaces fines insécables sur la vitrine React (23 occurrences) | prochaine passe | le hub est fait |
| Espace connecté : révélations depuis une opacité nulle, `CountUp` | prochaine passe | hors du périmètre public de la refonte |
| Ordre déclaré des compétences garanti en base (colonne `position`) | sprint produit | migration de schéma |
| Lighthouse en production | après GO DEPLOY | l'aperçu fausse les bonnes pratiques |
