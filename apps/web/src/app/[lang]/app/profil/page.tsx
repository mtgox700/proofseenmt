import Link from "next/link";
import { notFound } from "next/navigation";
import { importDrafts, profiles, profileSections, REQUIRED_TO_PUBLISH, storedFiles, type ProfileFacts } from "@proofseen/db";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { StandingNotice } from "@/components/market/StandingNotice";
import { StatusTag } from "@/components/market/StatusTag";
import { CertificationSection, LanguageSection } from "@/components/profile/CredentialSections";
import { CvSection } from "@/components/profile/CvSection";
import { EducationSection } from "@/components/profile/EducationSection";
import { ExperienceSection } from "@/components/profile/ExperienceSection";
import { AvailabilitySection, PhotoSection } from "@/components/profile/PhotoAndAvailability";
import { PortfolioSection } from "@/components/profile/PortfolioSection";
import { ProfileChecklist } from "@/components/visibility/ProfileChecklist";
import { importConfigured } from "@/data/cv-import";
import { checklistFor } from "@/data/profile-checklist";
import { isLang, type Lang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import type { ProfileDictionary } from "@/i18n/market/profile-fr";
import { centsToField } from "@/lib/mission-form";
import { pageMarket, type Market } from "@/lib/market";
import { editingOf, readNotice, type SectionNotice } from "@/lib/profile-notice";
import { saveProfile, setProfileVisibility } from "./actions";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
  readonly searchParams: Promise<{ erreur?: string; manque?: string; enregistre?: string; section?: string; avis?: string; modifier?: string }>;
}

const MODES = ["remote", "hybrid", "onsite"] as const;
const AVAILABILITIES = ["available", "available_from", "unavailable"] as const;

