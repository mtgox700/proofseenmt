import { escapeHtml as e } from "./html";

/*
 * « Ce qui est vérifié » : le registre des preuves d'un profil public (lot d de la refonte, STORYBOARD d.1 C et d.2).
 * Chaque ligne est un fait vérifié par un tiers, avec sa trace : la source, qui l'a vérifié, la date quand la base la
 * connaît. Le vert de la marque (le poinçon) ne se pose que sur ces lignes : jamais sur ce que le freelance déclare.
 *
 * Le registre est toujours présent, même vide : une page blanche honnête qui dit ce qui pourrait y figurer, au lieu de
 * laisser croire, par son absence, qu'il n'existe rien à vérifier. Aucune date n'est inventée : un fait dont la base
 * n'expose pas la date n'en affiche pas. Les textes des faits restent d'un seul tenant (une comparaison de chaînes sur
 * le HTML décodé les retrouve, comme le fait `marketplace-verify`).
 */

type Lang = "fr" | "en";

export interface ProofMission {
  readonly role: string;
  readonly clientKind: string;
  readonly durationMonths: number;
  readonly summary: string;
  readonly evidenceKind: string;
  readonly verifiedAt: Date;
  /** Nom du client, seulement s'il a lui-même autorisé son affichage en confirmant la mission. */
  readonly clientName?: string | null;
  /** Confirmation par l'entreprise inscrite, ou par un contact chez le client. */
  readonly confirmedBy?: "company" | "contact" | null;
}

/** Une adresse dont la possession est prouvée, avec sa preuve. `url` vaut `null` sur un profil pseudonyme. */
export interface ProvenAddress {
  readonly url: string | null;
  readonly method: string;
  readonly verifiedAt: Date;
  /** Dernière relecture de la preuve, réussie ou non. */
  readonly checkedAt: Date | null;
}

export interface ProofFacts {
  readonly registryActiveCheckedAt: Date | null;
  readonly identityVerified: boolean;
  /** Ouverture des versements par le prestataire de paiement, qui vérifie l'identité avant. */
  readonly identityVerifiedAt?: Date | null;
  readonly payingClients: number;
  readonly vigilanceValidUntil: Date | null;
  /** Vérification de l'attestation par un opérateur. */
  readonly vigilanceVerifiedAt?: Date | null;
}

export interface ProofRegister {
  readonly named: boolean;
  readonly missions: readonly ProofMission[];
  readonly provenUrls: readonly string[];
  readonly provenUrlCount: number;
  readonly provenAddresses?: readonly ProvenAddress[];
  readonly facts: ProofFacts;
}


