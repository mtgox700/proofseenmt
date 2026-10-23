import Link from "next/link";
import { notFound } from "next/navigation";
import { MAX_OWNED_URL_LENGTH, MAX_OWNED_URLS, MAX_PENDING_CONFIRMATIONS, missionConfirmations, ownedUrls, profiles, PROOF_GRACE_DAYS, publicProfiles, verifiedMissions, type OwnedUrlRecord } from "@proofseen/db";
import { proofKit } from "@proofseen/profiles";
import { EmptyNote } from "@/components/EmptyState";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { ProofWays } from "@/components/market/ProofWays";
import { StrikeOnce } from "@/components/proof/StrikeOnce";
import { MissionTrial } from "@/components/registre/MissionTrial";
import { ProofRegister } from "@/components/registre/ProofRegister";
import { PublicTally } from "@/components/registre/PublicTally";
import { isLang, type Lang } from "@/i18n";
import { marketDictionary, type MarketDictionary } from "@/i18n/market";
import { day } from "@/lib/format";
import { pageMarket } from "@/lib/market";
import { addressSeals, factViews, missionSeal, publicDay, publicStanding } from "@/lib/proof-register";
import { proofSecret } from "@/lib/proof-secret";
import { addOwnedUrl, checkOwnedUrl, removeOwnedUrl } from "./actions";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
  readonly searchParams: Promise<{ erreur?: string; enregistre?: string; prouve?: string; mission?: string; "mission-erreur"?: string }>;
}

type Proofs = MarketDictionary["proofs"];

const DAY_MS = 86_400_000;

/** The notice of the requests section, from the codes its actions redirect with. */
const missionNotice = (ok: string | undefined, failed: string | undefined, m: MarketDictionary): { readonly kind: "ok" | "error"; readonly text: string } | null => {
  const f = m.confirmations.freelance;
  const errors: Readonly<Record<string, string>> = {
    trop: f.errors.tooMany,
    invalide: f.errors.invalid,
    profil: f.errors.noProfile,
    limite: f.limit(MAX_PENDING_CONFIRMATIONS),
    future: f.errors.future,
    soi: f.errors.self,
    contact: f.errors.contactRequired,
    "contact-limite": f.errors.contactLimit,
    introuvable: f.errors.notFound,
    indisponible: f.errors.unavailable,
  };
  const done: Readonly<Record<string, string>> = { entreprise: f.sent.organisation, email: f.sent.email, retiree: f.withdrawn };
  const error = failed === undefined ? undefined : errors[failed];
  if (error !== undefined) return { kind: "error", text: error };
  const success = ok === undefined ? undefined : done[ok];
  return success === undefined ? null : { kind: "ok", text: success };
};

const errorText = (code: string | undefined, p: Proofs): string | null => {
  const e = p.errors;
  const known: Readonly<Record<string, string>> = {
    trop: e.tooMany,
    invalide: e.invalid,
    doublon: e.duplicate,
    limite: e.limit(MAX_OWNED_URLS),
    profil: e.noProfile,
    introuvable: e.notFound,
    absente: e.absent,
    ailleurs: e.elsewhere,
    manuel: e.manual,
    indisponible: e.unavailable,
  };
  return code === undefined ? null : (known[code] ?? null);
};

/** The state of an address in words. Proven reads in ink here: its poinçon is in the register at the top, once. */
function Status({ record, lang, p }: { readonly record: OwnedUrlRecord; readonly lang: Lang; readonly p: Proofs }) {
  if (record.verifiedAt !== null) return <span className="tag tag-done">{p.status.proven(publicDay(record.verifiedAt, lang), p.methods[record.proofMethod])}</span>;
  if (record.proofMethod === "profile_token") return <span className="tag tag-quiet">{p.status.manual}</span>;
  return <span className="tag tag-signal">{p.status.waiting}</span>;
}

interface ItemProps {
  readonly record: OwnedUrlRecord;
  readonly lang: Lang;
  readonly p: Proofs;
  readonly secret: string | null;
}

function ProofItem({ record, lang, p, secret }: ItemProps) {
  const manual = record.proofMethod === "profile_token";
  // An address in its grace period is still proven, but the person must restore the proof: same instructions.
  const needsProof = !manual && (record.verifiedAt === null || record.failedAt !== null);
  const kit = needsProof && secret !== null ? proofKit(secret, record.profileId, record.url) : null;
  return (
    <li className="proof-item">
      <div className="proof-head">
        <span className="proof-url">{record.url}</span>
        <Status record={record} lang={lang} p={p} />
        <form action={removeOwnedUrl}>
          <input type="hidden" name="lang" value={lang} />
          <input type="hidden" name="id" value={record.id} />
          <button type="submit" className="btn btn-quiet" aria-label={p.removeLabel(record.url)}>
            {p.remove}
          </button>
        </form>
      </div>
      {record.failedAt === null ? null : (
        <p className="form-error">{p.failing(day(record.failedAt, lang), day(new Date(record.failedAt.getTime() + PROOF_GRACE_DAYS * DAY_MS), lang))}</p>
      )}
      {manual ? <p className="muted measure">{p.manualNote}</p> : null}
      {kit === null ? null : (
        <>
          <ProofWays kit={kit} p={p} />
          <form action={checkOwnedUrl}>
            <input type="hidden" name="lang" value={lang} />
            <input type="hidden" name="id" value={record.id} />
            <button type="submit" className="btn btn-primary" aria-label={p.verifyLabel(record.url)}>
              {p.verify}
            </button>
          </form>
        </>
      )}
    </li>
  );
}

