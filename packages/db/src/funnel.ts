import type { Db } from "./client";

/*
 * Entonnoir de la marketplace, des deux côtés : combien de freelances et d'entreprises atteignent chaque étape, comptés
 * en base. Des totaux, jamais une liste de personnes ni un classement : c'est le chiffre que la bêta doit faire monter,
 * pas un outil pour trier qui que ce soit (AI Act).
 *
 * Une cohorte est délimitée par la date de création du profil ou de l'entreprise : les freelances arrivés cette
 * semaine, et ce qu'ils ont fait depuis.
 */

export interface FreelanceFunnel {
  /** Profils créés (privés compris). */
  readonly profiles: number;
  /** Profils publiés, nominatifs ou pseudonymes. */
  readonly published: number;
  /** Au moins une adresse dont la possession est prouvée. */
  readonly provenUrl: number;
  /** Contactés par une entreprise, ou ayant postulé : un premier échange. */
  readonly firstExchange: number;
  /** Au moins un contrat créé. */
  readonly contracted: number;
  /** Au moins un paiement versé. */
  readonly paid: number;
}

export interface CompanyFunnel {
  readonly organisations: number;
  /** Au moins une mission publiée (ouverte ou close depuis). */
  readonly missionPublished: number;
  /** Au moins une prise de contact envoyée ou une candidature reçue. */
  readonly firstExchange: number;
  readonly contracted: number;
  /** Au moins un paiement bloqué ou versé : de l'argent engagé sur la plateforme. */
  readonly paid: number;
}

export interface Funnel {
  readonly freelance: FreelanceFunnel;
  readonly company: CompanyFunnel;
  /** Demandes d'audit reçues sur la période (avant tout compte). */
  readonly auditRequests: number;
}

export interface Cohort {
  readonly from?: Date;
  readonly to?: Date;
}

const range = (c: Cohort) => ({ createdAt: { ...(c.from === undefined ? {} : { gte: c.from }), ...(c.to === undefined ? {} : { lt: c.to }) } });

export const funnel = (db: Db) => ({
  async measure(cohort: Cohort = {}): Promise<Funnel> {
    const profile = range(cohort);
    const org = range(cohort);
    const [profiles, published, provenUrl, firstExchange, contracted, paid] = await Promise.all([
      db.freelanceProfile.count({ where: profile }),
      db.freelanceProfile.count({ where: { ...profile, visibility: { not: "private" }, slug: { not: null } } }),
      db.freelanceProfile.count({ where: { ...profile, ownedUrls: { some: { verifiedAt: { not: null } } } } }),
      db.freelanceProfile.count({ where: { ...profile, OR: [{ conversations: { some: {} } }, { applications: { some: {} } }] } }),
      db.freelanceProfile.count({ where: { ...profile, contracts: { some: {} } } }),
      db.freelanceProfile.count({ where: { ...profile, contracts: { some: { payments: { some: { status: "released" } } } } } }),
    ]);
    const [organisations, missionPublished, companyExchange, companyContracted, companyPaid, auditRequests] = await Promise.all([
      db.organisation.count({ where: org }),
      db.organisation.count({ where: { ...org, jobPosts: { some: { publishedAt: { not: null } } } } }),
      db.organisation.count({ where: { ...org, conversations: { some: {} } } }),
      db.organisation.count({ where: { ...org, contracts: { some: {} } } }),
      db.organisation.count({ where: { ...org, contracts: { some: { payments: { some: { status: { in: ["held", "releasing", "released"] } } } } } } }),
      db.auditRequest.count({ where: range(cohort) }),
    ]);
    return {
      freelance: { profiles, published, provenUrl, firstExchange, contracted, paid },
      company: { organisations, missionPublished, firstExchange: companyExchange, contracted: companyContracted, paid: companyPaid },
      auditRequests,
    };
  },
});
