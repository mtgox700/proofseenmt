import "@/styles/ui.css";
import Link from "next/link";
import { z } from "zod";
import type { Lang } from "@/i18n/types";
import { colon, count } from "@/lib/format";
import { instantSchema, machineDate, waited, writtenDate, type Instant } from "../when";

/*
 * KpiTile (LEGENDS_P2_CONCEPT §B.4, §B.7): one count, what it counts in a sentence, how long the oldest item has
 * waited, what is late, and where to act. What decides leads (L1-091 K5): the late count is an amber mark at the top,
 * the oldest wait stands beside a count kept modest, and a tile at zero goes quiet. The figure is set, never rolled
 * (Kensa m4); there is no trend, since no history is stored; and it never counts a person's worth: a label or a
 * definition that names a score, a rank or a rating is refused (AI Act). Ages are taken at the moment of the measure,
 * not at the moment of reading: no clock. Tiles measured together say when once (KpiGrid and MeasuredAt).
 */

const RANKING = /\b(?:score|scoring|rank|ranking|rang|classement|rating|notation|note moyenne|average rating)s?\b/i;

const propsSchema = z.object({
  label: z.string().trim().min(1),
  value: z.number().int().nonnegative(),
  definition: z.string().trim().min(1),
  measuredAt: instantSchema,
  oldestSince: instantSchema.optional(),
  overdue: z.number().int().nonnegative().optional(),
  href: z.string().min(1).optional(),
  headingLevel: z.union([z.literal(2), z.literal(3)]).default(3),
  /** The word the count carries: « en attente » by default, « à vérifier », « signalés ». */
  unit: z.string().trim().min(1).optional(),
  /** Off when the page says once when its tiles were measured (KpiGrid does). */
  showMeasure: z.boolean().default(true),
});

export type KpiTileProps = z.input<typeof propsSchema> & { readonly lang: Lang };

const WORDS = {
  fr: { unit: "en attente", oldest: "la plus ancienne", overdue: (n: string) => `${n} en retard`, measured: "Mesuré le" },
  en: { unit: "waiting", oldest: "the oldest", overdue: (n: string) => `${n} overdue`, measured: "Measured on" },
} as const;

/** « Mesuré le 24 octobre 2026 à 09:42 », once for a set of tiles, under the page title. */
export function MeasuredAt({ lang, at }: { readonly lang: Lang; readonly at: Instant }) {
  const when = instantSchema.parse(at);
  return (
    <p className="ui-measured">
      <time dateTime={machineDate(when, "minute")}>{`${WORDS[lang].measured} ${writtenDate(when, lang, "minute")}`}</time>
    </p>
  );
}

/** Throws on a count that is not a whole number, a date that is not one, or a label that ranks people. */
export function KpiTile(props: KpiTileProps) {
  const { label, value, definition, measuredAt, oldestSince, overdue, href, headingLevel, unit, showMeasure } = propsSchema.parse(props);
  if (RANKING.test(label) || RANKING.test(definition) || RANKING.test(unit ?? "")) throw new Error("a tile counts facts, it never ranks people (AI Act)");
  const { lang } = props;
  const words = WORDS[lang];
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const late = overdue !== undefined && overdue > 0;
  return (
    <div className="ui-kpi" data-link={href === undefined ? undefined : ""} data-zero={value === 0 ? "" : undefined}>
      <div className="ui-kpi-head">
        <Heading className="ui-kpi-label">{href === undefined ? label : <Link href={href}>{label}</Link>}</Heading>
        {late ? <p className="ui-kpi-late">{words.overdue(count(overdue ?? 0, lang))}</p> : null}
      </div>
      {/* The count carries its word, so « 1 » and « la plus ancienne » never read as one phrase (L1-120 R2). */}
      <p className="ui-kpi-figure">
        <data className="ui-kpi-value" value={String(value)}>
          {count(value, lang)}
        </data>
        {` ${unit ?? words.unit}`}
      </p>
      {oldestSince === undefined || value === 0 ? null : (
        <p className="ui-kpi-oldest">
          <span className="ui-kpi-oldest-k">{`${words.oldest}${colon(lang)}`}</span>
          <span className="ui-kpi-oldest-v">{waited(oldestSince, measuredAt, lang)}</span>
        </p>
      )}
      <p className="ui-kpi-def">{definition}</p>
      {showMeasure ? <MeasuredAt lang={lang} at={measuredAt} /> : null}
    </div>
  );
}

export interface KpiGridProps {
  readonly lang: Lang;
  /** Names the list of tiles: « Files de revue ». */
  readonly label: string;
  /** When every tile was measured: said once, by the page (MeasuredAt), not four times. */
  readonly measuredAt: Instant;
  readonly tiles: readonly Omit<KpiTileProps, "lang" | "measuredAt" | "showMeasure">[];
}

/** A row of tiles measured together; two by two on a phone, so the queue below stays in sight. */
export function KpiGrid({ lang, label, measuredAt, tiles }: KpiGridProps) {
  return (
    <ul className="ui-kpis" aria-label={label}>
      {tiles.map((tile) => (
        <li key={tile.label}>
          <KpiTile {...tile} lang={lang} measuredAt={measuredAt} showMeasure={false} />
        </li>
      ))}
    </ul>
  );
}
