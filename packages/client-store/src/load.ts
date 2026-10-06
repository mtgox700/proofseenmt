import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { IdentitySchema, ManifestSchema, hasPlaceholder, verifiedUrls } from "@proofseen/core";
import { SurfaceCheckRecordSchema, surfaceCheckBlocker } from "@proofseen/profiles";
import { buildClientView, type ClientFacts, type ClientView } from "@proofseen/workspace";

/*
 * Lecture d'un dossier client sur disque, vers la vue que toutes les surfaces partagent.
 *
 * Ce code vivait dans `apps/cli`. Il en sort parce que le web en a besoin aussi, et qu'un site n'a pas à importer une
 * CLI à l'exécution. `@proofseen/workspace` reste pur — types et décisions, aucune entrée-sortie ; **ici** vit tout ce
 * qui touche le disque. La séparation n'est pas cosmétique : elle empêche `node:fs` d'arriver dans un composant client
 * par la porte des types.
 *
 * Ce lecteur distingue **absent** de **illisible**, ce qu'une version précédente ne faisait pas : tout échec de lecture
 * devenait « absent ». Un `manifest.json` corrompu s'affichait donc « vague absente », la prochaine action devenait
 * `client-wave`, et la relancer aurait réécrit par-dessus — y compris par-dessus un manifeste déjà figé, c'est-à-dire
 * par-dessus l'instrument avec lequel un client payant a été mesuré.
 */

/**
 * Format d'une référence, contrôlé **avant** de toucher au disque.
 *
 * Ce n'est pas une coquetterie : la référence vient de l'URL quand le web appelle `loadClientView`. Sans ce contrôle,
 * `../../..` sortirait du dossier des clients et ferait lire n'importe quel fichier de la machine. Un chemin ne se
 * construit jamais avec une chaîne reçue de l'extérieur sans l'avoir d'abord reconnue.
 */
export const REFERENCE = /^[A-Za-z0-9_-]{1,40}$/;

type Loaded<T> = { readonly state: "absent" } | { readonly state: "unreadable" } | { readonly state: "ok"; readonly value: T };

const load = async <T>(path: string, parse: (value: unknown) => T): Promise<Loaded<T>> => {
  if (!existsSync(path)) return { state: "absent" };
  try {
    return { state: "ok", value: parse(JSON.parse(await readFile(path, "utf8"))) };
  } catch {
    return { state: "unreadable" };
  }
};

/** Les rapports remis, où qu'ils aient été écrits. Les noms seuls : un chemin disque ne sort pas d'ici. */
const reportsFor = async (dirs: readonly string[], reference: string): Promise<readonly string[]> => {
  const found = new Set<string>();
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const file of await readdir(dir)) if (file.startsWith(`audit-${reference}-`) && file.endsWith(".html")) found.add(file);
  }
  return [...found].sort();
};

export interface ClientStoreOptions {
  readonly clientsDir: string;
  /** Où chercher les rapports, en plus du dossier du client lui-même. `audit` écrit dans `report/` par défaut. */
  readonly reportDirs: readonly string[];
  readonly runsDir: string;
  readonly now: () => Date;
}

/** La vue d'un client, ou `null` si aucun dossier ne porte cette référence — ou si elle n'a pas la bonne forme. */
export const loadClientView = async (reference: string, o: ClientStoreOptions): Promise<ClientView | null> => {
  if (!REFERENCE.test(reference)) return null;
  const dir = join(o.clientsDir, reference);
  if (!existsSync(dir)) return null;

  const unreadable: string[] = [];
  const identity = await load(join(dir, "identity.json"), (v) => IdentitySchema.parse(v));
  const reportFiles = await reportsFor([dir, ...o.reportDirs], reference);

  if (identity.state !== "ok") {
    // Sans identité lisible, aucune autre case ne peut être affirmée : ne rien cocher plutôt que cocher au hasard.
    const blind: ClientFacts = { identityReadable: false, hasPlaceholders: false, ownedUrls: 0, verifiedUrls: 0, surface: "missing", manifest: "missing", measured: false, reportDelivered: false };
    return buildClientView({ reference, displayName: null, facts: blind, surfaceCheckedAt: null, waveId: null, reportFiles, unreadable: ["identity.json"] });
  }

  const verified = verifiedUrls(identity.value);

  // Même convention que la CLI : la trace porte le nom du fichier d'identité (`identity.surface-check.json`).
  const record = await load(join(dir, "identity.surface-check.json"), (v) => SurfaceCheckRecordSchema.parse(v));
  if (record.state === "unreadable") unreadable.push("identity.surface-check.json");
  const blocked =
    record.state !== "ok" ||
    surfaceCheckBlocker({ record: record.value, identityId: identity.value.id, urls: verified.map((owned) => owned.url), now: o.now() }) !== null;

  const manifest = await load(join(dir, "manifest.json"), (v) => ManifestSchema.parse(v));
  if (manifest.state === "unreadable") unreadable.push("manifest.json");
  const measured = manifest.state === "ok" && existsSync(join(o.runsDir, manifest.value.waveId, "wave.json"));

  const facts: ClientFacts = {
    identityReadable: true,
    hasPlaceholders: [identity.value.city, ...identity.value.stack].some(hasPlaceholder),
    ownedUrls: identity.value.ownedUrls.length,
    verifiedUrls: verified.length,
    surface: record.state === "absent" ? "missing" : record.state === "unreadable" ? "unreadable" : blocked ? "blocked" : "fresh",
    // Un manifeste illisible n'est pas un manifeste absent : `missing` mènerait à `client-wave`, qui l'écraserait en
    // silence — `frozenAt` compris, c'est-à-dire l'instrument avec lequel un client payant a peut-être déjà été mesuré.
    manifest: manifest.state === "absent" ? "missing" : manifest.state === "unreadable" ? "unreadable" : manifest.value.frozenAt === null ? "draft" : "frozen",
    measured,
    reportDelivered: reportFiles.length > 0,
  };

  return buildClientView({
    reference,
    displayName: identity.value.displayName,
    facts,
    surfaceCheckedAt: record.state === "ok" ? record.value.checkedAt.slice(0, 10) : null,
    waveId: manifest.state === "ok" ? manifest.value.waveId : null,
    reportFiles,
    unreadable,
  });
};

/** Toutes les vues clients, par référence. Le tri d'affichage appartient à la surface qui affiche. */
export const loadClientViews = async (o: ClientStoreOptions): Promise<readonly ClientView[]> => {
  if (!existsSync(o.clientsDir)) return [];
  const references = (await readdir(o.clientsDir, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  const views = await Promise.all(references.sort().map((reference) => loadClientView(reference, o)));
  // Un dossier dont le nom n'a pas la forme d'une référence est ignoré plutôt que de faire échouer la liste entière.
  return views.filter((view): view is ClientView => view !== null);
};
