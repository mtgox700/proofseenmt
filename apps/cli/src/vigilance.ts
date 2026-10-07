import { getDb, vigilance, vigilanceExpiresOn } from "@proofseen/db";
import { CliError } from "./files";

/*
 * vigilance : l'attestation URSSAF d'un freelance, pour l'opérateur. Sans option, ce qu'il faut contrôler à la main sur
 * le site de l'URSSAF (aucune automatisation) : date, code, et l'entité à laquelle l'attestation doit appartenir (SIRET
 * et raison sociale déclarés). Avec --verified --code <code contrôlé>, l'attestation est marquée vérifiée — seulement si
 * c'est bien celle dont le code a été contrôlé : une attestation redéclarée entre-temps ne l'est pas à sa place.
 */

export interface VigilanceCommand {
  readonly log: (line: string) => void;
  readonly reference: string;
  readonly verified: boolean;
  readonly code: string | undefined;
}

export const commandVigilance = async (o: VigilanceCommand): Promise<void> => {
  if ((process.env.DATABASE_URL ?? "") === "") throw new CliError("DATABASE_URL absente.");
  if (!/^FR-[A-Z2-9]{5,8}$/.test(o.reference)) throw new CliError("--reference attend une référence FR-XXXXX.");
  const repo = vigilance(getDb());
  const found = await repo.forReference(o.reference);
  if (found === null) throw new CliError(`aucune attestation déclarée pour ${o.reference}.`);
  const day = (d: Date): string => d.toISOString().slice(0, 10);
  o.log(`${o.reference} · délivrée le ${day(found.issuedOn)} · échéance ${day(vigilanceExpiresOn(found.issuedOn))} · code ${found.securityCode}`);
  o.log(`Doit appartenir à : ${found.legalName ?? "(identité de facturation absente)"} · SIRET ${found.siret ?? "(absent)"}`);
  o.log(found.verifiedAt === null ? "Non vérifiée." : `Vérifiée le ${day(found.verifiedAt)}.`);
  if (!o.verified) {
    o.log("Contrôlez le code et l'entité sur le site de l'URSSAF, puis relancez avec --verified --code <code contrôlé>.");
    return;
  }
  if (o.code === undefined) throw new CliError("--verified exige --code : le code que vous avez contrôlé.");
  if (!(await repo.markVerified(o.reference, o.code, new Date()))) throw new CliError("ce code n'est pas celui de l'attestation actuelle : rien n'a été marqué.");
  o.log("Marquée vérifiée : le fait s'affiche désormais sur le profil public.");
};
