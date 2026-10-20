"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { DealsDictionary } from "@/i18n/market/deals-fr";
import { returnState, type PaymentStatusName, type ReturnState } from "@/lib/pay-section";

interface PaymentReturnProps {
  readonly contractId: string;
  /** The status the page was rendered with, read from the database the webhook updates. */
  readonly initial: PaymentStatusName | null;
  readonly returned: DealsDictionary["contracts"]["pay"]["returned"];
}

const POLL_MS = 3000;
const MAX_POLLS = 20;

const statusOf = (body: unknown): PaymentStatusName | null => {
  if (typeof body !== "object" || body === null) return null;
  const data = (body as { readonly data?: unknown }).data;
  if (typeof data !== "object" || data === null) return null;
  const status = (data as { readonly status?: unknown }).status;
  return typeof status === "string" ? (status as PaymentStatusName) : null;
};

/**
 * Back from Stripe: what the page says comes from the existing status route, never from the redirect's own word — the
 * webhook is the source of truth. While Stripe has not confirmed, it asks again every few seconds, then refreshes the
 * page once the funds are held so the approval button unlocks. The client secret Stripe puts in the address is removed
 * from it straight away.
 */
export function PaymentReturn({ contractId, initial, returned }: PaymentReturnProps) {
  const router = useRouter();
  const [state, setState] = useState<ReturnState>(returnState(initial));

  useEffect(() => {
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  useEffect(() => {
    if (state !== "processing") return;
    let polls = 0;
    let stopped = false;
    const timer = window.setInterval(() => {
      polls += 1;
      if (polls > MAX_POLLS) {
        window.clearInterval(timer);
        return;
      }
      fetch(`/api/contracts/${encodeURIComponent(contractId)}/payment`, { credentials: "same-origin", cache: "no-store" })
        .then((response) => (response.ok ? response.json() : null))
        .then((body: unknown) => {
          const next = returnState(statusOf(body));
          if (stopped || next === "processing") return;
          stopped = true;
          window.clearInterval(timer);
          setState(next);
          router.refresh();
        })
        .catch(() => undefined);
    }, POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [state, contractId, router]);

  return (
    <p className={state === "failed" ? "form-error" : state === "held" ? "form-ok" : "muted"} role="status" aria-live="polite">
      {returned[state]}
    </p>
  );
}
