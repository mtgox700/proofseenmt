import { escapeHtml as e } from "./html";

/*
 * Les sections déclarées d'un profil public (expériences, formations, certifications, langues, portfolio) : du HTML
 * simple, lisible sans JavaScript, et leurs données structurées. Ce sont des déclarations du freelance, présentées comme
 * telles et séparées des missions vérifiées : aucun niveau calculé, aucune ancienneté déduite, aucune note.
 *
 * Les adresses web (portfolio, vérification d'une certification), la photo, les images de réalisations, les entreprises
 * et les écoles n'arrivent ici que pour un profil nominatif : le dépôt les retire d'un profil pseudonyme, et le rendu
 * les ignore de nouveau (`named: false`) si elles arrivaient quand même. Un profil pseudonyme montre le rôle, les dates,
 * le diplôme et les compétences, jamais ce qui désignerait la personne. Un lien déposé par le freelance ne transmet
 * aucune autorité de la page (`nofollow ugc`).
 */

type Lang = "fr" | "en";

export type SectionLanguageLevel = "a1" | "a2" | "b1" | "b2" | "c1" | "c2" | "native";

export interface PublicSectionsView {
  readonly experiences: readonly {
    readonly title: string;
    readonly company: string | null;
    readonly startMonth: Date;
    readonly endMonth: Date | null;
    readonly description: string | null;
    readonly skills: readonly string[];
  }[];
  readonly educations: readonly { readonly school: string | null; readonly degree: string | null; readonly startYear: number | null; readonly endYear: number | null }[];
  readonly certifications: readonly {
    readonly name: string;
    readonly issuer: string | null;
    readonly year: number | null;
    readonly credentialUrl: string | null;
    readonly skills: readonly string[];
  }[];
  readonly languages: readonly { readonly code: string; readonly level: SectionLanguageLevel }[];
  readonly portfolio: readonly { readonly title: string; readonly url: string | null; readonly description: string | null; readonly imageFileId: string | null }[];
}

export const EMPTY_SECTIONS: PublicSectionsView = { experiences: [], educations: [], certifications: [], languages: [], portfolio: [] };

const LABELS = {
  fr: {
    experiences: "Expériences déclarées",
    current: "aujourd'hui",
    educations: "Formation",
    education: "Formation déclarée",
    certifications: "Certifications",
    verify: "Vérifier la certification",
    languages: "Langues",
    native: "langue maternelle",
    portfolio: "Réalisations",
  },
  en: {
    experiences: "Declared experience",
    current: "present",
    educations: "Education",
    education: "Declared education",
    certifications: "Certifications",
    verify: "Verify the certification",
    languages: "Languages",
    native: "native",
    portfolio: "Portfolio",
  },
} as const;

/** Adresse publique d'un fichier déposé (photo, image du portfolio), servie par la route des fichiers. */
export const fileUrl = (baseUrl: string, id: string): string => `${baseUrl.replace(/\/$/, "")}/fichiers/${encodeURIComponent(id)}`;

const monthText = (d: Date, lang: Lang): string => new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(d);

