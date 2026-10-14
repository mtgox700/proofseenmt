import type { ConfirmationDecision, ConfirmationInput } from "@proofseen/db";

/*
 * Mission confirmation forms, as posted, turned into repository input. This file only translates: the repository
 * schema decides what is valid (lengths, months, SIRET, e-mail, no contact details in the summary).
 */

const field = (form: FormData, name: string): string => {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
};

/** The freelancer's declaration. Empty SIRET or e-mail become null; the schema requires at least one of them. */
export const confirmationFromForm = (form: FormData): ConfirmationInput => ({
  role: field(form, "role"),
  clientName: field(form, "clientName"),
  clientKind: field(form, "clientKind") as ConfirmationInput["clientKind"],
  clientSiret: field(form, "clientSiret") === "" ? null : field(form, "clientSiret"),
  contactEmail: field(form, "contactEmail") === "" ? null : field(form, "contactEmail"),
  startedOn: field(form, "startedOn"),
  endedOn: field(form, "endedOn"),
  summary: field(form, "summary"),
});

/**
 * The client's answer: which button was pressed, and whether the box allowing the company name was ticked. The box
 * counts only with a confirmation, and only when explicitly ticked: the default publishes no name. `null` when the
 * form says neither.
 */
export const decisionFromForm = (form: FormData): ConfirmationDecision | null => {
  const decision = field(form, "decision");
  if (decision === "refuse") return { confirm: false, showClientName: false };
  if (decision !== "confirm") return null;
  return { confirm: true, showClientName: field(form, "showClientName") === "on" };
};
