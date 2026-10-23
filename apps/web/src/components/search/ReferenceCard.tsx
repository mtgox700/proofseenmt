interface ReferenceCardProps {
  /** The public reference, the only fact still shown once a profile has left the public pages. */
  readonly reference: string;
  /** The heading, written by the caller from the reference ("Profil FR-XXXXX"). */
  readonly title: string;
  readonly headingId: string;
  /** Why only the reference is left; nothing when the caller has nothing true to say. */
  readonly note?: string;
  /** What stays inside the company: the note, the thumbs, the actions. */
  readonly children?: React.ReactNode;
}

/**
 * A freelancer the company kept (a list line, a past applicant) whose profile is no longer published: the frame of the
 * one profile card, its reference and nothing else. No fact, no green, no link: the public page no longer exists.
 */
export function ReferenceCard({ reference, title, headingId, note, children }: ReferenceCardProps) {
  return (
    <article className="fiche-card ref-card" aria-labelledby={headingId}>
      <p className="fc-trace">{reference}</p>
      <h3 className="fc-name" id={headingId}>
        {title}
      </h3>
      {note === undefined ? null : <p className="ref-note">{note}</p>}
      {children === undefined ? null : <div className="fc-actions">{children}</div>}
    </article>
  );
}
