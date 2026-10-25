import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { fingerprint } from "../src/canonical";
import { renderPdf } from "../src/pdf";
import { digestGroups, fileDigestGroups, pageBreakBefore } from "../src/pdf-layout";
import { renderTemplate } from "../src/render";
import { demoContract, demoOptionals, demoOptionalVariables } from "./support/demo";
import { extractFromStreams, extractText, extractWithPdftotext, pdftotextAvailable } from "./support/pdf-text";
import { referenceFingerprint, referencePdf } from "./support/reference";

const NNBSP = " ";
const PRINT_REFERENCE = fileURLToPath(new URL("./support/print-reference.ts", import.meta.url));

/*
 * EMPREINTES DE RÉFÉRENCE (SHA-256 des octets exacts du PDF de référence, français et anglais).
 *
 * FIGÉES le 2026-10-25, après le gel du vecteur du poinçon (Tetsu L1-140 et L1-141, Shogun PASS L1-120). Raisons de cette
 * valeur : (1) les gabarits du Trésor ont changé (L1-100 : rattachement
 * des variables, « œuvre », « Proofseen » désigne la société e-kigai) ; (2) les mots du moteur (L1-101 : « Signature
 * électronique simple sur Proofseen », « Prise de connaissance sur Proofseen ») et le pied de page, qui dit que l'empreinte
 * imprimée est celle du contenu et non du fichier ; (3) le poinçon de la marque, niveau 64, 12 mm, en vecteur, branché dans
 * l'emplacement réservé (`hallmark.ts`, `@proofseen/brand/fingerprint-mark`, décision de Shogun L1-090 point 1, PASS L1-120) ;
 * (4) décision L1-147 : l'empreinte du CONTENU s'imprime en capitales groupées par quatre (comme à l'écran), celle d'un
 * FICHIER reste en minuscules (`fileDigestGroups`) ; seul le pied de page change, par rapport à `9f3c34fa…` et `530a37f2…`.
 * Elles ne bougent plus qu'avec la raison écrite ci-dessous (L1-120 : « aucun autre changement de dessin du poinçon sans
 * nouvelle DÉCISION de la Création »).
 *
 * Si ce test échoue :
 *  1. Ce n'est pas forcément un bug. Les octets d'un PDF changent quand change pdfmake, pdfkit, fontkit, l'une des six
 *     polices de packages/brand/pdf-fonts (verify.mjs doit rester vert), la version de Node (compression zlib), un mot
 *     d'un gabarit, ou la mise en page de pdf-layout.ts.
 *  2. Regarder d'abord le document : `pnpm exec tsx packages/documents/test/support/print-reference.ts fr`, rendre le PDF
 *     de référence (test/support/reference.ts), le convertir (`pdftoppm -r 100 -png`) et REGARDER les pages.
 *  3. Si la différence est voulue (montée de version, nouvelle mise en page), recopier les deux nouvelles empreintes ici
 *     et écrire la raison dans le message de commit. Les documents DÉJÀ émis ne changent jamais : le coffre scelle
 *     l'empreinte des octets à l'émission et ne régénère rien.
 *  4. Si la différence n'est pas voulue, ne pas "corriger" l'empreinte : chercher ce qui a bougé (`git diff`, `pnpm ls
 *     pdfmake pdfkit fontkit`, `node --version`).
 */
const REFERENCE_FINGERPRINT = {
  fr: "407c1fc2cd72ce1aed4d671eebb6ae56415a9383d2d94b1679e7e79dc6b6fe3f",
  en: "ede94235c4d554296b8e0b4e75f362c3264556be17bde77a4e506bd4885fedb5",
} as const;

/** La valeur d'une entrée du dictionnaire Info (pdfkit les écrit en objets indirects : `/Title 44 0 R`). */
const infoValue = (raw: string, key: string): string | undefined => {
  const ref = new RegExp(`/${key} (\\d+) 0 R`).exec(raw)?.[1];
  return ref === undefined ? undefined : new RegExp(`\\n${ref} 0 obj\\n\\((.*)\\)\\nendobj`).exec(raw)?.[1];
};

