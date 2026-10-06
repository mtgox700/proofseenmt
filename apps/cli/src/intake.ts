import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ContactSchema, SubmissionSchema, openDossier, submissionBlockers } from "@proofseen/intake";
import { issueAccess, secretFingerprint } from "@proofseen/access";
import { CliError, loadJson, writeText } from "./files";
import { commandClientInit } from "./client-init";
import type { CommonOptions } from "./commands";

/*
 * Ouvre un dossier à partir d'une inscription, sans que l'opérateur ait rien à retaper.
 *
 * Jusqu'ici, `client-init` exigeait qu'on tape la référence, le nom et les URL à la main. Personne ne pouvait donc
 * s'inscrire seul — ce qui suffit à bloquer une phase de test, où des gens arrivent d'eux-mêmes.
 *
 * Deux refus avant toute écriture, parce que les découvrir plus tard coûte cher :
 *  - une inscription qui n'apporte que des plateformes non vérifiables, où la possession ne se prouve pas : ouvrir
 *    le dossier reviendrait à promettre une mesure qu'on ne pourra jamais commencer ;
 *  - une référence déjà prise : le dossier d'un client existant porte ses preuves et ses offres.
 */

export interface IntakeCommand extends Pick<CommonOptions, "log" | "now"> {
  readonly submissionPath: string;
  readonly outDir: string;
  /** Imposer la référence plutôt que la tirer au hasard. Sert aux reprises, pas au cas courant. */
  readonly reference?: string | undefined;
  /** Secret d'accès. Absent, le dossier s'ouvre quand même : le lien se génère ensuite avec `access`. */
  readonly accessSecret?: string | undefined;
}

export const commandIntake = async (o: IntakeCommand): Promise<string> => {
  const submission = await loadJson(o.submissionPath, SubmissionSchema, "inscription");

  const blockers = submissionBlockers(submission);
  if (blockers.length > 0) {
    // Les messages s'adressent à la personne : c'est à elle qu'ils seront renvoyés par le formulaire.
    throw new CliError(`inscription refusée :\n  - ${blockers.join("\n  - ")}`);
  }

  const dossier = openDossier(submission, { now: o.now(), ...(o.reference === undefined ? {} : { reference: o.reference }) });
  const dir = join(o.outDir, dossier.reference);
  if (existsSync(dir)) throw new CliError(`${dir} existe déjà : relancer avec --reference pour en choisir une autre`);

  // La disposition du dossier a **une** définition, celle de `client-init`. La recopier ici en ferait une seconde,
  // et c'est exactement ce qui a produit les trois derniers défauts de ce dépôt.
  await commandClientInit({
    reference: dossier.reference,
    displayName: submission.displayName,
    urls: submission.urls.join(","),
    outDir: o.outDir,
    log: () => undefined,
  });

  // Le contact vit à côté de l'identité, jamais dedans : `identity.json` alimente le profil public.
  await writeText(join(dir, "contact.json"), `${JSON.stringify(dossier.contact, null, 2)}\n`);

  o.log(`Dossier ouvert : ${dir}`);
  o.log(`Référence : ${dossier.reference}`);
  o.log(`${dossier.identity.ownedUrls.length} adresse(s) à faire prouver — aucune n'est comptée comme prouvée d'office.`);
  o.log("Prochaine action : remplir identity.json (ville, technologies), puis `possession --verify`.");

  if (o.accessSecret !== undefined) {
    const token = issueAccess({ reference: dossier.reference, secret: o.accessSecret, now: o.now() });
    o.log("");
    // L'adresse porte la langue de l'inscription : `/fr/espace/…` et `/en/espace/…` sont deux routes distinctes, et
    // renvoyer quelqu'un dans la mauvaise langue sur la page qu'il attendait est un accueil raté.
    o.log(`Lien d'espace : /${submission.lang}/espace/${dossier.reference}?t=${token}`);
    o.log("Il prouve qu'on l'a reçu, pas qu'on possède les adresses : la preuve de possession reste exigée.");
    // La CLI émet, le web vérifie. Deux secrets différents et TOUS les liens deviennent « non valide » en silence :
    // rien ne plante, les gens cliquent et ne voient rien. Comparer les deux empreintes évite cette soirée-là.
    o.log(`Empreinte du secret : ${secretFingerprint(o.accessSecret)} — doit être identique côté site.`);
  } else {
    o.log("");
    o.log("Aucun lien d'espace : définir PROOFSEEN_ACCESS_SECRET pour en émettre un.");
  }
  return dir;
};

export interface AccessCommand extends Pick<CommonOptions, "log" | "now"> {
  readonly reference: string;
  readonly secret: string | undefined;
  readonly ttlDays: number | undefined;
  /** Dossier des clients, pour retrouver la langue du destinataire dans son `contact.json`. */
  readonly clientsDir: string;
}

/**
 * Langue du destinataire, lue dans son dossier.
 *
 * Sans elle, le lien partirait toujours en français. `/fr/espace/…` et `/en/espace/…` sont deux routes distinctes, et
 * la langue a été demandée à l'inscription — ne pas s'en servir reviendrait à l'avoir demandée pour rien.
 */
const langOf = async (clientsDir: string, reference: string): Promise<"fr" | "en"> => {
  try {
    const contact = ContactSchema.parse(JSON.parse(await readFile(join(clientsDir, reference, "contact.json"), "utf8")));
    return contact.lang;
  } catch {
    // Un contact illisible ne doit pas empêcher de réémettre un lien : on retombe sur le français en le disant.
    return "fr";
  }
};

/** Émet un lien d'espace pour un dossier déjà ouvert — par exemple quand le premier a expiré. */
export const commandAccess = async (o: AccessCommand): Promise<string> => {
  if (o.secret === undefined || o.secret === "") throw new CliError("PROOFSEEN_ACCESS_SECRET absent : aucun lien ne peut être signé");
  const ttlMs = o.ttlDays === undefined ? undefined : o.ttlDays * 24 * 60 * 60 * 1000;
  let token: string;
  try {
    token = issueAccess({ reference: o.reference, secret: o.secret, now: o.now(), ...(ttlMs === undefined ? {} : { ttlMs }) });
  } catch (error) {
    throw new CliError((error as Error).message);
  }
  const lang = await langOf(o.clientsDir, o.reference);
  o.log(`/${lang}/espace/${o.reference}?t=${token}`);
  // Même empreinte que dans `intake` : c'est elle qui dira pourquoi un lien pourtant valide est refusé par le site.
  o.log(`Empreinte du secret : ${secretFingerprint(o.secret)} — doit être identique côté site.`);
  return token;
};
