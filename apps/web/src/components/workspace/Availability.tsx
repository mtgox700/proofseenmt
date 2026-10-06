import type { PublicProfile } from "@proofseen/profiles";
import type { Dictionary, Lang } from "@/i18n";
import { date } from "@/lib/format";

interface AvailabilityProps {
  readonly lang: Lang;
  readonly t: Dictionary;
  readonly availability: PublicProfile["availability"];
}

/** Availability is always written in words, and always dated: colour only repeats it. */
export function Availability({ lang, t, availability }: AvailabilityProps) {
  const labels = t.directory.availability;
  if (availability.status === "available") return <span className="tag tag-proof">{labels.available}</span>;
  if (availability.status === "available_from" && availability.from !== null) {
    return <span className="tag tag-signal">{labels.available_from(date(availability.from, lang))}</span>;
  }
  return <span className="tag tag-quiet">{labels.unavailable}</span>;
}
