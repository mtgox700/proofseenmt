import { draftItemKey, type CvDraft, type DraftSection, type StoredFileRecord } from "@proofseen/db";
import { languageName } from "@proofseen/hub";
import { removeCv, uploadCv } from "@/app/[lang]/app/profil/file-actions";
import { acceptDraftItem, discardDraft, dismissDraftItem, importFromCv } from "@/app/[lang]/app/profil/import-actions";
import type { Lang } from "@/i18n";
import type { ProfileSectionsDictionary } from "@/i18n/market/profile-sections-fr";
import { day } from "@/lib/format";
import { SectionShell, type SectionProps } from "./SectionShell";

/** One proposed item, with the two choices: add it to the profile, or ignore it. */
function DraftItem({ lang, s, section, index, item, label, detail }: { readonly lang: Lang; readonly s: ProfileSectionsDictionary; readonly section: DraftSection; readonly index: number; readonly item: unknown; readonly label: string; readonly detail: string }) {
  const hidden = (
    <>
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="section" value={section} />
      <input type="hidden" name="index" value={index} />
      <input type="hidden" name="key" value={draftItemKey(item)} />
    </>
  );
  return (
    <li className="section-item">
      <div className="section-item-head">
        <strong>{label}</strong>
        <span className="muted small">{detail}</span>
      </div>
      <div className="row-actions">
        {section === "skills" ? null : (
          <form action={acceptDraftItem}>
            {hidden}
            <button type="submit" className="btn">
              {s.draft.accept}
            </button>
          </form>
        )}
        <form action={dismissDraftItem}>
          {hidden}
          <button type="submit" className="btn btn-quiet">
            {s.draft.dismiss}
          </button>
        </form>
      </div>
    </li>
  );
}

const join = (parts: readonly (string | number | null)[]): string => parts.filter((p) => p !== null && p !== "").join(" · ");

/** The fields proposed from the CV, grouped by section, each accepted or ignored one by one. */
function DraftReview({ lang, s, draft }: { readonly lang: Lang; readonly s: ProfileSectionsDictionary; readonly draft: CvDraft }) {
  const d = s.draft;
  const groups: readonly { readonly section: DraftSection; readonly items: readonly { readonly item: unknown; readonly label: string; readonly detail: string }[] }[] = [
    { section: "experiences", items: draft.experiences.map((e) => ({ item: e, label: e.title, detail: join([e.company, `${e.startMonth} – ${e.endMonth ?? s.experiences.ongoing}`]) })) },
    { section: "educations", items: draft.educations.map((e) => ({ item: e, label: e.school, detail: join([e.degree, e.startYear, e.endYear]) })) },
    { section: "certifications", items: draft.certifications.map((c) => ({ item: c, label: c.name, detail: join([c.issuer, c.year]) })) },
    { section: "languages", items: draft.languages.map((l) => ({ item: l, label: languageName(l.code, lang), detail: s.languages.levels[l.level] })) },
    { section: "skills", items: draft.skills.map((skill) => ({ item: skill, label: skill, detail: "" })) },
  ];
  return (
    <div className="draft-group" aria-labelledby="draft-title">
      <h3 id="draft-title">{d.title}</h3>
      <p className="muted measure">{d.lead}</p>
      {groups
        .filter((g) => g.items.length > 0)
        .map((g) => (
          <div key={g.section} className="draft-group">
            <h3>{d.sections[g.section]}</h3>
            <ul className="section-items">
              {g.items.map((entry, index) => (
                <DraftItem key={`${g.section}-${index}`} lang={lang} s={s} section={g.section} index={index} item={entry.item} label={entry.label} detail={entry.detail} />
              ))}
            </ul>
            {g.section !== "skills" ? null : (
              <form action={acceptDraftItem}>
                <input type="hidden" name="lang" value={lang} />
                <input type="hidden" name="section" value="skills" />
                <button type="submit" className="btn">
                  {d.acceptSkills}
                </button>
              </form>
            )}
          </div>
        ))}
      <form action={discardDraft}>
        <input type="hidden" name="lang" value={lang} />
        <button type="submit" className="btn btn-quiet">
          {d.discard}
        </button>
      </form>
    </div>
  );
}

/** The private CV: upload, download, delete; and, when a model is configured, the import into a draft. */
export function CvSection({ lang, s, notice, cv, draft, importAvailable }: SectionProps & { readonly cv: StoredFileRecord | null; readonly draft: CvDraft | null; readonly importAvailable: boolean }) {
  const c = s.cv;
  return (
    <SectionShell anchor="cv" title={c.title} lead={c.lead} s={s} notice={notice}>
      {cv === null ? (
        <p className="muted">{c.none}</p>
      ) : (
        <div className="row-actions">
          <span>{c.current(day(cv.createdAt, lang))}</span>
          <a className="btn" href={`/fichiers/${cv.id}`} download>
            {c.download}
          </a>
          <form action={removeCv}>
            <input type="hidden" name="lang" value={lang} />
            <button type="submit" className="btn btn-quiet" aria-describedby="cv-remove-hint">
              {c.remove}
            </button>
          </form>
          <p id="cv-remove-hint" className="muted small">
            {c.removeHint}
          </p>
        </div>
      )}
      <form action={uploadCv} className="panel-grid">
        <input type="hidden" name="lang" value={lang} />
        <div className="field">
          <label htmlFor="cv-file">{c.file}</label>
          <input id="cv-file" name="cv" type="file" accept="application/pdf" required />
        </div>
        <button type="submit" className="btn">
          {c.upload}
        </button>
      </form>
      {cv === null || !importAvailable ? null : (
        <form action={importFromCv} className="field">
          <input type="hidden" name="lang" value={lang} />
          <p className="field-hint" id="import-hint">
            {c.importHint}
          </p>
          <button type="submit" className="btn btn-primary" aria-describedby="import-hint">
            {c.import}
          </button>
        </form>
      )}
      {draft === null ? null : <DraftReview lang={lang} s={s} draft={draft} />}
    </SectionShell>
  );
}
