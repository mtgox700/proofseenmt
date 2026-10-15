import type { PendingAttestation, ProofDispute } from "@proofseen/db";
import { rejectVigilance, revokeProof, verifyVigilance } from "@/app/[lang]/app/operateur/verification-actions";
import type { Lang } from "@/i18n";
import type { OperatorDictionary } from "@/i18n/market/operator-fr";
import { day } from "@/lib/format";
import { LangField, ReasonField } from "./OperatorParts";

interface Props {
  readonly lang: Lang;
  readonly o: OperatorDictionary;
  readonly attestations: readonly PendingAttestation[];
  readonly disputes: readonly ProofDispute[];
}

/** The two manual verification queues: URSSAF certificates, then contested address proofs. */
export function VerificationQueues({ lang, o, attestations, disputes }: Props) {
  const v = o.verifications;
  return (
    <>
      <section className="panel" aria-labelledby="vigilance-title">
        <h2 id="vigilance-title">{v.vigilanceTitle}</h2>
        <p className="muted measure">{v.vigilanceLead}</p>
        {attestations.length === 0 ? (
          <p className="muted">{o.common.empty}</p>
        ) : (
          <ul className="op-list">
            {attestations.map((a) => (
              <li key={a.reference} className="op-item">
                <p>
                  <strong>{a.reference}</strong> · {v.issuedOn} {day(a.issuedOn, lang)} · {v.expiresOn} {day(a.expiresOn, lang)} · {v.code} <code>{a.securityCode}</code>
                </p>
                <p className="muted small">
                  {v.entity} : {a.legalName ?? v.noBilling} · SIRET {a.siret ?? "—"}
                </p>
                <div className="op-forms">
                  <form action={verifyVigilance}>
                    <LangField lang={lang} />
                    <input type="hidden" name="reference" value={a.reference} />
                    <div className="field">
                      <label htmlFor={`code-${a.reference}`}>{v.checkedCode}</label>
                      <input id={`code-${a.reference}`} name="code" type="text" required maxLength={60} autoComplete="off" />
                    </div>
                    <button type="submit" className="btn btn-primary">
                      {v.verify}
                    </button>
                  </form>
                  <form action={rejectVigilance}>
                    <LangField lang={lang} />
                    <input type="hidden" name="reference" value={a.reference} />
                    <ReasonField id={`reject-${a.reference}`} o={o} />
                    <button type="submit" className="btn btn-quiet">
                      {v.reject}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="panel" id="adresses" aria-labelledby="disputes-title">
        <h2 id="disputes-title">{v.disputesTitle}</h2>
        <p className="muted measure">{v.disputesLead}</p>
        {disputes.length === 0 ? (
          <p className="muted">{o.common.empty}</p>
        ) : (
          <ul className="op-list">
            {disputes.map((d) => (
              <li key={d.claimant.ownedUrlId} className="op-item">
                <p>
                  <code>{d.holder.url}</code>
                </p>
                <p>
                  {v.holder} <strong>{d.holder.reference}</strong> · {v.declaredOn} {day(d.holder.declaredAt, lang)} · {v.provenOn} {day(d.holder.verifiedAt, lang)}
                </p>
                <p>
                  {v.claimant} <strong>{d.claimant.reference}</strong> · {v.declaredOn} {day(d.claimant.declaredAt, lang)}
                </p>
                <form action={revokeProof} className="op-forms">
                  <LangField lang={lang} />
                  <input type="hidden" name="ownedUrlId" value={d.holder.ownedUrlId} />
                  <ReasonField id={`revoke-${d.claimant.ownedUrlId}`} o={o} />
                  <button type="submit" className="btn btn-quiet">
                    {v.revoke}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
