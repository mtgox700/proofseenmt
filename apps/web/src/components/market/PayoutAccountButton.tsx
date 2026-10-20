"use client";

import { useState } from "react";
import type { Lang } from "@/i18n/types";
import type { BillingDictionary } from "@/i18n/market/billing-fr";
import { isStripeOnboardingUrl } from "@/lib/stripe-public";

interface PayoutAccountButtonProps {
  readonly lang: Lang;
  readonly label: string;
  readonly payouts: BillingDictionary["payouts"];
}

const refusal = (error: unknown, e: BillingDictionary["payouts"]["errors"]): string => {
  if (error === "identité de facturation requise") return e.identity;
  if (error === "trop de demandes") return e.tooMany;
  return e.generic;
};

/**
 * Asks the server for a fresh Stripe onboarding link (same-origin POST; the account is created on the first call) and
 * sends the browser there. Only a Stripe address is followed: the link is never put together in the page.
 */
export function PayoutAccountButton({ lang, label, payouts }: PayoutAccountButtonProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async (): Promise<void> => {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/billing/payout-account?lang=${lang}`, { method: "POST", credentials: "same-origin" });
      const body: unknown = await response.json().catch(() => null);
      const record = typeof body === "object" && body !== null ? (body as { readonly data?: { readonly url?: unknown }; readonly error?: unknown }) : null;
      const url = record?.data?.url;
      if (response.ok && isStripeOnboardingUrl(url)) {
        window.location.assign(url);
        return;
      }
      setError(refusal(record?.error, payouts.errors));
    } catch {
      setError(payouts.errors.generic);
    }
    setPending(false);
  };

  return (
    <div>
      <div className="empty-actions">
        <button type="button" className="btn btn-primary" disabled={pending} onClick={() => void open()}>
          {pending ? payouts.opening : label}
        </button>
      </div>
      {error === null ? null : (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