export const PROOF_LABELS = {
  fr: {
    title: "Ce qui est vérifié",
    note: "Chaque ligne porte sa source, sa date et qui l'a vérifiée. Nous montrons la méthode de vérification, jamais le document.",
    missions: "Missions vérifiées",
    addresses: "Adresses dont la possession est prouvée",
    facts: "Faits vérifiés",
    source: "Source",
    by: "Vérifié par",
    date: "Date",
    lastRead: "Dernière relecture",
    months: (n: number) => (n === 1 ? "1 mois" : `${n} mois`),
    clientKinds: { startup: "Start-up", scaleup: "Scale-up", grand_groupe: "Grand groupe", eti: "ETI", pme: "PME", secteur_public: "Secteur public", editeur_logiciel: "Éditeur de logiciel", esn: "ESN", association: "Association" } as Readonly<Record<string, string>>,
    evidenceKinds: { facture: "Facture", contrat: "Contrat", attestation_client: "Attestation du client", acces_depot: "Accès au dépôt de code", livrable_public: "Livrable public" } as Readonly<Record<string, string>>,
    verifiedOn: (kind: string, d: string, contact: boolean) =>
      kind === "client_confirmation" ? (contact ? `Confirmée par un contact chez le client le ${d}` : `Confirmée par le client le ${d}`) : kind === "paid_on_platform" ? `Payée sur Proofseen, vérifiée le ${d}` : `Vérifiée le ${d}`,
    missionSource: (kind: string, evidence: string) => (kind === "client_confirmation" ? "Confirmation du client" : kind === "paid_on_platform" ? "Mission payée et validée sur Proofseen" : evidence),
    missionBy: (kind: string, contact: boolean) =>
      kind === "client_confirmation" ? (contact ? "Un contact chez le client, par lien signé" : "Le client, depuis son compte") : kind === "paid_on_platform" ? "Proofseen, au versement des fonds" : "Proofseen, sur pièce",
    proofCount: (n: number) => (n === 0 ? "Aucune adresse prouvée pour l'instant." : n === 1 ? "1 adresse prouvée." : `${n} adresses prouvées.`),
    unpublished: "Adresse non publiée",
    unpublishedWhy: "Les adresses ne sont pas publiées : ce profil est publié sous sa référence.",
    proven: (d: string) => `Possession prouvée le ${d}`,
    provenUndated: "Possession prouvée",
    methods: { well_known_file: "fichier de vérification", meta_tag: "balise meta", dns_txt: "enregistrement DNS TXT", profile_token: "vérification manuelle" } as Readonly<Record<string, string>>,
    addressBy: (method: string) => (method === "profile_token" ? "Un opérateur Proofseen, à la main" : "Proofseen, lecture automatique tous les 30 jours"),
    registryActive: (d: string) => `Entreprise active au répertoire officiel des entreprises (vérifié le ${d})`,
    registrySource: "Répertoire officiel des entreprises, le SIRET n'est jamais publié",
    identityVerified: "Identité vérifiée par le prestataire de paiement",
    identitySource: "Ouverture des versements",
    identityBy: "Le prestataire de paiement",
    vigilance: (d: string) => `Attestation de vigilance URSSAF vérifiée, valable jusqu'au ${d}`,
    vigilanceSource: "Attestation de vigilance URSSAF",
    vigilanceBy: "Un opérateur Proofseen",
    payingClients: (n: number) => (n === 1 ? "Payé sur Proofseen par 1 entreprise" : `Payé sur Proofseen par ${n} entreprises différentes`),
    payingSource: "Paiements versés sur Proofseen",
    proofseen: "Proofseen",
    emptyTitle: "Aucun fait vérifié pour l'instant. Les informations de ce profil sont déclarées par le freelance.",
    emptyLead: "Peut apparaître ici, avec sa source, sa date et qui l'a vérifié :",
    emptyItems: [
      "une mission confirmée par le client ou payée sur Proofseen",
      "une adresse web dont la possession est prouvée",
      "l'entreprise active au répertoire officiel des entreprises",
      "l'identité vérifiée par le prestataire de paiement",
      "l'attestation de vigilance URSSAF",
    ],
    method: { href: "/methode/", label: "Comment nous vérifions" },
    tally: { missions: (n: number) => (n === 1 ? "1 mission vérifiée" : `${n} missions vérifiées`), addresses: (n: number) => (n === 1 ? "1 adresse prouvée" : `${n} adresses prouvées`), facts: (n: number) => (n === 1 ? "1 fait vérifié" : `${n} faits vérifiés`) },
    tallyNone: "Aucun fait vérifié pour l'instant.",
  },
  en: {
    title: "What is verified",
    note: "Each line carries its source, its date and who verified it. We show the verification method, never the document.",
    missions: "Verified missions",
    addresses: "Addresses with proven ownership",
    facts: "Verified facts",
    source: "Source",
    by: "Verified by",
    date: "Date",
    lastRead: "Last read",
    months: (n: number) => (n === 1 ? "1 month" : `${n} months`),
    clientKinds: { startup: "Start-up", scaleup: "Scale-up", grand_groupe: "Large group", eti: "Mid-size company", pme: "SME", secteur_public: "Public sector", editeur_logiciel: "Software publisher", esn: "IT services firm", association: "Non-profit" } as Readonly<Record<string, string>>,
    evidenceKinds: { facture: "Invoice", contrat: "Contract", attestation_client: "Client attestation", acces_depot: "Repository access", livrable_public: "Public deliverable" } as Readonly<Record<string, string>>,
    verifiedOn: (kind: string, d: string, contact: boolean) =>
      kind === "client_confirmation" ? (contact ? `Confirmed by a contact at the client on ${d}` : `Confirmed by the client on ${d}`) : kind === "paid_on_platform" ? `Paid on Proofseen, verified on ${d}` : `Verified on ${d}`,
    missionSource: (kind: string, evidence: string) => (kind === "client_confirmation" ? "Client confirmation" : kind === "paid_on_platform" ? "Mission paid and approved on Proofseen" : evidence),
    missionBy: (kind: string, contact: boolean) =>
      kind === "client_confirmation" ? (contact ? "A contact at the client, through a signed link" : "The client, from its account") : kind === "paid_on_platform" ? "Proofseen, when the funds were released" : "Proofseen, on the document",
    proofCount: (n: number) => (n === 0 ? "No proven address yet." : n === 1 ? "1 proven address." : `${n} proven addresses.`),
    unpublished: "Address not published",
    unpublishedWhy: "The addresses are not published: this profile is published under its reference.",
    proven: (d: string) => `Ownership proven on ${d}`,
    provenUndated: "Ownership proven",
    methods: { well_known_file: "verification file", meta_tag: "meta tag", dns_txt: "DNS TXT record", profile_token: "manual check" } as Readonly<Record<string, string>>,
    addressBy: (method: string) => (method === "profile_token" ? "A Proofseen operator, by hand" : "Proofseen, automatic read every 30 days"),
    registryActive: (d: string) => `Business active in the official French company register (checked on ${d})`,
    registrySource: "Official French company register; the SIRET number is never published",
    identityVerified: "Identity verified by the payment provider",
    identitySource: "Opening of payouts",
    identityBy: "The payment provider",
    vigilance: (d: string) => `URSSAF vigilance certificate verified, valid until ${d}`,
    vigilanceSource: "URSSAF vigilance certificate",
    vigilanceBy: "A Proofseen operator",
    payingClients: (n: number) => (n === 1 ? "Paid on Proofseen by 1 company" : `Paid on Proofseen by ${n} different companies`),
    payingSource: "Payments released on Proofseen",
    proofseen: "Proofseen",
    emptyTitle: "No verified fact yet. The information on this profile is declared by the freelancer.",
    emptyLead: "What can appear here, with its source, its date and who verified it:",
    emptyItems: [
      "a mission confirmed by the client or paid on Proofseen",
      "a web address whose ownership is proven",
      "a business active in the official French company register",
      "an identity verified by the payment provider",
      "an URSSAF vigilance certificate",
    ],
    method: { href: "/en/method/", label: "How we verify" },
    tally: { missions: (n: number) => (n === 1 ? "1 verified mission" : `${n} verified missions`), addresses: (n: number) => (n === 1 ? "1 proven address" : `${n} proven addresses`), facts: (n: number) => (n === 1 ? "1 verified fact" : `${n} verified facts`) },
    tallyNone: "No verified fact yet.",
  },
} as const;

