import { escapeHtml as e } from "./html";
import { money, type Lang } from "./market-shell";
import { renderFrame } from "./page-frame";
import { EXAMPLE_INPUT, LIMITS, SIMULATOR_STATUSES, simulate, type SimulatorField, type SimulatorInput, type SimulatorQuery, type SimulatorResult } from "./simulator";
import { SIMULATOR_COPY } from "./simulator-copy";
import { asOf, euros, percent, rateRows, simulatorFaq } from "./simulator-facts";
import { INCOME_TAX_BRACKETS, RATES, RATES_AS_OF, SOURCES } from "./simulator-rates";

/*
 * Page du simulateur de revenu net : un formulaire GET, aucun JavaScript. La page nue (indexée) montre un exemple
 * calculé ; une page avec des paramètres montre la simulation demandée, renvoie vers la page nue (canonique) et ne
 * demande pas à être indexée. Chaque taux affiché vient de simulator-rates.ts, avec sa source et sa date.
 */

export const simulatorUrl = (baseUrl: string, lang: Lang): string => `${baseUrl.replace(/\/$/, "")}/${lang}/simulateur`;

const STYLES =
  ".sim{display:grid;gap:1rem;max-width:36rem;margin-top:1rem}" +
  ".sim label{display:grid;gap:.35rem;font-weight:500}" +
  ".sim input,.sim select{font:inherit;font-size:max(16px,var(--ps-step-0));color:var(--ps-text);background:var(--ps-surface);border:1px solid var(--ps-line-strong);border-radius:var(--ps-radius);padding:.6rem .8rem;min-height:2.75rem;width:100%}" +
  ".sim input:focus-visible,.sim select:focus-visible{outline:2px solid var(--ps-focus);outline-offset:2px}" +
  ".sim .hint{font-size:var(--ps-step--1);color:var(--ps-muted);font-weight:400}" +
  ".sim [aria-invalid]{border-color:var(--ps-signal)}.sim .bad{color:var(--ps-signal)}" +
  ".sim button{justify-self:start}" +
  "tr.total th,tr.total td{font-weight:600;color:var(--ps-text)}tr.option th{color:var(--ps-text);padding-top:1.2rem}" +
  // The page starts on the header's edge (Kensa M6): a two-column calculation stays readable at its own width, the
  // table of rates and the questions take the page.
  ".calc{max-width:48rem}.faq{grid-template-columns:repeat(auto-fit,minmax(min(100%,17rem),1fr))}";

const option = (value: string, label: string, selected: boolean): string => `<option value="${e(value)}"${selected ? " selected" : ""}>${e(label)}</option>`;

const form = (lang: Lang, typed: Readonly<Record<SimulatorField, string>>, bad: ReadonlySet<SimulatorField>): string => {
  const c = SIMULATOR_COPY[lang];
  const invalid = (f: SimulatorField): string => (bad.has(f) ? ` aria-invalid="true"` : "");
  const hint = (f: SimulatorField): string => `<span class="hint${bad.has(f) ? " bad" : ""}" id="hint-${f}">${e(c.hints[f])}</span>`;
  const number = (f: "tjm" | "jours" | "frais", min: number, max: number): string =>
    `<label for="f-${f}">${e(c.fields[f])}<input id="f-${f}" name="${f}" type="number" inputmode="numeric" min="${min}" max="${max}" step="1"${f === "frais" ? "" : " required"} value="${e(typed[f])}" aria-describedby="hint-${f}"${invalid(f)}>${hint(f)}</label>`;
  return [
    `<form class="sim" method="get" action="/${lang}/simulateur">`,
    number("tjm", 1, LIMITS.dailyRateMax),
    number("jours", 1, LIMITS.daysMax),
    `<label for="f-statut">${e(c.fields.statut)}<select id="f-statut" name="statut" aria-describedby="hint-statut"${invalid("statut")}>${SIMULATOR_STATUSES.map((s) => option(s, c.statuses[s], typed.statut === s)).join("")}</select>${hint("statut")}</label>`,
    number("frais", 0, LIMITS.expensesMax),
    `<button class="btn btn-primary" type="submit">${e(c.submit)}</button>`,
    "</form>",
  ].join("");
};

