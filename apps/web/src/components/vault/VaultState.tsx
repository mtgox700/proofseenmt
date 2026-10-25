import { EmptyState, type EmptyAction } from "@/components/EmptyState";
import type { Lang } from "@/i18n/types";
import { writtenDate } from "@/components/ui/when";
import type { AffairState, FirstAcceptance } from "@/lib/vault/affair-state";
import { vaultText } from "@/lib/vault/dictionary";

/*
 * The states of the tab « Documents » that have no list (storyboard L1.6, §4 E1): S0 closed, S1 monthly, S1b cancelled,
 * S2a and S2b no scope, S3 empty and preparable, S4 empty and too late, S6 a read error. Each says what is true and why,
 * in the storyboard's words, and offers an action only where one exists. Never a placeholder figure, never green.
 */

type EmptyKind = Exclude<AffairState["kind"], "list">;

export interface VaultStateProps {
  readonly lang: Lang;
  readonly state: Extract<AffairState, { kind: EmptyKind }>;
  /** The side of the person reading: S2b says a different next step to each. */
  readonly side: "freelance" | "company";
  readonly affairHref: string;
  readonly prepareHref: string;
  readonly retryHref: string;
  /** While only one party has accepted, who has not yet (L1-159 M5); said under S4. */
  readonly waiting?: string | null;
}

/** « vous », « l'entreprise » or « le freelance », and the day, of the first acceptance. */
export function acceptedBy(acceptance: FirstAcceptance, lang: Lang): { readonly who: string; readonly date: string } {
  const who = vaultText(lang).who;
  return { who: acceptance.by === "you" ? who.you : acceptance.by === "company" ? who.company : who.freelance, date: writtenDate(acceptance.at, lang, "day") };
}

export function VaultState({ lang, state, side, affairHref, prepareHref, retryHref, waiting = null }: VaultStateProps) {
  const s = vaultText(lang).states;
  const one = (title: string, body: string | null, actions: readonly EmptyAction[] = []) => (
    <EmptyState title={title} actions={actions}>
      {body === null ? undefined : <p className="measure">{body}</p>}
    </EmptyState>
  );
  switch (state.kind) {
    case "closed":
      return one(s.closed.title, s.closed.body, [{ href: affairHref, label: s.closed.back }]);
    case "error":
      return (
        <div role="alert">
          <EmptyState title={s.error.title} actions={[{ href: retryHref, label: s.error.retry }]} />
        </div>
      );
    case "monthly":
      return one(s.monthly, null);
    case "cancelled":
      return one(s.cancelled, null);
    case "no-scope-accepted":
      return one(s.noScopeAccepted.title, s.noScopeAccepted.body);
    case "no-scope-pending":
      return one(s.noScopePending.title, side === "freelance" ? s.noScopePending.freelance : s.noScopePending.company);
    case "empty-preparable":
      return one(s.empty.title, s.empty.preparable, [{ href: prepareHref, label: s.empty.prepare }]);
    case "empty-late": {
      if (state.acceptance === null) return one(s.empty.title, s.empty.lateUndated);
      const { who, date } = acceptedBy(state.acceptance, lang);
      return one(s.empty.title, waiting === null ? s.empty.late(who, date) : `${s.empty.late(who, date)} ${waiting}`);
    }
  }
}
