/*
 * A short name for a subscribed device (C20), "Chrome · Android", read from the User-Agent header once, at
 * subscription. The header itself is never stored: it says far more about the person than they need to see.
 */

const BROWSERS: readonly (readonly [RegExp, string])[] = [
  [/Edg(A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser\//, "Samsung Internet"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/CriOS\/|Chrome\//, "Chrome"],
  [/Safari\//, "Safari"],
];

const SYSTEMS: readonly (readonly [RegExp, string])[] = [
  [/Android/, "Android"],
  [/iPhone|iPad|iPod/, "iOS"],
  [/CrOS/, "ChromeOS"],
  [/Windows/, "Windows"],
  [/Macintosh|Mac OS X/, "macOS"],
  [/Linux/, "Linux"],
];

const first = (table: readonly (readonly [RegExp, string])[], ua: string): string | null => table.find(([pattern]) => pattern.test(ua))?.[1] ?? null;

export const deviceLabel = (userAgent: string | null): string | null => {
  if (userAgent === null) return null;
  const ua = userAgent.slice(0, 512);
  const parts = [first(BROWSERS, ua), first(SYSTEMS, ua)].filter((part): part is string => part !== null);
  return parts.length === 0 ? null : parts.join(" · ");
};
