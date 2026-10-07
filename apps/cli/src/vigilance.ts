import { getDb, vigilance, vigilanceExpiresOn } from "@proofseen/db";
import { CliError } from "./files";

/*
 * vigilance : l'attestation URSSAF d'un freelance, pour l'opérateur. Sans option, la date et le code à contrôler à la
 * main sur le site de l'URSSAF (aucune automatisation) ; avec --verified, l'attestation est marquée vérifiée et devient
 * un fait affiché sur le profil public.
 */

export interface VigilanceCommand {
  readonly log: (line: string) => void;
  readonly reference: string;
  readonly verified: boolean;
}

export const commandVigilance = async (o: VigilanceCommand): Promise<void> => {
  if ((process.env.DATABASE_URL ?? "") === "") throw new CliError("DATABASE_URL absente.");
  if (!/^FR-[A-Z2-9]{5,8}$/.test(o.reference)) throw new CliError("--reference attend une référence FR-XXXXX.");
  const repo = vigilance(getDb());
  const found = await repo.forReference(o.reference);
  if (found === null) throw new CliError(`aucune attestation déclarée pour ${o.reference}.`);
  const day = (d: Date): string => d.toISOString().slice(0, 10);
  o.log(`${o.reference} · délivrée le ${day(found.issuedOn)} · échéance ${day(vigilanceExpiresOn(found.issuedOn))} · code ${found.securityCode}`);
  o.log(found.verifiedAt === null ? "Non vérifiée." : `Vérifiée le ${day(found.verifiedAt)}.`);
  if (!o.verified) {
    o.log("Contrôlez le code sur le site de l'URSSAF, puis relancez avec --verified.");
    return;
  }
  await repo.markVerified(o.reference, new Date());
  o.log("Marquée vérifiée : le fait s'affiche désormais sur le profil public.");
};
