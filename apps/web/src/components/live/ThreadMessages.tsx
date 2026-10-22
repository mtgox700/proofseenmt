"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { subscribeLive } from "./live-stream";
import { messageTime } from "./message-time";

/*
 * The messages of one thread. Rendered on the server like any page (it works without JavaScript); in the browser it
 * also listens to the live stream: a new message in this thread is fetched through the usual access-controlled route
 * and appended, the thread is marked read when the tab is visible, and « Read » appears under the last own message as
 * soon as the other side has read it. The send form stays a plain server action.
 */

export interface ThreadAttachmentView {
  readonly id: string;
  readonly image: boolean;
}

export interface ThreadMessageView {
  readonly id: string;
  readonly mine: boolean;
  readonly body: string;
  /** ISO instant, for ordering and read receipts. */
  readonly createdAt: string;
  /** The same instant, formatted for display. */
  readonly at: string;
  readonly flagged: boolean;
  readonly attachments: readonly ThreadAttachmentView[];
}

export interface ThreadLabels {
  readonly you: string;
  readonly counterpart: string;
  readonly flagged: string;
  readonly read: string;
  /** « Pièce jointe {n} (PDF) »: `{n}` is replaced by the position. */
  readonly pdf: string;
  readonly image: string;
}

interface ThreadMessagesProps {
  readonly conversationId: string;
  readonly selfId: string;
  readonly lang: "fr" | "en";
  /** Only the latest page listens; an older page of the history stays still. */
  readonly live: boolean;
  readonly initial: readonly ThreadMessageView[];
  readonly otherReadAt: string | null;
  readonly labels: ThreadLabels;
}

const ApiPage = z.object({
  ok: z.literal(true),
  data: z.object({
    items: z.array(
      z.object({
        id: z.string(),
        senderUserId: z.string().nullable(),
        body: z.string(),
        containsContact: z.boolean(),
        createdAt: z.string(),
        attachments: z.array(z.object({ id: z.string(), contentType: z.string() })),
      }),
    ),
  }),
});

const byTime = (a: ThreadMessageView, b: ThreadMessageView): number => Date.parse(a.createdAt) - Date.parse(b.createdAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const merge = (...lists: (readonly ThreadMessageView[])[]): ThreadMessageView[] => {
  const byId = new Map<string, ThreadMessageView>();
  for (const list of lists) for (const message of list) byId.set(message.id, message);
  return [...byId.values()].sort(byTime);
};

const later = (current: string | null, candidate: string | null): string | null => {
  if (candidate === null) return current;
  if (current === null) return candidate;
  return Date.parse(candidate) > Date.parse(current) ? candidate : current;
};

const label = (template: string, n: number): string => template.replace("{n}", String(n));

export function ThreadMessages({ conversationId, selfId, lang, live, initial, otherReadAt, labels }: ThreadMessagesProps) {
  const [arrived, setArrived] = useState<readonly ThreadMessageView[]>([]);
  const [otherRead, setOtherRead] = useState<string | null>(otherReadAt);
  const readPending = useRef(false);
  const messages = useMemo(() => merge(initial, arrived), [initial, arrived]);
  // Served with the page: these do not move. Only a message that arrives while the thread is open settles in.
  const served = useMemo(() => new Set(initial.map((message) => message.id)), [initial]);

  useEffect(() => setOtherRead((current) => later(current, otherReadAt)), [otherReadAt]);

  const fetchLatest = useCallback(async () => {
    try {
      const response = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/messages`, { cache: "no-store", headers: { accept: "application/json" } });
      if (!response.ok) return;
      const page = ApiPage.safeParse(await response.json());
      if (!page.success) return;
      const views = page.data.data.items.map(
        (item): ThreadMessageView => ({
          id: item.id,
          mine: item.senderUserId === selfId,
          body: item.body,
          createdAt: item.createdAt,
          at: messageTime(new Date(item.createdAt), lang),
          flagged: item.containsContact,
          attachments: item.attachments.map((a) => ({ id: a.id, image: a.contentType !== "application/pdf" })),
        }),
      );
      setArrived((current) => merge(current, views));
    } catch {
      // Offline or signed out: the next event, or a reload, catches up.
    }
  }, [conversationId, selfId, lang]);

  const markRead = useCallback(() => {
    if (document.visibilityState !== "visible") {
      readPending.current = true;
      return;
    }
    readPending.current = false;
    void fetch(`/api/conversations/${encodeURIComponent(conversationId)}/read`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).catch(() => undefined);
  }, [conversationId]);

  useEffect(() => {
    if (!live) return;
    const unsubscribe = subscribeLive((event) => {
      if (event.type === "resync") {
        void fetchLatest();
      } else if (event.type === "message" && event.conversationId === conversationId) {
        void fetchLatest();
        if (!event.mine) markRead();
      } else if (event.type === "read" && event.conversationId === conversationId) {
        setOtherRead((current) => later(current, event.readAt));
      }
    });
    const onVisible = (): void => {
      if (document.visibilityState === "visible" && readPending.current) markRead();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [live, conversationId, fetchLatest, markRead]);

  const lastOwn = [...messages].reverse().find((message) => message.mine);
  const readMarker = lastOwn !== undefined && otherRead !== null && Date.parse(otherRead) >= Date.parse(lastOwn.createdAt) ? lastOwn.id : null;

  return (
    <ol className="bubbles" aria-live={live ? "polite" : undefined} aria-relevant={live ? "additions" : undefined}>
      {messages.map((message) => (
        <li key={message.id} data-from={message.mine ? "mine" : "other"} data-mine={message.mine || undefined} data-new={served.has(message.id) ? undefined : ""}>
          <span className="bubble-who small">{message.mine ? labels.you : labels.counterpart}</span>
          <p className="bubble-body">{message.body}</p>
          {message.attachments.length === 0 ? null : (
            <div className="bubble-files">
              {message.attachments.map((attachment, index) => {
                const name = label(attachment.image ? labels.image : labels.pdf, index + 1);
                return attachment.image ? (
                  <a key={attachment.id} href={`/fichiers/${attachment.id}`} target="_blank" rel="noopener noreferrer" className="bubble-file">
                    <img src={`/fichiers/${attachment.id}`} alt={name} loading="lazy" decoding="async" />
                    <span className="small">{name}</span>
                  </a>
                ) : (
                  <a key={attachment.id} href={`/fichiers/${attachment.id}`} download className="bubble-file small">
                    {name}
                  </a>
                );
              })}
            </div>
          )}
          {message.flagged ? <span className="tag tag-quiet small">{labels.flagged}</span> : null}
          <time className="bubble-at small muted" dateTime={message.createdAt}>
            {message.at}
          </time>
          {message.id === readMarker ? <span className="bubble-read small muted">{labels.read}</span> : null}
        </li>
      ))}
    </ol>
  );
}
