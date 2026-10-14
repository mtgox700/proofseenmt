import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { AnswersSnapshotSchema, type AnswersSnapshot } from "./schema";
import type { WorkspaceSource } from "./source";

const DATA_DIR = join(process.cwd(), "data");

const readJson = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, "utf8")) as unknown;

class FileSource implements WorkspaceSource {
  async answers(): Promise<AnswersSnapshot> {
    return AnswersSnapshotSchema.parse(await readJson(join(DATA_DIR, "j0-answers.json")));
  }
}

const source: WorkspaceSource = new FileSource();

export const getSource = (): WorkspaceSource => source;
