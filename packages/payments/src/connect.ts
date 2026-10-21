import { z } from "zod";

/*
 * Comptes de versement des freelances en Accounts v2 (Stripe Connect).
 *
 * Depuis la version d'API 2026-09-30, Stripe refuse `POST /v1/accounts` pour une nouvelle intégration Connect et
 * renvoie vers `POST /v2/core/accounts` (https://docs.stripe.com/connect/accounts-v2/account-creation). Le compte porte
 * la configuration `recipient` : il reçoit nos virements (`/v1/transfers`) dans son solde Stripe grâce à la capacité
 * `stripe_balance.stripe_transfers` (https://docs.stripe.com/connect/marketplace/tasks/create). Il est « prêt » quand
 * cette capacité est `active` (https://docs.stripe.com/connect/marketplace/tasks/onboard).
 *
 * Tout appel `/v2` exige l'en-tête `Stripe-Version` et un corps JSON (https://docs.stripe.com/api-v2-overview).
 */

/** Version d'API par défaut du compte Stripe (bac à sable « New business »), envoyée sur chaque appel `/v2`. */
export const STRIPE_V2_VERSION = "2026-09-30.endive";

export const ACCOUNT_ID = /^acct_[A-Za-z0-9]+$/;

/**
 * Corps de création, tel que Stripe le recommande pour un compte qui ne fait que recevoir des virements : tableau de
 * bord Express, frais et pertes à la charge de la plateforme (obligatoire avec `dashboard: express` et la seule
 * configuration `recipient`). `entity_type: individual` reprend le choix fait en v1 (`business_type=individual`).
 */
export const recipientAccountBody = (email: string, country: string): Record<string, unknown> => ({
  contact_email: email,
  dashboard: "express",
  identity: { country, entity_type: "individual" },
  defaults: { responsibilities: { fees_collector: "application", losses_collector: "application" } },
  configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } },
});

/**
 * Lien d'inscription v2 (`POST /v2/core/account_links`, https://docs.stripe.com/api/v2/core/account-links/create).
 * En 2026-09-30.endive, `use_case.account_onboarding` ne prend plus de liste `configurations` : Stripe la déduit des
 * configurations du compte (la réponse rend `["recipient"]`). Le lien v1 `/v1/account_links` n'est plus utilisé.
 */
export const onboardingLinkBody = (accountId: string, returnUrl: string, refreshUrl: string): Record<string, unknown> => ({
  account: accountId,
  use_case: { type: "account_onboarding", account_onboarding: { return_url: returnUrl, refresh_url: refreshUrl } },
});

const AccountSchema = z.object({
  id: z.string(),
  closed: z.boolean().nullish(),
  configuration: z
    .object({
      recipient: z
        .object({
          capabilities: z
            .object({ stripe_balance: z.object({ stripe_transfers: z.object({ status: z.string() }).nullish() }).nullish() })
            .nullish(),
        })
        .nullish(),
    })
    .nullish(),
});

/**
 * Vrai seulement si le compte v2 (lu avec `include[0]=configuration.recipient`) peut recevoir des virements : capacité
 * `stripe_transfers` au statut `active`, compte non fermé. Tout autre statut (`pending`, `restricted`, `rejected`,
 * `unsupported`) ou une réponse inattendue vaut « pas prêt » : les fonds restent bloqués, rien n'est perdu.
 */
export const recipientTransfersActive = (account: unknown): boolean => {
  const parsed = AccountSchema.safeParse(account);
  if (!parsed.success || parsed.data.closed === true) return false;
  return parsed.data.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status === "active";
};
