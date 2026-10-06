# DEMANDE ÉCRITE — Perplexity · API Terms §2.5 (« competitive with Perplexity »)

> Legal & Trust · 2026-09-18 · Tâche founder F7 (envoi avant le 2026-10-02). Confirmation **exigée avant le premier rapport vendu** (`CONFORMITE.md` §5).
> Conditions lues le 2026-09-18 : Perplexity API Terms of Service (mise à jour du 23 janvier 2026), Search Addendum (22 septembre 2025) (`R5` §3).

## Résumé en français

Nous décrivons factuellement notre usage de l'API Sonar (endpoint de chat, **jamais** l'API `/search`) : des questions de recruteur générées par nous,
des tirages répétés, une analyse automatisée des réponses et des citations, et des rapports vendus **au freelance lui-même**. Nous ne revendons pas les
réponses brutes et nous masquons les noms de tiers avant tout stockage.
Question principale : **un service de mesure de visibilité dans les réponses de Perplexity est-il « competitive with Perplexity » (§2.5) ?**
Questions secondaires : un rapport PDF remis au client reste-t-il un affichage « solely within the Customer Applications » (§2.1(ii)) ? Pouvez-vous
nous transmettre le DPA et la durée de rétention des données envoyées à l'API ?

**Canal d'envoi** : [À VÉRIFIER sur le site officiel de Perplexity avant envoi : contact API / legal / sales. Ne pas utiliser une adresse trouvée ailleurs.]
**Pièce à archiver** : la réponse écrite, datée, avec la version des conditions en vigueur ce jour-là.

---

## E-mail (à envoyer en anglais)

**Subject:** Written confirmation request — API Terms §2.5 ("competitive with Perplexity") for a candidate-side visibility measurement service

Hello,

I am the founder of Proofseen ([COMPANY LEGAL NAME / STATUS], [COUNTRY]), an early-stage project using the Perplexity Sonar API
(account: [ACCOUNT EMAIL / ID]). Before we sell our first report, I would like a written answer to one compliance question.

**What we do**

- Proofseen helps an individual freelancer understand whether they are found when a recruiter searches for talent with an AI assistant.
- We send recruiter-style questions, built from public job descriptions with contact details removed, to the Sonar chat completions endpoint.
  We do the same with two other providers. **We do not use the Search API (`/search`).**
- Each question is asked several times, because answers vary. A full paid audit uses about 60 Sonar calls; our initial internal experiment uses a few hundred.
- We analyse the responses automatically: is our customer mentioned, at what position, and which web domains are cited as sources?
- The customer is the freelancer themself. They receive a report about **their own** visibility: rates with confidence intervals, the funnel step where
  they drop out, the categories of domains cited (e.g. LinkedIn, GitHub), and a list of corrective actions.
- We verify that the customer owns the profiles we measure before any analysis.

**What we do not do**

- We do not offer a search engine, an answer engine or a chat interface. Customers cannot send their own queries.
- We do not resell or redistribute raw Sonar outputs. Customers see derived metrics, not Perplexity's answers.
- Names of third parties (other professionals mentioned in answers) are masked in memory before anything is written to disk. Raw answers are kept
  pseudonymised for 72 hours at most, then deleted. We never show a customer who appears instead of them.
- We do not rank candidates for recruiters or employers.

**Our question**

1. **Main question.** Would the service described above be considered "competitive with Perplexity" under §2.5 of the API Terms? If it is not,
   could you confirm this in writing?

**Two secondary questions**

2. Our reports are delivered to the customer as a web page or PDF containing derived metrics and domain categories. Does this count as displaying
   Output "solely within the Customer Applications" under §2.1(ii)?
3. Could you send us your Data Processing Agreement for API customers, and tell us how long data sent to the Sonar API is retained?

We would be grateful for a written reply that we can keep on file. I am happy to provide more detail or a short call.

Best regards,

[FIRST NAME LAST NAME]
[TITLE], Proofseen
[COMPANY LEGAL NAME] · [REGISTRATION NUMBER] · [ADDRESS]
[EMAIL] · [PHONE]
