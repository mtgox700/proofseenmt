/*
 * Calculs purs des variables `derived` (TEMPLATE_FORMAT.md §3.2, arrondis R3 et R6 de tresor/L0_FLUX_ARGENT.md) : le
 * moteur recalcule ceux qu'il sait calculer et refuse une valeur fournie qui ne les égale pas (un montant de TVA faux
 * dans un contrat est une faute grave). Les autres (`vigilanceRequired`, `organisationSnapshot`...) lisent la base :
 * l'appelant les fournit.
 */

type Derivation = (args: readonly unknown[]) => unknown;

const isCount = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

/** Pourcentage en points de base, demi vers le haut sur la valeur absolue (R3), en BigInt : exact quelle que soit la taille. */
export const applyBp = (cents: number, bp: number): number => Number((BigInt(cents) * BigInt(bp) + 5000n) / 10000n);

const bpOf = (args: readonly unknown[], fn: (cents: number, bp: number) => unknown): unknown => {
  const [cents, bp] = args;
  return isCount(cents) && isCount(bp) ? fn(cents, bp) : undefined;
};

const DERIVATIONS: Readonly<Record<string, Derivation>> = {
  applyBp: (args) => bpOf(args, applyBp),
  /** TVA une seule fois sur le total hors taxes (R6), au taux du vendeur. */
  vatOfTotal: (args) => bpOf(args, applyBp),
  totalWithVat: (args) => {
    const [total, vat] = args;
    return isCount(total) && isCount(vat) ? total + vat : undefined;
  },
  vatRegimeOf: (args) => (isCount(args[0]) ? (args[0] === 0 ? "exempt" : "standard") : undefined),
  /** Forfait ou régie, daté ou sans date de fin : la date de fin facultative décide du second. */
  durationShapeOf: (args) => {
    const [billing, endsOn] = args;
    if (billing !== "fixed" && billing !== "monthly") return undefined;
    return `${billing}_${typeof endsOn === "string" && endsOn !== "" ? "dated" : "open"}`;
  },
};

/** Vrai quand le moteur sait calculer cette fonction elle-même. */
export const isPureDerivation = (fn: string): boolean => Object.hasOwn(DERIVATIONS, fn);

/** Calcule la fonction sur les valeurs de ses dépendances (dans l'ordre de `from`) ; `undefined` si une dépendance manque. */
export const derive = (fn: string, args: readonly unknown[]): unknown => (isPureDerivation(fn) ? DERIVATIONS[fn]?.(args) : undefined);
