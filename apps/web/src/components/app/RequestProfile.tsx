import Link from "next/link";
import { openThread } from "@/app/[lang]/app/messages/actions";
import type { Dictionary, Lang } from "@/i18n";
import { authConfigured } from "@/lib/auth-config";
import { MAX_BODY } from "@/lib/messaging";
import { session } from "@/lib/session";

/*
 * The contact block of a profile page. A signed-in company writes its request here; it reaches the freelancer through
 * Proofseen, never directly. Everyone else is told what they need, without a dead button.
 */
export async function RequestProfile({ lang, t, profileId }: { readonly lang: Lang; readonly t: Dictionary; readonly profileId: string }) {
  const m = t.messages;
  if (!authConfigured()) {
    return (
      <div className="order-cta">
        <button type="button" className="btn" disabled aria-describedby="contact-closed">
          {t.profile.contactCta}
        </button>
        <p id="contact-closed" className="muted small">
          {t.profile.contactClosed}
        </p>
      </div>
    );
  }
  const state = await session();
  if (state.kind !== "signed-in") {
    return (
      <div className="order-cta">
        <p className="muted">{m.requestSignIn}</p>
        <Link className="btn btn-primary" href={`/${lang}/connexion`}>
          {m.requestSignInCta}
        </Link>
      </div>
    );
  }
  if (state.person.role !== "company") return <p className="muted">{m.requestNotCompany}</p>;
  return (
    <form action={openThread} className="reply">
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="profileId" value={profileId} />
      <div className="field">
        <label htmlFor="request-body">{m.requestLabel}</label>
        <textarea id="request-body" name="body" required maxLength={MAX_BODY} rows={5} />
      </div>
      <button type="submit" className="btn btn-primary">
        {m.requestSend}
      </button>
    </form>
  );
}
