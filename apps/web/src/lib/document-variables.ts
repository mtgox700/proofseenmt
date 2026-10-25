import {
  commissionTermsFromEnv,
  parisDay,
  RenderRefusedError,
  VIGILANCE_THRESHOLD_BY_CURRENCY,
  type ContractFacts,
  type Db,
  type DocumentType,
  type RenderRequest,
} from "@proofseen/db";
import { LEGAL_VERSION_DATE, PUBLISHER } from "@proofseen/hub";

/*
 * Les variables de chaque gabarit : ce que le coffre remet (`facts`) plus ce que la base porte encore et que `ContractFacts`
 * et `QuoteFacts` ne remettent pas (centre de coûts, qui paie la commission, référence du freelance, nom de l'entreprise,
 * TVA du freelance, identités du NDA, versions du contrat). Chaque fait vient d'une colonne lue : rien n'est deviné. Les
 * choix des parties (`choices`) passent en premier et sont écrasés par les faits de même nom.
 *
 * Les noms de variables sont ceux des `template.yaml` du Trésor (packages/documents/templates) ; la source de chacune y est écrite.
 */

export type Variables = Readonly<Record<string, unknown>>;
export type Engine = typeof import("@proofseen/documents");

export interface Context {
  readonly db: Db;
  readonly request: RenderRequest;
  readonly engine: Engine;
  /** Les saisies des parties, déjà filtrées : seules les variables `input` du gabarit. */
  readonly choices: Variables;
}

/** Les gabarits des sortes de document que le coffre range. */
export const TEMPLATE_OF: Readonly<Record<DocumentType, string>> = {
  service_agreement: "service-agreement",
  quote: "quote",
  acceptance_report: "acceptance-report",
  nda: "nda",
  amendment: "amendment",
};

/** Le seul payeur de la commission que le code des paiements prend en charge (`payments.ts` : « payeur de la commission non pris en charge »). */
const CURRENT_FEE_PAYER = "freelance";
const SIX_MONTHS_MS = 183 * 86_400_000;

const day = (date: Date): string => date.toISOString().slice(0, 10);

const contractOf = (request: RenderRequest): ContractFacts => {
  if (request.facts.kind !== "contract") throw new RenderRefusedError("affair_not_supported");
  return request.facts.contract;
};

const base = (request: RenderRequest): Variables => ({ "document.issuedOn": parisDay(request.at), "document.versionNumber": request.version });

/* ---- contrat de prestation ---- */

const publisher = (lang: "fr" | "en"): Variables => ({
  "platform.publisherName": PUBLISHER.name,
  "platform.publisherForm": PUBLISHER.form[lang],
  "platform.publisherSiren": PUBLISHER.siren,
  "platform.publisherRegistry": PUBLISHER.registry[lang],
  "platform.publisherAddress": PUBLISHER.address,
  "platform.termsVersion": LEGAL_VERSION_DATE,
});

interface ContractRow {
  readonly organisationId: string | null;
  readonly profileId: string | null;
  readonly costCenter: string | null;
  readonly feePayer: "freelance" | "company";
}

/** Ce que `ContractFacts` ne porte pas : les deux parties par leur identifiant, le centre de coûts, qui paie la commission. */
const rowOf = async (db: Db, contractId: string): Promise<ContractRow> => {
  const row = await db.contract.findUnique({ where: { id: contractId }, select: { organisationId: true, profileId: true, costCenter: true, feePayer: true } });
  if (row === null) throw new RenderRefusedError("contract_not_found");
  return row;
};

export interface Vigilance {
  readonly required: boolean;
  readonly thresholdCents: number;
}

/**
 * Faut-il l'attestation de vigilance ? Même calcul que `contractBlocker` (packages/db/src/contract-checks.ts) : le cumul des
 * contrats non annulés des six derniers mois entre les mêmes parties, dans la même devise, plus ce contrat, atteint le seuil
 * de la devise. A extraire dans packages/db pour n'avoir qu'une copie du calcul (RISK au bus).
 */
export const vigilanceOf = async (db: Db, contract: ContractFacts, row: ContractRow, at: Date): Promise<Vigilance> => {
  const thresholdCents = VIGILANCE_THRESHOLD_BY_CURRENCY[contract.currency] ?? VIGILANCE_THRESHOLD_BY_CURRENCY.EUR ?? 500_000;
  const recent = await db.contract.aggregate({
    where: { organisationId: row.organisationId, profileId: row.profileId, currency: contract.currency, status: { not: "cancelled" }, createdAt: { gte: new Date(at.getTime() - SIX_MONTHS_MS) }, id: { not: contract.id } },
    _sum: { totalCents: true },
  });
  return { required: (recent._sum.totalCents ?? 0) + contract.totalCents >= thresholdCents, thresholdCents };
};

