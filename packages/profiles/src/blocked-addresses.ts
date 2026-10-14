import { isIP } from "node:net";

/*
 * Les adresses que nous ne composons jamais sur la foi d'un tiers : réseau interne, boucle locale, métadonnées cloud,
 * et toutes les écritures IPv6 qui transportent une IPv4 (compatible, mappée, traduite, 6to4, NAT64, Teredo). Une
 * IPv6 qui encapsule une IPv4 peut atteindre la boucle locale ou un réseau privé par une passerelle : dans le doute,
 * les plages de transition sont refusées en entier, sauf l'IPv4 mappée, jugée sur l'IPv4 qu'elle porte (c'est ainsi
 * que le système la compose réellement).
 */

const v4Blocked: readonly (readonly [string, number])[] = [
  ["0.0.0.0", 8], // « cet hôte »
  ["10.0.0.0", 8], // RFC 1918
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8], // boucle locale
  ["169.254.0.0", 16], // lien-local, dont les métadonnées d'instance cloud
  ["172.16.0.0", 12], // RFC 1918
  ["192.0.0.0", 24],
  ["192.0.2.0", 24], // documentation
  ["192.88.99.0", 24], // relais 6to4
  ["192.168.0.0", 16], // RFC 1918
  ["198.18.0.0", 15], // bancs d'essai
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 4], // multidiffusion
  ["240.0.0.0", 4], // réservé, dont 255.255.255.255
];

const toV4 = (ip: string): number | null => {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    const byte = Number(part);
    if (!/^\d{1,3}$/.test(part) || byte > 255) return null;
    value = value * 256 + byte;
  }
  return value;
};

const isBlockedV4 = (value: number): boolean =>
  v4Blocked.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (-1 << (32 - bits)) >>> 0;
    return (value & mask) >>> 0 === ((toV4(base) ?? 0) & mask) >>> 0;
  });

/** Les huit mots de 16 bits d'une IPv6 (zone retirée, IPv4 finale convertie) ; `null` si l'écriture est illisible. */
const v6Words = (ip: string): number[] | null => {
  let text = ip.toLowerCase().split("%")[0] ?? "";
  const dotted = /^(.*:)(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (dotted !== null) {
    const v4 = toV4(dotted[2] ?? "");
    if (v4 === null) return null;
    text = `${dotted[1] ?? ""}${(v4 >>> 16).toString(16)}:${(v4 & 0xffff).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const parse = (part: string): number[] => (part === "" ? [] : part.split(":").map((word) => (/^[0-9a-f]{1,4}$/.test(word) ? Number.parseInt(word, 16) : Number.NaN)));
  const head = parse(halves[0] ?? "");
  const tail = halves.length === 2 ? parse(halves[1] ?? "") : [];
  const missing = 8 - head.length - tail.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
  const words = [...head, ...Array.from({ length: halves.length === 2 ? missing : 0 }, () => 0), ...tail];
  return words.some((word) => Number.isNaN(word)) ? null : words;
};

const zeros = (words: readonly number[], from: number, to: number): boolean => words.slice(from, to).every((word) => word === 0);

const isBlockedV6 = (w: readonly number[]): boolean => {
  const [w0 = 0, w1 = 0, w2 = 0, w3 = 0, w4 = 0, w5 = 0, w6 = 0, w7 = 0] = w;
  if (zeros(w, 0, 6)) return true; // ::/96 : non spécifiée, boucle locale, IPv4 compatible
  if (zeros(w, 0, 5) && w5 === 0xffff) return isBlockedV4(((w6 << 16) >>> 0) + w7); // IPv4 mappée ::ffff:0:0/96
  if (zeros(w, 0, 4) && w4 === 0xffff && w5 === 0) return true; // IPv4 traduite ::ffff:0:0:0/96
  if (w0 === 0x64 && w1 === 0xff9b) return true; // NAT64 64:ff9b::/96 et 64:ff9b:1::/48
  if (w0 === 0x2002) return true; // 6to4
  if (w0 === 0x2001 && w1 === 0) return true; // Teredo
  if (w0 === 0x2001 && w1 === 0x0db8) return true; // documentation
  if (w0 === 0x0100 && w1 === 0 && w2 === 0 && w3 === 0) return true; // préfixe de rejet 100::/64
  if ((w0 & 0xfe00) === 0xfc00) return true; // fc00::/7, adresses locales uniques
  if ((w0 & 0xffc0) === 0xfe80 || (w0 & 0xffc0) === 0xfec0) return true; // lien-local, site-local
  return (w0 & 0xff00) === 0xff00; // ff00::/8, multidiffusion
};

/** Adresses que nous ne composons jamais sur la foi d'un tiers : réseau interne, boucle locale, métadonnées cloud. */
export const isBlockedAddress = (ip: string): boolean => {
  const family = isIP(ip);
  if (family === 0) return true; // ce qui n'est pas une IP ne se valide pas : on refuse.
  if (family === 4) {
    const value = toV4(ip);
    return value === null || isBlockedV4(value);
  }
  const words = v6Words(ip);
  return words === null || isBlockedV6(words);
};
