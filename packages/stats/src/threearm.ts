import { wilson, type Interval } from "./wilson";

/*
 * Verdict of the three-arm test, exactly as pre-registered in PIVOT_ANONYME §5. The rules are applied mechanically:
 * nobody reinterprets them after seeing the numbers. The thresholds come from the caller (profiles/experiment.ts)
 * so that there is ONE copy of them.
 *
 * Definitions fixed here, before any measurement:
 * - a person arm (A, B) is "cited" on a draw when it is recognised with CERTAINTY (a verified URL of the arm next to
 *   the person) — the same conservative rule as the LLM Discoverability Rate; a name alone does not count;
 * - the entry page (C) is "cited" when one of its URLs is given as a source; its rate is computed on TARGET job
 *   descriptions only, as §5 says ("sur ses JD cibles");
 * - an arm "fails" when its 95 % interval starts at 0: no evidence that it is cited at all.
 *
 * **Contrôle de délivrance** (ajouté le 29/09). Un bras dont les pages ne sont pas dans l'index ne peut pas être cité :
 * son zéro ne dit rien de l'hypothèse, il dit que l'expérience n'a pas eu lieu. Sans ce contrôle, trois bras jamais
 * crawlés auraient produit `allFailed` — c'est-à-dire « la voie se faire citer est close », la thèse du produit
 * déclarée morte — sur une manipulation qui n'avait jamais été délivrée. Le cas n'est pas théorique : le 29/09, Bing
 * Webmaster Tools donnait `proofseen.com/n/ayoub-hammoudi/` « Discovered but not crawled » cinq jours après l'avoir
 * découverte, et Perplexity s'appuie sur l'index de Bing.
 *
 * Même principe que le 24/09 pour le bras C non publié, appliqué un cran plus bas : un bras publié mais **absent de
 * l'index** ne peut pas « échouer » non plus. Le relevé est un fait extérieur ; on ne le devine pas, on le reçoit, et
 * quand il manque le verdict dit « inconnu » plutôt que de conclure.
 */

export type Arm = "A" | "B" | "C";

export interface ArmDraw {
  readonly drawId: string;
  readonly arm: Arm;
  readonly cited: boolean;
  readonly jdRole: "target" | "control";
}

/** Relevé d'indexation d'un bras au moment de la mesure. Fait extérieur : il vient d'un outil, pas d'un calcul. */
/**
 * Les index dont on relève la couverture. `google` y figure parce qu'on le constate, **pas** parce qu'il compte :
 * aucun des trois moteurs mesurés ne s'en sert. C'est précisément le piège que ce champ existe pour fermer — voir
 * `relevantIndexation`.
 */
export type IndexName = "bing" | "brave" | "google" | "other";

export interface ArmIndexation {
  readonly arm: Arm;
  /**
   * De quel index parle ce relevé. Sans ce champ, « 1 page indexée » ne veut rien dire : être dans Google ne rend la
   * page récupérable par aucun des moteurs mesurés, et le verdict aurait conclu « traitement délivré » à tort.
   */
  readonly index: IndexName;
  /** Pages de ce bras effectivement présentes dans cet index. Une seule suffit à rendre le bras mesurable. */
  readonly indexed: number;
  readonly declared: number;
  /** Date du relevé, `YYYY-MM-DD`. */
  readonly checkedAt: string;
}

/**
 * Ne garde que les relevés qui portent sur un index dont **un moteur mesuré** tire son web.
 *
 * Filtrer ici plutôt que de pondérer plus loin a une conséquence voulue : un bras dont on n'a relevé que des index
 * hors protocole ressort **non relevé**, donc ne peut rien clore. C'est le bon défaut — on ne sait pas si les moteurs
 * mesurés pouvaient voir la page, donc on ne conclut pas.
 *
 * La correspondance moteur → index est un état public qui bouge (OpenAI et Perplexity ont développé leurs propres
 * robots en parallèle de Bing). Elle est donc passée par l'appelant, pas gravée ici.
 */
export const relevantIndexation = (
  indexation: readonly ArmIndexation[] | undefined,
  relevant: readonly IndexName[],
): readonly ArmIndexation[] | undefined => {
  if (indexation === undefined) return undefined;
  const kept = indexation.filter((row) => relevant.includes(row.index));
  return kept.length === 0 ? undefined : kept;
};

/**
 * Empreinte préexistante du sujet sous son **nom réel**, relevée avant la mesure.
 *
 * Le bras A porte le nom réel, le bras B un pseudonyme créé pour le test. Quand le sujet est déjà connu sous son nom —
 * fiche Wikidata, site personnel indexé, articles signés — A part avec une avance que B ne peut pas rattraper, et la
 * règle « B cité dans moins d'un tiers des tirages où A l'est » se vérifie **par construction**. On conclurait « le
 * pseudonyme ne marche pas » alors qu'on aurait seulement mesuré que le sujet est déjà connu.
 *
 * Le test reste valable entre sujets comparables. Il cesse de l'être dès que A dispose d'une empreinte que B n'a pas.
 */
