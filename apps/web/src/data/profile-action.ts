import { redirect } from "next/navigation";
import { profiles, type SectionUpdateResult, type SectionWriteResult } from "@proofseen/db";
import type { Lang } from "@/i18n";
import { actionMarket, langOf, type Market } from "@/lib/market";
import { noticeHref, type NoticeCode, type SectionAnchor } from "@/lib/profile-notice";
import { notifyProfileChanged } from "./indexnow";
import { throttled } from "./throttle";

/*
 * What every server action of the rich profile shares: the person comes from the session and must be a freelancer,
 * each action is throttled per person, and the answer is a redirect back to the section with one notice. A change to a
 * published profile is announced to search engines (IndexNow).
 */

export interface ThrottleRule {
  readonly windowMs: number;
  readonly max: number;
}

/** Edits of the profile sections: generous for a person filling their profile, tight for a script. */
export const SECTION_RULE: ThrottleRule = { windowMs: 60 * 60_000, max: 120 };
/** Uploads: each one is decoded and re-encoded on the server. */
export const UPLOAD_RULE: ThrottleRule = { windowMs: 60 * 60_000, max: 30 };

export const freelanceAction = async (formData: FormData, anchor: SectionAnchor, scope: string, rule: ThrottleRule): Promise<{ readonly lang: Lang; readonly market: Market }> => {
  const lang = langOf(formData.get("lang"));
  const market = await actionMarket(lang);
  if (market.person.role !== "freelance") redirect(`/${lang}/app`);
  if (await throttled(scope, market.actor.userId, rule, new Date())) redirect(noticeHref(lang, anchor, "throttled"));
  return { lang, market };
};

/** A function declaration, not an arrow: callers rely on `never` to narrow what follows. `editing` reopens a form. */
export function backTo(lang: Lang, anchor: SectionAnchor, code: NoticeCode, editing?: string | null): never {
  redirect(noticeHref(lang, anchor, code, editing));
}

/** The notice for a section write. */
export const writeNotice = (result: SectionWriteResult): NoticeCode => (result.kind === "added" ? "saved" : result.kind);

/** The notice for an edit in place. */
export const updateNotice = (result: SectionUpdateResult): NoticeCode => (result.kind === "updated" ? "saved" : result.kind);

/** The id of the item an edit form targets; the repository still checks it belongs to the person. */
export const itemIdOf = (formData: FormData): string => {
  const id = formData.get("id");
  return typeof id === "string" ? id : "";
};

/** Announces the profile page to search engines when it is published. */
export const announceProfile = async (market: Market): Promise<void> => {
  const mine = await profiles(market.db).findMine(market.actor);
  if (mine !== null && mine.visibility !== "private" && mine.slug !== null) notifyProfileChanged(mine.slug);
};
