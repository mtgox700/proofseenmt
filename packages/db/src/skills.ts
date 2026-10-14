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

const INVISIBLE = new RegExp(String.raw`\p{Cf}`, "gu");
const CONTROL = new RegExp(String.raw`\p{Cc}`, "gu");

/**
 * Un libellé sur une seule ligne, sans caractère invisible : il est écrit tel quel dans des pages, des balises et
 * /llms.txt, où un saut de ligne ajouterait une ligne entière et un caractère de format masquerait ce qui est affiché.
 */
export const cleanSkillLabel = (raw: string): string => raw.replace(INVISIBLE, "").replace(CONTROL, " ").replace(/\s+/g, " ").trim();

/** Les libellés reçus, nettoyés et dédoublonnés par clé ; le premier libellé d'une clé est gardé tel qu'écrit. */
export const uniqueSkills = (labels: readonly string[]): readonly { readonly key: string; readonly label: string }[] => {
  const byKey = new Map<string, string>();
  for (const raw of labels) {
    const label = cleanSkillLabel(raw);
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
