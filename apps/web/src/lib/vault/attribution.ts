/*
 * Who changed what (storyboard L1.6, §4 E5, T8). Every version is a complete snapshot written by one person, so a change
 * of a choice belongs to the first version, after the older one compared, where the new value appears; a change made,
 * undone and made again names every version where the value moved: « Changé dans la version 2, puis dans la version 3. »
 * The key of a choice is its variable name (`input.ipRegime`), or `clause:<id>` for an optional article.
 */

export interface ChainLink {
  readonly number: number;
  /** Who wrote this version, already in words: « vous », « le freelance ». */
  readonly by: string;
  readonly values: Readonly<Record<string, unknown>>;
  readonly optionalClauses: Readonly<Record<string, string>>;
}

export type Attribution = { readonly kind: "one"; readonly number: number; readonly by: string } | { readonly kind: "many"; readonly numbers: readonly number[] };

/** The value of a choice in a version, as comparable text; an optional article absent from the snapshot is not added. */
export function valueAt(link: ChainLink, key: string): string {
  if (key.startsWith("clause:")) return link.optionalClauses[key.slice(7)] === "included" ? "included" : "excluded";
  const value = link.values[key];
  return value === undefined || value === null ? "" : JSON.stringify(value);
}

/**
 * The versions where a choice moved, in the chain from the older version compared to the newer one (ascending, both
 * included). Null when the chain does not show it move: then nothing is attributed, rather than a guess.
 */
export function attribute(key: string, chain: readonly ChainLink[]): Attribution | null {
  const moved: ChainLink[] = [];
  for (let k = 1; k < chain.length; k += 1) {
    const previous = chain[k - 1] as ChainLink;
    const link = chain[k] as ChainLink;
    if (valueAt(link, key) !== valueAt(previous, key)) moved.push(link);
  }
  const [first] = moved;
  if (first === undefined) return null;
  return moved.length === 1 ? { kind: "one", number: first.number, by: first.by } : { kind: "many", numbers: moved.map((link) => link.number) };
}
