import Link from "next/link";

export interface EmptyAction {
  readonly href: string;
  readonly label: string;
}

interface EmptyStateProps {
  readonly title: string;
  readonly children?: React.ReactNode;
  readonly headingLevel?: 2 | 3;
  /** Where to go from here: the first is the main call (paper on ink), the others are quiet. */
  readonly actions?: readonly EmptyAction[];
}

/*
 * The mark of an empty place: the outline of the brand cartouche, dashed, with nothing struck inside. The same slot
 * as the drawing of the 404. Never green: green is earned by a verified fact, and an empty list has none.
 */
function EmptyMark({ size }: { readonly size: number }) {
  return (
    <svg className="empty-mark" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <path d="M5 1.75H19A3.25 3.25 0 0 0 22.25 5V19A3.25 3.25 0 0 0 19 22.25H5A3.25 3.25 0 0 0 1.75 19V5A3.25 3.25 0 0 0 5 1.75Z" />
    </svg>
  );
}

/** An honest empty state: says what is missing and why, then where to go, never a placeholder figure. */
export function EmptyState({ title, children, headingLevel = 2, actions = [] }: EmptyStateProps) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section className="empty">
      <EmptyMark size={28} />
      <Heading className="empty-title">{title}</Heading>
      {children === undefined ? null : <div className="empty-body">{children}</div>}
      {actions.length === 0 ? null : (
        <p className="empty-actions">
          {actions.map((action, index) => (
            <Link key={action.href} className={index === 0 ? "btn btn-primary" : "btn"} href={action.href}>
              {action.label}
            </Link>
          ))}
        </p>
      )}
    </section>
  );
}

/** The same state, one line, for a list inside a section that already has its heading. */
export function EmptyNote({ children }: { readonly children: React.ReactNode }) {
  return (
    <p className="empty-note">
      <EmptyMark size={18} />
      <span>{children}</span>
    </p>
  );
}
