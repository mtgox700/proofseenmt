import Link from "next/link";
import { notFound } from "next/navigation";
import { getClientSource } from "@/data/client-source";
import { getSource } from "@/data/file-source";
import { getMessageStore } from "@/data/message-store";
import { viewerOf } from "@/data/viewer";
import { dictionary, isLang } from "@/i18n";
import { date } from "@/lib/format";
import { canAnswer, canDecide, canView, MAX_BODY } from "@/lib/messaging";
import { requirePerson } from "@/lib/session";
import { answerThread, decideThread } from "../actions";

/** Depends on who is signed in (and on whether sign-in is configured): rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string; id: string }>;
  readonly searchParams: Promise<{ erreur?: string }>;
}

/*
 * One thread. The freelancer's real name reaches the company only once the freelancer has accepted; before that the
 * company sees the pseudonym. A thread the person may not see answers 404, not « forbidden »: its existence is private.
 */
export default async function ThreadPage({ params, searchParams }: PageProps) {
  const { lang, id } = await params;
  if (!isLang(lang)) notFound();
  const t = dictionary(lang);
  const m = t.messages;
  const person = await requirePerson(lang);
  if (person === null) return null;
  const viewer = await viewerOf(person);
  const thread = await getMessageStore().get(id);
  if (viewer === null || thread === null || !canView(viewer, thread)) notFound();

  const { profiles } = await getSource().profiles();
  const handle = profiles.find((profile) => profile.id === thread.profileId)?.handle ?? thread.profileId;
  const revealed = thread.status === "accepted" || person.role === "operator";
  const realName = revealed ? ((await getClientSource().view(thread.profileId))?.displayName ?? null) : null;
  const error = (await searchParams).erreur;

  const sideLabel = (from: "company" | "freelance" | "operator"): string =>
    from === "operator" ? "Proofseen" : from === "company" ? thread.company.name : realName === null ? handle : `${realName} (${handle})`;

  return (
    <>
      <p>
        <Link href={`/${lang}/app/messages`}>{m.back}</Link>
      </p>
      <header className="app-head">
        <h1>{person.role === "company" ? (realName ?? handle) : thread.company.name}</h1>
        <p className="thread-meta">
          <span className={thread.status === "accepted" ? "tag tag-proof" : thread.status === "declined" ? "tag tag-quiet" : "tag tag-signal"}>{m.status[thread.status]}</span>
          <span className="muted small">
            {m.about} {handle} · {m.opened} {date(thread.createdAt, lang)}
          </span>
        </p>
        {person.role === "company" && thread.status === "pending" ? <p className="muted measure">{m.pendingCompany}</p> : null}
      </header>

      <ol className="bubbles">
        {thread.messages.map((message) => (
          <li key={message.id} data-from={message.from} data-mine={message.authorId === person.id || undefined}>
            <span className="bubble-who small">{sideLabel(message.from)}</span>
            <p className="bubble-body">{message.body}</p>
            <time className="bubble-at small muted" dateTime={message.at}>
              {date(message.at, lang)}
            </time>
          </li>
        ))}
      </ol>

      {error === undefined ? null : (
        <p className="form-error" role="alert">
          {error === "trop" ? m.tooMany : m.invalid}
        </p>
      )}

      {canDecide(viewer, thread) ? (
        <form action={decideThread} className="decision">
          <input type="hidden" name="lang" value={lang} />
          <input type="hidden" name="threadId" value={thread.id} />
          <p className="measure">{m.decideLead}</p>
          <div className="empty-actions">
            <button type="submit" name="decision" value="accepted" className="btn btn-primary">
              {m.accept}
            </button>
            <button type="submit" name="decision" value="declined" className="btn">
              {m.decline}
            </button>
          </div>
        </form>
      ) : null}

      {canAnswer(viewer, thread) ? (
        <form action={answerThread} className="reply">
          <input type="hidden" name="lang" value={lang} />
          <input type="hidden" name="threadId" value={thread.id} />
          <div className="field">
            <label htmlFor="body">{person.role === "operator" ? m.replyAsProofseen : m.reply}</label>
            <textarea id="body" name="body" required maxLength={MAX_BODY} rows={4} />
          </div>
          <button type="submit" className="btn btn-primary">
            {m.send}
          </button>
        </form>
      ) : thread.status === "declined" ? (
        <p className="muted">{m.declinedNote}</p>
      ) : null}
    </>
  );
}
