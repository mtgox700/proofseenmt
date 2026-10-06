import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadClientViews } from "@proofseen/client-store";
import { deliveryStatus, gateStatus, PaymentJournalSchema, type DeliveryStatus, type GateStatus } from "@proofseen/presale";
import { byUrgency, summarise, type ClientView } from "@proofseen/workspace";
import { z } from "zod";

/*
 * Read side of the operator's dashboard and of the account ↔ file link. Every figure comes from the shared packages
 * (client-store, workspace, presale): the dashboard decides nothing the CLI would decide differently.
 */

const REPO = join(process.cwd(), "..", "..");
const CLIENTS = join(REPO, "clients");
const JOURNAL = join(REPO, ".war-room", "presale", "JOURNAL_PAIEMENTS.json");

export interface OperatorOverview {
  readonly views: readonly ClientView[];
  readonly summary: ReturnType<typeof summarise>;
  /** `null` when the payment journal cannot be read: shown as such, never as « 0 payment ». */
  readonly gate: GateStatus | null;
  readonly delivery: DeliveryStatus | null;
}

export const operatorOverview = async (now: Date = new Date()): Promise<OperatorOverview> => {
  const views = [...(await loadClientViews({ clientsDir: CLIENTS, reportDirs: [join(REPO, "report")], runsDir: join(REPO, "runs"), now: () => now }))].sort(byUrgency);
  let gate: GateStatus | null = null;
  let delivery: DeliveryStatus | null = null;
  try {
    const journal = PaymentJournalSchema.parse(JSON.parse(await readFile(JOURNAL, "utf8")));
    gate = gateStatus(journal.payments, now);
    delivery = deliveryStatus(journal.payments, now);
  } catch {
    // Unreadable journal: the tiles say « illisible », the rest of the dashboard still works.
  }
  return { views, summary: summarise(views), gate, delivery };
};

const ContactSchema = z.object({ reference: z.string().regex(/^[A-Z]{2}-[A-Z0-9]{5}$/), email: z.string() });

/**
 * The file opened by a signup with this email, if any. Matching on the verified primary email of the Clerk account:
 * the person proved the address at sign-in, and the signup recorded the same address in `contact.json`.
 */
export const referenceForEmail = async (email: string): Promise<string | null> => {
  if (email === "" || !existsSync(CLIENTS)) return null;
  const wanted = email.trim().toLowerCase();
  for (const entry of await readdir(CLIENTS, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    try {
      const contact = ContactSchema.parse(JSON.parse(await readFile(join(CLIENTS, entry.name, "contact.json"), "utf8")));
      if (contact.email.trim().toLowerCase() === wanted && contact.reference === entry.name) return contact.reference;
    } catch {
      // A folder without a readable contact simply does not match.
    }
  }
  return null;
};
