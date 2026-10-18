/*
 * The name the dashboard greets a person by (C23): the first name when the account has one, otherwise the display name,
 * otherwise nothing and the greeting stays neutral ("Bonjour."). An e-mail address is never a name: a sign-in account
 * without a name used to be greeted by its address, on a screen that can be shared or shown during a call.
 */

/** Longer than this is not a greeting, it is a pasted text. */
const MAX_GREETING_CHARS = 60;

export interface GreetingSource {
  readonly firstName: string | null;
  readonly displayName: string | null;
}

const usable = (value: string | null): string | null => {
  const trimmed = value?.trim() ?? "";
  if (trimmed === "" || trimmed.includes("@")) return null;
  return trimmed.length > MAX_GREETING_CHARS ? null : trimmed;
};

export const greetingName = (source: GreetingSource): string | null => usable(source.firstName) ?? usable(source.displayName);