export interface NamedBaseline {
  /** Surfaces indexées portant le nom réel, hors pages publiées pour le test. Zéro = les deux bras partent à égalité. */
  readonly preexistingNamedSurfaces: number;
  /** Ce qui a été constaté, pour que la réserve du rapport soit lisible plutôt qu'abstraite. */
  readonly detail: string;
}

export interface ThreeArmThresholds {
  readonly armBoverArmA: number;
  readonly armCcitationRate: number;
}

export interface ThreeArmVerdict {
  /** Pre-registration: the decision is taken at J+60 only; J+30 is a checkpoint. */
  readonly final: boolean;
  readonly draws: number;
  readonly rates: Readonly<Record<Arm, { readonly cited: number; readonly n: number; readonly interval: Interval | null }>>;
  /** Share of the draws citing A that also cite B — the §5 rule. */
  readonly bGivenA: { readonly cited: number; readonly n: number; readonly share: number | null };
  readonly mechanismA: "refuted" | "not_refuted" | "inconclusive";
  /** "not_tested" : le bras C n'a pas été publié (test à 2 bras). Le dire, plutôt que de le compter comme un échec. */
  readonly mechanismB: "retained" | "not_retained" | "not_tested";
  /**
   * Le traitement a-t-il atteint les moteurs ? `unknown` quand l'indexation n'a pas été relevée. Un verdict ne peut
   * rien clore tant que ce n'est pas `yes` : on ne conclut pas d'une expérience dont la manipulation n'a pas eu lieu.
   */
  readonly delivered: "yes" | "partial" | "no" | "unknown";
  /**
   * Vrai quand le bras nominatif disposait d'une empreinte préexistante que le pseudonyme n'avait pas. Le mécanisme A
   * ne peut alors pas être réfuté : la comparaison était biaisée avant la première requête.
   */
  readonly baselineBiased: boolean;
  readonly allFailed: boolean;
  readonly reasons: readonly string[];
}

const citedSet = (draws: readonly ArmDraw[], arm: Arm): Set<string> => new Set(draws.filter((d) => d.arm === arm && d.cited).map((d) => d.drawId));

const rateOf = (draws: readonly ArmDraw[], arm: Arm, onlyTarget = false) => {
  const pool = draws.filter((d) => d.arm === arm && (!onlyTarget || d.jdRole === "target"));
  const cited = pool.filter((d) => d.cited).length;
  return { cited, n: pool.length, interval: wilson(cited, pool.length) };
};

const pct = (value: number): string => `${(value * 100).toFixed(1)} %`;

