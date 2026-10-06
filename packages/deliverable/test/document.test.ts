import { describe, expect, it } from "vitest";
import { b, definitions, documentTitle, heading, list, paragraph, table, toHtml, toMarkdown, type ReportDocument } from "../src/document";

const doc: ReportDocument = [
  heading(1, "Votre visibilité — ", b("Camille Dupont")),
  paragraph("Mesure du ", b("2026-10-24"), "."),
  table(["Moteur", "Résultat"], [["openai", "0 fois sur 200"]]),
  list(["Premier point", "Deuxième point"]),
  definitions([{ term: "Effort", detail: "moyen" }]),
];

const html = () => toHtml(doc, { lang: "fr", title: documentTitle(doc) });

describe("le fond est décrit une fois, rendu deux fois", () => {
  it("porte les mêmes faits dans les deux rendus", () => {
    const md = toMarkdown(doc);
    for (const fact of ["Camille Dupont", "2026-10-24", "openai", "0 fois sur 200", "Premier point", "moyen"]) {
      expect(md, `markdown: ${fact}`).toContain(fact);
      expect(html(), `html: ${fact}`).toContain(fact);
    }
  });

  it("met en valeur au moyen propre à chaque format", () => {
    expect(toMarkdown(doc)).toContain("**Camille Dupont**");
    expect(html()).toContain("<strong>Camille Dupont</strong>");
  });

  it("conserve les espaces entre fragments : un fragment se compose avec ses voisins", () => {
    // Rogner chaque fragment collerait « …IA — » à « Camille Dupont ». Défaut vu à l'exécution, pas au test unitaire.
    expect(toMarkdown(doc)).toContain("Votre visibilité — **Camille Dupont**");
    expect(toMarkdown(doc)).toContain("Mesure du **2026-10-24**.");
    expect(html()).toContain("Votre visibilité — <strong>Camille Dupont</strong>");
  });

  it("neutralise quand même un saut de ligne à l'intérieur d'un fragment", () => {
    expect(toMarkdown([paragraph("avant\n## faux titre")])).not.toMatch(/^## faux titre/m);
  });

  it("tire le titre du document de son premier titre", () => {
    expect(documentTitle(doc)).toBe("Votre visibilité — Camille Dupont");
    expect(html()).toContain("<title>Votre visibilité — Camille Dupont</title>");
  });
});

describe("une valeur hostile ne remodèle ni l'un ni l'autre", () => {
  const hostile = "Dev | cible | fournie par vous";
  const injected: ReportDocument = [
    table(["Offre", "Origine"], [[hostile, "choisie par Proofseen"]]),
    paragraph("<script>alert(1)</script>"),
    heading(2, "Réserve\n## Résultat garanti"),
    paragraph("Référence ", b("`FR-1AB2C`")),
  ];

  it("échappe les barres qui forgeraient une colonne de tableau", () => {
    expect(toMarkdown(injected)).toContain("| Dev \\| cible \\| fournie par vous | choisie par Proofseen |");
  });

  it("n'ouvre aucune balise dans le HTML", () => {
    const out = toHtml(injected, { lang: "fr", title: "t" });
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
  });

  it("ne laisse pas un saut de ligne ouvrir un faux titre en Markdown", () => {
    expect(toMarkdown(injected)).not.toMatch(/^## Résultat garanti/m);
  });

  it("neutralise l'accent grave qui casserait un extrait de code", () => {
    expect(toMarkdown(injected)).toContain("\\`FR-1AB2C\\`");
  });
});

describe("le document HTML se tient tout seul", () => {
  it("n'appelle ni script ni ressource distante", () => {
    const out = html();
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toMatch(/https?:\/\//);
  });

  it("demande à ne pas être indexé : il parle d'une personne et n'a qu'un destinataire", () => {
    expect(html()).toContain('name="robots" content="noindex,nofollow"');
  });

  it("fait défiler ses tableaux dans leur cadre, pas la page entière", () => {
    // Un rapport client s'ouvre aussi sur un téléphone : six colonnes n'y tiennent pas, et une page qui déborde
    // horizontalement est illisible. Le cadre défile, le document reste droit.
    expect(html()).toContain('<div class="scroll"><table>');
    expect(html()).toContain(".scroll{overflow-x:auto");
  });

  it("déclare sa langue et son encodage", () => {
    expect(html()).toContain('<html lang="fr">');
    expect(html()).toContain('<meta charset="utf-8">');
  });
});
