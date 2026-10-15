import { articleDesk } from "../src/article-desk";
import { createDb } from "../src/client";
import { ARTICLE_DRAFTS } from "../prisma/seeds/articles-drafts";

/*
 * Charge les trois guides en BROUILLON dans la base désignée par DATABASE_URL. Ne publie rien : la publication se fait
 * à la main, après relecture, depuis le bureau de rédaction (/fr/app/articles). Rejouable : un article dont l'adresse
 * existe déjà dans sa langue est laissé tel quel.
 *
 *   pnpm --filter @proofseen/db exec tsx --env-file=../../.env scripts/seed-article-drafts.ts
 */

const url = process.env.DATABASE_URL ?? "";
if (url === "") throw new Error("DATABASE_URL absente");
const db = createDb(url);

try {
  const desk = articleDesk(db, { role: "operator" });
  for (const draft of ARTICLE_DRAFTS) {
    const result = await desk.create(draft);
    const outcome = result.kind === "saved" ? "brouillon créé" : result.kind === "slug_taken" ? "déjà présent, laissé tel quel" : `refusé (${result.kind === "invalid" ? result.fields.join(", ") : result.kind})`;
    console.log(`${draft.slug} : ${outcome}`);
  }
} finally {
  await db.$disconnect();
}
