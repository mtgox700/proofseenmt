import type { ClientRequest, IncomingMessage } from "node:http";
import { request as httpsRequest, type RequestOptions } from "node:https";
import { lookup as dnsLookup } from "node:dns";
import { isIP } from "node:net";
import { isBlockedAddress } from "./blocked-addresses";

export { isBlockedAddress } from "./blocked-addresses";

/*
 * Récupération d'une URL **déclarée par un tiers**. C'est un contrôle de sécurité, pas une commodité.
 *
 * Le danger : la preuve de possession consiste à aller lire une adresse que le client choisit. Sans garde-fou, il lui
 * suffit de faire pointer son domaine vers une adresse interne — ou de renvoyer une redirection vers elle — pour que
 * notre machine aille frapper son propre réseau. Et si le service interne atteint renvoie une partie de la requête, le
 * jeton peut apparaître dans la réponse : le client obtient alors une **vérification frauduleuse** sur un domaine qu'il
 * ne contrôle pas, ce qui retourne le contrôle contre ce qu'il protège (US-F00).
 *
 * Quatre verrous, dans cet ordre, **avant chaque saut** (redirections comprises) :
 *  1. https uniquement, port 443 uniquement ;
 *  2. aucune IP littérale : Node ne passe pas par `lookup` pour une IP écrite dans l'URL, le contrôle à la connexion
 *     ne la verrait donc jamais. Une adresse prouvée est un nom de domaine : une IP n'a rien à faire ici ;
 *  3. l'adresse IP d'un nom est validée **au moment de la connexion** (`lookup` passé à la requête), ce qui ferme aussi
 *     la réattribution DNS : valider puis laisser le client re-résoudre laisserait une fenêtre entre les deux ;
 *  4. le corps est plafonné en taille, et la lecture entière en durée : une cible qui envoie un octet de temps en temps
 *     ne déclenche jamais un délai d'inactivité, elle doit buter sur un délai total.
 */

/** Un fichier de preuve tient en quelques dizaines d'octets ; une page d'accueil raisonnable, en quelques dizaines de Ko. */
export const MAX_EVIDENCE_BYTES = 256 * 1024;
export const MAX_REDIRECTS = 5;

/** La forme de `https.request` dont on se sert ; injectable pour que les tests conduisent les sauts vers un serveur local. */
export type RequestImpl = (options: RequestOptions, callback: (res: IncomingMessage) => void) => ClientRequest;

export interface SafeFetchOptions {
  /** Délai d'inactivité d'un saut ; c'est aussi le délai total par défaut. */
  readonly timeoutMs: number;
  /** Délai total de l'appel, redirections comprises : passé ce délai, la connexion en cours est détruite. */
  readonly deadlineMs?: number;
  readonly maxBytes?: number;
  readonly maxRedirects?: number;
  /** Injectable pour les tests : la valeur par défaut refuse tout ce que `isBlockedAddress` refuse. */
  readonly isBlocked?: (ip: string) => boolean;
  /**
   * Résolution du nom. Injectable pour que le contrôle se teste **sans réseau** : un test de sécurité qui dépend du
   * DNS réel devient instable, et un test instable finit par être ignoré.
   */
  readonly lookupImpl?: typeof dnsLookup;
  /** Transport ; `https.request` par défaut. Les verrous 1 et 2 s'appliquent avant lui, le verrou 3 passe par lui. */
  readonly requestImpl?: RequestImpl;
}

interface Hop {
  readonly body: string;
  readonly location: string | null;
}

/** Verrous 1 et 2 : protocole, port et nom, jugés sur l'URL elle-même avant d'ouvrir quoi que ce soit. */
const assertHopAllowed = (url: URL): void => {
  if (url.protocol !== "https:") throw new Error(`refus de ${url.protocol}// : seules les adresses https sont lues`);
  if (url.port !== "" && url.port !== "443") throw new Error(`refus du port ${url.port} : seul le port 443 est lu`);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "" || isIP(host) !== 0) throw new Error("refus d'une IP littérale : seule une adresse par nom de domaine est lue");
};

/** Verrou 3 : l'adresse est jugée au moment où l'on s'y connecte, pas avant. */
const guardedLookup =
  (o: SafeFetchOptions): RequestOptions["lookup"] =>
  (hostname, options, callback) => {
    const blocked = o.isBlocked ?? isBlockedAddress;
    (o.lookupImpl ?? dnsLookup)(hostname, options, (error, address, family) => {
      if (error !== null) return callback(error, address as never, family);
      const addresses = Array.isArray(address) ? address.map((a) => a.address) : [address as string];
      const refused = addresses.find((candidate) => blocked(candidate));
      if (refused !== undefined) return callback(new Error(`adresse interne refusée (${refused})`), address as never, family);
      return callback(null, address as never, family);
    });
  };

const fetchHop = (url: URL, o: SafeFetchOptions, remainingMs: number): Promise<Hop> =>
  new Promise((resolve, reject) => {
    const maxBytes = o.maxBytes ?? MAX_EVIDENCE_BYTES;
    let settled = false;
    // Le délai total détruit la requête : la connexion se ferme au lieu de rester pendue à une cible qui traîne.
    const timer = setTimeout(() => {
      fail(new Error("délai total dépassé"));
      req.destroy();
    }, remainingMs);
    const finish = (outcome: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      outcome();
    };
    const fail = (error: Error): void => finish(() => reject(error));
    const req = (o.requestImpl ?? httpsRequest)(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: 443,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        timeout: o.timeoutMs,
        lookup: guardedLookup(o),
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = res.headers.location ?? null;
        if (status >= 300 && status < 400 && location !== null) {
          res.resume();
          return finish(() => resolve({ body: "", location }));
        }
        if (status < 200 || status >= 300) {
          res.resume();
          return fail(new Error(`HTTP ${status}`));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            req.destroy();
            fail(new Error(`réponse trop grande (plus de ${maxBytes} octets)`));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => finish(() => resolve({ body: Buffer.concat(chunks).toString("utf8"), location: null })));
        res.on("error", fail);
      },
    );
    req.on("timeout", () => {
      req.destroy(new Error("délai dépassé"));
    });
    req.on("error", fail);
    req.end();
  });

/**
 * Corps d'une URL https, redirections suivies **une par une** et revalidées à chaque saut. `redirect: "follow"` de
 * `fetch` ne le permet pas : il suit sans jamais revoir ni le protocole, ni le port, ni l'adresse.
 */
export const safeFetchText = async (url: string, o: SafeFetchOptions): Promise<string> => {
  const deadline = Date.now() + (o.deadlineMs ?? o.timeoutMs);
  let current = new URL(url);
  for (let hop = 0; hop <= (o.maxRedirects ?? MAX_REDIRECTS); hop += 1) {
    assertHopAllowed(current);
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("délai total dépassé");
    const result = await fetchHop(current, o, remaining);
    if (result.location === null) return result.body;
    current = new URL(result.location, current);
  }
  throw new Error("trop de redirections");
};