const row = (label: string, cents: number, lang: Lang, cls = ""): string =>
  `<tr${cls === "" ? "" : ` class="${cls}"`}><th scope="row">${e(label)}</th><td class="num">${e(money(cents, "EUR", lang))}</td></tr>`;
const heading = (label: string): string => `<tr class="option"><th scope="rowgroup" colspan="2">${e(label)}</th></tr>`;

const resultTable = (r: SimulatorResult, lang: Lang): string => {
  const c = SIMULATOR_COPY[lang];
  const p = (rate: number): string => percent(rate, lang);
  if (r.kind === "sasu") {
    const s = c.sasu;
    const rows = [
      row(s.turnover, r.turnoverCents, lang),
      row(s.expenses, -r.expensesCents, lang),
      row(s.profit, r.profitCents, lang),
      row(s.corporateTax(p(RATES.corporateReducedRate.value), euros(RATES.corporateReducedCeiling.value, lang), p(RATES.corporateNormalRate.value)), -r.corporateTaxCents, lang),
      row(s.dividends, r.dividendsCents, lang),
      row(s.levies(p(RATES.dividendSocialLevies.value)), -r.socialLeviesCents, lang),
      row(s.dividendTax(p(RATES.dividendIncomeTax.value)), -r.dividendIncomeTaxCents, lang),
      row(s.net, r.netCents, lang, "total"),
    ];
    return `<div class="table calc"><table><tbody>${rows.join("")}</tbody></table></div>`;
  }
  const m = c.micro;
  const bnc = r.status === "micro-bnc";
  const rows = [
    row(m.turnover, r.turnoverCents, lang),
    row(m.social(p((bnc ? RATES.microBncSocial : RATES.microBicSocial).value)), -r.socialCents, lang),
    row(m.training(p((bnc ? RATES.trainingBnc : RATES.trainingBic).value)), -r.trainingCents, lang),
    row(m.expenses, -r.expensesCents, lang),
    row(m.beforeTax, r.netBeforeTaxCents, lang, "total"),
    heading(m.optionScale),
    row(m.taxable(p((bnc ? RATES.allowanceBnc : RATES.allowanceBic).value), euros(RATES.allowanceMinimum.value, lang)), r.taxableCents, lang),
    row(m.incomeTax(INCOME_TAX_BRACKETS.year), -r.incomeTaxCents, lang),
    row(m.afterIncomeTax, r.netAfterIncomeTaxCents, lang, "total"),
    heading(m.optionFlat(euros(RATES.flatTaxIncomeLimitSingle.value, lang))),
    row(m.flatTax(p((bnc ? RATES.flatTaxBnc : RATES.flatTaxBic).value)), -r.flatTaxCents, lang),
    row(m.afterFlatTax, r.netAfterFlatTaxCents, lang, "total"),
  ];
  const ceiling = r.aboveCeiling ? `<p class="note">${e(m.ceiling(euros(RATES.microCeilingServices.value, lang)))}</p>` : "";
  return `${ceiling}<div class="table calc"><table><tbody>${rows.join("")}</tbody></table></div>`;
};

const describe = (input: SimulatorInput, lang: Lang, example: boolean): string => {
  const c = SIMULATOR_COPY[lang];
  const args = [money(input.dailyRateCents, "EUR", lang), input.days, c.statuses[input.status], money(input.expensesCents, "EUR", lang)] as const;
  return example ? c.example(...args) : c.yours(...args);
};

const typedFrom = (input: SimulatorInput): Record<SimulatorField, string> => ({
  tjm: String(input.dailyRateCents / 100),
  jours: String(input.days),
  statut: input.status,
  frais: String(input.expensesCents / 100),
});

