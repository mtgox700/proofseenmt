import { join } from "node:path";
import { loadClientView } from "@proofseen/client-store";
import type { ClientView } from "@proofseen/workspace";

/*
 * Read side of a real client's file (not the demo): the shared `ClientView`, built by `@proofseen/client-store`, the
 * one reader of a client folder, also used by the CLI. Same principle as `WorkspaceSource`: one door, files today, a
 * database tomorrow.
 */
export interface ClientSource {
  /** `null` when the reference is malformed or no folder exists for it. */
  view(reference: string): Promise<ClientView | null>;
}

// Checked here as well as in the store: the reference comes from the URL, and two guards are better than one.
const REFERENCE = /^[A-Z]{2}-[A-Z0-9]{5}$/;
const REPO = join(process.cwd(), "..", "..");

class FileClientSource implements ClientSource {
  async view(reference: string): Promise<ClientView | null> {
    if (!REFERENCE.test(reference)) return null;
    return loadClientView(reference, {
      clientsDir: join(REPO, "clients"),
      reportDirs: [join(REPO, "report")],
      runsDir: join(REPO, "runs"),
      now: () => new Date(),
    });
  }
}

const source: ClientSource = new FileClientSource();

export const getClientSource = (): ClientSource => source;
