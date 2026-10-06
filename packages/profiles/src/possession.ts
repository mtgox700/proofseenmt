import { createHmac, timingSafeEqual } from "node:crypto";

/*
 * Preuve de possession des URL (CAHIER_DES_CHARGES, US-F00) : « afin de ne jamais mesurer un tiers ».
 *
 * Sans cette étape, une identité est une simple déclaration : un client pourrait nous faire mesurer — et lui vendre un
 * rapport sur — le profil de quelqu'un d'autre. Le jeton ne prouve pas qui est la personne ; il prouve que celui qui
 * commande contrôle la surface mesurée. C'est tout ce dont nous avons besoin, et nous n'en demandons pas plus.
 *
 * Ce que chaque méthode prouve, exactement :
 *  - `well_known_file` et `dns_txt` : le contrôle du **domaine**, donc de toutes ses pages.
 *  - `meta_tag` : le contrôle de **cette page-là**, rien d'autre.
 *  - `profile_token` : rien d'automatisable. LinkedIn et Malt sont une ligne rouge du projet — aucune requête n'est
 *    émise vers eux, la vérification est une visite humaine, une fois, puis le client peut retirer le jeton.
 */

export type ProofMethod = "well_known_file" | "meta_tag" | "dns_txt" | "profile_token";

/** Préfixe commun aux trois formes vérifiables : il rend le jeton reconnaissable dans un fichier ou un DNS. */
export const PROOF_PREFIX = "proofseen-verification";
export const WELL_KNOWN_PATH = "/.well-known/proofseen-verification.txt";
/** Longueur du jeton en caractères hexadécimaux : 128 bits, non devinable, assez court pour être recopié. */
export const TOKEN_CHARS = 32;
/** En deçà, le secret ne protège rien : on refuse d'émettre plutôt que d'émettre faible. */
export const MIN_SECRET_LENGTH = 32;

/** Les méthodes que la machine n'a pas le droit de vérifier seule. */
const MANUAL_METHODS: ReadonlySet<ProofMethod> = new Set(["profile_token"]);
export const isManual = (method: ProofMethod): boolean => MANUAL_METHODS.has(method);

/**
 * Plateformes sur lesquelles **aucune requête automatisée** n'est émise, quelle que soit la méthode déclarée.
 *
 * Sans cette liste, la ligne rouge ne tiendrait qu'à une saisie correcte : une URL LinkedIn déclarée en
 * `well_known_file` aurait bel et bien déclenché une requête vers LinkedIn. Le refus est donc prononcé ici, au seul
 * endroit par lequel toute vérification passe, plutôt que laissé à la vigilance de l'opérateur.
 */
export const MANUAL_ONLY_HOSTS: readonly string[] = ["linkedin.com", "malt.fr", "malt.com"];

/** Vrai si l'URL est sur une plateforme où aucune requête automatisée n'est émise, quelle que soit la raison. */
export const isManualOnlyHost = (url: string): boolean => {
  const hostname = new URL(url).hostname.toLowerCase();
  return MANUAL_ONLY_HOSTS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
};

export interface Challenge {
  readonly identityId: string;
  readonly url: string;
  readonly method: ProofMethod;
  readonly token: string;
  /** Vrai quand la vérification est humaine : la CLI refusera de la faire à notre place. */
  readonly manual: boolean;
  /** Consigne à transmettre au client, telle quelle. */
  readonly instruction: string;
}

export interface IssueInput {
  readonly secret: string;
  readonly identityId: string;
  readonly url: string;
  readonly method: ProofMethod;
}

/**
 * Le fichier de preuve se lit à la **racine du domaine**, jamais au chemin déclaré : sinon un client hébergé sur une
 * page d'un domaine partagé prouverait la possession du domaine entier.
 */
export const wellKnownUrl = (url: string): string => {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error(`preuve impossible sur ${parsed.protocol}// : une URL vérifiable est en https`);
  return `${parsed.origin}${WELL_KNOWN_PATH}`;
};

