/** Vrai si l'erreur vient d'une contrainte d'unicité (code Prisma P2002), quelle que soit la classe qui la porte. */
export const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