const pagesOf = (pdf: Buffer): number => (pdf.toString("latin1").match(/\/Type \/Page(?![a-z])/g) ?? []).length;
// The stream extractor (used where poppler is absent, as in the Linux gate) separates text runs with a space, and pdfmake
// cuts a hyphenated word into two runs: « Nguyễn- Dvořák ». The PDF bytes are the same on every platform (reference
// digest), so only the reading is rejoined here.
const flat = (text: string): string => text.replace(/[ \n\r\t]+/g, " ").replace(/(\p{L})- (?=\p{L})/gu, "$1-");

const modelOf = (variables: Record<string, unknown>, options: Parameters<typeof renderTemplate>[4] = {}) => {
  const rendered = renderTemplate("service-agreement", 1, "fr", variables, options);
  if (!rendered.ok) throw new Error(`${rendered.error.code} : ${rendered.error.message}`);
  return rendered.value;
};

describe("deterministic PDF (decision L1-006)", () => {
  it("is a real PDF 1.7 with the three brand font families embedded as subsets", async () => {
    const pdf = await referencePdf("fr");
    expect(pdf.subarray(0, 8).toString("latin1")).toBe("%PDF-1.7");
    expect(pdf.subarray(-6).toString("latin1")).toContain("%%EOF");
    const raw = pdf.toString("latin1");
    for (const font of ["PSText-Regular", "PSText-Bold", "PSDisplay-Semibold", "PSMono-Regular"]) expect(raw).toMatch(new RegExp(`/BaseFont /[A-Z]{6}\\+${font}`));
    expect(pagesOf(pdf)).toBeGreaterThan(5);
  });

  it("gives the same bytes for the same model, and different bytes for a different one", async () => {
    const [a, b] = [await referencePdf("fr"), await referencePdf("fr")];
    expect(fingerprint(a)).toBe(fingerprint(b));
    expect(a.equals(b)).toBe(true);
    const other = await renderPdf(modelOf(demoContract({ "contract.totalCents": 300_100 }), { watermark: true }));
    expect(fingerprint(other)).not.toBe(fingerprint(a));
  });

  it("never reads the clock: the same bytes whatever date the machine believes it is", async () => {
    const before = await referenceFingerprint("fr");
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2031-07-14T09:30:00Z"));
      expect(await referenceFingerprint("fr")).toBe(before);
      vi.setSystemTime(new Date("1999-12-31T23:59:59Z"));
      expect(await referenceFingerprint("fr")).toBe(before);
    } finally {
      vi.useRealTimers();
    }
  });

  it("gives the same bytes in another process, in other time zones (a jsPDF flaw the engine does not have)", async () => {
    const here = await referenceFingerprint("fr");
    for (const TZ of ["UTC", "Pacific/Auckland", "America/Los_Angeles"]) {
      const out = execFileSync(process.execPath, ["--import", "tsx", PRINT_REFERENCE, "fr"], { encoding: "utf8", env: { ...process.env, TZ }, timeout: 200_000 });
      expect(out.trim(), TZ).toBe(here);
    }
  }, 660_000);

  it("pins the fingerprint of the reference documents (French and English)", async () => {
    expect({ fr: await referenceFingerprint("fr"), en: await referenceFingerprint("en") }).toEqual(REFERENCE_FINGERPRINT);
  });

  it("fills the metadata from the data: title, author, and the issue date in place of the clock", async () => {
    const raw = (await referencePdf("fr")).toString("latin1");
    expect(infoValue(raw, "CreationDate")).toBe("D:20261024000000Z");
    expect(infoValue(raw, "ModDate")).toBe("D:20261024000000Z");
    expect(infoValue(raw, "Author")).toBe("Proofseen");
    expect(infoValue(raw, "Title")).toBe("Contrat de prestation de services");
    expect(infoValue(raw, "Subject")).toBe("service-agreement v1");
    expect(raw).toContain("/Lang (fr-FR)");
  });

  it("changes when the date of issue changes, and only then", async () => {
    const a = await renderPdf(modelOf(demoContract({ "document.issuedOn": "2026-10-24" })));
    const b = await renderPdf(modelOf(demoContract({ "document.issuedOn": "2026-10-25" })));
    expect(infoValue(a.toString("latin1"), "CreationDate")).toBe("D:20261024000000Z");
    expect(infoValue(b.toString("latin1"), "CreationDate")).toBe("D:20261025000000Z");
    expect(fingerprint(a)).not.toBe(fingerprint(b));
  });
});

