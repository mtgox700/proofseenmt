import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ThreadSchema, type Thread } from "@/lib/messaging";

/*
 * Where threads live. Files today (one JSON per thread, written atomically), Postgres tomorrow: same single door as
 * the rest of the data layer, so the swap touches this file only. The folder sits outside the repo's tracked tree
 * (.store/ is ignored): messages are personal data, never committed.
 */
export interface MessageStore {
  list(): Promise<readonly Thread[]>;
  get(id: string): Promise<Thread | null>;
  save(thread: Thread): Promise<void>;
}

const DIR = join(process.cwd(), "..", "..", ".store", "threads");
const ID = /^[a-zA-Z0-9-]{1,64}$/;

class FileMessageStore implements MessageStore {
  async list(): Promise<readonly Thread[]> {
    if (!existsSync(DIR)) return [];
    const threads: Thread[] = [];
    for (const file of await readdir(DIR)) {
      if (!file.endsWith(".json")) continue;
      try {
        threads.push(ThreadSchema.parse(JSON.parse(await readFile(join(DIR, file), "utf8"))));
      } catch {
        // An unreadable thread is skipped from the list, never shown half-parsed.
      }
    }
    return threads.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string): Promise<Thread | null> {
    // The id reaches a path: refuse anything outside the alphabet before touching the disk.
    if (!ID.test(id)) return null;
    const path = join(DIR, `${id}.json`);
    if (!existsSync(path)) return null;
    try {
      return ThreadSchema.parse(JSON.parse(await readFile(path, "utf8")));
    } catch {
      return null;
    }
  }

  async save(thread: Thread): Promise<void> {
    const valid = ThreadSchema.parse(thread);
    await mkdir(DIR, { recursive: true });
    // Write then rename: a reader never sees a half-written file.
    const temp = join(DIR, `${valid.id}.json.tmp`);
    await writeFile(temp, `${JSON.stringify(valid, null, 2)}\n`);
    await rename(temp, join(DIR, `${valid.id}.json`));
  }
}

const store: MessageStore = new FileMessageStore();

export const getMessageStore = (): MessageStore => store;
