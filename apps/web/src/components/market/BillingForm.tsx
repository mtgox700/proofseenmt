import type { Address } from "@proofseen/db";
import type { Lang } from "@/i18n";
import type { BillingDictionary } from "@/i18n/market/billing-fr";

export interface BillingValues {
  readonly legalName: string;
  readonly siret: string | null;
  readonly vatNumber: string | null;
  readonly address: Address | null;
  readonly vatRateBp: number;
}

interface BillingFormProps {
  readonly lang: Lang;
  readonly b: BillingDictionary;
  readonly action: (formData: FormData) => Promise<void>;
  readonly values: BillingValues | null;
  /** Freelancers choose their VAT rate and give the invoicing mandate; a company does neither. */
  readonly freelance: boolean;
  readonly mandateAt: string | null;
}

const RATES = ["0", "2000", "1000", "550", "210"] as const;

/** One form for both sides: the fields a French invoice requires, nothing more. */
export function BillingForm({ lang, b, action, values, freelance, mandateAt }: BillingFormProps) {
  const a = values?.address;
  return (
    <form action={action} className="panel">
      <input type="hidden" name="lang" value={lang} />
      <div className="panel-grid">
        <div className="field">
          <label htmlFor="legalName">{b.legalName}</label>
          <input id="legalName" name="legalName" type="text" required minLength={2} maxLength={200} autoComplete="organization" defaultValue={values?.legalName ?? ""} aria-describedby="legalName-hint" />
          {freelance ? <p id="legalName-hint" className="field-hint">{b.legalNameHint}</p> : null}
        </div>
        <div className="field">
          <label htmlFor="siret">{b.siret}</label>
          <input id="siret" name="siret" type="text" inputMode="numeric" maxLength={17} defaultValue={values?.siret ?? ""} aria-describedby="siret-hint" />
          <p id="siret-hint" className="field-hint">{b.siretHint}</p>
        </div>
        <div className="field">
          <label htmlFor="vatNumber">{b.vatNumber}</label>
          <input id="vatNumber" name="vatNumber" type="text" maxLength={20} autoCapitalize="characters" defaultValue={values?.vatNumber ?? ""} aria-describedby="vat-hint" />
          {freelance ? <p id="vat-hint" className="field-hint">{b.vatNumberHint}</p> : null}
        </div>
        {freelance ? (
          <div className="field">
            <label htmlFor="vatRateBp">{b.vatRate}</label>
            <select id="vatRateBp" name="vatRateBp" defaultValue={String(values?.vatRateBp ?? 0)}>
              {RATES.map((rate) => (
                <option key={rate} value={rate}>
                  {b.vatRates[rate]}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
      <fieldset className="panel-grid fieldset">
        <legend>{b.address}</legend>
        <div className="field">
          <label htmlFor="line1">{b.line1}</label>
          <input id="line1" name="line1" type="text" required maxLength={200} autoComplete="address-line1" defaultValue={a?.line1 ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="line2">{b.line2}</label>
          <input id="line2" name="line2" type="text" maxLength={200} autoComplete="address-line2" defaultValue={a?.line2 ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="postalCode">{b.postalCode}</label>
          <input id="postalCode" name="postalCode" type="text" required maxLength={12} autoComplete="postal-code" defaultValue={a?.postalCode ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="city">{b.city}</label>
          <input id="city" name="city" type="text" required maxLength={120} autoComplete="address-level2" defaultValue={a?.city ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="country">{b.country}</label>
          <input id="country" name="country" type="text" required minLength={2} maxLength={2} autoComplete="country" autoCapitalize="characters" defaultValue={a?.country ?? "FR"} />
        </div>
      </fieldset>
      {freelance ? (
        mandateAt === null ? (
          <div className="field field-inline">
            <input id="acceptInvoicingMandate" name="acceptInvoicingMandate" type="checkbox" aria-describedby="mandate-hint" />
            <label htmlFor="acceptInvoicingMandate">{b.mandate}</label>
            <p id="mandate-hint" className="field-hint">{b.mandateHint}</p>
          </div>
        ) : (
          <p className="muted small">
            {b.mandateSince} {mandateAt}
          </p>
        )
      ) : null}
      <button type="submit" className="btn btn-primary">
        {b.save}
      </button>
    </form>
  );
}
