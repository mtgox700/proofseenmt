"use client";

import { useId, useState } from "react";

interface OrderCtaProps {
  readonly href: string | null;
  readonly cta: string;
  readonly accept: string;
  readonly acceptFirst: string;
  readonly unavailable: string;
  readonly secure: string;
}

/*
 * The order button sits under an explicit acceptance box (US-P01): the terms are on the page, above, and the link to
 * the payment page only becomes active once they are accepted. Without a configured link, the button says so plainly.
 */
export function OrderCta({ href, cta, accept, acceptFirst, unavailable, secure }: OrderCtaProps) {
  const [accepted, setAccepted] = useState(false);
  const id = useId();

  if (href === null) {
    return (
      <div className="order-cta">
        <button type="button" className="btn btn-primary" disabled aria-describedby={`${id}-na`}>
          {cta}
        </button>
        <p id={`${id}-na`} className="small muted">
          {unavailable}
        </p>
      </div>
    );
  }

  return (
    <div className="order-cta">
      <label className="order-accept" htmlFor={`${id}-accept`}>
        <input id={`${id}-accept`} type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
        <span>{accept}</span>
      </label>
      {accepted ? (
        <a className="btn btn-primary" href={href} rel="noopener noreferrer">
          {cta}
        </a>
      ) : (
        <button type="button" className="btn btn-primary" disabled aria-describedby={`${id}-hint`}>
          {cta}
        </button>
      )}
      <p id={`${id}-hint`} className="small muted" aria-live="polite">
        {accepted ? secure : acceptFirst}
      </p>
    </div>
  );
}