export const contractVariables = async (c: Context): Promise<Variables> => {
  const contract = contractOf(c.request);
  const row = await rowOf(c.db, contract.id);
  const vigilance = await vigilanceOf(c.db, contract, row, c.request.at);
  return {
    ...c.choices,
    ...base(c.request),
    // Seule méthode que le produit pratique aujourd'hui (un clic daté par partie, contracts.ts `sign()`) ; otp_simple avec le Sceau (L2).
    "document.signatureMethod": "platform_acceptance",
    "contract.id": contract.id,
    seller: contract.seller,
    buyer: contract.buyer,
    "seller.vatRateBp": contract.seller.vatRateBp ?? 0,
    ...publisher(c.request.lang),
    "contract.billing": contract.billing,
    "contract.currency": contract.currency,
    "contract.dailyRateCents": contract.dailyRateCents,
    "contract.days": contract.days,
    "contract.totalCents": contract.totalCents,
    "contract.startsOn": day(contract.startsOn),
    "contract.endsOn": contract.endsOn === null ? null : day(contract.endsOn),
    "contract.costCenter": row.costCenter,
    "contract.commissionBp": contract.commissionBp,
    "contract.feePayer": row.feePayer,
    "computed.vigilanceRequired": vigilance.required,
    "rule.vigilanceThresholdCents": vigilance.thresholdCents,
    "rule.recoveryFeeCents": c.engine.RECOVERY_FEE_CENTS,
    "input.scope": contract.scope,
    "input.deliverables": contract.deliverables,
  };
};

/* ---- devis ---- */

export const quoteVariables = async (c: Context): Promise<Variables> => {
  if (c.request.facts.kind !== "quote") throw new RenderRefusedError("affair_not_supported");
  const quote = c.request.facts.quote;
  const row = await c.db.quote.findUnique({
    where: { id: quote.id },
    select: { conversation: { select: { organisation: { select: { name: true } }, profile: { select: { reference: true, billing: { select: { vatRateBp: true } } } } } } },
  });
  if (row === null) throw new RenderRefusedError("quote_not_found");
  const vatRateBp = row.conversation.profile.billing?.vatRateBp ?? null;
  return {
    ...c.choices,
    // La date du devis est celle de sa création (source `Quote.createdAt` du gabarit), pas celle de ce rendu.
    "document.issuedOn": parisDay(quote.createdAt),
    "document.versionNumber": c.request.version,
    "quote.id": quote.id,
    "seller.reference": row.conversation.profile.reference,
    "buyer.name": row.conversation.organisation.name,
    "quote.billing": quote.billing,
    "quote.currency": quote.currency,
    "quote.dailyRateCents": quote.dailyRateCents,
    "quote.days": quote.days,
    "quote.totalCents": quote.totalCents,
    "computed.vatRegime": vatRateBp === null ? "unknown" : vatRateBp === 0 ? "exempt" : "standard",
    "computed.vatRateBp": vatRateBp,
    "platform.commissionBp": commissionTermsFromEnv(process.env)?.commissionBp ?? null,
    "platform.feePayer": CURRENT_FEE_PAYER,
    "input.scope": quote.scope,
    "input.deliverables": quote.deliverables,
    "input.validUntil": quote.validUntil === null ? null : day(quote.validUntil),
  };
};

/* ---- accord de confidentialité ---- */

export const ndaVariables = async (c: Context): Promise<Variables> => {
  const facts = c.request.facts;
  if (facts.kind !== "other" || facts.affair.kind !== "conversation") throw new RenderRefusedError("affair_not_supported");
  const row = await c.db.conversation.findUnique({
    where: { id: facts.affair.id },
    select: {
      profile: { select: { billing: { select: { legalName: true, siret: true, vatNumber: true, address: true } } } },
      organisation: { select: { name: true, siret: true, vatNumber: true, billingAddress: true } },
    },
  });
  if (row === null) throw new RenderRefusedError("conversation_not_found");
  const freelance = row.profile.billing;
  const company = row.organisation;
  return {
    ...c.choices,
    ...base(c.request),
    "document.signatureMethod": "platform_acceptance",
    freelance: freelance === null ? null : { legalName: freelance.legalName, siret: freelance.siret, vatNumber: freelance.vatNumber, address: freelance.address },
    company: company.billingAddress === null ? null : { legalName: company.name, siret: company.siret, vatNumber: company.vatNumber, address: company.billingAddress },
  };
};

