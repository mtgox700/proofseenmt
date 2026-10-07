import { EmptyState } from "@/components/EmptyState";

/** Shown in place of a marketplace page when the server has no database: says so, never shows an empty fake. */
export function MarketUnavailable({ text }: { readonly text: string }) {
  return (
    <EmptyState title="Proofseen" headingLevel={2}>
      <p>{text}</p>
    </EmptyState>
  );
}
