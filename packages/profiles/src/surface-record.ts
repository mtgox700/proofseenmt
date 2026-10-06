import { z } from "zod";

/*
 * Trace du contrôle de surface, et ce qui interdit de mesurer sans lui.
 *
 * Le détecteur (`manipulation.ts`) ne sert à rien s'il reste facultatif : un opérateur pressé mesurerait un profil
 * manipulé sans le savoir, et nous aurions promis un contrôle que nous ne faisons pas. Le contrôle laisse donc une
 * trace datée, et le préflight refuse de partir sans elle — exactement comme il refuse de partir sans preuve de
 * possession.
 *
 * Le même raisonnement existe déjà pour l'auto-recherche avant publication (`audit.ts`) : une obligation qui n'est pas
 * imposée par le code n'est pas une obligation, c'est une intention.
 */

/** Une page change après avoir été contrôlée. Au-delà, le contrôle ne dit plus rien de ce qu'on va mesurer. */
export const SURFACE_CHECK_MAX_AGE_DAYS = 30;
const DAY_MS = 86_400_000;

export const SurfaceCheckRecordSchema = z.object({
  identityId: z.string().min(1).max(64),
  checkedAt: z.iso.datetime({ offset: true }),
  pages: z
    .array(
      z.object({
        url: z.string().min(1),
        /**
         * `clean` : rien de bloquant. `manipulated` : refus. `unreadable` : la page n'a pas pu être lue — ce n'est pas
         * la même chose que propre. `manual` : plateforme où aucune requête n'est émise, relecture humaine.
         */
        outcome: z.enum(["clean", "manipulated", "unreadable", "manual"]),
        kinds: z.array(z.string().max(40)).max(20),
      }),
    )
    .min(1),
});
export type SurfaceCheckRecord = z.infer<typeof SurfaceCheckRecordSchema>;

export interface SurfaceCheckInput {
  readonly record: SurfaceCheckRecord | null;
  readonly identityId: string;
  /** URL vérifiées qui seront mesurées : toutes doivent apparaître au contrôle. */
  readonly urls: readonly string[];
  readonly now: Date;
}

/**
 * Ce qui interdit de mesurer aujourd'hui. `null` = le contrôle est présent, récent, propre, et couvre ce qui sera
 * mesuré. Une page `manual` compte comme couverte : elle relève de la relecture humaine, pas de la machine.
 */
export const surfaceCheckBlocker = ({ record, identityId, urls, now }: SurfaceCheckInput): string | null => {
  if (record === null) {
    return "aucun contrôle de surface enregistré : la mesure est interdite tant qu'il n'a pas eu lieu (offre : refus des profils manipulés)";
  }
  if (record.identityId !== identityId) {
    return `le contrôle de surface porte sur une autre identité (${record.identityId} au lieu de ${identityId})`;
  }

  const checkedAt = Date.parse(record.checkedAt);
  if (checkedAt > now.getTime()) return `contrôle de surface daté du futur (${record.checkedAt}) : il ne prouve rien`;
  const ageInDays = (now.getTime() - checkedAt) / DAY_MS;
  if (ageInDays > SURFACE_CHECK_MAX_AGE_DAYS) {
    return `contrôle de surface du ${record.checkedAt}, plus vieux que ${SURFACE_CHECK_MAX_AGE_DAYS} jours : les pages ont pu changer depuis`;
  }

  const byUrl = new Map(record.pages.map((page) => [page.url, page]));
  const missing = urls.filter((url) => !byUrl.has(url));
  if (missing.length > 0) return `URL non contrôlée(s) : ${missing.join(", ")}`;

  const manipulated = record.pages.filter((page) => page.outcome === "manipulated");
  if (manipulated.length > 0) {
    return `manipulation trouvée sur ${manipulated.map((page) => `${page.url} (${page.kinds.join(", ")})`).join(" · ")} — ne pas mesurer, rembourser`;
  }
  const unreadable = record.pages.filter((page) => page.outcome === "unreadable");
  if (unreadable.length > 0) {
    return `page(s) illisible(s) au contrôle : ${unreadable.map((page) => page.url).join(", ")} — à relire à la main avant de mesurer`;
  }
  return null;
};
