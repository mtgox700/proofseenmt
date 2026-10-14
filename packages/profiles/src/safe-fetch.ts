import { request as httpsRequest } from "node:https";
import { lookup as dnsLookup } from "node:dns";
import { isIP } from "node:net";

/*
 * Récupération d'une URL **déclarée par un tiers**. C'est un contrôle de sécurité, pas une commodité.
 *
 * Le danger : la preuve de possession consiste à aller lire une adresse que le client choisit. Sans garde-fou, il lui
 * suffit de faire pointer son domaine vers une adresse interne — ou de renvoyer une redirection vers elle — pour que
 * notre machine aille frapper son propre réseau. Et si le service interne atteint renvoie une partie de la requête, le
 * jeton peut apparaître dans la réponse : le client obtient alors une **vérification frauduleuse** sur un domaine qu'il
 * ne contrôle pas, ce qui retourne le contrôle contre ce qu'il protège (US-F00).
 *
 * Trois verrous, dans cet ordre :
 *  1. https uniquement, à chaque saut ;
 *  2. l'adresse IP est validée **au moment de la connexion** (`lookup` passé à la requête), ce qui ferme aussi la
 *     réattribution DNS : valider puis laisser le client re-résoudre laisserait une fenêtre entre les deux ;
 *  3. le corps est plafonné : la cible est hostile par nature et `text()` sans limite se lit en mémoire.
 */

/** Un fichier de preuve tient en quelques dizaines d'octets ; une page d'accueil raisonnable, en quelques dizaines de Ko. */
export const MAX_EVIDENCE_BYTES = 256 * 1024;
export const MAX_REDIRECTS = 5;

const v4Blocked: readonly (readonly [string, number])[] = [
  ["0.0.0.0", 8], // « cet hôte »
  ["10.0.0.0", 8], // RFC 1918
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8], // boucle locale
  ["169.254.0.0", 16], // lien-local, dont les métadonnées d'instance cloud
  ["172.16.0.0", 12], // RFC 1918
  ["192.0.0.0", 24],
  ["192.0.2.0", 24], // documentation
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
    if (!Number.isInteger(byte) || byte < 0 || byte > 255) return null;
    value = value * 256 + byte;
  }
  return value;
};

/** Adresses que nous ne composons jamais sur la foi d'un tiers : réseau interne, boucle locale, métadonnées cloud. */
export const isBlockedAddress = (ip: string): boolean => {
  const family = isIP(ip);
  if (family === 0) return true; // ce qui n'est pas une IP ne se valide pas : on refuse.
  if (family === 4) {
    const value = toV4(ip);
    if (value === null) return true;
    return v4Blocked.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (-1 << (32 - bits)) >>> 0;
      return (value & mask) >>> 0 === ((toV4(base) ?? 0) & mask) >>> 0;
    });
  }
  const normalised = ip.toLowerCase().split("%")[0]!;
  // Une IPv6 qui encapsule une IPv4 se juge sur l'IPv4 qu'elle transporte.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalised);
  if (mapped !== null) return isBlockedAddress(mapped[1]!);
  if (normalised === "::1" || normalised === "::") return true;
  const head = normalised.split(":")[0] ?? "";
  if (/^f[cd]/.test(head)) return true; // fc00::/7, adresses locales uniques
  if (/^fe[89ab]/.test(head)) return true; // fe80::/10, lien-local
  if (head.startsWith("ff")) return true; // ff00::/8, multidiffusion
  if (normalised.startsWith("2001:db8")) return true; // documentation
  if (normalised.startsWith("64:ff9b")) return true; // NAT64
  return false;
};

export interface SafeFetchOptions {
  readonly timeoutMs: number;
  readonly maxBytes?: number;
  readonly maxRedirects?: number;
  /** Injectable pour les tests : la valeur par défaut refuse tout ce que `isBlockedAddress` refuse. */
  readonly isBlocked?: (ip: string) => boolean;
  /**
   * Résolution du nom. Injectable pour que le contrôle se teste **sans réseau** : un test de sécurité qui dépend du
   * DNS réel devient instable, et un test instable finit par être ignoré.
   */
  readonly lookupImpl?: typeof dnsLookup;
}

interface Hop {
  readonly body: string;
  readonly location: string | null;
}

const fetchHop = (url: URL, o: SafeFetchOptions): Promise<Hop> =>
  new Promise((resolve, reject) => {
    const blocked = o.isBlocked ?? isBlockedAddress;
    const maxBytes = o.maxBytes ?? MAX_EVIDENCE_BYTES;
    const req = httpsRequest(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port === "" ? 443 : Number(url.port),
        path: `${url.pathname}${url.search}`,
        method: "GET",
        timeout: o.timeoutMs,
        // Le verrou : l'adresse est jugée au moment où l'on s'y connecte, pas avant.
        lookup: (hostname, options, callback) => {
          (o.lookupImpl ?? dnsLookup)(hostname, options, (error, address, family) => {
            if (error !== null) return callback(error, address as never, family);
            const addresses = Array.isArray(address) ? address.map((a) => a.address) : [address as string];
            const refused = addresses.find((candidate) => blocked(candidate));
            if (refused !== undefined) {
              return callback(new Error(`adresse interne refusée (${refused})`), address as never, family);
            }
            return callback(null, address as never, family);
          });
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = res.headers.location ?? null;
        if (status >= 300 && status < 400 && location !== null) {
          res.resume();
          return resolve({ body: "", location });
        }
        if (status < 200 || status >= 300) {
          res.resume();
          return reject(new Error(`HTTP ${status}`));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            req.destroy();
            reject(new Error(`réponse trop grande (plus de ${maxBytes} octets)`));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => resolve({ body: Buffer.concat(chunks).toString("utf8"), location: null }));
        res.on("error", reject);
      },
    );
    req.on("timeout", () => {
      req.destroy(new Error("délai dépassé"));
    });
    req.on("error", reject);
    req.end();
  });

/**
 * Corps d'une URL https, redirections suivies **une par une** et revalidées à chaque saut. `redirect: "follow"` de
 * `fetch` ne le permet pas : il suit sans jamais revoir ni le protocole ni l'adresse.
 */
export const safeFetchText = async (url: string, o: SafeFetchOptions): Promise<string> => {
  let current = new URL(url);
  for (let hop = 0; hop <= (o.maxRedirects ?? MAX_REDIRECTS); hop += 1) {
    if (current.protocol !== "https:") throw new Error(`refus de ${current.protocol}// : seules les adresses https sont lues`);
    const result = await fetchHop(current, o);
    if (result.location === null) return result.body;
    current = new URL(result.location, current);
  }
  throw new Error("trop de redirections");
};
