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
const YES_NO_COLUMNS = new Set<string>(["logged_out", "client_present"]);

/**
 * The file is filled by hand, often in a spreadsheet. A French Excel saves with ";" and a UTF-8 BOM, quotes any field
 * containing the separator, and turns typed booleans into VRAI/FAUX. All of that is accepted; anything else fails loudly.
 */
const YES = new Set(["true", "vrai", "oui", "yes", "1"]);
const NO = new Set(["false", "faux", "non", "no", "0"]);
const yesNo = (value: string): string => {
  const v = value.toLowerCase();
  if (YES.has(v)) return "true";
  if (NO.has(v)) return "false";
  return value; // left as is: the schema rejects it with the line number
};

/** Splits one CSV record (RFC 4180 quoting). Returns null when a quoted field is never closed. */
const splitRecord = (line: string, separator: string): string[] | null => {
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i]!;
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === separator) {
      fields.push(field);
      field = "";
    } else field += c;
  }
  if (quoted) return null;
  fields.push(field);
  return fields;
};

export const parseManualCsv = (content: string): ManualRow[] => {
  const lines = content
    .replace(/^\uFEFF/u, "") // escaped, never a literal BOM in the source
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];
  const head = lines[0]!.trim();
  const separator = [",", ";"].find((s) => head === COLUMNS.join(s));
  if (separator === undefined) throw new CliError(`manual sample: header must be ${COLUMNS.join(",")} (or the same with ";")`);
  return lines.slice(1).map((line, i) => {
    const at = `manual sample: line ${i + 2}`;
    const fields = splitRecord(line, separator);
    if (fields === null) throw new CliError(`${at}: a quoted field is not closed`);
    if (fields.length !== COLUMNS.length) throw new CliError(`${at} must have ${COLUMNS.length} fields, found ${fields.length}`);
    const record = Object.fromEntries(COLUMNS.map((c, j) => [c, YES_NO_COLUMNS.has(c) ? yesNo(fields[j]!.trim()) : fields[j]!.trim()]));
    const parsed = ManualRowSchema.safeParse(record);
    if (!parsed.success) throw new CliError(`${at}: ${parsed.error.issues[0]?.path.join(".") ?? ""} ${parsed.error.issues[0]?.message ?? "invalid"}`.trim());
    return parsed.data;
  });
};

/** 10 target JDs × 5 apps on J0 (PROTOCOLE_ECHANTILLON_MANUEL.md §5). */
export const EXPECTED_MANUAL_ROWS = 50;

export interface ManualCheck {
  readonly problems: readonly string[];
  readonly summary: { readonly total: number; readonly present: number;
    /** Réponses où le moteur refuse de nommer quiconque : ni présence, ni absence. */
    readonly refusals: number; readonly byApp: Readonly<Record<string, number>> };
}

/** Protocol rules the schema alone cannot see. Line numbers match the file (header = line 1). */
/**
 * Le moteur refuse de nommer des personnes réelles (observé sur l'app Claude le 2026-09-24, et sur 28,8 % des réponses
 * API d'Anthropic). Ce n'est PAS « le client est absent d'une liste » : il n'y a pas de liste. On le note `refus`
 * dans les notes, et il sort des comparaisons plutôt que d'y entrer comme un faux accord.
 */
export const isRefusal = (row: ManualRow): boolean => /(^|;)refus(;|$)/i.test(row.notes_sans_nom);

export const checkManualSample = (rows: readonly ManualRow[], expected = EXPECTED_MANUAL_ROWS): ManualCheck => {
  const problems: string[] = [];
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    const at = `line ${i + 2}`;
    if (isRefusal(r) && r.client_present === "true") problems.push(`${at}: un refus ne peut pas valoir client_present=true`);
    if (r.client_present === "true" && r.client_rank === "") problems.push(`${at}: client_rank is required when client_present=true`);
    if (r.client_present === "false" && r.client_rank !== "") problems.push(`${at}: client_rank must be empty when client_present=false`);
    const key = `${r.wave_id} × ${r.jd_id} × ${r.app}`;
    if (seen.has(key)) problems.push(`${at}: duplicate ${key}`);
    seen.add(key);
  });
  const waves = [...new Set(rows.map((r) => r.wave_id))];
  if (waves.length > 1) problems.push(`several waves: ${waves.join(", ")} (one file per wave)`);
  if (rows.length !== expected) problems.push(`${rows.length} rows, ${expected} expected`);
  const byApp = rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.app]: (acc[r.app] ?? 0) + 1 }), {});
  return {
    problems,
    summary: { total: rows.length, present: rows.filter((r) => r.client_present === "true").length, refusals: rows.filter(isRefusal).length, byApp },
  };
};

export const loadManualCsv = async (path: string): Promise<ManualRow[]> => {
  try {
    return parseManualCsv(await readFile(path, "utf8"));
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError(`manual sample: cannot read ${path}`);
  }
};
