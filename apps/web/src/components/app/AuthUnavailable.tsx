import { EmptyState } from "@/components/EmptyState";
import type { Dictionary } from "@/i18n";

/** Shown in place of any connected page when Clerk is not configured: says so, never fakes a signed-in state. */
export function AuthUnavailable({ t }: { readonly t: Dictionary }) {
  return (
    <EmptyState title={t.app.unconfiguredTitle} headingLevel={2}>
      <p>{t.app.unconfiguredText}</p>
    </EmptyState>
  );
}
