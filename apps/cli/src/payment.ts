import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { EMPTY_JOURNAL, PaymentJournalSchema, markDelivered, markRefunded, recordPayment, type PaymentJournal } from "@proofseen/presale";
import { CliError, writeText } from "./files";
import type { CommonOptions } from "./commands";

/*
 * Écrit dans le journal des paiements, pour que personne n'ait à éditer ce JSON à la main.
 *
 * C'est le fichier qui décide de la gate du 27/11 et de ce qui reste dû au 31/12. Une référence en double y ferait
 * croire la cible atteinte avec un client de moins ; une date de livraison écrasée masquerait un remboursement
 * automatique dû. Les refus vivent dans `@proofseen/presale`, pour que le web applique les mêmes.
 */

export interface PaymentCommand extends Pick<CommonOptions, "log" | "now"> {
  readonly journalPath: string;
  readonly reference: string;
  readonly action: "record" | "delivered" | "refunded";
  readonly offer?: string | undefined;
  readonly amountCents?: number | undefined;
  readonly earlyStart?: boolean;
}

const readJournal = async (path: string): Promise<PaymentJournal> => {
  // Un journal absent est un journal vide, pas une erreur : le premier paiement doit pouvoir s'enregistrer.
  if (!existsSync(path)) return EMPTY_JOURNAL;
  try {
    return PaymentJournalSchema.parse(JSON.parse(await readFile(path, "utf8")));
  } catch (error) {
    // Surtout ne pas repartir d'un journal vide ici : on écraserait tous les paiements déjà encaissés.
    throw new CliError(`${path} illisible : ${(error as Error).message}. Le réparer à la main — ne pas le remplacer.`);
  }
};

export const commandPayment = async (o: PaymentCommand): Promise<PaymentJournal> => {
  const journal = await readJournal(o.journalPath);
  const now = o.now();

  let updated: PaymentJournal;
  try {
    if (o.action === "record") {
      if (o.offer === undefined) throw new Error("--offer manquant (audit ou cle_en_main)");
      if (o.amountCents === undefined || !Number.isInteger(o.amountCents)) throw new Error("--amount-cents manquant ou non entier");
      updated = recordPayment(journal, {
        reference: o.reference,
        paidAt: now.toISOString(),
        offer: o.offer,
        amountCents: o.amountCents,
        status: "paid",
        // La renonciation est un acte du client, pas un défaut : sans demande expresse écrite, le paiement reste
        // rétractable 14 jours et n'est donc pas encore acquis.
        earlyStartRequestedAt: o.earlyStart === true ? now.toISOString() : null,
      });
    } else if (o.action === "delivered") {
      updated = markDelivered(journal, o.reference, now);
    } else {
      updated = markRefunded(journal, o.reference);
    }
  } catch (error) {
    throw new CliError((error as Error).message);
  }

  await writeText(o.journalPath, `${JSON.stringify(updated, null, 2)}\n`);
  o.log(`Journal écrit : ${o.journalPath} (${updated.payments.length} paiement(s))`);
  o.log("Lancer `gate --journal <file>` pour le décompte : acquis, provisoires, remboursements dus.");
  return updated;
};
