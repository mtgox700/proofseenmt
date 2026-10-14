import { Resolver } from "node:dns/promises";
import { PROOF_PREFIX, checkEvidence, isManualOnlyHost, issueChallenge, wellKnownUrl, type Challenge, type ProofMethod } from "./possession";
import { safeFetchText } from "./safe-fetch";

/*
 * Vérification d'une preuve de possession, partagée par la CLI et l'application web.
 *
 * Le module ne décide pas *où* sont rangées les preuves (fichier d'identité, base) : il dit seulement si le jeton lié à
 * une identité et à une URL est posé, et par quelle méthode. Les accès réseau passent par une sonde injectée, pour que
 * tout se teste sans réseau ; la sonde par défaut est le récupérateur durci (`safe-fetch`) et un résolveur DNS borné.
 *
 * LinkedIn et Malt ne sont jamais interrogés : `proveOwnership` s'arrête avant toute requête, et `issueChallenge`
 * refuserait de toute façon d'émettre une consigne automatisable pour ces plateformes.
 */

export type AutomaticMethod = Exclude<ProofMethod, "profile_token">;

/** Ordre de préférence quand plusieurs preuves tiennent à la fois : celles qui prouvent le domaine d'abord. */
export const AUTOMATIC_METHODS: readonly AutomaticMethod[] = ["well_known_file", "meta_tag", "dns_txt"];

/** Délai par lecture : une preuve posée répond vite, un serveur qui traîne ne doit pas bloquer une action web. */
export const DEFAULT_PROBE_TIMEOUT_MS = 8_000;

/** Les deux seules façons dont une preuve est lue. Injectables : les tests n'émettent aucune requête. */
export interface EvidenceProbe {
  readonly fetchText: (url: string) => Promise<string>;
  readonly resolveTxt: (host: string) => Promise<readonly string[]>;
}

/** La sonde de production : https durci pour les pages et les fichiers, DNS borné dans le temps pour les TXT. */
export const defaultProbe = (timeoutMs: number = DEFAULT_PROBE_TIMEOUT_MS): EvidenceProbe => ({
  fetchText: (url) => safeFetchText(url, { timeoutMs }),
  resolveTxt: async (host) => {
    const resolver = new Resolver({ timeout: timeoutMs, tries: 2 });
    return (await resolver.resolveTxt(host)).map((chunks) => chunks.join(""));
  },
});

const META_ELEMENT = /<meta[^>]*>/gi;
const ATTRIBUTE = /([a-zA-Z:-]+)=(?:"([^"]*)"|'([^']*)'|([^ "'>]+))/g;

/**
 * Les valeurs `content` des balises `<meta name="proofseen-verification">` de la page, et rien d'autre. Lire la page
 * entière ferait accepter un jeton posé en simple texte — un commentaire sous l'article de quelqu'un d'autre suffirait
 * à « prouver » sa page. Une vraie balise dans le HTML brut demande d'en contrôler le code : c'est ce que la méthode
 * prétend prouver.
 *
 * Sur un attribut répété, le premier fait foi, comme pour un analyseur HTML : sinon un attribut ajouté en fin de balise
 * remplacerait celui que le site a écrit, et nous lirions une autre balise que celle que voit un navigateur.
 */
export const metaTagProofs = (html: string): readonly string[] =>
  (html.match(META_ELEMENT) ?? []).flatMap((element) => {
    const attributes = new Map<string, string>();
    for (const m of element.matchAll(ATTRIBUTE)) {
      const key = (m[1] ?? "").toLowerCase();
      if (!attributes.has(key)) attributes.set(key, m[2] ?? m[3] ?? m[4] ?? "");
    }
    return attributes.get("name")?.toLowerCase() === PROOF_PREFIX ? [attributes.get("content") ?? ""] : [];
  });

/**
 * Le contenu où la preuve doit apparaître : TXT du nom d'hôte, fichier à la racine du domaine, ou les balises de
 * preuve de la page elle-même.
 */
