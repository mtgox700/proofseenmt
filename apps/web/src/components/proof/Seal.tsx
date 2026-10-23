import "@proofseen/brand/seal.css";
import { z } from "zod";

/*
 * The poinçon of the connected space: the dated cartouche of a fact a third party verified (CONNECTED_PLAN §2), in
 * green, with its coins de poinçon where `corner-shape` exists. The same markup as the register of the hub
 * (packages/hub/src/profile-proofs.ts): `<p class="seal"><time datetime="…">…</time></p>`, then the trace in the
 * trace face. Green is earned: use it only for a fact read from the database (confirmed by the client, paid on
 * Proofseen, address proven, SIRET checked, URSSAF verified); apps/web/test/seal.test.ts lists the files allowed to.
 */

const DAY = /^\d{4}-\d{2}-\d{2}$/;

const sealSchema = z.object({
  /** The whole sentence, its date written out: « Confirmée par le client le 22 octobre 2026 ». */
  text: z.string().trim().min(1),
  /** When the fact was verified: a Date, or a calendar day (YYYY-MM-DD) or an ISO instant. */
  date: z.union([z.date(), z.string()]).transform((value, ctx) => {
    const day = value instanceof Date ? value : DAY.test(value) ? new Date(`${value}T00:00:00Z`) : new Date(value);
    if (Number.isNaN(day.getTime())) {
      ctx.addIssue({ code: "custom", message: "a seal needs a real date" });
      return z.NEVER;
    }
    return day.toISOString().slice(0, 10);
  }),
  /** The trace beside the cartouche: source, verifier, last reading. A row without a value is not written. */
  trace: z.array(z.object({ label: z.string().trim().min(1), value: z.string().trim() })).readonly().default([]),
  /** Strike once, now: only for a real event read from the database, never on every load of a page. */
  strike: z.boolean().default(false),
});

export type SealProps = z.input<typeof sealSchema>;

/** Throws on a seal without text or with a date that is not one: a mark that cannot say when must not be drawn. */
export function Seal(props: SealProps) {
  const { text, date, trace, strike } = sealSchema.parse(props);
  const rows = trace.filter((row) => row.value !== "");
  const seal = (
    <p className="seal" data-strike={strike ? "" : undefined}>
      <time dateTime={date}>{text}</time>
    </p>
  );
  if (rows.length === 0) return seal;
  return (
    <div className="sealed">
      {seal}
      <dl className="trace">
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
