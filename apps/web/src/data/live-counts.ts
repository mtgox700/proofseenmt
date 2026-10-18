import { getDb, liveAudience, type LiveCounts } from "@proofseen/db";
import { accountUsers } from "./accounts";
import type { Person } from "../lib/session";
import { logError } from "../lib/log";
import { hasDatabase } from "./intake-sink";

/**
 * The header counters of a signed-in person, rendered by the server (they show without JavaScript; the live stream
 * keeps them current). `null` without a database, or when reading them fails: the header then shows no number rather
 * than an error.
 */
export const headerCounts = async (person: Person): Promise<LiveCounts | null> => {
  if (!hasDatabase() || person.email === "" || person.role === null) return null;
  try {
    const db = getDb();
    const { userId, suspension } = await accountUsers(db).ensure({ clerkId: person.id, email: person.email, displayName: person.name, emailVerified: person.emailVerified });
    // A suspended account (C19) has no space to read: no counters either.
    if (suspension !== null) return null;
    return await liveAudience(db).counts(userId);
  } catch (error) {
    logError("header counts: not read", error);
    return null;
  }
};