const assumptions = (lang: Lang): string => {
  const c = SIMULATOR_COPY[lang];
  const list = (items: readonly string[]): string => `<ul>${items.map((i) => `<li>${e(i)}</li>`).join("")}</ul>`;
  return [
    `<h2>${e(c.assumptionsTitle)}</h2>`,
    `<div class="prose">`,
    list(c.common),
    `<h3>${e(c.statuses["micro-bnc"].split(",")[0] ?? "")}</h3>`,
    list(c.microAssumptions(euros(RATES.microCeilingServices.value, lang), INCOME_TAX_BRACKETS.year)),
    `<h3>${e(c.statuses["sasu-dividendes"])}</h3>`,
    list(c.sasuAssumptions(euros(RATES.corporateReducedTurnoverMax.value, lang), percent(RATES.corporateReducedOwnership.value, lang))),
    `<h3>${e(c.notSimulatedTitle)}</h3>`,
    `<p>${e(c.eurl)}</p>`,
    "</div>",
  ].join("");
};

const ratesSection = (lang: Lang): string => {
  const c = SIMULATOR_COPY[lang];
  const rows = rateRows(lang).map(
    (r) => `<tr><th scope="row">${e(r.label)}</th><td class="num">${e(r.value)}</td><td><a href="${e(SOURCES[r.source].url)}">${e(/F\d+$/.exec(SOURCES[r.source].url)?.[0] ?? "")}</a></td></tr>`,
  );
  const sources = Object.values(SOURCES).map(
    (s) => `<li><a href="${e(s.url)}">${e(s.title[lang])}</a>, ${e(c.verified(new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${s.verifiedOn}T00:00:00Z`))))}</li>`,
  );
  return [
    `<h2>${e(c.ratesTitle(asOf(lang)))}</h2>`,
    `<div class="table"><table><thead><tr>${c.rateHeaders.map((h) => `<th scope="col">${e(h)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`,
    `<ol class="sources">${sources.join("")}</ol>`,
  ].join("");
};

export interface SimulatorPageOptions {
  readonly baseUrl: string;
  readonly lang: Lang;
  readonly query: SimulatorQuery;
}

export const renderSimulatorPage = (o: SimulatorPageOptions): string => {
  const c = SIMULATOR_COPY[o.lang];
  const other: Lang = o.lang === "fr" ? "en" : "fr";
  const canonical = simulatorUrl(o.baseUrl, o.lang);
  const faq = simulatorFaq(o.lang);
  const shown = o.query.kind === "ok" ? o.query.input : EXAMPLE_INPUT;
  const typed = o.query.kind === "empty" ? typedFrom(EXAMPLE_INPUT) : o.query.typed;
  const bad = new Set<SimulatorField>(o.query.kind === "invalid" ? o.query.fields : []);
  const result =
    o.query.kind === "invalid"
      ? `<p class="note">${e(c.invalid)}</p>`
      : `<p class="lede">${e(describe(shown, o.lang, o.query.kind === "empty"))}</p>${resultTable(simulate(shown), o.lang)}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: c.title,
        url: canonical,
        description: c.description,
        inLanguage: o.lang,
        applicationCategory: "FinanceApplication",
        operatingSystem: "Any",
        isAccessibleForFree: true,
        dateModified: RATES_AS_OF,
        citation: Object.values(SOURCES).map((s) => s.url),
        publisher: { "@type": "Organization", name: "Proofseen" },
      },
      { "@type": "FAQPage", url: canonical, mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
    ],
  };
  return renderFrame({
    lang: o.lang,
    title: c.title,
    description: c.description,
    canonical,
    alternates: { fr: simulatorUrl(o.baseUrl, "fr"), en: simulatorUrl(o.baseUrl, "en") },
    noindex: o.query.kind !== "empty",
    jsonLd,
    otherHref: `/${other}/simulateur`,
    menu: "simulator",
    styles: STYLES,
    main: [
      `<h1 class="title">${e(c.title)}</h1>`,
      `<p class="headline">${e(c.lead)}</p>`,
      `<h2>${e(c.formTitle)}</h2>`,
      form(o.lang, typed, bad),
      `<h2>${e(c.resultTitle)}</h2>`,
      result,
      `<p class="muted">${e(c.disclaimer)}</p>`,
      assumptions(o.lang),
      ratesSection(o.lang),
      `<h2>${e(c.faqTitle)}</h2>`,
      `<dl class="context faq">${faq.map((f) => `<div><dt>${e(f.q)}</dt><dd>${e(f.a)}</dd></div>`).join("")}</dl>`,
    ],
  });
};
