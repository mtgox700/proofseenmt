import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { getSource } from "@/data/file-source";
import { getMessageStore } from "@/data/message-store";
import { viewerOf } from "@/data/viewer";
import { dictionary, isLang } from "@/i18n";
import { date } from "@/lib/format";
import { canView } from "@/lib/messaging";
import { requirePerson } from "@/lib/session";

/** Depends on who is signed in (and on whether sign-in is configured): rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
}

/** Every thread the person may see, newest first. A company sees the pseudonym, never the person behind it. */
export default async function MessagesPage({ params }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = dictionary(lang);
  const m = t.messages;
  const person = await requirePerson(lang);
  if (person === null) return null;
  const viewer = await viewerOf(person);
  if (viewer === null) return null;
  const [threads, { profiles }] = await Promise.all([getMessageStore().list(), getSource().profiles()]);
  const handles = new Map(profiles.map((profile) => [profile.id, profile.handle]));
  const visible = threads.filter((thread) => canView(viewer, thread));

  return (
    <>
      <header className="app-head">
        <h1>{m.title}</h1>
        <p className="muted measure">{m.lead}</p>
      </header>
      {visible.length === 0 ? (
        <EmptyState title={m.empty} headingLevel={2}>
          <p>{person.role === "company" ? m.emptyCompany : m.emptyFreelance}</p>
          {person.role === "company" ? (
            <p className="empty-actions">
              <Link className="btn btn-primary" href={`/${lang}/entreprise`}>
                {t.app.company.search}
              </Link>
            </p>
          ) : null}
        </EmptyState>
      ) : (
        <ul className="threads">
          {visible.map((thread) => {
            const last = thread.messages.at(-1);
            const counterpart = person.role === "company" ? (handles.get(thread.profileId) ?? thread.profileId) : thread.company.name;
            return (
              <li key={thread.id}>
                <Link href={`/${lang}/app/messages/${thread.id}`} className="thread-row">
                  <span className="thread-who">
                    <strong>{counterpart}</strong>
                    {person.role === "operator" ? <span className="muted small"> → {handles.get(thread.profileId) ?? thread.profileId}</span> : null}
                  </span>
                  <span className={thread.status === "accepted" ? "tag tag-proof" : thread.status === "declined" ? "tag tag-quiet" : "tag tag-signal"}>{m.status[thread.status]}</span>
                  <span className="thread-last muted">{last?.body}</span>
                  <span className="thread-date muted small">{date(thread.updatedAt, lang)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
