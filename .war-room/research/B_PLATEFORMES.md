# Recherche B — Ce que les plateformes exposent aux crawlers IA (Elias, relevé du 2026-09-18)

> Rapport du sous-agent, condensé. robots.txt récupérés en direct (curl avec UA de navigateur).
> Un profil public par plateforme a été chargé. Aucun challenge anti-bot contourné.

| Plateforme | Profil public sans login | Bots de recherche IA sur les profils | Bots d'entraînement | Balisage du profil | Matching IA interne | Scraping dans les CGU |
|---|---|---|---|---|---|---|
| **LinkedIn** | Oui (`/in/…` → 200, `noarchive`) | **Autorisés** : OAI-SearchBot, Claude-SearchBot, Googlebot, Bingbot. **Bloqués** : ChatGPT-User, Claude-User, PerplexityBot, Perplexity-User | Tous bloqués ; `*` = Disallow / | JSON-LD Person riche | Hiring Assistant | **Interdit** |
| **Malt** | Oui (`noindex` sur malt.com) | Autorisés via `*` | GPTBot bloqué | ProfilePage + Person + Offer | Oui (IA de recherche) | **Interdit** (§10.2) |
| **Free-Work** | **Pas de page profil publique** | ouvert (OAI-SearchBot `Allow: /`) | autorisés | sans objet | NON VÉRIFIÉ | aucune clause trouvée |
| **Welcome to the Jungle** | **Non** (`/me`, `/users` interdits) | sans objet | — | sans objet | côté candidat seulement | **Interdit** |
| **GitHub** | Oui | Autorisés (Crawl-delay 1), mais `?tab=`, `/tree/`, `/commits/` bloqués | autorisés | Microdata Person | aucun produit recruteur | revente de données aux recruteurs **interdite** (AUP §7) |
| **Crème de la Crème** | **Non** (aucun profil dans le sitemap) ; ⚠ `creme-de-la-creme.com` est un domaine parqué, le vrai site est cremedelacreme.io | — | — | — | NON VÉRIFIÉ | aucune clause trouvée |
| **Comet** | **Non** | tout ouvert | — | — | NON VÉRIFIÉ | aucune clause trouvée |
| **Codeur.com** | Oui | tout ouvert | autorisés | **ProfilePage + Person + Rating + Offer** (le plus riche) | NON VÉRIFIÉ | aucune clause trouvée |
| **Upwork** | Challenge Cloudflare (NON VÉRIFIÉ en direct) ; profils présents dans les SERP | `/freelancers/~` non interdit | Allow seulement ; publie un `llms.txt` et `/ai-reference` | NON VÉRIFIÉ | Uma Recruiter | **Interdit** |
| **Stack Overflow** | Oui | robots.txt répond **HTTP 418** + Disallow / (ambigu) | idem | pas de Person | — | copie interdite |
| **dev.to** | Oui | autorisés | autorisés | Person | — | aucune clause |
| **Medium** | Oui (`index,follow`) | autorisés via `*` | GPTBot et ClaudeBot bloqués | Person | — | NON VÉRIFIÉ |

## Classement de visibilité par les LLM d'un profil freelance

1. GitHub
2. LinkedIn
3. Malt
4. Codeur
5. dev.to / Medium
6. Upwork
7. Stack Overflow
8. **Invisibles** : Free-Work, WTTJ, Comet, Crème de la Crème (aucun profil public)

## Implications

- **Trois familles de bots** : entraînement, index de recherche, fetch à la demande. Sur LinkedIn,
  l'index passe mais **le fetch à la demande est bloqué** : une URL LinkedIn collée dans ChatGPT ou Claude est refusée.
- **Perplexity est aveugle sur LinkedIn** ; GPTBot l'est sur Malt et Medium. Aucune plateforme ne couvre tous les LLM.
- Scraping interdit presque partout, donc produit **100 % opt-in**, sur les données fournies par le freelance.
- Free-Work, WTTJ, Comet et Crème de la Crème = **matching interne uniquement**.
- (Recommandation du sous-agent, NON VÉRIFIÉE et **contredite par la recherche A** sur le JSON-LD et le llms.txt : voir la synthèse.)

## Sources
robots.txt : linkedin.com, malt.fr, malt.com, free-work.com, welcometothejungle.com, github.com, cremedelacreme.io, comet.co, codeur.com, upwork.com (+ /llms.txt), stackoverflow.com, dev.to, medium.com — tous sous `https://<domaine>/robots.txt`.
Profils testés : https://www.linkedin.com/in/williamhgates · https://www.malt.fr/profile/patricklebas · https://github.com/torvalds · https://www.codeur.com/-codiup · https://stackoverflow.com/users/22656/jon-skeet · https://dev.to/ben · https://medium.com/@ev
CGU : https://www.linkedin.com/legal/user-agreement · https://www.malt.fr/legal · https://www.welcometothejungle.com/fr/pages/terms · https://docs.github.com/en/site-policy/acceptable-use-policies/github-acceptable-use-policies · https://www.upwork.com/legal · https://stackoverflow.com/legal/terms-of-service/public
Matching IA : https://news.linkedin.com/2025/hiring-assistant-globally-available · https://www.malt.fr/resources/article/hiringwithai · https://www.upwork.com/blog/uma-recruiter-how-we-built-an-agentic-solution-to-talent-matching-and-hiring
