import { readFile } from "node:fs/promises";
import { z } from "zod";
import { CliError } from "./files";

/** Manual calibration sample (PROTOCOLE_ECHANTILLON_MANUEL.md): yes/no, client rank and codes — never a third-party name. */
export const ManualRowSchema = z.object({
  wave_id: z.string().min(1),
  jd_id: z.string().min(1),
  app: z.enum(["chatgpt", "claude", "perplexity", "gemini", "copilot"]),
  date_utc: z.string().min(1),
  logged_out: z.enum(["true", "false"]),
  client_present: z.enum(["true", "false"]),
  client_rank: z.string().regex(/^(\d+)?$/),
  notes_sans_nom: z.string().regex(/^[a-z0-9=;_+-]*$/i, "notes must contain codes only"),
});
export type ManualRow = z.infer<typeof ManualRowSchema>;

const COLUMNS = ["wave_id", "jd_id", "app", "date_utc", "logged_out", "client_present", "client_rank", "notes_sans_nom"] as const;

export const parseManualCsv = (content: string): ManualRow[] => {
  const lines = content.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];
  if (lines[0]!.trim() !== COLUMNS.join(",")) throw new CliError(`manual sample: header must be ${COLUMNS.join(",")}`);
  return lines.slice(1).map((line, i) => {
    const fields = line.split(",");
    if (fields.length !== COLUMNS.length) throw new CliError(`manual sample: line ${i + 2} must have ${COLUMNS.length} fields`);
    const parsed = ManualRowSchema.safeParse(Object.fromEntries(COLUMNS.map((c, j) => [c, fields[j]!.trim()])));
    if (!parsed.success) throw new CliError(`manual sample: line ${i + 2}: ${parsed.error.issues[0]?.message ?? "invalid"}`);
    return parsed.data;
  });
};

export const loadManualCsv = async (path: string): Promise<ManualRow[]> => {
  try {
    return parseManualCsv(await readFile(path, "utf8"));
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError(`manual sample: cannot read ${path}`);
  }
};
