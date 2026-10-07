import Link from "next/link";
import type { MissionRecord } from "@proofseen/db";
import type { Lang } from "@/i18n";
import type { MissionsDictionary } from "@/i18n/market/missions-fr";
import { centsToField } from "@/lib/mission-form";

interface MissionFormProps {
  readonly lang: Lang;
  readonly m: MissionsDictionary;
  readonly action: (formData: FormData) => Promise<void>;
  /** The mission being edited; absent for a new one. */
  readonly mission?: MissionRecord;
  readonly error: string | null;
  readonly cancelHref: string;
}

const MODES = ["remote", "hybrid", "onsite"] as const;

/** Create and edit share one form: same fields, same hints, so a mission reads the same before and after. */
export function MissionForm({ lang, m, action, mission, error, cancelHref }: MissionFormProps) {
  const f = m.form;
  return (
    <form action={action} className="panel">
      <input type="hidden" name="lang" value={lang} />
      {mission === undefined ? null : <input type="hidden" name="missionId" value={mission.id} />}
      {error === null ? null : (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="field">
        <label htmlFor="title">{f.title}</label>
        <input id="title" name="title" type="text" required maxLength={200} defaultValue={mission?.title} aria-describedby="title-hint" />
        <p id="title-hint" className="field-hint">{f.titleHint}</p>
      </div>
      <div className="field">
        <label htmlFor="description">{f.description}</label>
        <textarea id="description" name="description" required maxLength={20_000} rows={10} defaultValue={mission?.description} aria-describedby="description-hint" />
        <p id="description-hint" className="field-hint">{f.descriptionHint}</p>
      </div>
      <div className="field">
        <label htmlFor="skills">{f.skills}</label>
        <input id="skills" name="skills" type="text" maxLength={2000} defaultValue={mission?.skills.join(", ")} aria-describedby="skills-hint" />
        <p id="skills-hint" className="field-hint">{f.skillsHint}</p>
      </div>
      <div className="panel-grid">
        <div className="field">
          <label htmlFor="workMode">{f.workMode}</label>
          <select id="workMode" name="workMode" required defaultValue={mission?.workMode ?? "remote"}>
            {MODES.map((mode) => (
              <option key={mode} value={mode}>
                {m.workModes[mode]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="city">{f.city}</label>
          <input id="city" name="city" type="text" maxLength={120} autoComplete="address-level2" defaultValue={mission?.city ?? ""} aria-describedby="city-hint" />
          <p id="city-hint" className="field-hint">{f.cityHint}</p>
        </div>
        <div className="field">
          <label htmlFor="durationMonths">{f.duration}</label>
          <input id="durationMonths" name="durationMonths" type="number" min={1} max={600} step={1} inputMode="numeric" defaultValue={mission?.durationMonths ?? ""} />
        </div>
      </div>
      <div className="panel-grid">
        <div className="field">
          <label htmlFor="rateMin">{f.rateMin}</label>
          <input id="rateMin" name="rateMin" type="text" inputMode="decimal" maxLength={12} defaultValue={centsToField(mission?.dailyRateMinCents ?? null)} aria-describedby="rate-hint" />
        </div>
        <div className="field">
          <label htmlFor="rateMax">{f.rateMax}</label>
          <input id="rateMax" name="rateMax" type="text" inputMode="decimal" maxLength={12} defaultValue={centsToField(mission?.dailyRateMaxCents ?? null)} aria-describedby="rate-hint" />
        </div>
      </div>
      <p id="rate-hint" className="field-hint">{f.rateHint}</p>
      <div className="empty-actions">
        <button type="submit" className="btn btn-primary">
          {mission === undefined ? f.save : f.update}
        </button>
        <Link className="btn" href={cancelHref}>
          {f.cancel}
        </Link>
      </div>
    </form>
  );
}
