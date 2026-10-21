import { describe, expect, it } from "vitest";
import { renderProfilePage, type PublicProfile } from "../src/profile-page";
import { PROFILE_STRIKE_CSS, PROFILE_STYLES } from "../src/profile-styles";

/*
 * La page de preuve (lot d de la refonte) : « Ce qui est vérifié » est toujours là, même vide ; le vert du poinçon ne
 * se pose que sur un fait vérifié ; chaque fait vérifié porte sa trace (source, vérificateur, date) dans le HTML.
 */

const BARE: PublicProfile = {
  reference: "FR-ABCDE",
  slug: "fr-abcde",
  visibility: "pseudonymous",
  displayName: null,
  headline: "Développeuse Rust",
  summary: "Systèmes embarqués.",
  city: "Lyon",
  workMode: "remote",
  availability: "available",
  availableFrom: null,
  dailyRateCents: null,
  currency: "EUR",
  skills: ["Rust", "WebAssembly"],
  provenUrls: [],
  provenUrlCount: 0,
  missions: [],
  reviews: [],
  facts: { registryActiveCheckedAt: null, identityVerified: false, payingClients: 0, vigilanceValidUntil: null },
  updatedAt: new Date("2026-10-06T00:00:00Z"),
};

const PROVEN: PublicProfile = {
  ...BARE,
  visibility: "named",
  displayName: "Camille Martin",
  photoFileId: "9b2a7c1d-3e4f-4a5b-8c6d-7e8f9a0b1c2d",
  provenUrls: ["https://camille.dev"],
  provenUrlCount: 1,
  provenAddresses: [{ url: "https://camille.dev", method: "dns_txt", verifiedAt: new Date("2026-09-12T00:00:00Z"), checkedAt: new Date("2026-10-18T00:00:00Z") }],
  missions: [
    { role: "Lead Rust", clientKind: "pme", durationMonths: 8, summary: "Firmware.", evidenceKind: "client_confirmation", verifiedAt: new Date("2026-10-14T00:00:00Z"), confirmedBy: "contact" },
    { role: "Audit Rust", clientKind: "eti", durationMonths: 1, summary: "", evidenceKind: "paid_on_platform", verifiedAt: new Date("2026-10-02T00:00:00Z") },
    { role: "Portage", clientKind: "startup", durationMonths: 3, summary: "", evidenceKind: "facture", verifiedAt: new Date("2026-09-01T00:00:00Z") },
  ],
  facts: { registryActiveCheckedAt: new Date("2026-10-05T00:00:00Z"), identityVerified: true, identityVerifiedAt: new Date("2026-09-20T00:00:00Z"), payingClients: 2, vigilanceValidUntil: null },
};

const OPTIONS = { baseUrl: "https://proofseen.com", lang: "fr" as const, contactHref: "/fr/app/contact/FR-ABCDE" };

const between = (html: string, start: string, end: string): string => html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start)));
const register = (html: string): string => between(html, '<section class="register', "</section>");
const outsideRegister = (html: string): string => html.replace(register(html), "");
const body = (html: string): string => html.slice(html.indexOf("<body>"));
/** Les marques vertes du balisage : cartouche, ligne « possession prouvée », carré plein (le carré vide est neutre). */
const GREEN = /class="seal"|class="stamp"|class="sq"/g;

