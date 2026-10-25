import type { Db } from "./client";
import type { Prisma } from "./generated/client";

/*
 * Le coffre et le RGPD (accès art. 15 et 20, effacement art. 17).
 *
 * Export : pour chaque document dont la personne est partie (contrat, devis envoyé, fil, entreprise, profil), ses
 * métadonnées et celles de ses versions (sorte, gabarit, langue, numéro, empreinte, taille, date, raison, « écrite par
 * vous »), et le journal de ses propres accès (action, numéro de version, date). Jamais le contenu, qui se télécharge
 * depuis l'application, ni les valeurs du rendu (elles portent l'identité de l'autre partie).
 *
 * Effacement :
 *  - les documents d'un contrat sont conservés avec lui, détachés du compte (la référence à l'auteur et au lecteur
 *    disparaît, les octets et l'empreinte restent) : durée légale, 5 ans après la fin du contrat (C. civ. 2224,
 *    C. com. L110-4), 10 ans s'ils justifient une écriture comptable (C. com. L123-22, confirmé par l'expert-comptable) ;
 *    la base refuse d'ailleurs de les supprimer ;
 *  - les documents qui ne tiennent à aucun contrat (devis jamais devenu contrat, accord de confidentialité du fil, de
 *    l'entreprise ou du profil) partent avec le profil du freelance effacé, comme son fil : leurs versions et leur
 *    journal avec eux, et leurs fichiers au balayage des fichiers orphelins qui suit.
 */

type Reader = Db | Prisma.TransactionClient;

export const exportDocuments = async (db: Reader, userId: string) => {
  const mine: Prisma.DocumentWhereInput = {
    OR: [
      { contract: { OR: [{ profile: { userId } }, { organisation: { members: { some: { userId } } } }] } },
      // L'entreprise ne voit pas un brouillon de devis : ni le devis, ni ses documents.
      { quote: { OR: [{ conversation: { profile: { userId } } }, { status: { not: "draft" }, conversation: { organisation: { members: { some: { userId } } } } }] } },
      { conversation: { OR: [{ profile: { userId } }, { organisation: { members: { some: { userId } } } }] } },
      { organisation: { members: { some: { userId } } } },
      { profile: { userId } },
    ],
  };
  const [documents, myAccesses] = await Promise.all([
    db.document.findMany({
      where: mine,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        type: true,
        slot: true,
        templateId: true,
        lang: true,
        createdAt: true,
        contractId: true,
        versions: { orderBy: { number: "asc" }, select: { number: true, sha256: true, size: true, createdAt: true, reason: true, authorId: true } },
      },
    }),
    db.documentAccess.findMany({ where: { userId }, orderBy: { at: "asc" }, select: { documentId: true, action: true, versionNumber: true, at: true } }),
  ]);
  return {
    documents: documents.map(({ versions, contractId, ...document }) => ({
      ...document,
      forAContract: contractId !== null,
      versions: versions.map(({ authorId, ...version }) => ({ ...version, writtenByYou: authorId === userId })),
    })),
    myAccesses,
  };
};

/** Supprime les documents sans contrat du profil effacé (fil, devis, accord, profil) : le coffre d'un contrat reste. */
export const eraseUnretainedDocuments = async (tx: Prisma.TransactionClient, profileId: string | null): Promise<void> => {
  if (profileId === null) return;
  await tx.document.deleteMany({
    where: { contractId: null, OR: [{ profileId }, { conversation: { profileId } }, { quote: { conversation: { profileId } } }] },
  });
};
