import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, organisations, type Actor, type Db, type OrganisationRecord } from "@proofseen/db";
import { accountUsers } from "@/data/accounts";
import { hasDatabase } from "@/data/intake-sink";
import type { Lang } from "@/i18n";
import type { Role } from "@/lib/roles";
import { requirePerson, session, type Person } from "@/lib/session";
import { ORGANISATION_COOKIE, pickOrganisation } from "./settings";
import { stopIfSuspended } from "@/lib/suspension";

/*
 * The marketplace screens and their server actions reach the database through here. The person comes from the session
 * (never from the form), becomes a database actor (their row created on first use), and every repository call checks
 * access inside its own query: a page never decides on its own what someone may see.
 */

export interface Market {
  readonly person: Person;
  readonly actor: Actor;
  readonly db: Db;
}

/** The person as a database actor; a suspended account (C19) is sent to the page that says so, never further. */
const actorOf = async (db: Db, person: Person, lang: Lang): Promise<Actor> => {
  const { userId, suspension } = await accountUsers(db).ensure({ clerkId: person.id, email: person.email, displayName: person.name });
  stopIfSuspended(lang, suspension);
  return { userId };
};

/** For pages: the market context, `"unconfigured"` without a database, or a redirect (sign-in, role choice, wrong role). */
export const pageMarket = async (lang: Lang, allowed?: readonly Role[]): Promise<Market | "unconfigured"> => {
  const person = await requirePerson(lang, allowed);
  if (person === null || !hasDatabase() || person.email === "") return "unconfigured";
  const db = getDb();
  return { person, actor: await actorOf(db, person, lang), db };
};

/** For server actions: the same context, re-read from the session; anyone else is sent to sign in. */
export const actionMarket = async (lang: Lang): Promise<Market> => {
  const state = await session();
  if (state.kind !== "signed-in" || !hasDatabase() || state.person.email === "") redirect(`/${lang}/connexion`);
  if (state.person.role === null) redirect(`/${lang}/app/bienvenue`);
  const db = getDb();
  return { person: state.person, actor: await actorOf(db, state.person, lang), db };
};

/**
 * The company the person acts for: the one chosen in the settings (a cookie, honoured only while they are still a
 * member: the list comes from their memberships), else the first one they own, else the first one they belong to.
 */
export const currentOrganisation = async (market: Market): Promise<OrganisationRecord | null> => {
  const mine = await organisations(market.db).listMine(market.actor);
  return pickOrganisation(mine, (await cookies()).get(ORGANISATION_COOKIE)?.value);
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An id posted by a form, if it is a uuid; anything else never reaches a redirect path. */
export const uuidOf = (raw: FormDataEntryValue | null): string | null => (typeof raw === "string" && UUID.test(raw.trim()) ? raw.trim() : null);

/** The language posted by a form, `fr` when absent or unknown. */
export const langOf = (raw: FormDataEntryValue | null): Lang => (raw === "en" ? "en" : "fr");