describe("text in the PDF (selectable, with accents and foreign names)", () => {
  it("contains the accents, the foreign names and the French typography as real text", async () => {
    const text = extractText(await referencePdf("fr"));
    const squashed = flat(text);
    for (const word of ["Contrat de prestation de services", "Łukasz", "Nguyễn-Dvořák", "Çağrı", "L'HAŸ-LES-ROSES", "Bâtiment B", "Société Exemple", "indépendant", "Éditeur Exemple"]) {
      expect(squashed, word).toContain(word);
    }
    // On the flattened text: the stream extractor may break a line between two words, never inside the narrow spaces.
    expect(squashed).toContain(`«${NNBSP}le Prestataire${NNBSP}»`);
    expect(text).not.toContain("�");
    expect(text).not.toMatch(/[□▯]/u);
  });

  it("the stream extractor (no poppler needed) finds the same words as pdftotext when it is installed", async () => {
    const pdf = await referencePdf("fr");
    const fromStreams = flat(extractFromStreams(pdf));
    for (const word of ["Łukasz", "Nguyễn", "Dvořák", "Çağrı", "HAŸ", "Prestataire", "ARTICLE 1", "Page 1 / "]) {
      expect(fromStreams, word).toContain(word);
    }
    if (pdftotextAvailable()) {
      const reference = new Set(flat(extractWithPdftotext(pdf)).split(" ").filter((w) => w.length > 6));
      const mine = new Set(fromStreams.split(" ").filter((w) => w.length > 6));
      const shared = [...reference].filter((w) => mine.has(w)).length;
      expect(shared / reference.size).toBeGreaterThan(0.85);
    }
  });

  it("prints the first sixteen characters of the content digest, grouped by four, and the page number, on every page", async () => {
    const model = modelOf(demoContract(), { watermark: true });
    const pdf = await renderPdf(model);
    const text = flat(extractFromStreams(pdf));
    const groups = digestGroups(model.contentDigest);
    // L1-147 : l'empreinte du CONTENU s'écrit en capitales, comme à l'écran ; celle du FICHIER reste en minuscules.
    expect(groups).toMatch(/^[0-9A-F]{4} [0-9A-F]{4} [0-9A-F]{4} [0-9A-F]{4}$/);
    expect(fileDigestGroups(model.contentDigest)).toMatch(/^[0-9a-f]{4} [0-9a-f]{4} [0-9a-f]{4} [0-9a-f]{4}$/);
    expect(text.split(groups).length - 1).toBe(pagesOf(pdf));
    expect(text).not.toContain(fileDigestGroups(model.contentDigest));
    const pages = pagesOf(pdf);
    for (let page = 1; page <= pages; page += 1) expect(text).toContain(`Page ${page} / ${pages}`);
  });

  it("prints the review line at the foot of every page while the template is in review", async () => {
    const pdf = await referencePdf("fr");
    expect(flat(extractFromStreams(pdf)).split("Modèle Proofseen en cours de relecture par un avocat, version 1.").length - 1).toBe(pagesOf(pdf));
  });

  it("prints the test watermark on every page of a test render, and on none otherwise", async () => {
    const marked = await referencePdf("fr");
    const plain = await renderPdf(modelOf(demoContract()));
    expect(flat(extractFromStreams(marked)).split("Exemple, non signé").length - 1).toBe(pagesOf(marked));
    expect(extractFromStreams(plain)).not.toContain("non signé");
  });

  it("renders the English version with English chrome", async () => {
    const text = flat(extractFromStreams(await referencePdf("en")));
    expect(text).toContain("Example, unsigned");
    expect(text).toContain("CONTENT FINGERPRINT");
    expect(text).toContain("EUR 3,000.00");
  });
});

