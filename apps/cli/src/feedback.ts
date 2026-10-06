import { feedback, getDb, type FeedbackPeriod } from "@proofseen/db";
import { CliError } from "./files";

/*
 * feedback : les retours de la bêta, en totaux par nature et par côté, puis les derniers textes d'une nature. Sans
 * auteur : le texte suffit pour décider quoi corriger.
 */

export interface FeedbackCommand {
  readonly log: (line: string) => void;
  readonly from: string | undefined;
  readonly kind: string | undefined;
  readonly limit: number;
}

const KINDS = ["bug", "missing", "idea", "other"] as const;
const LABELS: Readonly<Record<(typeof KINDS)[number], string>> = { bug: "ne marche pas", missing: "manque", idea: "idée", other: "autre" };

const isKind = (value: string): value is (typeof KINDS)[number] => (KINDS as readonly string[]).includes(value);

export const commandFeedback = async (o: FeedbackCommand): Promise<void> => {
  if ((process.env.DATABASE_URL ?? "") === "") throw new CliError("DATABASE_URL absente : les retours se lisent dans la base.");
  let period: FeedbackPeriod = {};
  if (o.from !== undefined) {
    const from = new Date(`${o.from}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(o.from) || Number.isNaN(from.getTime()) || from.toISOString().slice(0, 10) !== o.from) throw new CliError("--from attend une date AAAA-MM-JJ.");
    period = { from };
  }
  if (o.kind !== undefined && !isKind(o.kind)) throw new CliError(`--kind attend ${KINDS.join(", ")}.`);
  const repo = feedback(getDb());
  const summary = await repo.summary(period);
  o.log(`${summary.total} retour(s)${o.from === undefined ? "" : ` depuis le ${o.from}`}`);
  o.log(`  par nature : ${KINDS.map((k) => `${LABELS[k]} ${summary.byKind[k] ?? 0}`).join(" · ")}`);
  o.log(`  par côté   : freelance ${summary.bySide.freelance ?? 0} · entreprise ${summary.bySide.company ?? 0} · visiteur ${summary.bySide.visitor ?? 0}`);
  for (const kind of o.kind === undefined ? KINDS : [o.kind]) {
    const entries = await repo.latest(kind, o.limit, period);
    if (entries.length === 0) continue;
    o.log(`\n${LABELS[kind]} — les ${entries.length} plus récents`);
    entries.forEach((e) => o.log(`  ${e.createdAt.toISOString().slice(0, 10)} [${e.side}]${e.page === null ? "" : ` ${e.page}`} : ${e.body.replace(/\s+/g, " ")}`));
  }
};
