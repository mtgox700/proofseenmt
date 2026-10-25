import "@/styles/ui.css";
import { z } from "zod";
import type { Lang } from "@/i18n/types";
import { date as longDate } from "@/lib/format";
import { FINGERPRINT_ERROR, fingerprintMark, fingerprintPrefix, parseFingerprint, PENDING_FRAME } from "@proofseen/brand/fingerprint-mark";

/*
 * The poinçon d'empreinte (LEGENDS_P2_CONCEPT §A.3), drawn by the server: no script, one <svg> of two paths.
 *
 * Three states (§A.4, decided in L1-090), told apart by their form before their colour, and always by a word:
 * - filed: a closed frame of ink, the cells in ink;
 * - pending: the same frame left open in the middle of each side, in amber, with the word of what waits (« À signer »)
 *   and its deadline; whole at 16 px, where the word alone tells it;
 * - sealed: at 64 and 128 px, the cartouche's language (green frame and cells on the proof wash, a halo); at 16 and
 *   32 px, a green plate with the cells punched through, the only form legible that small. With the dated sentence of
 *   §D.2, « Signé électroniquement sur Proofseen par les deux parties le … ». Green is earned: only for an act every
 *   party signed and whose timestamp is recorded, read from the database. The files allowed to build a sealed state
 *   are in the one list of green, apps/web/test/support/green-files.ts, read by seal.test.ts.
 */

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The geometry lives in @proofseen/brand (L1-111), without zod: its own check, wrapped here as a schema. */
const fingerprintSchema = z.string().refine((value) => {
  try {
    parseFingerprint(value);
    return true;
  } catch {
    return false;
  }
}, FINGERPRINT_ERROR);

const realDay = z.union([z.date(), z.string()]).transform((value, ctx) => {
  const at = value instanceof Date ? value : DAY.test(value) ? new Date(`${value}T00:00:00Z`) : new Date(value);
  if (Number.isNaN(at.getTime())) {
    ctx.addIssue({ code: "custom", message: "a fingerprint mark needs a real date" });
    return z.NEVER;
  }
  return at.toISOString().slice(0, 10);
});

const stateSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("filed") }),
  z.object({
    kind: z.literal("pending"),
    /** What waits, in words: « À signer », « 1 signature sur 2 ». */
    word: z.string().trim().min(1),
    /** The deadline, a real day, written out in the trace face. */
    due: realDay.optional(),
  }),
  z.object({
    kind: z.literal("sealed"),
    /** The whole sentence: « Signé électroniquement sur Proofseen par les deux parties le 24 octobre 2026 ». */
    sentence: z.string().trim().min(1),
    /** The day the last signature and its timestamp were recorded. */
    date: realDay,
  }),
]);

export type FingerprintState = z.input<typeof stateSchema>;
type State = z.output<typeof stateSchema>;

const WORDS = {
  fr: { noun: "Empreinte", subject: "du document", filed: "Déposé", due: "échéance le" },
  en: { noun: "Fingerprint", subject: "of the document", filed: "Filed", due: "due on" },
} as const satisfies Record<Lang, Record<string, string>>;

const propsSchema = z.object({
  fingerprint: fingerprintSchema,
  /** Rendered size in pixels; 16, 32, 64 and 128 are drawn for that size, any other scales the nearest level. */
  size: z.number().positive().default(32),
  state: stateSchema.default({ kind: "filed" }),
  /** What the fingerprint belongs to, after the noun: « du contrat, version 3 ». */
  subject: z.string().trim().min(1).optional(),
});

export type FingerprintMarkProps = z.input<typeof propsSchema> & { readonly lang: Lang };

function phrase(state: State, lang: Lang): string {
  if (state.kind === "filed") return WORDS[lang].filed;
  if (state.kind === "sealed") return state.sentence;
  return state.due === undefined ? state.word : `${state.word}, ${WORDS[lang].due} ${longDate(state.due, lang)}`;
}

/** The name a screen reader hears: « Empreinte du document, 7F3A 91C2 0B4E D2A8. Déposé ». */
export function fingerprintLabel(props: FingerprintMarkProps): string {
  const { fingerprint, state, subject } = propsSchema.parse(props);
  const words = WORDS[props.lang];
  return `${words.noun} ${subject ?? words.subject}, ${fingerprintPrefix(fingerprint)}. ${phrase(state, props.lang)}`;
}

interface DrawingProps {
  readonly fingerprint: string;
  readonly size: number;
  readonly kind: State["kind"];
  readonly label: string | null;
}

function Drawing({ fingerprint, size, kind, label }: DrawingProps) {
  const g = fingerprintMark(fingerprint, size);
  const a11y = label === null ? { "aria-hidden": true as const } : { role: "img", "aria-label": label };
  // The open frame is the frame's own path, interrupted in the middle of each side; whole at 16 px.
  const open = kind === "pending" && g.detailed ? { pathLength: PENDING_FRAME.pathLength, strokeDasharray: PENDING_FRAME.dasharray, strokeDashoffset: PENDING_FRAME.dashoffset } : {};
  return (
    <svg className="ui-fpm" data-state={kind} data-level={g.size} viewBox={g.viewBox} width={size} height={size} focusable="false" {...a11y}>
      <path className="ui-fpm-frame" d={g.frame} strokeWidth={g.stroke} {...open} />
      {g.cells === "" ? null : <path className="ui-fpm-cells" d={g.cells} />}
    </svg>
  );
}

/**
 * The mark alone, an image whose name gives the fingerprint and the state. Throws on a fingerprint that is not one, and
 * on a pending mark under 48 px: there its open frame is a pixel or two from closed, so the word must stand beside it
 * (Shogun, L1-120: a rule of the component) and only FingerprintStamp writes it.
 */
export function FingerprintMark(props: FingerprintMarkProps) {
  const { fingerprint, size, state } = propsSchema.parse(props);
  if (state.kind === "pending" && fingerprintMark(fingerprint, size).size <= 32) {
    throw new Error("a pending mark under 48 px goes with its word: use FingerprintStamp");
  }
  return <Drawing fingerprint={fingerprint} size={size} kind={state.kind} label={fingerprintLabel(props)} />;
}

/**
 * The mark with what attests beside it: the first sixteen characters in the trace face, and the state in words. The
 * drawing is hidden from screen readers here, since the text says everything it says.
 */
export function FingerprintStamp(props: FingerprintMarkProps) {
  const { fingerprint, size, state, subject } = propsSchema.parse(props);
  const words = WORDS[props.lang];
  return (
    <span className="ui-fp" data-state={state.kind}>
      <span className="ui-fp-mark">
        <Drawing fingerprint={fingerprint} size={size} kind={state.kind} label={null} />
      </span>
      <span className="ui-fp-text">
        <span className="sr-only">{`${words.noun} ${subject ?? words.subject}`}</span>
        <code className="ui-fp-code">{fingerprintPrefix(fingerprint)}</code>
        {state.kind === "sealed" ? (
          <time className="ui-fp-word" dateTime={state.date}>
            {state.sentence}
          </time>
        ) : (
          <span className="ui-fp-word">
            {state.kind === "filed" ? words.filed : state.word}
            {state.kind === "pending" && state.due !== undefined ? (
              <>
                {`, ${words.due} `}
                <time dateTime={state.due}>{longDate(state.due, props.lang)}</time>
              </>
            ) : null}
          </span>
        )}
      </span>
    </span>
  );
}