export const readEvidence = async (challenge: Challenge, probe: EvidenceProbe): Promise<string> => {
  if (challenge.manual || isManualOnlyHost(challenge.url)) {
    throw new Error("vérification manuelle : aucune requête n'est émise vers cette plateforme");
  }
  if (challenge.method === "dns_txt") return (await probe.resolveTxt(new URL(challenge.url).hostname)).join("\n");
  if (challenge.method === "well_known_file") return probe.fetchText(wellKnownUrl(challenge.url));
  return metaTagProofs(await probe.fetchText(challenge.url)).join("\n");
};

export interface OwnershipInput {
  readonly secret: string;
  readonly identityId: string;
  readonly url: string;
  /** Méthodes essayées ; toutes les méthodes automatisables par défaut. */
  readonly methods?: readonly AutomaticMethod[];
}

export interface ProbeFailure {
  readonly method: AutomaticMethod;
  /** `absent` : la ressource est lue mais ne porte pas le jeton ; `unreachable` : elle n'a pas pu être lue. */
  readonly reason: "absent" | "unreachable";
}

export type OwnershipOutcome =
  | { readonly kind: "proven"; readonly method: AutomaticMethod }
  | { readonly kind: "manual_only" }
  | { readonly kind: "not_found"; readonly failures: readonly ProbeFailure[] };

const tryMethod = async (input: OwnershipInput, method: AutomaticMethod, probe: EvidenceProbe): Promise<ProbeFailure | null> => {
  const challenge = issueChallenge({ secret: input.secret, identityId: input.identityId, url: input.url, method });
  try {
    return checkEvidence(challenge, await readEvidence(challenge, probe)) ? null : { method, reason: "absent" };
  } catch {
    // La cause exacte (DNS, TLS, délai) n'est pas rendue : elle peut nommer une adresse interne refusée.
    return { method, reason: "unreachable" };
  }
};

/**
 * Cherche le jeton par chaque méthode, en parallèle : la personne a posé une seule des trois preuves et ne doit pas
 * attendre l'échec des deux autres l'une après l'autre. Si plusieurs tiennent, la première dans `AUTOMATIC_METHODS`
 * est retenue. Un secret trop court lève une erreur : c'est une faute de configuration, pas une preuve absente.
 */
export const proveOwnership = async (input: OwnershipInput, probe: EvidenceProbe): Promise<OwnershipOutcome> => {
  if (isManualOnlyHost(input.url)) return { kind: "manual_only" };
  const methods = input.methods ?? AUTOMATIC_METHODS;
  // Émettre d'abord : une erreur de secret part avant la moindre requête.
  for (const method of methods) issueChallenge({ secret: input.secret, identityId: input.identityId, url: input.url, method });
  const results = await Promise.all(methods.map((method) => tryMethod(input, method, probe)));
  const proven = methods.find((_, index) => results[index] === null);
  if (proven !== undefined) return { kind: "proven", method: proven };
  return { kind: "not_found", failures: results.filter((result): result is ProbeFailure => result !== null) };
};

/** Les valeurs exactes à poser, une par méthode, telles que la personne doit les recopier. */
export interface ProofKit {
  readonly wellKnown: { readonly url: string; readonly content: string };
  readonly metaTag: { readonly page: string; readonly tag: string };
  readonly dnsTxt: { readonly host: string; readonly value: string };
}

/** `null` pour une plateforme à vérification manuelle : aucune consigne automatisable n'y a de sens. */
export const proofKit = (secret: string, identityId: string, url: string): ProofKit | null => {
  if (isManualOnlyHost(url)) return null;
  const issue = (method: AutomaticMethod) => issueChallenge({ secret, identityId, url, method }).token;
  return {
    wellKnown: { url: wellKnownUrl(url), content: `${PROOF_PREFIX}=${issue("well_known_file")}` },
    metaTag: { page: url, tag: `<meta name="${PROOF_PREFIX}" content="${issue("meta_tag")}">` },
    dnsTxt: { host: new URL(url).hostname, value: `${PROOF_PREFIX}=${issue("dns_txt")}` },
  };
};
