import { IdentitySchema, type Identity, type OwnedUrl } from "@proofseen/core";
import { checkEvidence, issueChallenge, wellKnownUrl, type Challenge, type ProofMethod } from "@proofseen/profiles";
import { CliError, loadJson, writeText } from "./files";
import { safeFetchText } from "./safe-fetch";
import type { CommonOptions } from "./commands";

/*
 * Preuve de possession (US-F00). Deux temps : `--issue` remet au client la consigne à poser, `--verify` va la lire.
 *
 * Trois règles tenues ici :
 *  - **aucune requête vers LinkedIn, Malt ou GitHub** : la méthode `profile_token` est déclarée manuelle et la commande
 *    refuse de la vérifier à notre place, au lieu de la vérifier discrètement (ligne rouge du projet) ;
 *  - une URL qui échoue **reste non vérifiée** : on n'écrit jamais une date de vérification qu'on n'a pas obtenue ;
 *  - le secret de preuve vient de l'environnement et n'est jamais affiché, pas même tronqué.
 */

/** Ce que la commande sait aller chercher elle-même, et par quel moyen. */
type Source = "https" | "dns";
const SOURCE_OF: Readonly<Record<Exclude<ProofMethod, "profile_token">, Source>> = {
  well_known_file: "https",
  meta_tag: "https",
  dns_txt: "dns",
};

export type FetchText = (url: string, timeoutMs: number) => Promise<string>;
export type ResolveTxt = (host: string) => Promise<readonly string[]>;

export interface PossessionCommand extends Pick<CommonOptions, "log" | "env" | "now"> {
  readonly identityPath: string;
  readonly mode: "issue" | "verify";
  readonly timeoutMs: number;
  readonly fetchText?: FetchText;
  readonly resolveTxt?: ResolveTxt;
}

const SECRET_VAR = "PROOFSEEN_PROOF_SECRET";

/**
 * L'adresse vient du client : elle passe par le récupérateur durci (https seul, adresses internes refusées à la
 * connexion, redirections revalidées une à une, corps borné). Un `fetch` nu ferait de cette commande un moyen de faire
 * frapper notre propre réseau, et un service interne qui renvoie sa requête suffirait à forger une preuve.
 */
const defaultFetchText: FetchText = (url, timeoutMs) => safeFetchText(url, { timeoutMs });

const defaultResolveTxt: ResolveTxt = async (host) => {
  const { resolveTxt } = await import("node:dns/promises");
  return (await resolveTxt(host)).map((chunks) => chunks.join(""));
};

/** Où la preuve se lit, pour chaque méthode automatisable. */
const evidenceFor = async (challenge: Challenge, o: PossessionCommand): Promise<string> => {
  const method = challenge.method as Exclude<ProofMethod, "profile_token">;
  if (SOURCE_OF[method] === "dns") {
    const records = await (o.resolveTxt ?? defaultResolveTxt)(new URL(challenge.url).hostname);
    return records.join("\n");
  }
  const target = method === "well_known_file" ? wellKnownUrl(challenge.url) : challenge.url;
  return await (o.fetchText ?? defaultFetchText)(target, o.timeoutMs);
};

interface Outcome {
  readonly url: OwnedUrl;
  readonly challenge: Challenge;
  readonly verified: boolean;
  readonly detail: string;
}

const verifyOne = async (challenge: Challenge, url: OwnedUrl, o: PossessionCommand): Promise<Outcome> => {
  if (challenge.manual) {
    return { url, challenge, verified: false, detail: "vérification manuelle : aucune requête n'est émise vers cette plateforme" };
  }
  try {
    const evidence = await evidenceFor(challenge, o);
    return checkEvidence(challenge, evidence)
      ? { url, challenge, verified: true, detail: "jeton trouvé" }
      : { url, challenge, verified: false, detail: "jeton absent de la réponse" };
  } catch (error) {
    // La cause exacte aide le client à corriger ; elle ne contient ni le secret ni le jeton.
    return { url, challenge, verified: false, detail: `preuve illisible (${error instanceof Error ? error.message : "erreur inconnue"})` };
  }
};

/**
 * Une URL déjà vérifiée le reste : on ne réécrit sa date que si la preuve tient toujours. Une URL qui échoue repasse à
 * `null` — mieux vaut refuser de mesurer que mesurer quelqu'un d'autre sur une preuve périmée.
 */
const applyOutcomes = (identity: Identity, outcomes: readonly Outcome[], at: string): Identity => {
  const byUrl = new Map(outcomes.map((outcome) => [outcome.url.url, outcome]));
  return {
    ...identity,
    ownedUrls: identity.ownedUrls.map((owned) => {
      const outcome = byUrl.get(owned.url);
      if (outcome === undefined || outcome.challenge.manual) return owned;
      return { ...owned, verifiedAt: outcome.verified ? at : null };
    }),
  };
};

export const commandPossession = async (o: PossessionCommand): Promise<Identity> => {
  const identity = await loadJson(o.identityPath, IdentitySchema, "identité");
  const secret = o.env[SECRET_VAR];
  if (secret === undefined || secret === "") {
    throw new CliError(`${SECRET_VAR} absent de l'environnement : sans secret, le jeton serait devinable et ne prouverait rien`);
  }

  // Un refus d'émission (plateforme à vérification manuelle, secret trop court) doit dire à l'opérateur *pourquoi* :
  // seuls les messages de `CliError` sont affichés, les autres sont réduits à leur classe.
  const challenges = identity.ownedUrls.map((owned) => {
    try {
      return issueChallenge({ secret, identityId: identity.id, url: owned.url, method: owned.proofMethod });
    } catch (error) {
      throw new CliError(`${owned.url} : ${error instanceof Error ? error.message : "consigne de preuve impossible"}`);
    }
  });

  if (o.mode === "issue") {
    o.log(`Consignes de preuve pour ${identity.id} — ${challenges.length} URL. À transmettre telles quelles au client.\n`);
    for (const challenge of challenges) {
      o.log(`## ${challenge.url}${challenge.manual ? "  (vérification manuelle)" : ""}\n${challenge.instruction}\n`);
    }
    return identity;
  }

  const outcomes: Outcome[] = [];
  for (const [index, challenge] of challenges.entries()) {
    outcomes.push(await verifyOne(challenge, identity.ownedUrls[index]!, o));
  }
  for (const outcome of outcomes) {
    o.log(`${outcome.verified ? "[ ok ]" : "[ -- ]"} ${outcome.url.url} · ${outcome.url.proofMethod} · ${outcome.detail}`);
  }

  const updated = applyOutcomes(identity, outcomes, o.now().toISOString());
  await writeText(o.identityPath, `${JSON.stringify(updated, null, 2)}\n`);
  const verified = updated.ownedUrls.filter((owned) => owned.verifiedAt !== null).length;
  const manual = outcomes.filter((outcome) => outcome.challenge.manual).length;
  o.log(
    `\n${verified}/${identity.ownedUrls.length} URL vérifiées${manual > 0 ? ` · ${manual} à vérifier à la main (aucune automatisation sur ces plateformes)` : ""}.`,
  );
  if (verified === 0) o.log("Aucune URL vérifiée : aucun appariement ne sera calculé pour cette identité (US-F00).");
  return updated;
};
