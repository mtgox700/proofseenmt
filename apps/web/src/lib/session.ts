import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { Lang } from "@/i18n";
import { authConfigured } from "./auth-config";
import { isChosenRole, operatorEmails, resolveRole, verifiedEmails, type ChosenRole, type Role } from "./roles";

/*
 * The signed-in person, as the server sees it. Every connected page and every server action goes through here:
 * one place decides who someone is and what they may open.
 */

export interface Person {
  readonly id: string;
  /** Full name, or the address when the account has no name: what the database keeps as the display name. */
  readonly name: string;
  /** The first name alone, `null` without one: what the dashboard greets by (C23), never the address. */
  readonly firstName: string | null;
  readonly email: string;
  /** Whether Clerk has verified the primary address: only then may a database row found by that address be relinked. */
  readonly emailVerified: boolean;
  readonly role: Role | null;
}

export type SessionState = { readonly kind: "unconfigured" } | { readonly kind: "signed-out" } | { readonly kind: "signed-in"; readonly person: Person };

export const session = async (): Promise<SessionState> => {
  if (!authConfigured()) return { kind: "unconfigured" };
  const { userId } = await auth();
  if (userId === null) return { kind: "signed-out" };
  const user = await currentUser();
  if (user === null) return { kind: "signed-out" };
  const emails = user.emailAddresses.map((address) => address.emailAddress);
  const primaryAddress = user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId);
  const primary = primaryAddress?.emailAddress ?? emails[0] ?? "";
  return {
    kind: "signed-in",
    person: {
      id: user.id,
      name: [user.firstName, user.lastName].filter(Boolean).join(" ") || primary,
      firstName: user.firstName?.trim() || null,
      email: primary,
      emailVerified: primaryAddress?.verification?.status === "verified",
      role: resolveRole({ emails: verifiedEmails(user.emailAddresses), stored: user.publicMetadata.role }, operatorEmails(process.env.OPERATOR_EMAILS)),
    },
  };
};

/** For pages: the person, or a redirect to sign-in (or to the role choice). Never renders for the wrong role. */
export const requirePerson = async (lang: Lang, allowed?: readonly Role[]): Promise<Person | null> => {
  const state = await session();
  if (state.kind === "unconfigured") return null;
  if (state.kind === "signed-out") redirect(`/${lang}/connexion`);
  const { person } = state;
  if (person.role === null) redirect(`/${lang}/app/bienvenue`);
  if (allowed !== undefined && !allowed.includes(person.role)) redirect(`/${lang}/app`);
  return person;
};

/** Writes the side a person chose. Refuses anything but freelance/company, and never overwrites a choice already made. */
export const chooseRole = async (userId: string, role: ChosenRole): Promise<void> => {
  if (!isChosenRole(role)) throw new Error("rôle refusé");
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  if (isChosenRole(user.publicMetadata.role)) return;
  await client.users.updateUserMetadata(userId, { publicMetadata: { role } });
};

/** Deletes the sign-in account itself, once the database has erased the person: their sessions end with it. */
export const deleteSignInAccount = async (userId: string): Promise<void> => {
  const client = await clerkClient();
  await client.users.deleteUser(userId);
};
