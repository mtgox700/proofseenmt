import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../src/markdown";

/*
 * Le texte d'un article vient de l'éditeur de l'opérateur, mais il finit dans une page publique : chaque attaque connue
 * doit en sortir inerte, même si la validation à l'écriture l'avait laissée passer.
 */

const html = (source: string): string => renderMarkdown(source).html;

const executable = (out: string): boolean => /<script|<iframe|<object|<embed|<img|<svg|<style|\son[a-z]+\s*=|javascript:|data:text\/html|vbscript:/i.test(out.replace(/&lt;[\s\S]*?&gt;/g, ""));

describe("Markdown rendu sûr", () => {
  it("rend le Markdown courant : titres, listes, gras, liens, code", () => {
    const out = html("## Statut\n\nUn **choix** et un `code`.\n\n- un\n- deux\n\n[Urssaf](https://www.urssaf.fr/accueil.html)");
    expect(out).toContain('<h2 id="statut">Statut</h2>');
    expect(out).toContain("<strong>choix</strong>");
    expect(out).toContain("<code>code</code>");
    expect(out).toContain("<li>un</li>");
    expect(out).toContain('<a href="https://www.urssaf.fr/accueil.html" rel="noopener">Urssaf</a>');
  });

  it("échappe les balises script et les attributs d'événement", () => {
    for (const attack of ["<script>alert(1)</script>", "Texte <script src=//x.test/a.js></script>", '<img src=x onerror="alert(1)">', "<svg onload=alert(1)>", '<a href="#" onclick="x()">y</a>', "<iframe src=//x.test></iframe>", "<style>body{display:none}</style>"]) {
      const out = html(attack);
      expect(out, attack).toContain("&lt;");
      expect(executable(out), out).toBe(false);
    }
  });

  it("vide les adresses javascript:, data: et vbscript:, même déguisées", () => {
    for (const href of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "java\tscript:alert(1)", "data:text/html;base64,PHNjcmlwdD4=", "vbscript:msgbox(1)", "&#106;avascript:alert(1)"]) {
      const out = html(`[clic](${href}) et [ref][x]\n\n[x]: ${href}`);
      expect(executable(out), out).toBe(false);
      expect(out).not.toMatch(/href="[^"]*script/i);
    }
  });

  it("garde les entités échappées : &lt;script&gt; reste du texte", () => {
    const out = html("&lt;script&gt;alert(1)&lt;/script&gt; et &#60;b&#62;");
    expect(out).toContain("&lt;script&gt;");
    expect(out).not.toContain("<script");
    expect(out).not.toContain("<b>");
  });

  it("donne aux titres des identifiants sûrs et uniques, et descend un h1 au niveau 2", () => {
    const { html: out, headings } = renderMarkdown('# L\'été & "vous"\n\n## Sources\n\n## Sources\n\n### <script>\n\n## !!!');
    expect(headings).toEqual([
      { id: "l-ete-vous", level: 2, text: 'L\'été & "vous"' },
      { id: "sources", level: 2, text: "Sources" },
      { id: "sources-2", level: 2, text: "Sources" },
      { id: "script", level: 3, text: "<script>" },
      { id: "section", level: 2, text: "!!!" },
    ]);
    expect(out).not.toContain("<h1");
    expect(out).toContain('<h3 id="script">&lt;script&gt;</h3>');
  });

  it("ne marque que les liens externes, et remplace une image par son texte", () => {
    const out = html("[interne](/fr/blog) [ancre](#statut) [externe](http://example.org) ![schéma des statuts](https://x.test/i.png)");
    expect(out).toContain('<a href="/fr/blog">interne</a>');
    expect(out).toContain('<a href="#statut">ancre</a>');
    expect(out).toContain('<a href="http://example.org" rel="noopener">externe</a>');
    expect(out).toContain("schéma des statuts");
    expect(out).not.toContain("<img");
  });
});
