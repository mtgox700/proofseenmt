import { billingView, profileSections, vigilance, type ProfileFacts } from "@proofseen/db";
import type { Lang } from "@/i18n";
import type { Market } from "@/lib/market";
import { profileChecklist, type Checklist } from "@/lib/profile-checklist";

/**
 * Reads what the checklist needs beyond the profile (billing identity and registry check, URSSAF certificate) through
 * the existing repositories, which scope every query to the signed-in person, then computes the list.
 */
export const checklistFor = async (market: Market, lang: Lang, profile: ProfileFacts | null, now: Date): Promise<Checklist> => {
  const [billing, certificate, sections] =
    profile === null
      ? [null, null, null]
      : await Promise.all([billingView(market.db).freelance(market.actor), vigilance(market.db).status(profile.id, now), profileSections(market.db).mine(market.actor)]);
  return profileChecklist({
    lang,
    profile,
    billing: billing === null ? null : { siret: billing.siret, registry: billing.registry },
    vigilance: certificate,
    sections: sections === null ? null : { hasPhoto: sections.photoFileId !== null, languages: sections.languages.length, experiences: sections.experiences.length },
    now,
  });
};
