import Link from "next/link";
import { getDb, inbox } from "@proofseen/db";
import { hasDatabase } from "@/data/intake-sink";
import type { Dictionary, Lang } from "@/i18n";
import { authConfigured } from "@/lib/auth-config";

/*
 * The contact block of a profile page: a link to the connected contact form, where a company writes through
 * Proofseen, never directly. Only a profile published on the marketplace can be contacted; any other is said closed,
 * without a dead button.
 */
export async function RequestProfile({ lang, t, reference }: { readonly lang: Lang; readonly t: Dictionary; readonly reference: string }) {
  const open = authConfigured() && hasDatabase() && (await inbox(getDb()).contactTarget(reference)) !== null;
  if (!open) {
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
  return (
    <div className="order-cta">
      <Link className="btn btn-primary" href={`/${lang}/app/contact/${encodeURIComponent(reference)}`}>
        {t.messages.requestTitle}
      </Link>
    </div>
  );
}
