/*
 * After a server action on a section of the profile, the person lands back on the profile page at that section, with
 * one short notice. Only known codes and known sections are read back from the address: nothing the address carries is
 * ever shown as text.
 */

export const SECTION_ANCHORS = ["photo", "disponibilite", "experiences", "formation", "certifications", "langues", "realisations", "cv"] as const;
export type SectionAnchor = (typeof SECTION_ANCHORS)[number];

export const SUCCESS_CODES = ["saved", "removed", "confirmed", "uploaded", "imported"] as const;

export const NOTICE_CODES = [
  ...SUCCESS_CODES,
  "invalid",
  "contact",
  "limit",
  "throttled",
  "absent",
  "missing",
  "empty",
  "too_large",
  "type",
  "dimensions",
  "active_content",
  "unreadable",
  "quota",
  "storage_full",
  "unconfigured",
  "too_long",
  "no_text",
  "not_understood",
  "failed",
  "stale",
  "no_cv",
  "encrypted",
  "busy",
  "too_many_pages",
] as const;
export type NoticeCode = (typeof NOTICE_CODES)[number];

export interface SectionNotice {
  readonly anchor: SectionAnchor;
  readonly code: NoticeCode;
  readonly ok: boolean;
}

/** What may name the item being edited in the address: an item id, or a language code. Anything else is dropped. */
const EDITABLE = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[a-z]{2})$/;

/** The item being edited, read back from `?modifier=`; `null` when absent or not an id. */
export const editingOf = (raw: string | undefined): string | null => (raw !== undefined && EDITABLE.test(raw) ? raw : null);

/** The section after an action; `editing` keeps an edit form open after a refused change. */
export const noticeHref = (lang: string, anchor: SectionAnchor, code: NoticeCode, editing?: string | null): string => {
  const kept = editingOf(editing ?? undefined);
  return `/${lang}/app/profil?section=${anchor}&avis=${code}${kept === null ? "" : `&modifier=${kept}`}#${anchor}`;
};

/** The address that opens the edit form of one item, at its section. */
export const editHref = (lang: string, anchor: SectionAnchor, id: string): string => `/${lang}/app/profil?modifier=${encodeURIComponent(id)}#${anchor}`;

export const readNotice = (section: string | undefined, code: string | undefined): SectionNotice | null => {
  const anchor = SECTION_ANCHORS.find((a) => a === section);
  const known = NOTICE_CODES.find((c) => c === code);
  if (anchor === undefined || known === undefined) return null;
  return { anchor, code: known, ok: (SUCCESS_CODES as readonly string[]).includes(known) };
};