/**
 * Ce que le jeton engage, et donc ce sur quoi il est dérivé : le **domaine** pour les méthodes qui prouvent le domaine,
 * la **page** pour celles qui prouvent la page. Sans cela, quatre pages d'un même site donneraient quatre jetons à
 * recopier dans un seul fichier de preuve — une consigne absurde, pour une garantie qui reste celle du domaine.
 */
const scopeOf = (url: string, method: ProofMethod): string => {
  const parsed = new URL(url);
  return method === "well_known_file" || method === "dns_txt" ? parsed.origin : parsed.href;
};

const instructionFor = (method: ProofMethod, url: string, token: string): string => {
  // `hostname` et non `host` : un port dans la consigne serait recopié dans un nom DNS, qui n'en porte pas.
  const host = new URL(url).hostname;
  switch (method) {
    case "well_known_file":
      return `Déposez un fichier texte à l'adresse https://${host}${WELL_KNOWN_PATH} contenant exactement cette ligne :\n${PROOF_PREFIX}=${token}`;
    case "meta_tag":
      return `Ajoutez cette balise dans le <head> de ${url} :\n<meta name="${PROOF_PREFIX}" content="${token}">`;
    case "dns_txt":
      return `Ajoutez un enregistrement DNS TXT sur ${host} (nom « @ ») dont la valeur est :\n${PROOF_PREFIX}=${token}`;
    case "profile_token":
      return `Placez cette chaîne dans un champ public de votre profil ${host} (titre, résumé ou bio) :\n${PROOF_PREFIX}=${token}\nLa vérification se fait **à la main**, par une visite normale, une seule fois : aucune automatisation n'est lancée sur cette plateforme. Vous pourrez retirer la chaîne ensuite.`;
  }
};

/**
 * Jeton dérivé du secret de l'opérateur, de l'identité et de l'URL. Dérivé plutôt que tiré au hasard : réémettre rend
 * le **même** jeton, donc un client qui reperd sa consigne n'a pas à recommencer la pose. Le jeton ne dépend pas de la
 * méthode, pour qu'il puisse changer d'avis sans nouvelle pose. Changer le secret invalide toutes les preuves en cours.
 */
export const issueChallenge = ({ secret, identityId, url, method }: IssueInput): Challenge => {
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`secret de preuve trop court (${secret.length} caractères, minimum ${MIN_SECRET_LENGTH}) : un jeton devinable ne prouve rien`);
  }
  if (method !== "profile_token" && isManualOnlyHost(url)) {
    throw new Error(
      `${new URL(url).hostname} ne se vérifie qu'à la main (proofMethod « profile_token ») : aucune requête automatisée n'est émise vers cette plateforme`,
    );
  }
  // Encodage non ambigu : une concaténation avec séparateur laisserait deux paires distinctes produire le même message
  // si l'identifiant contenait lui-même le séparateur, donc le même jeton.
  const token = createHmac("sha256", secret).update(JSON.stringify([identityId, scopeOf(url, method)])).digest("hex").slice(0, TOKEN_CHARS);
  return { identityId, url, method, token, manual: isManual(method), instruction: instructionFor(method, url, token) };
};

/** Comparaison à durée constante : le jeton est un secret, même si le divulguer n'ouvre qu'une fausse preuve. */
const sameToken = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
};

/**
 * La preuve est acceptée si le contenu récupéré porte le jeton, seul ou sous sa forme préfixée. On accepte les deux
 * parce que les interfaces DNS et les éditeurs de fichiers ajoutent volontiers des guillemets et des espaces.
 */
export const checkEvidence = (challenge: Challenge, evidence: string): boolean => {
  const wanted = challenge.token.toLowerCase();
  const candidates = evidence
    .toLowerCase()
    .split(/[\s"'<>,;]+/)
    .flatMap((word) => (word.startsWith(`${PROOF_PREFIX}=`) ? [word.slice(PROOF_PREFIX.length + 1)] : [word]));
  return candidates.some((candidate) => sameToken(candidate, wanted));
};
