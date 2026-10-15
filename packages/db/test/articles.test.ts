import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { articleDesk } from "../src/article-desk";
import { ArticleInputSchema, slugify, sourcesOf } from "../src/article-input";
import { articles, BLOG_PAGE_SIZE } from "../src/articles";
import { DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const SOURCE = { title: "Service-Public.fr", url: "https://entreprendre.service-public.fr/vosdroits/F23961" };

let drawn = 0;
const article = (over: Record<string, unknown> = {}) => {
  drawn += 1;
  return {
    lang: "fr",
    slug: `article-${drawn}`,
    title: "Choisir son statut",
    description: "Ce que change chaque statut.",
    body: "## Le statut\n\nUn texte relu, sans nombre.",
    category: "guide",
    audience: "freelance",
    authorName: "Équipe Proofseen",
    sources: [],
    ...over,
  };
};

const desk = () => articleDesk(t.db, { role: "operator" });

const published = async (over: Record<string, unknown> = {}, now = new Date()): Promise<string> => {
  const saved = await desk().create(article(over));
  if (saved.kind !== "saved") throw new Error(`non enregistré : ${saved.kind}`);
  expect(await desk().publish(saved.id, now)).toEqual({ kind: "done" });
  return saved.id;
};

describe("règles d'écriture d'un article", () => {
  it("refuse un chiffre sans source, et l'accepte avec une source", () => {
    const withDigit = article({ body: "Le plafond est de 77 700 euros." });
    expect(ArticleInputSchema.safeParse(withDigit).success).toBe(false);
    expect(ArticleInputSchema.safeParse({ ...withDigit, sources: [SOURCE] }).success).toBe(true);
    expect(ArticleInputSchema.safeParse(article({ title: "Les 3 statuts" })).success).toBe(false);
  });

  it("refuse le HTML brut et les sources qui ne sont pas des adresses https", () => {
    expect(ArticleInputSchema.safeParse(article({ body: "Texte <script>alert(1)</script>" })).success).toBe(false);
    expect(ArticleInputSchema.safeParse(article({ body: '<img src=x onerror="alert(1)">' })).success).toBe(false);
    expect(ArticleInputSchema.safeParse(article({ body: "Un commentaire <!-- caché -->" })).success).toBe(false);
    expect(ArticleInputSchema.safeParse(article({ body: "Si a < b et b > c, rien à craindre." })).success).toBe(true);
    for (const url of ["javascript:alert(1)", "http://www.urssaf.fr/", "https://localhost/x", "data:text/html,x"]) {
      expect(ArticleInputSchema.safeParse(article({ sources: [{ title: "x", url }] })).success).toBe(false);
    }
  });

  it("tire une adresse lisible d'un titre accentué", () => {
    expect(slugify("Micro-entreprise, EURL ou SASU : quel statut ?")).toBe("micro-entreprise-eurl-ou-sasu-quel-statut");
    expect(slugify("Fixer son TJM — été 2026")).toBe("fixer-son-tjm-ete-2026");
  });

  it("ne garde, des sources lues en base, que celles qui ont la bonne forme", () => {
    expect(sourcesOf([SOURCE, { title: "x", url: "javascript:alert(1)" }, "texte", null])).toEqual([SOURCE]);
    expect(sourcesOf({ not: "a list" })).toEqual([]);
  });
});

describe("bureau de rédaction", () => {
  it("ne s'ouvre que pour l'opérateur", () => {
    expect(() => articleDesk(t.db, { role: "company" } as unknown as { role: "operator" })).toThrow();
  });

  it("enregistre un brouillon invisible du public, puis le publie et le retire", async () => {
    const saved = await desk().create(article({ slug: "brouillon-cache" }));
    expect(saved.kind).toBe("saved");
    const id = saved.kind === "saved" ? saved.id : "";
    expect(await articles(t.db).bySlug("fr", "brouillon-cache")).toBeNull();

    const first = new Date("2026-10-15T08:00:00Z");
    expect(await desk().publish(id, first)).toEqual({ kind: "done" });
    expect((await articles(t.db).bySlug("fr", "brouillon-cache"))?.publishedAt).toEqual(first);
    expect(await articles(t.db).bySlug("en", "brouillon-cache")).toBeNull();

    expect(await desk().unpublish(id)).toEqual({ kind: "done" });
    expect(await articles(t.db).bySlug("fr", "brouillon-cache")).toBeNull();
    // Republier garde la première date de publication.
    await desk().publish(id, new Date("2026-11-01T08:00:00Z"));
    expect((await articles(t.db).bySlug("fr", "brouillon-cache"))?.publishedAt).toEqual(first);
  });

  it("refuse une adresse déjà prise dans la même langue, l'accepte dans l'autre", async () => {
    expect((await desk().create(article({ slug: "meme-adresse" }))).kind).toBe("saved");
    expect(await desk().create(article({ slug: "meme-adresse" }))).toEqual({ kind: "slug_taken" });
    expect((await desk().create(article({ slug: "meme-adresse", lang: "en" }))).kind).toBe("saved");
  });

  it("dit quels champs corriger, et répond absent pour un identifiant inconnu ou forgé", async () => {
    expect(await desk().create(article({ title: "", body: "Le taux est de 21,2 %." }))).toEqual({ kind: "invalid", fields: expect.arrayContaining(["title", "sources"]) });
    expect(await desk().update("00000000-0000-7000-8000-000000000000", article())).toEqual({ kind: "absent" });
    expect(await desk().update("pas-un-uuid", article())).toEqual({ kind: "absent" });
    expect(await desk().publish("pas-un-uuid")).toEqual({ kind: "absent" });
    expect(await desk().unpublish("pas-un-uuid")).toEqual({ kind: "absent" });
    expect(await desk().get("pas-un-uuid")).toBeNull();
  });

  it("modifie un article et le relit avec ses sources", async () => {
    const saved = await desk().create(article());
    const id = saved.kind === "saved" ? saved.id : "";
    expect(await desk().update(id, article({ slug: "modifie", body: "En 2026, rien.", sources: [SOURCE] }))).toEqual({ kind: "saved", id });
    expect(await desk().get(id)).toMatchObject({ slug: "modifie", status: "draft", sources: [SOURCE] });
    expect((await desk().list()).some((a) => a.id === id)).toBe(true);
  });

  it("ne publie pas un brouillon qui ne respecte plus la règle des sources", async () => {
    const saved = await desk().create(article({ body: "Rien de chiffré." }));
    const id = saved.kind === "saved" ? saved.id : "";
    await t.db.article.update({ where: { id }, data: { body: "Un plafond de 77 700 euros." } });
    expect(await desk().publish(id)).toEqual({ kind: "invalid", fields: ["sources"] });
  });

  it("la base refuse un article publié sans date et des sources qui ne sont pas une liste", async () => {
    await expect(t.db.article.create({ data: { ...article(), sources: [], status: "published" } as never })).rejects.toThrow();
    await expect(t.db.article.create({ data: { ...article(), sources: { a: 1 } } as never })).rejects.toThrow();
    await expect(t.db.article.create({ data: { ...article(), slug: "Pas Une Adresse" } as never })).rejects.toThrow();
  });
});

describe("lecture publique du blog", () => {
  it("filtre par catégorie et public, du plus récent au plus ancien, et pagine", async () => {
    const base = new Date("2026-09-01T00:00:00Z").getTime();
    for (let i = 0; i < BLOG_PAGE_SIZE + 1; i += 1) await published({ lang: "en", category: "etude", audience: "entreprise" }, new Date(base + i * 60_000));
    await published({ lang: "en", category: "guide", audience: "freelance" });

    const first = await articles(t.db).page({ lang: "en", category: "etude", audience: null, page: 1 });
    expect(first.items).toHaveLength(BLOG_PAGE_SIZE);
    expect(first.hasMore).toBe(true);
    expect(first.items[0]?.publishedAt.getTime()).toBeGreaterThan(first.items[1]?.publishedAt.getTime() ?? 0);
    const second = await articles(t.db).page({ lang: "en", category: "etude", audience: null, page: 2 });
    expect(second).toMatchObject({ hasMore: false });
    expect(second.items).toHaveLength(1);

    const guides = await articles(t.db).page({ lang: "en", category: null, audience: "freelance", page: 1 });
    expect(guides.items.every((a) => a.audience === "freelance")).toBe(true);
    expect((await articles(t.db).page({ lang: "en", category: null, audience: null, page: -4 })).items.length).toBeGreaterThan(0);
  });

  it("propose des articles liés de la même langue, la même catégorie d'abord, sans l'article lui-même", async () => {
    await published({ lang: "fr", slug: "lie-a", category: "actualite" });
    await published({ lang: "fr", slug: "lie-b", category: "actualite" });
    const related = await articles(t.db).related({ lang: "fr", slug: "lie-a", category: "actualite" });
    expect(related.map((a) => a.slug)).not.toContain("lie-a");
    expect(related[0]?.slug).toBe("lie-b");
    expect(related.length).toBeLessThanOrEqual(3);
    expect(related.every((a) => a.lang === "fr")).toBe(true);
  });

  it("alimente le flux et le sitemap des seuls articles publiés", async () => {
    const draft = await desk().create(article({ slug: "jamais-publie" }));
    expect(draft.kind).toBe("saved");
    const all = await articles(t.db).listPublished();
    expect(all.map((a) => a.slug)).not.toContain("jamais-publie");
    const feed = await articles(t.db).feed("fr");
    expect(feed.length).toBeGreaterThan(0);
    expect(feed.every((a) => a.lang === "fr" && a.body.length > 0)).toBe(true);
    expect(await articles(t.db).bySlug("fr", "<script>")).toBeNull();
  });
});
