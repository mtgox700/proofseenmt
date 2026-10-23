"use client";

import { useEffect, useRef, useState } from "react";
import type { Lang } from "@/i18n/types";
import type { DealsDictionary } from "@/i18n/market/deals-fr";
import { money } from "@/lib/format";
import { appearanceTheme } from "@/lib/pay-section";
import type { StripeAppearances } from "@/lib/stripe-appearance";
import { loadStripe, type StripeClient, type StripeElements, type StripePaymentElement } from "@/lib/stripe-js";

type PayStrings = DealsDictionary["contracts"]["pay"]["client"];

interface EscrowPaymentProps {
  readonly lang: Lang;
  readonly contractId: string;
  /** Public by design (`pk_…`): the only Stripe key this component ever receives. */
  readonly publishableKey: string;
  readonly testMode: boolean;
  readonly currency: string;
  readonly p: PayStrings;
  /** Stripe's appearance for each theme, drawn from the brand palette on the server: plain strings only. */
  readonly appearance: StripeAppearances;
}

type State =
  | { readonly kind: "idle" | "starting" }
  | { readonly kind: "ready" | "confirming"; readonly amountCents: number }
  | { readonly kind: "error"; readonly message: string; readonly amountCents: number | null };

interface Mounted {
  readonly stripe: StripeClient;
  readonly elements: StripeElements;
  readonly element: StripePaymentElement;
}

/** The route's refusals, turned into what the person can act on. */
const refusal = (error: unknown, e: PayStrings["errors"]): string => {
  if (error === "déjà payé") return e.already;
  if (error === "paiement par relevé mensuel") return e.monthly;
  if (error === "montant trop faible") return e.tooSmall;
  if (error === "trop de demandes") return e.tooMany;
  if (error === "paiements non configurés" || error === "introuvable") return e.closed;
  return e.generic;
};

const opened = (body: unknown): { readonly clientSecret: string; readonly amountCents: number } | null => {
  if (typeof body !== "object" || body === null) return null;
  const data = (body as { readonly data?: unknown }).data;
  if (typeof data !== "object" || data === null) return null;
  const { clientSecret, amountCents } = data as { readonly clientSecret?: unknown; readonly amountCents?: unknown };
  return typeof clientSecret === "string" && typeof amountCents === "number" ? { clientSecret, amountCents } : null;
};

/**
 * The company's escrowed payment: one click opens the payment on the server (same-origin POST, which returns the client
 * secret), then Stripe's Payment Element takes the card or bank details inside Stripe's own frame. Confirming sends the
 * person to Stripe if their bank asks for it, then back to this contract, where the status follows the webhook.
 */
export function EscrowPayment({ lang, contractId, publishableKey, testMode, currency, p, appearance }: EscrowPaymentProps) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const target = useRef<HTMLDivElement>(null);
  const mounted = useRef<Mounted | null>(null);

  useEffect(() => () => mounted.current?.element.destroy(), []);

  const start = async (): Promise<void> => {
    setState({ kind: "starting" });
    let secret: { readonly clientSecret: string; readonly amountCents: number } | null;
    try {
      const response = await fetch(`/api/contracts/${encodeURIComponent(contractId)}/payment`, { method: "POST", credentials: "same-origin" });
      const body: unknown = await response.json().catch(() => null);
      secret = response.ok ? opened(body) : null;
      if (secret === null) {
        const error = typeof body === "object" && body !== null ? (body as { readonly error?: unknown }).error : undefined;
        setState({ kind: "error", message: refusal(error, p.errors), amountCents: null });
        return;
      }
    } catch {
      setState({ kind: "error", message: p.errors.generic, amountCents: null });
      return;
    }
    try {
      const stripe = await loadStripe(publishableKey, lang);
      // The theme in force now: the form is mounted once, in the colours of the page around it.
      const theme = appearanceTheme(document.documentElement.dataset.theme, window.matchMedia("(prefers-color-scheme: light)").matches);
      const elements = stripe.elements({ clientSecret: secret.clientSecret, locale: lang, appearance: appearance[theme] });
      const element = elements.create("payment", { layout: "tabs" });
      mounted.current?.element.destroy();
      if (target.current === null) throw new Error("payment target missing");
      element.mount(target.current);
      mounted.current = { stripe, elements, element };
      setState({ kind: "ready", amountCents: secret.amountCents });
    } catch {
      setState({ kind: "error", message: p.errors.load, amountCents: null });
    }
  };

  const confirm = async (amountCents: number): Promise<void> => {
    const current = mounted.current;
    if (current === null) return;
    setState({ kind: "confirming", amountCents });
    const returnUrl = `${window.location.origin}/${lang}/app/contrats/${encodeURIComponent(contractId)}`;
    try {
      const { error } = await current.stripe.confirmPayment({ elements: current.elements, confirmParams: { return_url: returnUrl } });
      // Reached only when Stripe did not redirect: the card was refused or a field is wrong. Stripe's message is meant
      // for the payer; anything else gets ours.
      const shown = error?.type === "card_error" || error?.type === "validation_error" ? (error.message ?? p.errors.generic) : p.errors.generic;
      setState({ kind: "error", message: shown, amountCents });
    } catch {
      setState({ kind: "error", message: p.errors.generic, amountCents });
    }
  };

  const amountCents = state.kind === "ready" || state.kind === "confirming" ? state.amountCents : state.kind === "error" ? state.amountCents : null;
  const formShown = amountCents !== null;

  return (
    <div className="escrow-pay">
      {testMode ? (
        <p className="test-note" role="note">
          {p.testMode} {p.testCard}
        </p>
      ) : null}
      {amountCents === null ? null : <p>{p.amountDue.replace("{amount}", money(amountCents, currency, lang))}</p>}
      <div ref={target} hidden={!formShown} />
      {state.kind === "error" ? (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      ) : null}
      <div className="empty-actions">
        {formShown ? (
          <button type="button" className="btn btn-primary" disabled={state.kind === "confirming"} onClick={() => void confirm(amountCents)}>
            {state.kind === "confirming" ? p.confirming : p.confirm}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" disabled={state.kind === "starting"} onClick={() => void start()}>
            {state.kind === "starting" ? p.starting : p.start}
          </button>
        )}
      </div>
      <p className="muted small">{p.processor}</p>
    </div>
  );
}
