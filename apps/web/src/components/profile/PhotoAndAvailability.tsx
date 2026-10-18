import { isAvailabilityFresh } from "@proofseen/db";
import { removePhoto, uploadPhoto } from "@/app/[lang]/app/profil/file-actions";
import { confirmAvailability, declareUnavailable } from "@/app/[lang]/app/profil/section-actions";
import { day } from "@/lib/format";
import { SectionShell, type SectionProps } from "./SectionShell";

/** The profile photo: optional, shown publicly only on a profile published under the person's name. */
export function PhotoSection({ lang, s, notice, photoFileId }: SectionProps & { readonly photoFileId: string | null }) {
  const p = s.photo;
  return (
    <SectionShell anchor="photo" title={p.title} lead={p.lead} s={s} notice={notice}>
      <div className="profile-photo-row">
        {photoFileId === null ? (
          <p className="muted">{p.none}</p>
        ) : (
          <img className="profile-photo" src={`/fichiers/${photoFileId}`} alt={p.alt} width={96} height={96} />
        )}
        {photoFileId === null ? null : (
          <form action={removePhoto}>
            <input type="hidden" name="lang" value={lang} />
            <button type="submit" className="btn btn-quiet">
              {p.remove}
            </button>
          </form>
        )}
      </div>
      <form action={uploadPhoto} className="panel-grid">
        <input type="hidden" name="lang" value={lang} />
        <div className="field">
          <label htmlFor="photo-file">{p.file}</label>
          <input id="photo-file" name="photo" type="file" accept="image/jpeg,image/png,image/webp" required aria-describedby="photo-hint" />
          <p id="photo-hint" className="field-hint">
            {p.hint}
          </p>
        </div>
        <button type="submit" className="btn">
          {p.upload}
        </button>
      </form>
    </SectionShell>
  );
}

/** When the person last declared or confirmed their availability, and the button to confirm it again. */
export function AvailabilitySection({ lang, s, notice, confirmedAt, now }: SectionProps & { readonly confirmedAt: Date; readonly now: Date }) {
  const a = s.availability;
  const stale = !isAvailabilityFresh(confirmedAt, now);
  return (
    <SectionShell anchor="disponibilite" title={a.title} lead={a.lead} s={s} notice={notice}>
      <p>
        <strong>{a.confirmedOn(day(confirmedAt, lang))}</strong>
      </p>
      {stale ? (
        <p className="form-error">
          {a.staleNote}
        </p>
      ) : null}
      <div className="empty-actions">
        <form action={confirmAvailability}>
          <input type="hidden" name="lang" value={lang} />
          <button type="submit" className="btn btn-primary">
            {a.confirm}
          </button>
        </form>
        <form action={declareUnavailable}>
          <input type="hidden" name="lang" value={lang} />
          <button type="submit" className="btn">
            {a.notAvailable}
          </button>
        </form>
      </div>
    </SectionShell>
  );
}