interface AddressesProps {
  readonly lang: Lang;
  readonly p: Proofs;
  readonly records: readonly OwnedUrlRecord[];
  readonly secret: string | null;
  /** The notice of an address action, already translated. */
  readonly error: string | null;
  readonly saved: boolean;
  readonly profileError: boolean;
}

/** The addresses, their state, how to prove the ones still waiting, and the form to add one. */
function Addresses({ lang, p, records, secret, error, saved, profileError }: AddressesProps) {
  return (
    <section className="panel" id="adresses" aria-labelledby="proofs-list">
      <h2 id="proofs-list">{p.listTitle}</h2>
      <p className="muted measure">{p.listLead}</p>
      {error === null ? null : (
        <div className="form-error" role="alert">
          <p>{error}</p>
          {profileError ? <Link href={`/${lang}/app/profil`}>{p.profileLink}</Link> : null}
        </div>
      )}
      {saved ? (
        <p className="form-ok" role="status">
          {p.saved}
        </p>
      ) : null}
      {secret === null ? <p className="muted measure">{p.unavailable}</p> : null}
      {records.length === 0 ? (
        <EmptyNote>{p.empty}</EmptyNote>
      ) : (
        <ul className="plain-list">
          {records.map((record) => (
            <ProofItem key={record.id} record={record} lang={lang} p={p} secret={secret} />
          ))}
        </ul>
      )}
      {records.length >= MAX_OWNED_URLS ? (
        <p className="muted measure">{p.errors.limit(MAX_OWNED_URLS)}</p>
      ) : (
        <form action={addOwnedUrl} className="reg-add" aria-labelledby="proofs-add">
          <input type="hidden" name="lang" value={lang} />
          <h3 id="proofs-add">{p.addTitle}</h3>
          <div className="field">
            <label htmlFor="proof-url">{p.addLabel}</label>
            <input id="proof-url" name="url" type="url" inputMode="url" required maxLength={MAX_OWNED_URL_LENGTH} placeholder="https://" autoComplete="url" aria-describedby="proof-url-hint" />
            <p id="proof-url-hint" className="field-hint">
              {p.addHint(MAX_OWNED_URLS)}
            </p>
          </div>
          <button type="submit" className="btn btn-primary">
            {p.add}
          </button>
        </form>
      )}
    </section>
  );
}

/*
 * "Preuves", the register of the freelancer (CONNECTED_PLAN §2.1, lot 2), in the order of a file: under the same
 * cartouche as the home, what the public page shows as verified, each fact under its poinçon; then what is on trial
 * with a client, and the form to ask for a confirmation; then the addresses to prove. Everything is read from the
 * database on the server; the only script is the island that strikes a newly verified fact once per device.
 */
export default async function ProofsPage({ params, searchParams }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const m = marketDictionary(lang);
  const p = m.proofs;
  const market = await pageMarket(lang, ["freelance"]);
  if (market === "unconfigured") return <MarketUnavailable text={m.notConfigured} />;
  const now = new Date();
  const [records, missions, requests, profile] = await Promise.all([
    ownedUrls(market.db).list(market.actor),
    verifiedMissions(market.db).listMine(market.actor),
    missionConfirmations(market.db).listMine(market.actor, now),
    profiles(market.db).findMine(market.actor),
  ]);
  // The public page as its visitors get it: the counts of its rail and its other verified facts.
  const page = profile === null || profile.visibility === "private" || profile.slug === null ? null : await publicProfiles(market.db).page(profile.slug, now);
  const standing = publicStanding(profile, page, lang);
  const secret = proofSecret();
  const { erreur, enregistre, prouve, mission, "mission-erreur": missionError } = await searchParams;
  const error = errorText(erreur, p);

  return (
    <>
      <header className="app-head">
        <h1>{p.title}</h1>
        <p className="muted measure">{p.lead}</p>
        <PublicTally lang={lang} p={p} standing={standing} link={false} />
      </header>
      {error === null && prouve !== undefined ? (
        <p className="form-ok" role="status">
          {p.proven}
        </p>
      ) : null}
      <ProofRegister
        p={p}
        missions={missions.map((verified) => missionSeal(verified, lang))}
        addresses={addressSeals(records, lang)}
        facts={factViews(page, lang)}
        published={standing.kind === "published"}
        pseudonymous={profile?.visibility === "pseudonymous"}
      />
      <MissionTrial lang={lang} m={m} requests={requests} notice={missionNotice(mission, missionError, m)} />
      <Addresses lang={lang} p={p} records={records} secret={secret} error={error} saved={error === null && prouve === undefined && enregistre !== undefined} profileError={erreur === "profil"} />
      <StrikeOnce scope="verifie" />
    </>
  );
}
