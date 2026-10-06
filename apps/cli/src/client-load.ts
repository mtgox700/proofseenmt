import { loadClientViews as loadFromStore } from "@proofseen/client-store";
import type { ClientView } from "@proofseen/workspace";

/*
 * La lecture des dossiers clients vit désormais dans `@proofseen/client-store`, parce que le web en a besoin aussi et
 * qu'un site n'a pas à importer une CLI à l'exécution (demande de la session design, 01/10).
 *
 * Ce fichier ne garde que l'adaptation des options : la CLI a un `--report-dir` unique, le magasin en accepte
 * plusieurs. Traduire ici évite de propager la forme des options de la CLI dans un paquet partagé.
 */

export interface LoadClientOptions {
  readonly clientsDir: string;
  /** Où `audit` écrit les rapports. Le dossier du client est regardé aussi : l'opérateur peut y écrire directement. */
  readonly reportDir: string;
  readonly runsDir: string;
  readonly now: () => Date;
}

export const loadClientViews = (o: LoadClientOptions): Promise<readonly ClientView[]> =>
  loadFromStore({ clientsDir: o.clientsDir, reportDirs: [o.reportDir], runsDir: o.runsDir, now: o.now });