/* ---- procès-verbal de recette et avenant : les versions du contrat qu'ils visent ---- */

/** La dernière version du contrat de prestation rangée au coffre : son numéro et l'empreinte de ses octets (16 caractères par quatre). */
const signedVersion = async (c: Context, contractId: string): Promise<Variables> => {
  const document = await c.db.document.findFirst({
    where: { contractId, type: "service_agreement", slot: 1 },
    select: { versions: { orderBy: { number: "desc" }, take: 1, select: { number: true, sha256: true } } },
  });
  const latest = document?.versions[0];
  return latest === undefined ? {} : { "base.contractVersionNumber": latest.number, "base.contractDigestShort": c.engine.fileDigestGroups(latest.sha256) };
};

interface Approvals {
  readonly required: number;
  readonly decidedOn: string | null;
}

/** Combien de validations l'entreprise exige (jamais plus que d'administrateurs, comme `contracts.ts`) et le jour de la dernière. */
const approvalsOf = async (db: Db, contractId: string): Promise<Approvals> => {
  const row = await db.contract.findUnique({ where: { id: contractId }, select: { organisation: { select: { approvalLevels: true, members: { where: { role: { in: ["owner", "admin"] } }, select: { userId: true } } } } } });
  const admins = (row?.organisation?.members ?? []).map((m) => m.userId);
  const last = await db.contractApproval.aggregate({ where: { contractId, userId: { in: admins } }, _max: { approvedAt: true } });
  return { required: Math.max(1, Math.min(row?.organisation?.approvalLevels ?? 1, admins.length)), decidedOn: last._max.approvedAt === null ? null : parisDay(last._max.approvedAt) };
};

export const reportVariables = async (c: Context): Promise<Variables> => {
  const contract = contractOf(c.request);
  // Aucune échéance n'est codée : une recette « réputée acquise » ne s'écrit pas à la main (le code n'a pas de délai de recette).
  if (c.choices["report.decision"] === "deemed_accepted") throw new RenderRefusedError("invalid_variable", ["report.decision"]);
  const approvals = await approvalsOf(c.db, contract.id);
  return {
    ...c.choices,
    ...base(c.request),
    ...(await signedVersion(c, contract.id)),
    "contract.id": contract.id,
    "contract.billing": contract.billing,
    "contract.deliverables": contract.deliverables,
    seller: contract.seller,
    buyer: contract.buyer,
    "report.decidedOn": approvals.decidedOn,
    "buyer.approvalsRequired": approvals.required,
  };
};

export const amendmentVariables = async (c: Context): Promise<Variables> => {
  const contract = contractOf(c.request);
  const row = await rowOf(c.db, contract.id);
  const vigilance = await vigilanceOf(c.db, contract, row, c.request.at);
  const text = (name: string): string | undefined => (typeof c.choices[name] === "string" ? (c.choices[name] as string) : undefined);
  const list = (name: string): readonly string[] | undefined => (Array.isArray(c.choices[name]) ? (c.choices[name] as string[]) : undefined);
  const lines = c.engine.describeChanges(
    c.request.lang,
    { endsOn: contract.endsOn === null ? null : day(contract.endsOn), scope: contract.scope, deliverables: contract.deliverables },
    { endsOn: text("input.newEndsOn"), scope: text("input.newScope"), deliverables: list("input.newDeliverables") },
  );
  return {
    ...c.choices,
    ...base(c.request),
    ...(await signedVersion(c, contract.id)),
    "document.signatureMethod": "platform_acceptance",
    "contract.id": contract.id,
    "contract.currency": contract.currency,
    "amendment.rank": c.request.slot,
    seller: contract.seller,
    buyer: contract.buyer,
    "computed.changeLines": lines,
    // La v1 de l'avenant ne touche ni le prix ni les jours : aucun mouvement d'argent (le gabarit sait dire le reste, le code ne le fait pas encore).
    "computed.moneyAfterPayout": "none",
    "computed.vigilanceRequiredAfter": vigilance.required,
    "rule.vigilanceThresholdCents": vigilance.thresholdCents,
  };
};

export const BUILDERS: Readonly<Record<DocumentType, (context: Context) => Promise<Variables>>> = {
  service_agreement: contractVariables,
  quote: quoteVariables,
  nda: ndaVariables,
  acceptance_report: reportVariables,
  amendment: amendmentVariables,
};
