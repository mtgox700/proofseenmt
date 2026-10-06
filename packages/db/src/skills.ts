import type { Prisma } from "./generated/client";

/*
 * Une compétence a une forme normalisée (sa clé) et un libellé affiché. « TypeScript », « typescript » et « Typescript »
 * sont la même compétence ; « Node.js » et « nodejs » aussi. Sans clé unique, une recherche par compétence raterait la
 * moitié des profils et des missions.
 */

export const MAX_SKILLS = 30;

export const skillKey = (label: string): string =>
  label
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\.js\b/g, "js")
    .replace(/[^a-z0-9+#]+/g, " ")
    .trim()
    .replace(/\s+/g, "-");

/** Les libellés reçus, dédoublonnés par clé ; le premier libellé d'une clé est gardé tel qu'écrit. */
export const uniqueSkills = (labels: readonly string[]): readonly { readonly key: string; readonly label: string }[] => {
  const byKey = new Map<string, string>();
  for (const raw of labels) {
    const label = raw.trim();
    const key = skillKey(label);
    if (key !== "" && !byKey.has(key)) byKey.set(key, label);
  }
  return [...byKey].slice(0, MAX_SKILLS).map(([key, label]) => ({ key, label }));
};

/** Les identifiants des compétences, créées si elles n'existent pas encore. */
export const ensureSkills = async (tx: Prisma.TransactionClient, labels: readonly string[]): Promise<readonly string[]> => {
  const skills = uniqueSkills(labels);
  const ids: string[] = [];
  for (const { key, label } of skills) {
    const { id } = await tx.skill.upsert({ where: { key }, create: { key, label }, update: {}, select: { id: true } });
    ids.push(id);
  }
  return ids;
};
