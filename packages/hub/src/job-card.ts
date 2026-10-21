import { escapeHtml as e } from "./html";
import { rateText, registryLine } from "./job-page";
import { isoDay, longDate, type Lang } from "./market-shell";

/*
 * La fiche d'une mission dans une liste (index, page de ville, page d'entreprise) : la même partout. De haut en bas,
 * la date de publication en trace, l'intitulé en PS Display (toute la fiche mène à la mission, un seul arrêt de
 * tabulation), l'entreprise et son état au répertoire officiel quand la source le connaît, le lieu, les compétences,
 * puis le TJM. Aucune note, aucun score : l'ordre de la liste est écrit au-dessus d'elle.
 */

export interface JobCardView {
  readonly id: string;
  readonly title: string;
  readonly workMode: "onsite" | "hybrid" | "remote";
  readonly city: string | null;
  readonly publishedAt: Date;
  /** Absent sur la page d'une entreprise : la fiche est déjà chez elle. */
  readonly organisationName?: string;
  /** `undefined` : la source ne connaît pas l'état au répertoire, la fiche n'en dit rien. */
  readonly organisationRegistryActiveCheckedAt?: Date | null;
  readonly skills?: readonly string[];
  readonly durationMonths?: number | null;
  readonly dailyRateMinCents?: number | null;
  readonly dailyRateMaxCents?: number | null;
  readonly currency?: string;
}

const LABELS = {
  fr: {
    published: (d: string) => `Publiée le ${d}`,
    modes: { remote: "Télétravail", hybrid: "Hybride", onsite: "Sur site" },
    months: (n: number) => (n === 1 ? "1 mois" : `${n} mois`),
    noRate: "TJM non précisé par l'entreprise",
  },
  en: {
    published: (d: string) => `Published on ${d}`,
    modes: { remote: "Remote", hybrid: "Hybrid", onsite: "On site" },
    months: (n: number) => (n === 1 ? "1 month" : `${n} months`),
    noRate: "Day rate not given by the company",
  },
} as const;

export const JOB_CARD_STYLES =
  ".job .org-name{font-weight:var(--ps-weight-strong)}" +
  ".job .vline{font-size:var(--ps-step--1)}" +
  ".job .where{color:var(--ps-muted);font-size:var(--ps-step--1)}" +
  ".job ul.tags{margin-top:var(--ps-space-1)}" +
  ".job .foot-line b{font:var(--ps-weight-display) var(--ps-step-1)/1.2 var(--ps-font-display);font-variant-numeric:tabular-nums}";

export const jobCard = (m: JobCardView, lang: Lang): string => {
  const l = LABELS[lang];
  const where = [m.workMode === "remote" || m.city === null ? l.modes[m.workMode] : `${m.city} · ${l.modes[m.workMode]}`, ...(m.durationMonths == null ? [] : [l.months(m.durationMonths)])].join(" · ");
  const skills = m.skills ?? [];
  const given = m.dailyRateMinCents != null || m.dailyRateMaxCents != null;
  const rate =
    m.currency === undefined
      ? ""
      : given
        ? `<p class="foot-line"><b>${e(rateText({ dailyRateMinCents: m.dailyRateMinCents ?? null, dailyRateMaxCents: m.dailyRateMaxCents ?? null, currency: m.currency }, lang))}</b></p>`
        : `<p class="foot-line trace">${l.noRate}</p>`;
  return (
    `<li class="entry job"><p class="ref"><time datetime="${isoDay(m.publishedAt)}">${e(l.published(longDate(m.publishedAt, lang)))}</time></p>` +
    `<h3><a href="/${lang}/missions/${e(encodeURIComponent(m.id))}">${e(m.title)}</a></h3>` +
    (m.organisationName === undefined ? "" : `<p class="org-name">${e(m.organisationName)}</p>`) +
    registryLine(m.organisationRegistryActiveCheckedAt, lang) +
    `<p class="where">${e(where)}</p>` +
    (skills.length === 0 ? "" : `<ul class="tags">${skills.map((s) => `<li>${e(s)}</li>`).join("")}</ul>`) +
    rate +
    "</li>"
  );
};
