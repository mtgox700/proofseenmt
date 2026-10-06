import type { Viewer } from "@/lib/messaging";
import type { Person } from "@/lib/session";
import { referenceForEmail } from "./operator-source";

/** The messaging viewer of a signed-in person: a freelancer is tied to the file their verified email opened. */
export const viewerOf = async (person: Person): Promise<Viewer | null> => {
  if (person.role === null) return null;
  return { id: person.id, role: person.role, reference: person.role === "freelance" ? await referenceForEmail(person.email) : null };
};
