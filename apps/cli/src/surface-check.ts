import { IdentitySchema, verifiedUrls } from "@proofseen/core";
import { SurfaceCheckRecordSchema, findManipulations, isManual, isManualOnlyHost, refusesMeasurement, type Finding } from "@proofseen/profiles";
import { CliError, loadJson, writeText } from "./files";
import { safeFetchText } from "./safe-fetch";
import type { CommonOptions } from "./commands";

/*
 * Contrôle des surfaces publiques du client avant de mesurer (OFFRE_PREVENTE).
 *
 * L'offre promet : « Nous vérifions vos surfaces de profil avant la mesure et nous refusons tout profil qui contient
 * une manipulation (texte caché, instructions adressées aux IA…). Dans ce cas, vous êtes remboursé intégralement. »
 * Cette commande est ce qui rend cette phrase vraie.
 *
 * Deux règles héritées du reste du projet :
 *  - **aucune requête vers LinkedIn ou Malt**, même pour contrôler : la ligne rouge ne souffre pas d'exception
 *    commode, et ces pages-là se relisent à la main ;
 *  - l'adresse vient du client, donc elle passe par le récupérateur durci (https, adresses internes refusées).
 */

export interface SurfaceCheckCommand extends Pick<CommonOptions, "log"> {
  readonly identityPath: string;
  readonly timeoutMs: number;
  /** Où écrire la trace datée que le préflight exigera. */
  readonly recordPath: string;
  readonly now: () => Date;
  readonly fetchText?: (url: string, timeoutMs: number) => Promise<string>;
}

interface Checked {
  readonly url: string;
  readonly findings: readonly Finding[];
  readonly error: string | null;
}

export const commandSurfaceCheck = async (o: SurfaceCheckCommand): Promise<boolean> => {
  const identity = await loadJson(o.identityPath, IdentitySchema, "identité");
  const verified = verifiedUrls(identity);
  if (verified.length === 0) {
    throw new CliError("aucune URL vérifiée : il n'y a rien à contrôler, et rien ne serait mesuré (US-F00)");
  }

  const manual = verified.filter((owned) => isManual(owned.proofMethod) || isManualOnlyHost(owned.url));
  const fetchable = verified.filter((owned) => !manual.includes(owned));
  const fetchText = o.fetchText ?? ((url, timeoutMs) => safeFetchText(url, { timeoutMs }));

  const checked: Checked[] = [];
  for (const owned of fetchable) {
    try {
      checked.push({ url: owned.url, findings: findManipulations(await fetchText(owned.url, o.timeoutMs)), error: null });
    } catch (error) {
      checked.push({ url: owned.url, findings: [], error: error instanceof Error ? error.message : "erreur inconnue" });
    }
  }

  for (const page of checked) {
    if (page.error !== null) {
      o.log(`[ ?? ] ${page.url} · page illisible (${page.error}) — à relire à la main`);
      continue;
    }
    if (page.findings.length === 0) {
      o.log(`[ ok ] ${page.url} · rien de repéré`);
      continue;
    }
    o.log(`[${refusesMeasurement(page.findings) ? "STOP" : "warn"}] ${page.url}`);
    for (const finding of page.findings) o.log(`         ${finding.kind} · ${finding.detail} · « ${finding.excerpt} »`);
  }
  for (const owned of manual) o.log(`[ -- ] ${owned.url} · à relire à la main (aucune requête n'est émise vers cette plateforme)`);

  // La trace est écrite dans tous les cas, y compris en cas de refus : c'est elle qui empêchera de mesurer.
  const record = SurfaceCheckRecordSchema.parse({
    identityId: identity.id,
    checkedAt: o.now().toISOString(),
    pages: [
      ...checked.map((page) => ({
        url: page.url,
        outcome: page.error !== null ? "unreadable" : refusesMeasurement(page.findings) ? "manipulated" : "clean",
        kinds: [...new Set(page.findings.map((finding) => finding.kind))],
      })),
      ...manual.map((owned) => ({ url: owned.url, outcome: "manual" as const, kinds: [] })),
    ],
  });
  await writeText(o.recordPath, `${JSON.stringify(record, null, 2)}\n`);
  o.log(`Trace du contrôle : ${o.recordPath}`);

  const refused = checked.filter((page) => refusesMeasurement(page.findings));
  const unreadable = checked.filter((page) => page.error !== null);
  o.log("");
  if (refused.length > 0) {
    o.log(`REFUS : ${refused.length} page(s) contiennent une manipulation. Ne pas mesurer, ne pas encaisser — rembourser intégralement.`);
    return false;
  }
  o.log(
    `Contrôle passé : ${checked.length - unreadable.length} page(s) propres${unreadable.length > 0 ? `, ${unreadable.length} illisible(s)` : ""}${manual.length > 0 ? `, ${manual.length} à relire à la main` : ""}.`,
  );
  // Ne rien trouver ne prouve pas qu'il n'y a rien : le détecteur reconnaît des procédés connus, pas l'intention.
  o.log("Rappel : ce contrôle repère des procédés connus. Il ne remplace pas une relecture.");
  return true;
};
