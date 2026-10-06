/*
 * Who is who in the connected app. Three roles, decided on the server only:
 *  - operator: an email on the OPERATOR_EMAILS allowlist. Never stored, never self-assigned.
 *  - freelance / company: chosen once by the person, written to Clerk `publicMetadata` (writable by the backend only).
 * Stored metadata can never grant `operator`: if it ever said so, it would be ignored.
 */

export type Role = "operator" | "freelance" | "company";
export type ChosenRole = Exclude<Role, "operator">;

export const CHOSEN_ROLES: readonly ChosenRole[] = ["freelance", "company"];

export const operatorEmails = (raw: string | undefined): ReadonlySet<string> =>
  new Set(
    (raw ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email !== ""),
  );

export const isChosenRole = (value: unknown): value is ChosenRole => typeof value === "string" && (CHOSEN_ROLES as readonly string[]).includes(value);

export const resolveRole = (
  user: { readonly emails: readonly string[]; readonly stored: unknown },
  operators: ReadonlySet<string>,
): Role | null => {
  if (user.emails.some((email) => operators.has(email.toLowerCase()))) return "operator";
  return isChosenRole(user.stored) ? user.stored : null;
};
