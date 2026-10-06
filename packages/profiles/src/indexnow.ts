/*
 * IndexNow (Bing, Yandex, Seznam, Naver… — one submission is shared between them): the day-one submission of the
 * three-arm test (PIVOT_ANONYME §5). Proofseen proves it owns the host by serving `<key>.txt` at the root.
 *
 * CONTROLLED: the key file, the list of URLs, the moment we submit. NOT GUARANTEED: that an engine crawls, indexes or
 * cites anything — IndexNow is a notification, not an instruction. Google does not take part: Search Console is the
 * founder's manual step.
 */

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
/** Protocol rule: 8 to 128 characters, letters, digits and dashes. */
export const INDEXNOW_KEY = /^[A-Za-z0-9-]{8,128}$/;
/** Protocol limit per request. */
export const INDEXNOW_MAX_URLS = 10_000;

export interface IndexNowPayload {
  readonly host: string;
  readonly key: string;
  readonly keyLocation: string;
  readonly urlList: readonly string[];
}

export const indexNowKeyFile = (key: string): { path: string; content: string } => {
  if (!INDEXNOW_KEY.test(key)) throw new Error("clé IndexNow invalide : 8 à 128 caractères, lettres, chiffres et tirets");
  return { path: `${key}.txt`, content: `${key}\n` };
};

/** Every URL must belong to the host that serves the key, or the whole request is rejected (HTTP 422). */
export const indexNowPayload = (baseUrl: string, key: string, urls: readonly string[]): IndexNowPayload => {
  const host = new URL(baseUrl).host;
  const foreign = urls.filter((url) => new URL(url).host !== host);
  if (foreign.length > 0) throw new Error(`URL hors du domaine ${host} : ${foreign.slice(0, 3).join(", ")}`);
  if (urls.length === 0) throw new Error("aucune URL à soumettre");
  if (urls.length > INDEXNOW_MAX_URLS) throw new Error(`${urls.length} URL : le protocole en accepte ${INDEXNOW_MAX_URLS} par requête`);
  return { host, key: indexNowKeyFile(key).path.replace(/\.txt$/, ""), keyLocation: `${baseUrl}/${key}.txt`, urlList: [...urls] };
};

/** The URLs of a published sitemap, in order. */
export const sitemapUrls = (sitemap: string): string[] => [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!.replace(/&amp;/g, "&"));

/** What each answer of the endpoint means, in plain words (https://www.indexnow.org/documentation). */
export const indexNowOutcome = (status: number): { readonly ok: boolean; readonly meaning: string } => {
  switch (status) {
    case 200:
      return { ok: true, meaning: "URL reçues" };
    case 202:
      return { ok: true, meaning: "URL reçues, la clé sera vérifiée plus tard" };
    case 400:
      return { ok: false, meaning: "requête mal formée" };
    case 403:
      return { ok: false, meaning: "clé refusée : le fichier de clé n'est pas servi ou ne correspond pas" };
    case 422:
      return { ok: false, meaning: "URL n'appartenant pas au domaine, ou clé non conforme au protocole" };
    case 429:
      return { ok: false, meaning: "trop de requêtes : soumettre moins souvent" };
    default:
      return { ok: false, meaning: `réponse inattendue (HTTP ${status})` };
  }
};
