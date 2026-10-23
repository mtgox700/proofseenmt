import Link from "next/link";
import type { MyConfirmationRequest } from "@proofseen/db";
import "@/styles/app-registre.css";
import type { Lang } from "@/i18n";
import type { MarketDictionary } from "@/i18n/market";
import { day } from "@/lib/format";
import { waitingRequests } from "@/lib/proof-register";

/** Requests written out on the home; the rest are counted, and all of them are on /app/preuves. */
const SHOWN = 3;

/*
 * "Ce qui attend quelqu'un" on the home (CONNECTED_PLAN §2.1): the confirmation requests still waiting for a client,
 * the nearest deadline first, each with its deadline in words and in amber. Nothing when none is waiting.
 */
export function WaitingForClient({ lang, m, requests }: { readonly lang: Lang; readonly m: MarketDictionary; readonly requests: readonly MyConfirmationRequest[] }) {
  const waiting = waitingRequests(requests);
  if (waiting.length === 0) return null;
  const w = m.proofs.waiting;
  const f = m.confirmations.freelance;
  const rest = waiting.length - SHOWN;
  return (
    <section className="panel" aria-labelledby="waiting-title">
      <h2 id="waiting-title">{w.title}</h2>
      <ul className="reg-requests">
        {waiting.slice(0, SHOWN).map((r) => (
          <li key={r.id} className="reg-request" data-state={r.state}>
            <p className="reg-request-what">
              <strong>{r.role}</strong> · {r.clientName}
            </p>
            <p className="reg-request-state">
              <span className="tag tag-signal">{f.state.pending(day(r.expiresAt, lang))}</span>
            </p>
          </li>
        ))}
      </ul>
      {rest > 0 ? <p className="muted small">{w.more(rest)}</p> : null}
      <p>
        <Link href={`/${lang}/app/preuves#missions`}>{w.link}</Link>
      </p>
    </section>
  );
}
