import { existsSync } from "node:fs";
import { SURFACE_CHECK_MAX_AGE_DAYS } from "@proofseen/profiles";
import { byUrgency, summarise, type ClientView, type NextAction } from "@proofseen/workspace";
import { CliError } from "./files";
import { loadClientViews } from "./client-load";
import type { CommonOptions } from "./commands";

/*
 * Où en est chaque client.
 *
 * Avec dix dossiers ouverts et une livraison due au 31/12, l'état d'un client ne peut pas se reconstituer en ouvrant
 * cinq fichiers. Ce tableau le lit pour nous et, surtout, **dit la prochaine action** : une étape oubliée sur un client
 * qui a payé se paie en remboursement.
 *
 * Ce fichier ne décide plus de rien : il met en forme. L'état et la prochaine action viennent de `@proofseen/workspace`,
 * que l'espace client lit aussi — deux surfaces qui décident séparément finissent par se contredire devant quelqu'un
 * qui a payé. La version précédente décidait d'ailleurs de la suite en relisant sa propre colonne
 * (`!surface.startsWith("ok")`) : renommer un libellé y changeait la logique, sans qu'aucun test ne bouge.
 *
 * Règle de lecture inchangée : ce qui n'a pas pu être établi est affiché comme tel. Aucune case n'est cochée par défaut.
 */

export interface ClientStatusCommand extends Pick<CommonOptions, "log" | "now" | "runsDir"> {
  readonly clientsDir: string;
  /** Où `audit` écrit les rapports. Le dossier du client est regardé aussi : l'opérateur peut y écrire directement. */
  readonly reportDir: string;
}

interface Row {
  readonly reference: string;
  readonly possession: string;
  readonly surface: string;
  readonly wave: string;
  readonly report: string;
  readonly next: string;
}

/*
 * La formulation, pour l'opérateur : chaque action est nommée par la commande qui la réalise. L'espace client dira
 * autre chose à partir de la même valeur — c'est précisément pour ça que la décision ne vit pas ici.
 */
const phrase = (action: NextAction): string => {
  switch (action.kind) {
    case "unreadable":
      return "identity.json illisible";
    case "done":
      return "rien : livré";
    case "fill_identity":
      return "remplir identity.json (champs en attente)";
    case "prove_possession":
      return "possession --verify (aucune URL prouvée)";
    case "check_surface":
      return `surface-check (${action.reason === "missing" ? "jamais fait" : action.reason === "unreadable" ? "trace illisible" : `refusé ou plus de ${SURFACE_CHECK_MAX_AGE_DAYS} jours`})`;
    case "build_wave":
      return "client-wave";
    case "repair_manifest":
      // Volontairement manuel : la seule commande qui produirait un manifeste l'écraserait, `frozenAt` compris.
      return "manifest.json illisible : réparer ou supprimer à la main";
    case "freeze_manifest":
      return "figer frozenAt, puis preflight";
    case "measure":
      return "run --confirm-spend";
    case "deliver_report":
      return "audit";
  }
};

const rowOf = (view: ClientView): Row => {
  if (!view.facts.identityReadable) return { reference: view.reference, possession: "?", surface: "?", wave: "?", report: "?", next: phrase(view.action) };
  return {
    reference: view.reference,
    possession: `${view.facts.verifiedUrls}/${view.facts.ownedUrls}`,
    surface:
      view.facts.surface === "missing"
        ? "absent"
        : view.facts.surface === "unreadable"
          ? "illisible"
          : view.facts.surface === "blocked"
            ? "à refaire"
            : `ok (${view.surfaceCheckedAt})`,
    wave:
      view.facts.manifest === "missing"
        ? "absente"
        : view.facts.manifest === "unreadable"
          ? "illisible"
          : view.facts.measured
            ? `mesurée (${view.waveId})`
            : view.facts.manifest === "draft"
              ? "non figée"
              : "figée",
    report: view.facts.reportDelivered ? "remis" : "—",
    next: phrase(view.action),
  };
};

export const commandClientStatus = async (o: ClientStatusCommand): Promise<readonly Row[]> => {
  if (!existsSync(o.clientsDir)) throw new CliError(`${o.clientsDir} n'existe pas : aucun dossier client ouvert`);
  const views = await loadClientViews({ clientsDir: o.clientsDir, reportDir: o.reportDir, runsDir: o.runsDir, now: o.now });
  if (views.length === 0) {
    o.log(`Aucun client dans ${o.clientsDir}.`);
    return [];
  }

  const rows = views.map(rowOf);
  const width = (pick: (row: Row) => string, header: string) => Math.max(header.length, ...rows.map((row) => pick(row).length));
  const columns: readonly { readonly header: string; readonly pick: (row: Row) => string }[] = [
    { header: "Client", pick: (row) => row.reference },
    { header: "Preuve", pick: (row) => row.possession },
    { header: "Surface", pick: (row) => row.surface },
    { header: "Vague", pick: (row) => row.wave },
    { header: "Rapport", pick: (row) => row.report },
    { header: "Prochaine action", pick: (row) => row.next },
  ];
  const line = (cells: readonly string[]) => cells.map((cell, index) => cell.padEnd(width(columns[index]!.pick, columns[index]!.header))).join("  ").trimEnd();

  o.log(line(columns.map((column) => column.header)));
  o.log(line(columns.map((column) => "─".repeat(width(column.pick, column.header)))));
  for (const row of rows) o.log(line(columns.map((column) => column.pick(row))));

  const counts = summarise(views);
  o.log("");
  o.log(`${counts.complete}/${counts.total} rapport(s) remis.`);
  // Ce qui attend le client ne s'obtient pas en relançant une commande : le dire évite d'attendre sans le savoir.
  if (counts.waitingOnClient > 0) {
    const blocked = [...views].sort(byUrgency).filter((view) => !view.complete && view.actor === "client");
    o.log(`${counts.waitingOnClient} dossier(s) attendent le client : ${blocked.map((view) => view.reference).join(", ")}.`);
  }
  const unreadable = views.filter((view) => view.unreadable.length > 0);
  for (const view of unreadable) o.log(`${view.reference} : fichier(s) illisible(s) — ${view.unreadable.join(", ")}`);
  return rows;
};