export const threeArmVerdict = (
  draws: readonly ArmDraw[],
  day: number,
  thresholds: ThreeArmThresholds,
  indexation?: readonly ArmIndexation[],
  baseline?: NamedBaseline,
): ThreeArmVerdict => {
  const rates = { A: rateOf(draws, "A"), B: rateOf(draws, "B"), C: rateOf(draws, "C", true) };
  const citedA = citedSet(draws, "A");
  const citedB = citedSet(draws, "B");
  const both = [...citedA].filter((id) => citedB.has(id)).length;
  const bGivenA = { cited: both, n: citedA.size, share: citedA.size === 0 ? null : both / citedA.size };
  const reasons: string[] = [];

  // Délivrance, bras par bras. `null` = non relevé : on ne suppose ni l'un ni l'autre.
  const reached = (arm: Arm): boolean | null => {
    const rows = indexation?.filter((row) => row.arm === arm) ?? [];
    // Plusieurs index pertinents peuvent porter le même bras : un seul qui le contienne suffit à le rendre mesurable.
    return rows.length === 0 ? null : rows.some((row) => row.indexed > 0);
  };
  // Seuls les bras réellement joués comptent : un bras C non publié n'a pas de délivrance à évaluer.
  const played: readonly Arm[] = (["A", "B", "C"] as const).filter((arm) => rates[arm].n > 0);
  const states = played.map(reached);
  const delivered: ThreeArmVerdict["delivered"] = states.every((state) => state === null)
    ? "unknown"
    : states.every((state) => state === true)
      ? "yes"
      : states.every((state) => state === false)
        ? "no"
        : "partial";

  const baselineBiased = (baseline?.preexistingNamedSurfaces ?? 0) > 0;

  let mechanismA: ThreeArmVerdict["mechanismA"];
  // Avant toute comparaison : un bras que les moteurs ne pouvaient pas voir ne se compare à rien. Son zéro n'est pas
  // un résultat, c'est une absence de mesure — et l'attribuer au pseudonyme ou au nom serait une conclusion inventée.
  if (reached("A") === false || reached("B") === false) {
    mechanismA = "inconclusive";
    const absent = [reached("A") === false ? "A" : null, reached("B") === false ? "B" : null].filter((arm) => arm !== null);
    reasons.push(
      absent.length === 1
        ? `le bras ${absent[0]} n'était pas indexé au moment de la mesure : la comparaison nom / pseudonyme est impossible, ce n'est pas un résultat`
        : `les bras ${absent.join(" et ")} n'étaient pas indexés au moment de la mesure : la comparaison nom / pseudonyme est impossible, ce n'est pas un résultat`,
    );
  } else if (citedA.size === 0) {
    mechanismA = citedB.size === 0 ? "inconclusive" : "not_refuted";
    reasons.push(
      citedB.size === 0
        ? "A et B ne sont jamais cités : la comparaison est impossible, le mécanisme A n'est ni réfuté ni soutenu"
        : "B est cité alors que A ne l'est jamais : le pseudonyme ne fait pas moins bien que le nom",
    );
  } else if (baselineBiased) {
    // Réfuter ici reviendrait à conclure « le pseudonyme ne marche pas » après avoir mesuré que le sujet est déjà
    // connu sous son nom. Le sens de l'écart reste affiché ; c'est la **conclusion** qu'on refuse de tirer.
    mechanismA = "inconclusive";
    reasons.push(
      `le bras nominatif disposait d'une empreinte préexistante que le pseudonyme n'avait pas (${baseline!.detail}) : la comparaison nom / pseudonyme est biaisée par construction, aucun écart ne lui est attribuable`,
    );
  } else if (citedB.size === 0 && (rates.A.interval?.low ?? 0) > 0) {
    mechanismA = "refuted";
    reasons.push(`B n'est jamais cité alors que A l'est (${rates.A.cited}/${rates.A.n}, borne basse ${pct(rates.A.interval!.low)} > 0)`);
  } else if (bGivenA.share! < thresholds.armBoverArmA) {
    mechanismA = "refuted";
    reasons.push(`B n'est cité que dans ${both}/${citedA.size} des tirages où A l'est (${pct(bGivenA.share!)} < ${pct(thresholds.armBoverArmA)})`);
  } else {
    mechanismA = "not_refuted";
    reasons.push(`B est cité dans ${both}/${citedA.size} des tirages où A l'est (${pct(bGivenA.share!)} ≥ ${pct(thresholds.armBoverArmA)})`);
  }

  const c = rates.C.interval;
  const mechanismB = c === null ? "not_tested" : c.p >= thresholds.armCcitationRate && c.low > 0 ? "retained" : "not_retained";
  reasons.push(
    c === null
      ? "bras C absent : le mécanisme B n'a pas été testé — ni retenu, ni réfuté"
      : `page d'entrée citée dans ${rates.C.cited}/${rates.C.n} tirages sur JD cibles (${pct(c.p)}, borne basse ${pct(c.low)}) — seuil ${pct(thresholds.armCcitationRate)} avec borne basse > 0`,
  );

  const fails = (rate: { interval: Interval | null }): boolean => (rate.interval?.low ?? 0) === 0;
  // Un bras non publié ne peut pas « échouer » : la voie n'est close que si les bras réellement testés échouent tous.
  // Et un bras publié mais absent de l'index non plus : clore la voie demande d'avoir vérifié que les moteurs
  // pouvaient voir les pages. Sans ce relevé, on ne sait pas si l'expérience a eu lieu.
  const numbersFail = fails(rates.A) && fails(rates.B) && rates.C.n > 0 && fails(rates.C);
  const allFailed = numbersFail && delivered === "yes";
  if (allFailed) reasons.push("A, B et C échouent tous les trois : la voie « on se fait citer » est close pour P0, seul le canal connecteur reste");
  else if (numbersFail && delivered === "unknown")
    reasons.push(
      "les bras testés sont tous à zéro, mais l'indexation n'a pas été relevée : on ne sait pas si les moteurs pouvaient voir les pages, donc rien n'est clos",
    );
  else if (numbersFail)
    reasons.push(
      "les bras testés sont tous à zéro, et leurs pages n'étaient pas indexées : le traitement n'a pas été délivré, ce résultat ne dit rien de l'hypothèse",
    );

  const final = day >= 60;
  if (!final) reasons.unshift(`point d'étape à J+${day} : aucune décision avant J+60 (pré-enregistrement)`);

  return { final, draws: new Set(draws.map((d) => d.drawId)).size, rates, bGivenA, mechanismA, mechanismB, delivered, baselineBiased, allFailed, reasons };
};