const longDate = (d: Date, lang: Lang): string => new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", { dateStyle: "long", timeZone: "UTC" }).format(d);
const isoDay = (d: Date): string => d.toISOString().slice(0, 10);
const pick = (table: Readonly<Record<string, string>>, key: string): string => table[key] ?? key;

/** La trace d'un fait : des paires libellé, valeur, en chasse fixe. Une valeur absente n'est pas écrite. */
const trace = (rows: readonly (readonly [string, string | null])[]): string => {
  const shown = rows.filter((r): r is readonly [string, string] => r[1] !== null && r[1] !== "");
  return shown.length === 0 ? "" : `<dl class="trace">${shown.map(([k, v]) => `<div><dt>${e(k)}</dt><dd>${v}</dd></div>`).join("")}</dl>`;
};

const time = (d: Date, lang: Lang): string => `<time datetime="${isoDay(d)}">${e(longDate(d, lang))}</time>`;

/** Le carré du poinçon : décoratif, toujours doublé d'un mot. Plein pour un fait vérifié, vide pour une ligne à venir. */
const square = (filled: boolean): string => `<span class="sq${filled ? "" : " open"}" aria-hidden="true"></span>`;

/*
 * Une mission vérifiée : l'affirmation (rôle, client, durée, résumé), puis la ligne de preuve reliée par le fil : à
 * gauche la source et le vérificateur, à droite le cartouche daté, seul élément frappé du poinçon.
 */
