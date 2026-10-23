import Link from "next/link";
import "@proofseen/brand/seal.css";
import "@/styles/app-registre.css";
import type { Lang } from "@/i18n";
import type { ProofsDictionary } from "@/i18n/market/proofs-fr";
import type { PublicStanding } from "@/lib/proof-register";

interface PublicTallyProps {
  readonly lang: Lang;
  readonly p: ProofsDictionary;
  readonly standing: PublicStanding;
  /**
   * On the home the cartouche is the way in to the register (`/app/preuves`); on that page it is the head the register
   * opens under, and links nowhere.
   */
  readonly link: boolean;
}

/*
 * "Ce qui est poinçonné sur votre page publique" (CONNECTED_PLAN §2.1): the summary of the public rail, the same counts
 * written by the same function (`proofTally` of @proofseen/hub), never a weighted total, never a score. The square is
 * the only green, and only when a fact is verified; the words stay in ink, so the link is never a green call to action.
 */
export function PublicTally({ lang, p, standing, link }: PublicTallyProps) {
  const s = p.standing;
  const verified = standing.kind === "published" && standing.verified;
  const text = standing.kind === "published" ? standing.tally : standing.kind === "hidden" ? s.hidden : s.unpublished;
  const body = (
    <>
      <span className={verified ? "sq" : "sq open"} aria-hidden="true" />
      <span>{text}</span>
    </>
  );
  return (
    <div className="reg-standing">
      {link ? (
        <Link className="reg-tally" href={`/${lang}/app/preuves`} aria-describedby="reg-tally-detail">
          {body}
        </Link>
      ) : (
        <p className="reg-tally">{body}</p>
      )}
      <p className="reg-standing-links">
        {link ? (
          <span id="reg-tally-detail" className="muted small">
            {s.detail}
          </span>
        ) : null}
        {standing.kind === "published" ? (
          <a href={`/${lang}/profils/${standing.slug}`}>{s.publicPage}</a>
        ) : standing.kind === "unpublished" ? (
          <Link href={`/${lang}/app/profil#publication-title`}>{s.publish}</Link>
        ) : null}
      </p>
    </div>
  );
}
