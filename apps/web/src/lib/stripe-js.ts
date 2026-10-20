import { STRIPE_JS_URL } from "./stripe-public";

/*
 * Stripe.js, loaded on demand from Stripe's domain (Stripe forbids bundling it) by the payment form only: no other page
 * downloads it. The few calls Proofseen makes are typed here rather than through an extra dependency.
 */

export interface StripePaymentElement {
  mount(target: HTMLElement): void;
  destroy(): void;
}

export interface StripeElements {
  create(type: "payment", options?: { readonly layout?: "tabs" | "accordion" }): StripePaymentElement;
}

export interface StripeConfirmError {
  readonly type?: string;
  readonly message?: string;
}

export interface StripeClient {
  elements(options: { readonly clientSecret: string; readonly locale?: string; readonly appearance?: { readonly theme?: "stripe" | "flat" | "night" } }): StripeElements;
  confirmPayment(options: { readonly elements: StripeElements; readonly confirmParams: { readonly return_url: string } }): Promise<{ readonly error?: StripeConfirmError }>;
}

type StripeFactory = (publishableKey: string, options?: { readonly locale?: string }) => StripeClient;

declare global {
  interface Window {
    Stripe?: StripeFactory;
  }
}

let loading: Promise<StripeFactory> | null = null;

const inject = (): Promise<StripeFactory> =>
  new Promise((resolve, reject) => {
    const existing = window.Stripe;
    if (existing !== undefined) {
      resolve(existing);
      return;
    }
    const script = document.createElement("script");
    script.src = STRIPE_JS_URL;
    script.async = true;
    script.addEventListener("load", () => {
      const factory = window.Stripe;
      if (factory === undefined) reject(new Error("Stripe.js loaded without Stripe"));
      else resolve(factory);
    });
    script.addEventListener("error", () => reject(new Error("Stripe.js failed to load")));
    document.head.appendChild(script);
  });

/** One Stripe client per page; a failed load can be retried by calling again. */
export const loadStripe = async (publishableKey: string, locale: string): Promise<StripeClient> => {
  loading ??= inject();
  try {
    const factory = await loading;
    return factory(publishableKey, { locale });
  } catch (error) {
    loading = null;
    throw error;
  }
};