function ProfileForm({ lang, p, modes, profile }: { readonly lang: Lang; readonly p: ProfileDictionary; readonly modes: Record<(typeof MODES)[number], string>; readonly profile: ProfileFacts | null }) {
  return (
    <form action={saveProfile} className="panel">
      <input type="hidden" name="lang" value={lang} />
      {profile === null ? <p className="muted measure">{p.createLead}</p> : null}
      <div className="field">
        <label htmlFor="headline">{p.headline}</label>
        <input id="headline" name="headline" type="text" maxLength={200} defaultValue={profile?.headline ?? ""} aria-describedby="headline-hint" />
        <p id="headline-hint" className="field-hint">{p.headlineHint}</p>
      </div>
      <div className="field">
        <label htmlFor="summary">{p.summary}</label>
        <textarea id="summary" name="summary" maxLength={4000} rows={8} defaultValue={profile?.summary ?? ""} aria-describedby="summary-hint" />
        <p id="summary-hint" className="field-hint">{p.summaryHint}</p>
      </div>
      <div className="field">
        <label htmlFor="skills">{p.skills}</label>
        <input id="skills" name="skills" type="text" maxLength={2000} defaultValue={profile?.skills.join(", ") ?? ""} aria-describedby="skills-hint" />
        <p id="skills-hint" className="field-hint">{p.skillsHint}</p>
      </div>
      <div className="panel-grid">
        <div className="field">
          <label htmlFor="city">{p.city}</label>
          <input id="city" name="city" type="text" maxLength={120} autoComplete="address-level2" defaultValue={profile?.city ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="workMode">{p.workMode}</label>
          <select id="workMode" name="workMode" required defaultValue={profile?.workMode ?? "remote"}>
            {MODES.map((mode) => (
              <option key={mode} value={mode}>
                {modes[mode]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="rate">{p.rate}</label>
          <input id="rate" name="rate" type="text" inputMode="decimal" maxLength={12} defaultValue={centsToField(profile?.dailyRateCents ?? null)} aria-describedby="rate-hint" />
          <p id="rate-hint" className="field-hint">{p.rateHint}</p>
        </div>
      </div>
      <div className="panel-grid">
        <div className="field">
          <label htmlFor="availability">{p.availability}</label>
          <select id="availability" name="availability" defaultValue={profile?.availability ?? "available"}>
            {AVAILABILITIES.map((value) => (
              <option key={value} value={value}>
                {p.availabilities[value]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="availableFrom">{p.availableFrom}</label>
          <input id="availableFrom" name="availableFrom" type="date" defaultValue={profile?.availableFrom?.toISOString().slice(0, 10) ?? ""} aria-describedby="from-hint" />
          <p id="from-hint" className="field-hint">{p.availableFromHint}</p>
        </div>
      </div>
      <button type="submit" className="btn btn-primary">
        {profile === null ? p.create : p.save}
      </button>
    </form>
  );
}

function Publication({ lang, p, profile }: { readonly lang: Lang; readonly p: ProfileDictionary; readonly profile: ProfileFacts }) {
  const button = (visibility: "named" | "pseudonymous" | "private", label: string, primary: boolean) => (
    <form action={setProfileVisibility}>
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="visibility" value={visibility} />
      <button type="submit" className={primary ? "btn btn-primary" : visibility === "private" ? "btn btn-quiet" : "btn"} aria-describedby={visibility === "private" ? "unpublish-hint" : undefined}>
        {label}
      </button>
    </form>
  );
  return (
    <section className="panel" aria-labelledby="publication-title">
      <h2 id="publication-title">{p.visibilityTitle}</h2>
      <p className="thread-meta">
        <StatusTag status={profile.visibility === "private" ? "draft" : "accepted"} label={profile.reference} />
        <span className="muted">{p.visibility[profile.visibility]}</span>
      </p>
      <p className="muted small">{p.facts(profile.verifiedUrls, profile.verifiedMissions)}</p>
      {profile.visibility === "named" ? null : <p className="muted small">{p.pseudonymousShows}</p>}
      <div className="empty-actions">
        {profile.visibility === "pseudonymous" ? null : button("pseudonymous", p.publish, profile.visibility === "private")}
        {profile.visibility === "named" ? null : button("named", p.publishNamed, false)}
        {profile.visibility !== "private" && profile.slug !== null ? (
          <Link className="btn" href={`/${lang}/profils/${profile.slug}`}>
            {p.publicPage}
          </Link>
        ) : null}
        {profile.visibility === "private" ? null : button("private", p.unpublish, false)}
      </div>
      {profile.visibility === "private" ? null : (
        <p id="unpublish-hint" className="muted small">
          {p.unpublishHint}
        </p>
      )}
    </section>
  );
}

/**
 * The rich sections of an existing profile: photo, availability, declared items, CV and its import draft. `editing`
 * opens the edit form of one item; only items read from the person's own profile can match it.
 */
async function RichSections({ lang, market, notice, editing, s }: { readonly lang: Lang; readonly market: Market; readonly notice: SectionNotice | null; readonly editing: string | null; readonly s: ProfileDictionary["sections"] }) {
  const [sections, cv, draft] = await Promise.all([profileSections(market.db).mine(market.actor), storedFiles(market.db).latest(market.actor, "cv"), importDrafts(market.db).get(market.actor)]);
  if (sections === null) return null;
  const common = { lang, s, notice, editing };
  return (
    <>
      <AvailabilitySection {...common} confirmedAt={sections.availabilityAt} now={new Date()} />
      <PhotoSection {...common} photoFileId={sections.photoFileId} />
      <ExperienceSection {...common} items={sections.experiences} />
      <CertificationSection {...common} items={sections.certifications} />
      <EducationSection {...common} items={sections.educations} />
      <LanguageSection {...common} items={sections.languages} />
      <PortfolioSection {...common} items={sections.portfolio} />
      <CvSection {...common} cv={cv} draft={draft} importAvailable={importConfigured()} />
    </>
  );
}

/** The freelancer's own profile: edited here, published or withdrawn here. */
export default async function ProfilePage({ params, searchParams }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const market = await pageMarket(lang, ["freelance"]);
  const dict = marketDictionary(lang);
  if (market === "unconfigured") return <MarketUnavailable text={dict.notConfigured} />;
  const p = dict.profile;
  const profile = await profiles(market.db).findMine(market.actor);
  const checklist = await checklistFor(market, lang, profile, new Date());
  const { erreur, manque, enregistre, section, avis, modifier } = await searchParams;
  const notice = readNotice(section, avis);
  const missing = (manque ?? "")
    .split(",")
    .filter((field): field is (typeof REQUIRED_TO_PUBLISH)[number] => (REQUIRED_TO_PUBLISH as readonly string[]).includes(field))
    .map((field) => p.fieldNames[field]);
  const error = erreur === undefined ? (missing.length > 0 ? p.missing(missing) : null) : erreur === "trop" ? p.errors.tooMany : p.errors.invalid;

  return (
    <>
      <header className="app-head">
        <h1>{p.title}</h1>
        <p className="muted measure">{p.lead}</p>
      </header>
      <StandingNotice lang={lang} market={market} topics={["profile"]} />
      {error === null ? null : (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {enregistre === undefined || error !== null ? null : (
        <p className="form-ok" role="status">
          {p.saved}
        </p>
      )}
      <ProfileChecklist c={dict.visibility.checklist} checklist={checklist} headingId="profile-checklist" />
      {profile === null ? null : <Publication lang={lang} p={p} profile={profile} />}
      <ProfileForm lang={lang} p={p} modes={dict.missions.workModes} profile={profile} />
      {profile === null ? null : <RichSections lang={lang} market={market} notice={notice} editing={editingOf(modifier)} s={p.sections} />}
    </>
  );
}
