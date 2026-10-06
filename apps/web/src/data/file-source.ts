import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ClientReportInput } from "@proofseen/deliverable";
import type { PublicProfile } from "@proofseen/profiles";
import { AnswersSnapshotSchema, FreelanceWorkspaceSchema, ProfilesSnapshotSchema, type AnswersSnapshot, type FreelanceWorkspace, type ProfilesSnapshot } from "./schema";
import type { WorkspaceSource } from "./source";

const DATA_DIR = join(process.cwd(), "data");
const REFERENCE = /^[A-Z]{2}-[A-Z0-9]{5}$/;

const isMissing = (error: unknown): boolean => error instanceof Error && "code" in error && error.code === "ENOENT";

const readJson = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, "utf8")) as unknown;

class FileSource implements WorkspaceSource {
  async freelance(reference: string): Promise<FreelanceWorkspace | null> {
    // The reference becomes part of a path: anything outside the published alphabet is refused before touching the disk.
    if (!REFERENCE.test(reference)) return null;
    try {
      const workspace = FreelanceWorkspaceSchema.parse(await readJson(join(DATA_DIR, "freelance", `${reference}.json`)));
      // Compile-time guard: the snapshot report must stay assignable to the type the client report is built from.
      workspace.report satisfies ClientReportInput;
      return workspace;
    } catch (error: unknown) {
      if (isMissing(error)) return null;
      throw new Error(`espace ${reference} illisible : ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  }

  async profiles(): Promise<ProfilesSnapshot> {
    const snapshot = ProfilesSnapshotSchema.parse(await readJson(join(DATA_DIR, "profiles.json")));
    snapshot.profiles satisfies readonly PublicProfile[];
    return snapshot;
  }

  async answers(): Promise<AnswersSnapshot> {
    return AnswersSnapshotSchema.parse(await readJson(join(DATA_DIR, "j0-answers.json")));
  }
}

const source: WorkspaceSource = new FileSource();

export const getSource = (): WorkspaceSource => source;