const missionPiece = (m: ProofMission, index: number, lang: Lang): string => {
  const l = PROOF_LABELS[lang];
  const contact = m.confirmedBy === "contact";
  const client = m.clientName === undefined || m.clientName === null || m.clientName === "" ? pick(l.clientKinds, m.clientKind) : m.clientName;
  const evidence = pick(l.evidenceKinds, m.evidenceKind);
  const summary = m.summary.trim() === "" ? "" : `<p>${e(m.summary)}</p>`;
  const seal = `<p class="seal"><time datetime="${isoDay(m.verifiedAt)}">${e(l.verifiedOn(m.evidenceKind, longDate(m.verifiedAt, lang), contact))}</time></p>`;
  const source = e(l.missionSource(m.evidenceKind, evidence));
  return (
    `<li class="piece" id="mission-${index + 1}"><div class="claim"><h4>${e(m.role)}</h4><p class="when">${e(client)} · ${e(l.months(m.durationMonths))}</p>${summary}</div>` +
    `<div class="proofline">${trace([[l.source, source], [l.by, e(l.missionBy(m.evidenceKind, contact))]])}${seal}</div></li>`
  );
};

/*
 * Les adresses prouvées. Profil nominatif : l'adresse elle-même, lien `rel="me"`. Profil pseudonyme : jamais l'adresse
 * (elle suffirait à retrouver la personne), seulement le compte, et la date et la méthode de chaque preuve quand la
 * base les donne : ni l'une ni l'autre ne désigne quelqu'un.
 */
const addressGroup = (r: ProofRegister, lang: Lang): string => {
  const l = PROOF_LABELS[lang];
  const shown = (url: string | null): boolean => r.named && url !== null;
  const what = (url: string | null): string => (url !== null && shown(url) ? `<a href="${e(url)}" rel="me noopener">${e(url)}</a>` : e(l.unpublished));
  const detailed = r.provenAddresses ?? [];
  const items =
    detailed.length > 0
      ? detailed.map((a) => {
          const stamp = `<p class="stamp">${square(true)}<time datetime="${isoDay(a.verifiedAt)}">${e(l.proven(longDate(a.verifiedAt, lang)))}</time></p>`;
          const rows = trace([[l.source, e(pick(l.methods, a.method))], [l.by, e(l.addressBy(a.method))], [l.lastRead, a.checkedAt === null ? null : time(a.checkedAt, lang)]]);
          return `<li class="line"><p class="what">${what(a.url)}</p>${stamp}${rows}</li>`;
        })
      : r.named
        ? r.provenUrls.map((u) => `<li class="line"><p class="what">${what(u)}</p><p class="stamp">${square(true)}${e(l.provenUndated)}</p></li>`)
        : [`<li class="line"><p class="what">${e(l.unpublished)}</p><p class="stamp">${square(true)}${e(l.provenUndated)}</p></li>`];
  const note = r.named ? "" : `<p class="group-note">${e(l.proofCount(r.provenUrlCount))} ${e(l.unpublishedWhy)}</p>`;
  return `<h3 class="group">${e(l.addresses)}</h3>${note}<ul class="lines">${items.join("")}</ul>`;
};

