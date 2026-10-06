/*
 * Détection des manipulations destinées aux IA sur une page publique du client.
 *
 * Pourquoi ce fichier existe : l'offre promet que nous **refusons de mesurer** un profil contenant une manipulation —
 * texte caché, instructions adressées aux modèles — et que le client est alors remboursé intégralement. Une promesse
 * contractuelle sans code derrière n'est pas une promesse.
 *
 * Et c'est aussi une protection pour nous : l'extracteur est un modèle de langage, et une page qui contient
 * « ignore les instructions précédentes » pourrait orienter son travail.
 *
 * Limites assumées, écrites plutôt que tues :
 *  - nous ne lisons que le HTML servi. Un texte caché par une **classe CSS** définie dans une feuille externe n'est
 *    pas résolu ici ; seuls les styles en ligne le sont.
 *  - un texte inséré par JavaScript n'est pas vu — ce qui est cohérent, les robots d'IA ne l'exécutent pas non plus.
 *  - ce détecteur repère des procédés connus. Ne rien trouver ne prouve pas qu'il n'y a rien.
 */

export type ManipulationKind = "hidden_text" | "ai_instruction" | "invisible_characters" | "stuffing";

export interface Finding {
  readonly kind: ManipulationKind;
  /** Ce qui a été reconnu, en clair. */
  readonly detail: string;
  /** Extrait court, pour que le client retrouve le passage dans sa page. */
  readonly excerpt: string;
}

/** Au-delà de cette répétition d'un même mot, le texte n'est plus écrit pour un lecteur. */
export const STUFFING_MIN_REPEATS = 25;
/** …et il faut aussi qu'il pèse cette part du texte, pour ne pas punir un texte long et répétitif par nature. */
const STUFFING_MIN_SHARE = 0.05;
const MAX_EXCERPT = 120;
const MIN_HIDDEN_CHARS = 3;
const MIN_WORD_CHARS = 4;

const excerptOf = (text: string): string => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= MAX_EXCERPT ? flat : `${flat.slice(0, MAX_EXCERPT)}…`;
};

const stripTags = (html: string): string =>
  html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

/** Styles en ligne qui soustraient un contenu au lecteur tout en le laissant lisible par une machine. */
const HIDING_STYLES: readonly { readonly pattern: RegExp; readonly detail: string }[] = [
  { pattern: /display\s*:\s*none/i, detail: "style display:none" },
  { pattern: /visibility\s*:\s*hidden/i, detail: "style visibility:hidden" },
  { pattern: /font-size\s*:\s*0(?![.\d])/i, detail: "taille de police nulle" },
  { pattern: /opacity\s*:\s*0(?![.\d])/i, detail: "opacité nulle" },
  { pattern: /text-indent\s*:\s*-\d{3,}/i, detail: "texte repoussé hors de l'écran" },
  { pattern: /(?:left|top)\s*:\s*-\d{3,}/i, detail: "élément positionné hors de l'écran" },
];

/** Même couleur de texte et de fond : invisible à l'œil, lisible par un robot. */
const sameColourAsBackground = (style: string): boolean => {
  const colour = /(?:^|[;\s])color\s*:\s*([^;]+)/i.exec(style)?.[1]?.trim().toLowerCase();
  const background = /background(?:-color)?\s*:\s*([^;]+)/i.exec(style)?.[1]?.trim().toLowerCase();
  if (colour === undefined || background === undefined) return false;
  const normalise = (value: string) => value.replace(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i, "#$1$1$2$2$3$3");
  return normalise(colour) === normalise(background);
};

