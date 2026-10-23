import { Seal } from "@/components/proof/Seal";
import { EmptyNote } from "@/components/EmptyState";
import "@/styles/app-registre.css";
import type { ProofsDictionary } from "@/i18n/market/proofs-fr";
import type { AddressSeal, FactView, MissionSeal, TraceRow } from "@/lib/proof-register";

interface ProofRegisterProps {
  readonly p: ProofsDictionary;
  readonly missions: readonly MissionSeal[];
  readonly addresses: readonly AddressSeal[];
  readonly facts: readonly FactView[];
  /** Whether these lines are on a public page now; a private profile is told when they will be. */
  readonly published: boolean;
  /** Published under the reference: the page counts the addresses, it never shows them. */
  readonly pseudonymous: boolean;
}

function Trace({ rows }: { readonly rows: readonly TraceRow[] }) {
  if (rows.length === 0) return null;
  return (
    <dl className="trace">
      {rows.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/*
 * "Ce qui est vérifié" on /app/preuves (CONNECTED_PLAN §2.1, lot 2): the register of the public page, read from the
 * person's own rows, each verified fact under its poinçon (the `Seal` of lot 1) with its date and trace. Green only
 * here, and only on what the database holds as verified: a mission confirmed by the client or paid on Proofseen, an
 * address whose ownership is proven, a fact of the public page. Every seal carries an opaque id for the strike island,
 * which plays a strike once per device for a fact it has not seen yet.
 */
export function ProofRegister({ p, missions, addresses, facts, published, pseudonymous }: ProofRegisterProps) {
  const r = p.register;
  const empty = missions.length === 0 && addresses.length === 0 && facts.length === 0;
  return (
    <section className="panel reg-register" id="verifie" aria-labelledby="register-title">
      <h2 id="register-title">{r.title}</h2>
      <p className="muted measure">{published ? r.notePublished : r.notePrivate}</p>
      {empty ? <EmptyNote>{r.empty}</EmptyNote> : null}
      {missions.length === 0 ? null : (
        <>
          <h3 className="reg-group">{r.missions}</h3>
          <ul className="reg-pieces">
            {missions.map((m) => (
              <li key={m.id} className="reg-piece" data-seal-id={m.id}>
                <div className="reg-claim">
                  <h4>{m.role}</h4>
                  <p className="reg-when">
                    {m.client} · {m.months}
                  </p>
                  {m.summary === "" ? null : <p className="reg-summary">{m.summary}</p>}
                </div>
                <Seal text={m.text} date={m.date} trace={m.trace} />
              </li>
            ))}
          </ul>
        </>
      )}
      {addresses.length === 0 ? null : (
        <>
          <h3 className="reg-group">{r.addresses}</h3>
          {pseudonymous ? <p className="muted small measure">{r.pseudonymous}</p> : null}
          <ul className="reg-pieces">
            {addresses.map((a) => (
              <li key={a.id} className="reg-piece" data-seal-id={a.id}>
                <p className="reg-url">{a.url}</p>
                <Seal text={a.text} date={a.date} trace={a.trace} />
              </li>
            ))}
          </ul>
        </>
      )}
      {facts.length === 0 ? null : (
        <>
          <h3 className="reg-group">{r.facts}</h3>
          <ul className="reg-pieces">
            {facts.map((f) => (
              <li key={f.text} className="reg-piece">
                {/* As on the public page: the green square marks the fact, its words stay in ink. */}
                <p className="reg-what">
                  <span className="sq" aria-hidden="true" />
                  <span>{f.text}</span>
                </p>
                <Trace rows={f.trace} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