interface FactLine {
  readonly text: string;
  readonly source: string;
  readonly by: string;
  readonly date: Date | null;
}

const factLines = (f: ProofFacts, lang: Lang): FactLine[] => {
  const l = PROOF_LABELS[lang];
  return [
    ...(f.registryActiveCheckedAt === null ? [] : [{ text: l.registryActive(longDate(f.registryActiveCheckedAt, lang)), source: l.registrySource, by: l.proofseen, date: null }]),
    ...(f.identityVerified ? [{ text: l.identityVerified, source: l.identitySource, by: l.identityBy, date: f.identityVerifiedAt ?? null }] : []),
    ...(f.vigilanceValidUntil === null ? [] : [{ text: l.vigilance(longDate(f.vigilanceValidUntil, lang)), source: l.vigilanceSource, by: l.vigilanceBy, date: f.vigilanceVerifiedAt ?? null }]),
    ...(f.payingClients === 0 ? [] : [{ text: l.payingClients(f.payingClients), source: l.payingSource, by: l.proofseen, date: null }]),
  ];
};

/** Les comptes réels du registre, pour le résumé du rail : jamais un total pondéré, jamais un score. */
export const proofTally = (r: ProofRegister, lang: Lang): string => {
  const l = PROOF_LABELS[lang];
  const facts = factLines(r.facts, lang).length;
  const parts = [
    ...(r.missions.length === 0 ? [] : [l.tally.missions(r.missions.length)]),
    ...(r.provenUrlCount === 0 ? [] : [l.tally.addresses(r.provenUrlCount)]),
    ...(facts === 0 ? [] : [l.tally.facts(facts)]),
  ];
  return parts.length === 0 ? l.tallyNone : parts.join(" · ");
};

const group = (title: string, cls: string, items: string): string => `<h3 class="group">${e(title)}</h3><ul class="${cls}">${items}</ul>`;

const emptyRegister = (lang: Lang): string => {
  const l = PROOF_LABELS[lang];
  return (
    `<div class="blank"><p class="blank-title">${e(l.emptyTitle)}</p><p>${e(l.emptyLead)}</p>` +
    `<ul class="slots">${l.emptyItems.map((item) => `<li>${square(false)}${e(item)}</li>`).join("")}</ul>` +
    `<p><a href="${l.method.href}">${e(l.method.label)}</a></p></div>`
  );
};

/** Le registre complet, section comprise : toujours rendu, vide ou non. */
export const proofRegister = (r: ProofRegister, lang: Lang): string => {
  const l = PROOF_LABELS[lang];
  const facts = factLines(r.facts, lang);
  const hasAddresses = r.provenUrlCount > 0 || (r.named && r.provenUrls.length > 0);
  const empty = r.missions.length === 0 && !hasAddresses && facts.length === 0;
  const body = empty
    ? emptyRegister(lang)
    : [
        r.missions.length === 0 ? "" : group(l.missions, "pieces", r.missions.map((m, i) => missionPiece(m, i, lang)).join("")),
        hasAddresses ? addressGroup(r, lang) : "",
        facts.length === 0
          ? ""
          : group(
              l.facts,
              "lines",
              facts.map((f) => `<li class="line"><p class="what">${square(true)}${e(f.text)}</p>${trace([[l.source, e(f.source)], [l.by, e(f.by)], [l.date, f.date === null ? null : time(f.date, lang)]])}</li>`).join(""),
            ),
      ].join("");
  return `<section class="register${empty ? " is-empty" : ""}" aria-labelledby="verifie"><h2 class="part" id="verifie">${e(l.title)}</h2><p class="part-note">${e(l.note)}</p>${body}</section>`;
};
