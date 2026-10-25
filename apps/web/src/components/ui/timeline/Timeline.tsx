import "@/styles/ui.css";
import Link from "next/link";
import { z } from "zod";
import type { Lang } from "@/i18n/types";
import { instantSchema, machineDate, writtenDate, type Instant, type Precision } from "../when";

/*
 * Timeline (LEGENDS_P2_CONCEPT §B.7 AuditTimeline, §C.0): the dated events of one item, in the order they happened.
 * - Every event has a real date, in its <time>; an event whose date the database does not hold is not placed at a
 *   guessed one: it goes to « À venir » with the words of when it will happen (« à la validation »).
 * - The actor is a role (« Opérateur », « Entreprise »), never an e-mail address by default.
 * - No line is ever hidden or rewritten: the primitive has no such option.
 * - No green. An event says what happened in ink. A state that matters carries its own word with its tone, never a
 *   generic one (L1-091 K9: an expired envelope reads « Expirée » in the danger colour, it does not « wait »): amber
 *   for what waits on someone, the danger colour for a refusal, a dispute or a passed deadline (§A.5).
 */

export type EventTone = "signal" | "danger";

export interface EventStatus {
  /** The state in one word, written before the event: « Expirée », « Refusée », « À relancer ». */
  readonly word: string;
  readonly tone: EventTone;
}

export interface TimelineEvent {
  readonly id: string;
  readonly at: Instant;
  /** What happened, in a sentence: « Attestation vérifiée ». */
  readonly title: string;
  /** Who did it, as a role. */
  readonly actor?: string;
  /** The reason written with the decision, or a detail. */
  readonly detail?: string;
  /** Where the event's target lives. */
  readonly href?: string;
  readonly status?: EventStatus;
}

export interface UpcomingStep {
  readonly id: string;
  readonly title: string;
  /** When it will happen, in words, never a date the database does not hold: « à la validation du client ». */
  readonly when: string;
}

const statusSchema = z.object({ word: z.string().trim().min(1), tone: z.enum(["signal", "danger"]) });

const WORDS = {
  fr: { upcoming: "À venir" },
  en: { upcoming: "To come" },
} as const satisfies Record<Lang, Record<string, string>>;

export interface TimelineProps {
  readonly lang: Lang;
  /** Names the list: « Historique de l'attestation ». */
  readonly label: string;
  readonly events: readonly TimelineEvent[];
  readonly upcoming?: readonly UpcomingStep[];
  /** Oldest first (a story) or newest first (a journal). */
  readonly order?: "oldest-first" | "newest-first";
  readonly precision?: Precision;
}

/** Throws on an event without a real date, or a status without its word: what cannot say when or what is not drawn. */
export function Timeline({ lang, label, events, upcoming = [], order = "oldest-first", precision = "minute" }: TimelineProps) {
  const dated = events
    .map((event, index) => ({ event, index, at: instantSchema.parse(event.at), status: event.status === undefined ? null : statusSchema.parse(event.status) }))
    .sort((a, b) => (order === "oldest-first" ? 1 : -1) * (a.at.getTime() - b.at.getTime()) || a.index - b.index);
  const words = WORDS[lang];
  return (
    <div className="ui-timeline">
      <ol className="ui-tl" aria-label={label}>
        {dated.map(({ event, at, status }) => (
          <li key={event.id} className="ui-tl-item" data-tone={status?.tone}>
            <time className="ui-tl-time" dateTime={machineDate(at, precision)}>
              {writtenDate(at, lang, precision)}
            </time>
            <p className="ui-tl-title">
              {status === null ? null : <span className="ui-tl-status">{`${status.word} `}</span>}
              {event.href === undefined ? event.title : <Link href={event.href}>{event.title}</Link>}
            </p>
            {event.actor === undefined && event.detail === undefined ? null : (
              <p className="ui-tl-meta">{[event.actor, event.detail].filter((part) => part !== undefined && part.trim() !== "").join(" · ")}</p>
            )}
          </li>
        ))}
      </ol>
      {upcoming.length === 0 ? null : (
        <p className="ui-tl-upcoming-label" aria-hidden="true">
          {words.upcoming}
        </p>
      )}
      {upcoming.length === 0 ? null : (
        <ol className="ui-tl ui-tl-upcoming" aria-label={`${label}, ${words.upcoming.toLowerCase()}`}>
          {upcoming.map((step) => (
            <li key={step.id} className="ui-tl-item" data-tone="upcoming">
              <span className="ui-tl-time">{step.when}</span>
              <p className="ui-tl-title">{step.title}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
