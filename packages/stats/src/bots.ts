/*
 * Which AI and search crawlers actually fetched which page, read from the server's access log. This is the CONTROLLED
 * half of the measurement (ARCHITECTURE_ANONYME §5): we cannot decide to be cited, but we can prove a crawler came —
 * and, more useful still, prove that it never came.
 */

/** User-agent fragment → the name we report. Order matters: the first match wins. */
const CRAWLERS: readonly (readonly [string, string])[] = [
  ["OAI-SearchBot", "OAI-SearchBot"],
  ["ChatGPT-User", "ChatGPT-User"],
  ["GPTBot", "GPTBot"],
  ["Claude-SearchBot", "Claude-SearchBot"],
  ["ClaudeBot", "ClaudeBot"],
  ["Claude-User", "Claude-User"],
  ["PerplexityBot", "PerplexityBot"],
  ["Perplexity-User", "Perplexity-User"],
  ["Googlebot", "Googlebot"],
  ["Bingbot", "Bingbot"],
  ["BraveBot", "BraveBot"],
];

export interface BotHit {
  readonly bot: string;
  readonly count: number;
  /** ISO date of the most recent visit (UTC day). */
  readonly lastSeen: string;
}

export interface PathHits {
  readonly path: string;
  readonly hits: readonly BotHit[];
}

const MONTHS: Readonly<Record<string, string>> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

/** Combined log format: `… [20/Sep/2026:10:00:00 +0000] "GET /path HTTP/1.1" 200 5123 "-" "user agent"`. */
const LINE = /\[(\d{2})\/([A-Za-z]{3})\/(\d{4}):[^\]]*\]\s+"(?:GET|HEAD)\s+(\S+)[^"]*"\s+\d{3}[^"]*"[^"]*"\s+"([^"]*)"/;

const parse = (line: string): { path: string; date: string; bot: string } | null => {
  const match = LINE.exec(line);
  if (match === null) return null;
  const [, day, month, year, rawPath, userAgent] = match;
  const monthNumber = MONTHS[month!];
  if (monthNumber === undefined) return null;
  const crawler = CRAWLERS.find(([needle]) => userAgent!.toLowerCase().includes(needle.toLowerCase()));
  if (crawler === undefined) return null; // human traffic and unknown agents are not our subject here
  return { path: rawPath!.split("?")[0]!, date: `${year}-${monthNumber}-${day}`, bot: crawler[1] };
};

/**
 * Counts crawler visits per path. `expectedPaths` adds the pages that must be watched even when nothing came: an empty
 * `hits` list is the most valuable line of the report.
 */
export const botHits = (lines: readonly string[], expectedPaths: readonly string[] = []): PathHits[] => {
  const perPath = new Map<string, Map<string, BotHit>>();
  for (const path of expectedPaths) perPath.set(path, new Map());
  for (const line of lines) {
    const entry = parse(line);
    if (entry === null) continue;
    const bots = perPath.get(entry.path) ?? new Map<string, BotHit>();
    const current = bots.get(entry.bot);
    bots.set(entry.bot, {
      bot: entry.bot,
      count: (current?.count ?? 0) + 1,
      lastSeen: current === undefined || entry.date > current.lastSeen ? entry.date : current.lastSeen,
    });
    perPath.set(entry.path, bots);
  }
  return [...perPath.entries()]
    .map(([path, bots]) => ({ path, hits: [...bots.values()].sort((a, b) => a.bot.localeCompare(b.bot)) }))
    .sort((a, b) => a.path.localeCompare(b.path));
};
