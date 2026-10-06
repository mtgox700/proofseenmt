# DEMANDE ÉCRITE — Anthropic · Commercial Terms §D.4 (« resale »)

> Legal & Trust · 2026-09-18 · Tâche founder F7 (envoi avant le 2026-10-02). Confirmation **exigée avant le premier rapport vendu** (`CONFORMITE.md` §5).
> Conditions lues le 2026-09-18 : Commercial Terms (effectives au 17 juin 2025), doc du web search tool (`R5` §2).

## Résumé en français

Nous décrivons factuellement notre usage de l'API Claude avec la recherche web : des questions de recruteur générées par nous, des tirages répétés,
une analyse automatisée des réponses et des citations, et des rapports vendus **au freelance lui-même**, sur sa propre visibilité. Nous ne revendons
ni l'accès à l'API ni les réponses brutes, et nous masquons les noms de tiers avant tout stockage.
Nous posons une question principale : **ce service est-il une « resale » au sens du §D.4 ?** Deux questions secondaires : conditions du fournisseur
de recherche web (Brave ou autre) opposables ou non au client API ; durée de rétention par défaut et éligibilité à la rétention zéro (ZDR).

**Canal d'envoi** : [À VÉRIFIER sur le site officiel d'Anthropic avant envoi : contact commercial (sales) ou support de la Console. Ne pas utiliser une adresse trouvée ailleurs.]
**Pièce à archiver** : la réponse écrite, datée, avec la version des conditions en vigueur ce jour-là.

---

## E-mail (à envoyer en anglais)

**Subject:** Written confirmation request — Commercial Terms §D.4 ("resale") for a candidate-side visibility measurement service

Hello,

I am the founder of Proofseen ([COMPANY LEGAL NAME / STATUS], [COUNTRY]), an early-stage project using the Claude API under your Commercial Terms
(Console organization ID: [ORG ID]). Before we sell our first report, I would like a written answer to one compliance question.

**What we do**

- Proofseen helps an individual freelancer understand whether they are found when a recruiter searches for talent with an AI assistant.
- We send recruiter-style questions, built from public job descriptions with contact details removed, to the Claude API with the web search tool enabled.
  We do the same with two other providers.
- Each question is asked several times, because answers vary. A full paid audit uses about 60 Claude API calls; our initial internal experiment uses a few hundred.
- We analyse the responses automatically: is our customer mentioned, at what position, and which web domains are cited as sources?
- The customer is the freelancer themself. They receive a report about **their own** visibility: rates with confidence intervals, the funnel step where
  they drop out, the categories of domains cited (e.g. LinkedIn, GitHub), and a list of corrective actions.
- We verify that the customer owns the profiles we measure before any analysis.

**What we do not do**

- We do not give customers access to the Claude API, a chat interface, or any way to send their own prompts.
- We do not resell or redistribute raw model outputs. Customers see derived metrics, not Claude's responses.
- Names of third parties (other professionals mentioned in responses) are masked in memory before anything is written to disk. Raw responses are kept
  pseudonymised for 72 hours at most, then deleted. We never show a customer who appears instead of them.
- We do not rank candidates for recruiters or employers, and we make no hiring decisions.

**Our question**

1. **Main question.** Does the service described above constitute a "resale" of the Services under §D.4 of the Commercial Terms, or is it a permitted use
   in which we sell our own analysis of Outputs that we own under §B? If approval is needed, could you grant it in writing?

**Two secondary questions**

2. Are any terms of the underlying web search provider (or other third-party features, §A.2) binding on API customers for this use?
3. What is the default retention period for API inputs and outputs on our account, and is our use case eligible for zero data retention?

We would be grateful for a written reply that we can keep on file. I am happy to provide more detail or a short call.

Best regards,

[FIRST NAME LAST NAME]
[TITLE], Proofseen
[COMPANY LEGAL NAME] · [REGISTRATION NUMBER] · [ADDRESS]
[EMAIL] · [PHONE]
