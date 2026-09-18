export interface BudgetState {
  readonly capUsd: number;
  readonly spentUsd: number;
}

export class BudgetExceededError extends Error {
  constructor(readonly state: BudgetState, readonly nextEstimateUsd: number) {
    super(`budget cap reached: spent ${state.spentUsd.toFixed(4)} $ of ${state.capUsd} $, next draw could cost up to ${nextEstimateUsd} $`);
    this.name = "BudgetExceededError";
  }
}

export const createBudget = (capUsd: number): BudgetState => {
  if (!(capUsd > 0)) throw new RangeError("budget cap must be positive");
  return { capUsd, spentUsd: 0 };
};

export const charge = (state: BudgetState, costUsd: number): BudgetState => {
  if (!(costUsd >= 0)) throw new RangeError("cost must be a non-negative number");
  return { ...state, spentUsd: state.spentUsd + costUsd };
};

/** Hard stop: refuses a draw whose worst-case cost could push the wave over its cap. */
export const assertCanSpend = (state: BudgetState, nextEstimateUsd: number): void => {
  if (state.spentUsd + nextEstimateUsd > state.capUsd) throw new BudgetExceededError(state, nextEstimateUsd);
};
