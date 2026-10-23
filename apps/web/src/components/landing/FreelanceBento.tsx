import type { HomeCopy } from "@/content/home";
import type { Lang } from "@/i18n";
import { Photo } from "./Photo";

/*
 * S3, the freelancer's side, shown by the interface rather than described. Magic UI's "Bento Grid" (twelve columns,
 * tiles of different sizes) with its "Magic Card" (the edge lit where the pointer is, one delegated listener in
 * LandingFx). Each tile carries one micro-gesture that plays once, when it is 60 % on screen (`data-play-at`): the
 * profile's sections settle one by one, the day is ticked, the application moves from sent to read, the messages
 * arrive, the notice drops. Without JavaScript or under reduced motion, every tile is in its final state.
 */

function Tile({ id, className, children }: { readonly id: string; readonly className: string; readonly children: React.ReactNode }) {
  return (
    <article className={`tile ${className}`} aria-labelledby={id} data-spot="" data-play-at="">
      {children}
    </article>
  );
}

function Caption({ id, title, text }: { readonly id: string; readonly title: string; readonly text: string }) {
  return (
    <p className="tile-text">
      <strong id={id}>{title}</strong> {text}
    </p>
  );
}

export function FreelanceBento({ lang, copy }: { readonly lang: Lang; readonly copy: HomeCopy["freelance"] }) {
  const { profile, photo, availability, matches, application, mobile, messages } = copy;
  return (
    <section className="section bento-section" id="freelances" aria-labelledby="freelance-title">
      <div className="wrap">
        <header className="section-head reveal">
          <p className="kicker">{copy.kicker}</p>
          <h2 id="freelance-title">{copy.title}</h2>
          <p className="section-lead pretty">{copy.lead}</p>
          <a className="text-link" href={`/${lang}/creer-un-compte`}>
            {copy.link}
          </a>
        </header>

        <div className="bento bento-freelance">
          <Tile id="fb-profile" className="t-profile">
            <div className="mock mock-profile" aria-hidden="true">
              <div className="mock-id">
                <span className="mock-avatar" />
                <span className="mock-lines">
                  <span />
                  <span />
                </span>
              </div>
              <ul>
                {profile.sections.map((section, i) => (
                  <li key={section} style={{ "--i": i } as React.CSSProperties}>
                    <span className="mock-key">{section}</span>
                    <span className="mock-bar" />
                  </li>
                ))}
              </ul>
            </div>
            <Caption id="fb-profile" title={profile.title} text={profile.text} />
          </Tile>

          <Tile id="fb-photo" className="t-photo">
            <Photo name="developer-woman-office" alt={photo.alt} sizes="(min-width: 64rem) 480px, 100vw" className="tile-photo" />
            <Caption id="fb-photo" title={photo.title} text={photo.text} />
          </Tile>

          <Tile id="fb-availability" className="t-availability">
            <div className="mock mock-days" aria-hidden="true">
              {[14, 15, 16, 17, 18, 19, 20].map((day) => (
                <span key={day} className={day === 18 ? "is-today" : undefined}>
                  {day}
                </span>
              ))}
            </div>
            <p className="pill">{availability.pill}</p>
            <Caption id="fb-availability" title={availability.title} text={availability.text} />
          </Tile>

          <Tile id="fb-matches" className="t-matches">
            <div className="mock mock-mission" aria-hidden="true">
              <span className="mock-title">{matches.mission}</span>
              <span className="mock-reason">{matches.reason}</span>
            </div>
            <Caption id="fb-matches" title={matches.title} text={matches.text} />
          </Tile>

          <Tile id="fb-application" className="t-application">
            <ol className="mock mock-steps" aria-hidden="true">
              {application.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <Caption id="fb-application" title={application.title} text={application.text} />
          </Tile>

          <Tile id="fb-mobile" className="t-mobile">
            <div className="phone" aria-hidden="true">
              <span className="phone-notch" />
              <span className="phone-notice">
                <b>{mobile.notice}</b>
                <small>{mobile.from}</small>
              </span>
              <span className="phone-lines">
                <span />
                <span />
                <span />
              </span>
            </div>
            <Caption id="fb-mobile" title={mobile.title} text={mobile.text} />
          </Tile>

          <Tile id="fb-messages" className="t-messages">
            <div className="mock mock-thread" aria-hidden="true">
              <span className="bubble bubble-in">{messages.bubbles[0]}</span>
              <span className="bubble bubble-out">{messages.bubbles[1]}</span>
              <span className="bubble-file">{messages.file}</span>
              <span className="bubble-read">{messages.read}</span>
            </div>
            <Caption id="fb-messages" title={messages.title} text={messages.text} />
          </Tile>
        </div>
        <p className="bento-note">{copy.sample}</p>
      </div>
    </section>
  );
}
