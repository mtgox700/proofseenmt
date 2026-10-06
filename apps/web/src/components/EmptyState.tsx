interface EmptyStateProps {
  readonly title: string;
  readonly children: React.ReactNode;
  readonly headingLevel?: 2 | 3;
}

/** An honest empty state: says what is missing and why, never a placeholder figure. */
export function EmptyState({ title, children, headingLevel = 2 }: EmptyStateProps) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section className="empty">
      <span className="empty-mark" aria-hidden="true" />
      <Heading className="empty-title">{title}</Heading>
      <div className="empty-body">{children}</div>
    </section>
  );
}
