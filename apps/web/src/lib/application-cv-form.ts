import { NOTICE_CODES, type NoticeCode } from "./profile-notice";

/*
 * The apply form reports a refused CV as `?erreur=cv-<code>`, where `<code>` is one of the profile's upload notices:
 * the same sentence explains the same refusal wherever the CV was uploaded. Only known codes are read back.
 */

const PREFIX = "cv-";

/** The address code for a refused CV. */
export const cvErrorCode = (code: NoticeCode): string => `${PREFIX}${code}`;

/** The CV refusal behind an apply error code; `null` for any other code, or an unknown one. */
export const cvRefusalOf = (code: string | undefined): NoticeCode | null => {
  if (code === undefined || !code.startsWith(PREFIX)) return null;
  const rest = code.slice(PREFIX.length);
  return NOTICE_CODES.find((known) => known === rest) ?? null;
};
