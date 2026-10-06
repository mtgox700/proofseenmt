/*
 * Données structurées schema.org `JobPosting` d'une mission publique. C'est ce qui fait d'une page de mission une page
 * qu'un moteur — de recherche ou d'IA — lit comme une offre, avec son TJM, sa durée et son mode de travail, au lieu
 * d'un texte à deviner.
 *
 * Le constructeur ne dépend pas de la base : il reçoit une mission déjà publique. Rien de privé n'y entre — ni auteur,
 * ni candidatures, ni coordonnées.
 */

export interface PublicMission {
  readonly id: string;
  readonly organisationName: string;
  readonly title: string;
  readonly description: string;
  readonly skills: readonly string[];
  readonly durationMonths: number | null;
  readonly dailyRateMinCents: number | null;
  readonly dailyRateMaxCents: number | null;
  readonly currency: string;
  readonly city: string | null;
  readonly workMode: "onsite" | "hybrid" | "remote";
  readonly publishedAt: Date;
}

/** Une mission reste annoncée 60 jours au plus : au-delà, un moteur montrerait une offre probablement pourvue. */
export const VALIDITY_DAYS = 60;

const DAY_MS = 24 * 60 * 60 * 1000;

// Toutes les devises acceptées ont deux décimales : le montant en unités est le nombre de centimes divisé par cent.
const major = (cents: number): number => cents / 100;

const salary = (m: PublicMission): Record<string, unknown> | undefined => {
  const min = m.dailyRateMinCents ?? m.dailyRateMaxCents;
  const max = m.dailyRateMaxCents ?? m.dailyRateMinCents;
  if (min === null || max === null) return undefined;
  return {
    "@type": "MonetaryAmount",
    currency: m.currency,
    value: { "@type": "QuantitativeValue", minValue: major(min), maxValue: major(max), unitText: "DAY" },
  };
};

const location = (m: PublicMission): Record<string, unknown> => {
  if (m.workMode === "remote") {
    return { jobLocationType: "TELECOMMUTE", applicantLocationRequirements: { "@type": "Country", name: "FR" } };
  }
  return {
    jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: m.city ?? "", addressCountry: "FR" } },
  };
};

export const missionUrl = (baseUrl: string, lang: "fr" | "en", id: string): string => `${baseUrl.replace(/\/$/, "")}/${lang}/missions/${id}`;

export const jobPosting = (m: PublicMission, options: { readonly baseUrl: string; readonly lang: "fr" | "en" }): Record<string, unknown> => {
  const pay = salary(m);
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    identifier: { "@type": "PropertyValue", name: "Proofseen", value: m.id },
    url: missionUrl(options.baseUrl, options.lang, m.id),
    title: m.title,
    description: m.description,
    datePosted: m.publishedAt.toISOString().slice(0, 10),
    validThrough: new Date(m.publishedAt.getTime() + VALIDITY_DAYS * DAY_MS).toISOString(),
    employmentType: "CONTRACTOR",
    hiringOrganization: { "@type": "Organization", name: m.organisationName },
    ...(m.skills.length === 0 ? {} : { skills: m.skills.join(", ") }),
    ...(pay === undefined ? {} : { baseSalary: pay }),
    ...location(m),
    directApply: true,
  };
};
