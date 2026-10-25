import { randomUUID } from "node:crypto";
import type { Draft, Problem } from "./choices";

/*
 * The form « Préparer » comes back with its values and its errors, without JavaScript (storyboard L1.6, §4 E2). A
 * server action posted by a plain form can only answer with a redirect; the values must not travel in the address (a
 * description of the processing of personal data has no place in a URL, a history or a log) nor in a cookie (4 KB, and
 * sent back on every request). So the server keeps the draft for ten minutes, in its own memory, under an unguessable
 * key bound to the person and the contract, and the redirect carries only the key (`?brouillon=…`).
 * Nothing is written to the database or to disk; a restart loses the draft, and the page then says so in plain words.
 */

export const DRAFT_TTL_MS = 10 * 60_000;
const MAX_DRAFTS = 500;

export interface KeptDraft {
  readonly userId: string;
  readonly contractId: string;
  readonly values: Draft;
  readonly problems: readonly Problem[];
  /** Facts of the contract the engine found missing (`missing` names that are not a field): said in the summary. */
  readonly facts: readonly string[];
  /** A refusal of the engine that is not about a field: its dictionary key. */
  readonly refusal: "expired" | "invalid" | "other" | "monthly" | null;
  /** An error that is not about the form, as a key of the dictionary's errors. */
  readonly message: "tooMany" | null;
}

interface Entry {
  readonly draft: KeptDraft;
  readonly expires: number;
}

export interface DraftStore {
  keep(draft: KeptDraft, now: Date): string;
  take(key: string, userId: string, contractId: string, now: Date): KeptDraft | null;
}

const KEY = /^[0-9a-f-]{36}$/;

export function draftStore(): DraftStore {
  const entries = new Map<string, Entry>();
  const sweep = (now: number) => {
    for (const [key, entry] of entries) if (entry.expires <= now) entries.delete(key);
    while (entries.size >= MAX_DRAFTS) {
      const oldest = entries.keys().next().value;
      if (oldest === undefined) break;
      entries.delete(oldest);
    }
  };
  return {
    keep(draft, now) {
      sweep(now.getTime());
      const key = randomUUID();
      entries.set(key, { draft, expires: now.getTime() + DRAFT_TTL_MS });
      return key;
    },
    take(key, userId, contractId, now) {
      if (!KEY.test(key)) return null;
      const entry = entries.get(key);
      if (entry === undefined || entry.expires <= now.getTime()) return null;
      // Another person, or the same key on another contract, reads nothing: the same answer as an unknown key.
      if (entry.draft.userId !== userId || entry.draft.contractId !== contractId) return null;
      return entry.draft;
    },
  };
}

/** The one store of the process. */
const globalDrafts = globalThis as typeof globalThis & { __proofseenVaultDrafts?: DraftStore };
export const drafts = (): DraftStore => (globalDrafts.__proofseenVaultDrafts ??= draftStore());