const hiddenText = (html: string): Finding[] => {
  const findings: Finding[] = [];
  // Un élément ouvrant porteur d'un style, puis son contenu jusqu'à la fermeture de la même balise.
  for (const match of html.matchAll(/<([a-z][a-z0-9]*)\b[^>]*\bstyle\s*=\s*(["'])(.*?)\2[^>]*>([\s\S]*?)<\/\1\s*>/gi)) {
    const style = match[3] ?? "";
    const text = stripTags(match[4] ?? "").trim();
    if (text.length < MIN_HIDDEN_CHARS) continue;
    const rule = HIDING_STYLES.find((candidate) => candidate.pattern.test(style));
    const detail = rule?.detail ?? (sameColourAsBackground(style) ? "texte de la même couleur que le fond" : null);
    if (detail !== null) findings.push({ kind: "hidden_text", detail, excerpt: excerptOf(text) });
  }
  return findings;
};

/**
 * Formulations qui s'adressent au modèle plutôt qu'au lecteur. Chaque motif exige une **adresse** (« ignore », « tu
 * dois », « you must ») : parler d'IA dans un profil de développeur est parfaitement normal et ne doit rien déclencher.
 */
const AI_INSTRUCTIONS: readonly RegExp[] = [
  /ignore[a-z]*\s+(?:toutes?\s+)?(?:les\s+)?instructions?\s+(?:pr[ée]c[ée]dentes?|ant[ée]rieures?)/i,
  /ignore\s+(?:all\s+)?(?:the\s+)?(?:previous|prior|above)\s+instructions?/i,
  /(?:en tant que|as an?)\s+(?:mod[èe]le de langage|assistant|ai\b|ai language model)[^.]{0,80}(?:tu dois|vous devez|you must|recommend|recommande|classe)/i,
  /(?:tu dois|vous devez|you must|please)\s+(?:me\s+)?(?:recommander|recommend|classer|rank|placer|place)[^.]{0,60}(?:premier|first|en t[êe]te|top)/i,
  /system\s*prompt/i,
  /disregard\s+(?:all\s+)?(?:previous|prior)\s+/i,
];

const aiInstructions = (text: string): Finding[] =>
  AI_INSTRUCTIONS.flatMap((pattern) => {
    const match = pattern.exec(text);
    return match === null ? [] : [{ kind: "ai_instruction" as const, detail: "texte adressé à un modèle de langage", excerpt: excerptOf(match[0]) }];
  });

/** Espaces de largeur nulle et marques de sens d'écriture : invisibles, mais bien présentes pour une machine. */
const INVISIBLE = /[\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]/;

const invisibleCharacters = (text: string): Finding[] => {
  const match = INVISIBLE.exec(text);
  if (match === null) return [];
  const at = match.index;
  return [
    {
      kind: "invisible_characters",
      detail: `caractère invisible U+${match[0].codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`,
      excerpt: excerptOf(text.slice(Math.max(0, at - 30), at + 30).replace(INVISIBLE, "\u2423")),
    },
  ];
};

const stuffing = (text: string): Finding[] => {
  const words = text.toLowerCase().match(/[\p{L}\p{N}-]{2,}/gu) ?? [];
  if (words.length === 0) return [];
  const counts = new Map<string, number>();
  for (const word of words) {
    if (word.length < MIN_WORD_CHARS) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  const worst = [...counts.entries()].sort(([, a], [, z]) => z - a)[0];
  if (worst === undefined) return [];
  const [word, count] = worst;
  return count >= STUFFING_MIN_REPEATS && count / words.length >= STUFFING_MIN_SHARE
    ? [{ kind: "stuffing", detail: `« ${word} » répété ${count} fois`, excerpt: excerptOf(word) }]
    : [];
};

/** Tout ce qui a été reconnu sur une page, dans l'ordre de gravité décroissante des familles. */
export const findManipulations = (html: string): readonly Finding[] => {
  const text = stripTags(html);
  return [...hiddenText(html), ...aiInstructions(text), ...invisibleCharacters(text), ...stuffing(text)];
};

/**
 * Ce qui fait refuser la mesure. Le bourrage de mots-clés en est exclu : c'est maladroit, pas malhonnête, et le
 * rapport a mieux à faire que d'accuser un client de tricher parce qu'il a répété son métier.
 */
const REFUSING: ReadonlySet<ManipulationKind> = new Set(["hidden_text", "ai_instruction", "invisible_characters"]);
export const refusesMeasurement = (findings: readonly Finding[]): boolean => findings.some((finding) => REFUSING.has(finding.kind));