describe("le registre « Ce qui est vérifié »", () => {
  it("est présent même vide, avec un état vide honnête qui dit ce qui pourrait y figurer", () => {
    const html = renderProfilePage(BARE, OPTIONS);
    const reg = register(html);
    expect(reg).toContain('<h2 class="part" id="verifie">Ce qui est vérifié</h2>');
    expect(reg).toContain("Aucun fait vérifié pour l&#39;instant. Les informations de ce profil sont déclarées par le freelance.");
    for (const could of ["confirmée par le client", "payée sur Proofseen", "possession est prouvée", "répertoire officiel", "prestataire de paiement", "URSSAF"]) expect(reg).toContain(could);
    expect(reg).not.toMatch(/facture|accès au dépôt de code|livrable public/);
    expect(reg).toContain('<a href="/methode/">Comment nous vérifions</a>');
    // Aucun vert quand rien n'est vérifié : le rail le dit aussi.
    expect(body(html).match(GREEN)).toBeNull();
    expect(html).toContain('<a class="tally" href="#verifie">Aucun fait vérifié pour l&#39;instant.</a>');
    expect(renderProfilePage(BARE, { ...OPTIONS, lang: "en" })).toContain("No verified fact yet.");
  });

  it("pose le vert sur les faits vérifiés seulement, jamais sur le déclaré", () => {
    const html = renderProfilePage(PROVEN, OPTIONS);
    expect(register(html).match(/class="seal"/g)).toHaveLength(3);
    expect(outsideRegister(body(html)).match(GREEN)).toBeNull();
    const declared = between(html, '<section class="declared"', "</section>");
    expect(declared).toContain("Déclaré par le freelance");
    expect(declared).toContain("WebAssembly");
    expect(declared).not.toMatch(/seal|stamp|class="sq"|proof/);
    // Le vert de la feuille de style ne vise que les classes du registre.
    const greenRules = PROFILE_STYLES.split("}").filter((rule) => rule.includes("var(--ps-proof)") && !rule.includes("@keyframes") && !rule.includes("0%,76%"));
    for (const rule of greenRules) expect(rule).toMatch(/\.seal|\.stamp|\.sq|\.proofline::before/);
  });

  it("donne à chaque fait vérifié sa trace : source, vérificateur, date", () => {
    const html = renderProfilePage(PROVEN, OPTIONS);
    const reg = register(html);
    expect(reg).toContain('<time datetime="2026-10-14">Confirmée par un contact chez le client le 14 octobre 2026</time>');
    expect(reg).toContain("<dt>Source</dt><dd>Confirmation du client</dd>");
    expect(reg).toContain("<dt>Vérifié par</dt><dd>Un contact chez le client, par lien signé</dd>");
    expect(reg).toContain('<time datetime="2026-10-02">Payée sur Proofseen, vérifiée le 2 octobre 2026</time>');
    expect(reg).toContain("<dd>Mission payée et validée sur Proofseen</dd>");
    expect(reg).toContain("<dd>Facture</dd><");
    expect(reg).toContain("<dd>Proofseen, sur pièce</dd>");
    expect(reg).toContain('<a href="https://camille.dev" rel="me noopener">https://camille.dev</a>');
    expect(reg).toContain('<time datetime="2026-09-12">Possession prouvée le 12 septembre 2026</time>');
    expect(reg).toContain("<dd>enregistrement DNS TXT</dd>");
    expect(reg).toContain('<dt>Dernière relecture</dt><dd><time datetime="2026-10-18">18 octobre 2026</time></dd>');
    expect(reg).toContain('<dt>Date</dt><dd><time datetime="2026-09-20">20 septembre 2026</time></dd>');
    expect(reg).toContain("Entreprise active au répertoire officiel des entreprises (vérifié le 5 octobre 2026)");
    expect(html).toContain('<a class="tally" href="#verifie">3 missions vérifiées · 1 adresse prouvée · 3 faits vérifiés</a>');
    // Chaque mission peut être citée seule.
    expect(reg).toContain('<li class="piece" id="mission-1">');
  });

  it("garde la trace d'une adresse prouvée sur un profil pseudonyme, jamais l'adresse ni la photo", () => {
    const html = renderProfilePage({ ...PROVEN, visibility: "pseudonymous", displayName: null, provenUrls: [], provenAddresses: [{ ...PROVEN.provenAddresses![0]!, url: "https://camille.dev" }] }, OPTIONS);
    expect(html).not.toContain("camille.dev");
    expect(html).not.toContain("Camille Martin");
    expect(html).not.toContain('class="avatar"');
    expect(register(html)).toContain("Possession prouvée le 12 septembre 2026");
    expect(register(html)).toContain("1 adresse prouvée.");
  });

  it("garde l'ordre des titres : le nom, puis ce qui est vérifié, puis ce qui est déclaré", () => {
    const headings = [...renderProfilePage(PROVEN, OPTIONS).matchAll(/<h([1-4])[^>]*>([^<]*)/g)].map(([, level, text]) => `${level}:${text}`);
    expect(headings.slice(0, 3)).toEqual(["1:Camille Martin", "2:Ce qui est vérifié", "3:Missions vérifiées"]);
    expect(headings.indexOf("2:Déclaré par le freelance")).toBeGreaterThan(headings.indexOf("3:Faits vérifiés"));
    expect(headings).toContain("3:Compétences");
  });
});

describe("la frappe du poinçon (M2), en CSS seul", () => {
  it("ne joue que si le mouvement est permis et la timeline de vue disponible, sur six pièces au plus", () => {
    expect(PROFILE_STRIKE_CSS.startsWith("@media (prefers-reduced-motion:no-preference){@supports (animation-timeline:view()){")).toBe(true);
    expect(PROFILE_STRIKE_CSS).toContain(".pieces>.piece:nth-child(-n+6){view-timeline:--piece block}");
    expect(PROFILE_STRIKE_CSS).toContain("animation-range:entry 60% entry 100%");
    expect(PROFILE_STRIKE_CSS.length).toBeLessThan(1500);
  });

  it("part d'un état visible : aucune opacité, le cartouche levé puis frappé, l'anneau qui finit transparent", () => {
    expect(PROFILE_STYLES).not.toMatch(/opacity|display\s*:\s*none|visibility\s*:\s*hidden/);
    expect(PROFILE_STRIKE_CSS).toContain("transform:scale(1.06)");
    expect(PROFILE_STRIKE_CSS).toContain("transform:scale(.97)");
    expect(PROFILE_STRIKE_CSS).toMatch(/100%\{transform:scale\([^)]*\);border-color:transparent\}/);
    // L'état sans animation de l'anneau est déjà l'état final.
    expect(PROFILE_STYLES).toContain(".seal::after{content:\"\";position:absolute;inset:-1px;border:1px solid transparent;");
  });

  it("n'emploie que les jetons de la marque, et aucun survol hors des appareils qui survolent", () => {
    expect(PROFILE_STYLES).not.toMatch(/#[0-9a-f]{3,6}\b/i);
    expect(PROFILE_STYLES).not.toContain(":hover");
  });
});