/** Le nom d'une langue dans la langue de la page ; le code lui-même si le moteur d'exécution ne le connaît pas. */
export const languageName = (code: string, lang: Lang): string => {
  try {
    return new Intl.DisplayNames([lang], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
};

const levelText = (level: SectionLanguageLevel, lang: Lang): string => (level === "native" ? LABELS[lang].native : level.toUpperCase());

const years = (start: number | null, end: number | null): string => (start !== null && end !== null ? (start === end ? `${start}` : `${start} – ${end}`) : String(start ?? end ?? ""));

const tags = (skills: readonly string[]): string => (skills.length === 0 ? "" : `<ul class="tags">${skills.map((s) => `<li>${e(s)}</li>`).join("")}</ul>`);

const paragraph = (text: string | null): string => (text === null || text.trim() === "" ? "" : `<p>${e(text)}</p>`);

/** Ce qu'un profil pseudonyme ne montre jamais, même si le dépôt l'avait laissé passer. */
const forPublication = (s: PublicSectionsView, named: boolean): PublicSectionsView =>
  named
    ? s
    : {
        experiences: s.experiences.map((x) => ({ ...x, company: null })),
        educations: s.educations.map((x) => ({ ...x, school: null })),
        certifications: s.certifications.map((x) => ({ ...x, credentialUrl: null })),
        languages: s.languages,
        portfolio: s.portfolio.map((x) => ({ ...x, url: null, imageFileId: null })),
      };

const experiences = (s: PublicSectionsView, lang: Lang): string =>
  s.experiences.length === 0
    ? ""
    : `<h2>${LABELS[lang].experiences}</h2><ul class="missions">${s.experiences
        .map((x) => {
          const period = `${monthText(x.startMonth, lang)} – ${x.endMonth === null ? LABELS[lang].current : monthText(x.endMonth, lang)}`;
          const when = [x.company, period].filter((part): part is string => part !== null).join(" · ");
          return `<li class="card"><h3>${e(x.title)}</h3><p class="when">${e(when)}</p>${paragraph(x.description)}${tags(x.skills)}</li>`;
        })
        .join("")}</ul>`;

const educations = (s: PublicSectionsView, lang: Lang): string =>
  s.educations.length === 0
    ? ""
    : `<h2>${LABELS[lang].educations}</h2><ul class="missions">${s.educations
        .map((x) => {
          // Sans école (profil pseudonyme), le diplôme devient le titre ; sans diplôme non plus, un libellé neutre.
          const heading = x.school ?? x.degree ?? LABELS[lang].education;
          const details = x.school === null ? [years(x.startYear, x.endYear)] : [x.degree, years(x.startYear, x.endYear)];
          const when = details.filter((part): part is string => part !== null && part !== "").join(" · ");
          return `<li class="card"><h3>${e(heading)}</h3>${when === "" ? "" : `<p class="when">${e(when)}</p>`}</li>`;
        })
        .join("")}</ul>`;

const certifications = (s: PublicSectionsView, lang: Lang): string =>
  s.certifications.length === 0
    ? ""
    : `<h2>${LABELS[lang].certifications}</h2><ul class="missions">${s.certifications
        .map((x) => {
          const when = [x.issuer, x.year === null ? null : String(x.year)].filter((part): part is string => part !== null).join(" · ");
          const link = x.credentialUrl === null ? "" : `<p><a href="${e(x.credentialUrl)}" rel="nofollow noopener ugc">${LABELS[lang].verify}</a></p>`;
          return `<li class="card"><h3>${e(x.name)}</h3>${when === "" ? "" : `<p class="when">${e(when)}</p>`}${tags(x.skills)}${link}</li>`;
        })
        .join("")}</ul>`;

const languages = (s: PublicSectionsView, lang: Lang): string =>
  s.languages.length === 0
    ? ""
    : `<h2>${LABELS[lang].languages}</h2><ul class="tags">${s.languages.map((l) => `<li>${e(`${languageName(l.code, lang)} · ${levelText(l.level, lang)}`)}</li>`).join("")}</ul>`;

const portfolio = (s: PublicSectionsView, lang: Lang, baseUrl: string): string =>
  s.portfolio.length === 0
    ? ""
    : `<h2>${LABELS[lang].portfolio}</h2><ul class="missions">${s.portfolio
        .map((x) => {
          const title = x.url === null ? e(x.title) : `<a href="${e(x.url)}" rel="nofollow noopener ugc">${e(x.title)}</a>`;
          const image = x.imageFileId === null ? "" : `<img class="shot" src="${e(fileUrl(baseUrl, x.imageFileId))}" alt="${e(x.title)}" loading="lazy" decoding="async">`;
          return `<li class="card">${image}<h3>${title}</h3>${paragraph(x.description)}</li>`;
        })
        .join("")}</ul>`;

/** Les sections, dans l'ordre de la page : expériences, certifications, formation, langues, réalisations. */
export const renderSections = (sections: PublicSectionsView, o: { readonly lang: Lang; readonly baseUrl: string; readonly named: boolean }): string => {
  const s = forPublication(sections, o.named);
  return [experiences(s, o.lang), certifications(s, o.lang), educations(s, o.lang), languages(s, o.lang), portfolio(s, o.lang, o.baseUrl)].join("");
};

/** Styles des éléments propres aux sections : une photo et des aperçus d'images, rien de masqué. */
export const SECTION_STYLES = ".avatar{width:7.5rem;height:7.5rem;border-radius:50%;object-fit:cover;border:1px solid var(--line);margin-bottom:1.4rem}.shot{width:100%;max-height:16rem;object-fit:cover;border-radius:10px;border:1px solid var(--line)}";

const unique = (values: readonly string[]): string[] => [...new Set(values)];

/** Ce que les sections ajoutent à la personne dans les données structurées (schema.org). */
export const sectionsJsonLd = (
  sections: PublicSectionsView,
  o: { readonly lang: Lang; readonly baseUrl: string; readonly photoFileId: string | null; readonly named: boolean },
): Record<string, unknown> => {
  const s = forPublication(sections, o.named);
  const current = unique(s.experiences.flatMap((x) => (x.endMonth === null && x.company !== null ? [x.company] : [])));
  const schools = unique(s.educations.flatMap((x) => (x.school === null ? [] : [x.school])));
  return {
    ...(o.photoFileId === null || !o.named ? {} : { image: fileUrl(o.baseUrl, o.photoFileId) }),
    ...(s.languages.length === 0 ? {} : { knowsLanguage: s.languages.map((l) => ({ "@type": "Language", name: languageName(l.code, o.lang), alternateName: l.code })) }),
    ...(schools.length === 0 ? {} : { alumniOf: schools.map((name) => ({ "@type": "EducationalOrganization", name })) }),
    ...(s.certifications.length === 0
      ? {}
      : {
          hasCredential: s.certifications.map((c) => ({
            "@type": "EducationalOccupationalCredential",
            name: c.name,
            credentialCategory: "certification",
            ...(c.issuer === null ? {} : { recognizedBy: { "@type": "Organization", name: c.issuer } }),
            ...(c.credentialUrl === null ? {} : { url: c.credentialUrl }),
          })),
        }),
    ...(current.length === 0 ? {} : { worksFor: current.map((name) => ({ "@type": "Organization", name })) }),
  };
};
