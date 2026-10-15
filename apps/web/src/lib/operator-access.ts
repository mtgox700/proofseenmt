import { notFound } from "next/navigation";
import type { Person, SessionState } from "./session";

/*
 * Who may open the back office: a signed-in operator, and nobody else. Everyone else (signed out, freelance, company,
 * a server without sign-in configured) gets the very same 404 as an unknown page: the area does not say it exists.
 * Called first by the back-office layout, by every back-office page, every server action and every route handler.
 */
export const operatorOnly = (state: SessionState): Person => {
  const person = operatorOf(state);
  if (person === null) notFound();
  return person;
};

/** The same rule for route handlers, which answer a plain 404 response instead of rendering a page. */
export const operatorOf = (state: SessionState): Person | null => (state.kind === "signed-in" && state.person.role === "operator" ? state.person : null);

/** Per operator and per kind of action: generous for a person working a queue, tight for a stolen session. */
export const OPERATOR_ACTION_RULE = { windowMs: 60_000, max: 40 } as const;
