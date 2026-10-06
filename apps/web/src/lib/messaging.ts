import { z } from "zod";
import type { Role } from "./roles";

/*
 * Messaging through Proofseen (PIVOT_ANONYME: contact always goes through the platform). The rules live here, pure and
 * tested, so every server action applies the same ones:
 *  - only a company opens a thread, about one published profile;
 *  - the freelancer of that profile accepts or declines; until they accept, the company cannot write again and does
 *    not learn who they are (identity shared after agreement, before any commitment: art. 1112-1 C. civ.);
 *  - nobody reads a thread that is not theirs; the operator reads all and can write as Proofseen.
 * Functions never mutate a thread: they return a new one.
 */

export const MAX_BODY = 2000;
const REFERENCE = /^[A-Z]{2}-[A-Z0-9]{5}$/;

export const ThreadInputSchema = z.object({
  profileId: z.string().regex(REFERENCE),
  body: z.string().trim().min(1).max(MAX_BODY),
});

export const ReplyInputSchema = z.object({ body: z.string().trim().min(1).max(MAX_BODY) });

const MessageSchema = z.object({
  id: z.string(),
  from: z.enum(["company", "freelance", "operator"]),
  authorId: z.string(),
  body: z.string().max(MAX_BODY),
  at: z.string(),
});

export const ThreadSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9-]{1,64}$/),
  profileId: z.string().regex(REFERENCE),
  company: z.object({ userId: z.string(), name: z.string().max(200), email: z.string().max(320) }),
  status: z.enum(["pending", "accepted", "declined"]),
  createdAt: z.string(),
  updatedAt: z.string(),
  messages: z.array(MessageSchema).min(1),
});

export type Thread = z.infer<typeof ThreadSchema>;
export type ThreadMessage = Thread["messages"][number];

/** Who is looking, as the server established it. `reference` is the freelancer's own file, `null` otherwise. */
export interface Viewer {
  readonly id: string;
  readonly role: Role;
  readonly reference: string | null;
}

const ownsProfile = (viewer: Viewer, thread: Thread): boolean => viewer.role === "freelance" && viewer.reference === thread.profileId;
const opened = (viewer: Viewer, thread: Thread): boolean => viewer.role === "company" && viewer.id === thread.company.userId;

export const canView = (viewer: Viewer, thread: Thread): boolean => viewer.role === "operator" || opened(viewer, thread) || ownsProfile(viewer, thread);

export const canDecide = (viewer: Viewer, thread: Thread): boolean => thread.status === "pending" && ownsProfile(viewer, thread);

export const canAnswer = (viewer: Viewer, thread: Thread): boolean => {
  if (viewer.role === "operator") return true;
  if (thread.status === "declined") return false;
  if (ownsProfile(viewer, thread)) return true;
  return opened(viewer, thread) && thread.status === "accepted";
};

const sideOf = (viewer: Viewer): ThreadMessage["from"] => (viewer.role === "operator" ? "operator" : viewer.role === "company" ? "company" : "freelance");

const messageId = (thread: Thread, at: Date): string => `${thread.id}-${thread.messages.length + 1}-${at.getTime()}`;

export const newThread = (input: {
  readonly id: string;
  readonly profileId: string;
  readonly company: Thread["company"];
  readonly body: string;
  readonly now: Date;
}): Thread => {
  const at = input.now.toISOString();
  return ThreadSchema.parse({
    id: input.id,
    profileId: input.profileId,
    company: input.company,
    status: "pending",
    createdAt: at,
    updatedAt: at,
    messages: [{ id: `${input.id}-1-${input.now.getTime()}`, from: "company", authorId: input.company.userId, body: input.body.trim(), at }],
  });
};

export const decide = (thread: Thread, viewer: Viewer, status: "accepted" | "declined", now: Date): Thread => {
  if (!canDecide(viewer, thread)) throw new Error("décision refusée");
  return { ...thread, status, updatedAt: now.toISOString() };
};

export const reply = (thread: Thread, viewer: Viewer, body: string, now: Date): Thread => {
  if (!canAnswer(viewer, thread)) throw new Error("réponse refusée");
  const parsed = ReplyInputSchema.parse({ body });
  const message: ThreadMessage = { id: messageId(thread, now), from: sideOf(viewer), authorId: viewer.id, body: parsed.body, at: now.toISOString() };
  return { ...thread, messages: [...thread.messages, message], updatedAt: message.at };
};
