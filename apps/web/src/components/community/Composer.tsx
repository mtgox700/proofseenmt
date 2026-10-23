import { createPost } from "@/app/[lang]/app/fil/actions";
import type { ChosenSpeaker } from "@/data/community";
import type { Lang } from "@/i18n";
import type { CommunityDictionary } from "@/i18n/market/community-fr";

interface ComposerProps {
  readonly lang: Lang;
  readonly c: CommunityDictionary;
  readonly speaker: ChosenSpeaker | null;
  readonly role: "freelance" | "company";
  readonly back: string;
}

/** The post form: text, optional link, optional image, who may read it. A plain multipart form, sent without JavaScript. */
export function Composer({ lang, c, speaker, role, back }: ComposerProps) {
  if (speaker === null) {
    return (
      <div className="panel stack">
        <p className="muted">{role === "freelance" ? c.composer.needProfile : c.composer.needCompany}</p>
        <p>
          <a className="btn" href={`/${lang}/app/${role === "freelance" ? "profil" : "equipe"}`}>
            {role === "freelance" ? c.composer.toProfile : c.composer.toCompany}
          </a>
        </p>
      </div>
    );
  }
  return (
    <form action={createPost} className="panel stack composer" aria-labelledby="composer-title">
      <h2 id="composer-title">{c.composer.title}</h2>
      <p className="muted small">{speaker.kind === "profile" ? c.composer.asProfile(speaker.name) : c.composer.asCompany(speaker.name)}</p>
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="back" value={back} />
      <div className="field">
        <label htmlFor="post-body">{c.composer.body}</label>
        <textarea id="post-body" name="body" rows={5} maxLength={3000} required aria-describedby="post-body-hint" />
        <p id="post-body-hint" className="field-hint">
          {c.composer.bodyHint}
        </p>
      </div>
      <div className="field">
        <label htmlFor="post-link">{c.composer.link}</label>
        <input id="post-link" name="linkUrl" type="url" inputMode="url" maxLength={500} placeholder="https://" aria-describedby="post-link-hint" />
        <p id="post-link-hint" className="field-hint">
          {c.composer.linkHint}
        </p>
      </div>
      {speaker.mayShowImage ? (
        <div className="field">
          <label htmlFor="post-image">{c.composer.image}</label>
          <input id="post-image" name="image" type="file" accept="image/png,image/jpeg,image/webp" aria-describedby="post-image-hint" />
          <p id="post-image-hint" className="field-hint">
            {c.composer.imageHint}
          </p>
        </div>
      ) : null}
      <fieldset className="field">
        <legend>{c.composer.visibility}</legend>
        <label>
          <input type="radio" name="visibility" value="public" defaultChecked /> {c.composer.public}
        </label>
        <label>
          <input type="radio" name="visibility" value="members" /> {c.composer.members}
        </label>
      </fieldset>
      <button type="submit" className="btn btn-primary">
        {c.composer.submit}
      </button>
    </form>
  );
}