describe("layout", () => {
  it("includes the optional clauses when the parties chose them, and stays deterministic with them", async () => {
    const model = modelOf({ ...demoContract(), ...demoOptionalVariables() }, { optionalClauses: demoOptionals, watermark: true });
    const [a, b] = [await renderPdf(model), await renderPdf(model)];
    expect(a.equals(b)).toBe(true);
    expect(flat(extractFromStreams(a))).toContain("Assureur Exemple Mutuelle");
  });

  it("paginates a very long scope and thirty deliverables without losing a character or a page number", async () => {
    const scope = Array.from({ length: 40 }, (_v, i) => `Lot ${i + 1} : étude, réalisation et recette des écrans numéro ${i + 1} (noms : Łukasz, Nguyễn).`).join(" ").slice(0, 5900);
    const deliverables = Array.from({ length: 30 }, (_v, i) => `Livrable ${i + 1} : document de ${i + 10} pages au plus, remis au format source`);
    const started = Date.now();
    const pdf = await renderPdf(modelOf(demoContract({ "input.scope": scope, "input.deliverables": deliverables })));
    expect(Date.now() - started).toBeLessThan(30_000);
    const text = flat(extractFromStreams(pdf));
    expect(text).toContain("Livrable 30");
    expect(text).toContain(`Page ${pagesOf(pdf)} / ${pagesOf(pdf)}`);
    expect(pdf.length).toBeLessThan(400_000);
  });

  it("breaks before an article title that would be the last thing on a page, and only then", () => {
    expect(pageBreakBefore({ headlineLevel: 1 }, [])).toBe(true);
    expect(pageBreakBefore({ headlineLevel: 1 }, [{}])).toBe(false);
    expect(pageBreakBefore({}, [])).toBe(false);
  });

  it.skipIf(!pdftotextAvailable())("never leaves an article title alone at the foot of a page of the reference contract", async () => {
    const pages = extractWithPdftotext(await referencePdf("fr")).split("\f").filter((page) => page.trim() !== "");
    expect(pages.length).toBeGreaterThan(5);
    for (const page of pages) {
      const body = page.split("\n").map((l) => l.trim()).filter((l) => l !== "" && !/^(EMPREINTE DU CONTENU|Page \d+ \/ \d+|Modèle Proofseen)/.test(l));
      expect(body[body.length - 2] ?? "").not.toMatch(/^ARTICLE \d+$/);
      expect(body[body.length - 1] ?? "").not.toMatch(/^ARTICLE \d+$/);
    }
  });

  it("says on every page that the printed fingerprint is the content's and not the file's, and where to verify it", async () => {
    const pdf = await renderPdf(modelOf(demoContract(), { watermark: true }), { verifyUrl: "https://example.org/verifier" });
    const text = flat(extractFromStreams(pdf));
    expect(text.split("non du fichier").length - 1).toBe(pagesOf(pdf));
    expect(text.split("Vérification").length - 1).toBe(pagesOf(pdf));
    expect(text.split("example.org").length - 1).toBe(pagesOf(pdf));
    // Sans adresse, la ligne dit seulement ce que l'empreinte désigne.
    expect(flat(extractFromStreams(await referencePdf("fr")))).not.toContain("Vérification");
  });

  it("accepts a hallmark seam (the SVG of the fingerprint mark) without breaking determinism", async () => {
    const svg = (digest: string): string => `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect x="2" y="2" width="60" height="60" fill="none" stroke="#0a0b10"/><text x="20" y="40" font-size="24">${digest.slice(0, 1)}</text></svg>`;
    const model = modelOf(demoContract(), { watermark: true });
    const [a, b] = [await renderPdf(model, { hallmarkSvg: svg, verifyUrl: "https://example.org/verifier" }), await renderPdf(model, { hallmarkSvg: svg, verifyUrl: "https://example.org/verifier" })];
    expect(a.equals(b)).toBe(true);
    // pdfmake coupe une adresse à chaque « / » : on cherche l'hôte, qui reste d'un seul morceau.
    expect(flat(extractFromStreams(a))).toContain("example.org");
  });
});
