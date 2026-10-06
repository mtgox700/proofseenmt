import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { auditRequests, getDb } from "@proofseen/db";
import { identityFor, newReference, type Contact, type Submission } from "@proofseen/intake";

/*
 * The single door through which the web *writes* — the mirror of `WorkspaceSource`, which only reads.
 *
 * Two implementations behind one interface: Postgres when `DATABASE_URL` is set, the `clients/` folder otherwise. The
 * folder stays as the fallback so a machine without a database (a fresh clone, a preview) still accepts a signup.
 *
 * What this file deliberately does NOT do: build an identity of its own. `identityFor` comes from `@proofseen/intake`
 * and is the one definition shared with `client-init` and the `intake` command. Two places shaping a new file
 * differently is what produced the last three defects in this repository.
 */

export interface OpenedFile {
  readonly reference: string;
  readonly ownedUrlCount: number;
}

export interface IntakeSink {
  /** Opens a file for a validated submission. Returns the generated reference. */
  open(submission: Submission, now: Date): Promise<OpenedFile>;
}

const CLIENTS_DIR = join(process.cwd(), "..", "..", "clients");

class FileSink implements IntakeSink {
  async open(submission: Submission, now: Date): Promise<OpenedFile> {
    // Retry on the (vanishingly unlikely) collision rather than overwriting: an existing folder holds someone's
    // proofs and job ads.
    let reference = newReference();
    for (let attempt = 0; attempt < 5 && existsSync(join(CLIENTS_DIR, reference)); attempt += 1) reference = newReference();
    const dir = join(CLIENTS_DIR, reference);
    if (existsSync(dir)) throw new Error("impossible d'allouer une référence libre");

    const identity = identityFor({ id: reference, displayName: submission.displayName, urls: submission.urls });
    const contact: Contact = {
      reference,
      email: submission.email,
      lang: submission.lang,
      consentAt: now.toISOString(),
      createdAt: now.toISOString(),
    };

    await mkdir(join(dir, "offres"), { recursive: true });
    // The contact lives beside the identity, never inside it: `identity.json` feeds the public profile.
    await writeFile(join(dir, "identity.json"), `${JSON.stringify(identity, null, 2)}\n`);
    await writeFile(join(dir, "contact.json"), `${JSON.stringify(contact, null, 2)}\n`);
    return { reference, ownedUrlCount: identity.ownedUrls.length };
  }
}

class DatabaseSink implements IntakeSink {
  async open(submission: Submission, now: Date): Promise<OpenedFile> {
    const { reference } = await auditRequests(getDb()).open(
      {
        displayName: submission.displayName,
        email: submission.email,
        urls: submission.urls,
        lang: submission.lang,
        // The server's clock, not the form's: a timestamp sent by the client can be backdated, and this one is the
        // proof that consent was given.
        consentAt: now,
      },
      () => newReference(),
    );
    const identity = identityFor({ id: reference, displayName: submission.displayName, urls: submission.urls });
    return { reference, ownedUrlCount: identity.ownedUrls.length };
  }
}

export const hasDatabase = (): boolean => (process.env.DATABASE_URL ?? "") !== "";

let sink: IntakeSink | undefined;

export const getSink = (): IntakeSink => {
  sink ??= hasDatabase() ? new DatabaseSink() : new FileSink();
  return sink;
};
