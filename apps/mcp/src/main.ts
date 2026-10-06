import { readFile } from "node:fs/promises";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { CatalogueSchema, contactTool, getProfileTool, searchInput, searchTool, type Catalogue } from "./tools";

/*
 * Proofseen MCP connector: read-only access to the public pseudonymous catalogue (ARCHITECTURE_ANONYME, contrainte 7).
 * It reads the same `api/profiles.json` the site publishes, so an assistant can never see more than a visitor.
 * Being listed in a connector directory is NOT guaranteed — that part belongs to the platforms.
 */

const loadCatalogue = async (source: string): Promise<Catalogue> => {
  const raw = source.startsWith("https://") ? await (await fetch(source)).text() : await readFile(source, "utf8");
  return CatalogueSchema.parse(JSON.parse(raw));
};

const main = async (): Promise<void> => {
  const source = process.argv[2] ?? process.env.PROOFSEEN_CATALOGUE;
  if (source === undefined) throw new Error("usage: proofseen-mcp <api/profiles.json | https://…/api/profiles.json>");
  const catalogue = await loadCatalogue(source);

  const server = new McpServer({ name: "proofseen", version: "0.1.0" });

  server.registerTool(
    "search_profiles",
    {
      title: "Chercher des freelances vérifiés",
      description:
        "Cherche des profils freelances pseudonymes vérifiés par Proofseen. Filtres déterministes, tri par date de mise à jour : aucun classement automatique, aucun score. Le contact passe toujours par Proofseen.",
      inputSchema: searchInput,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    (args) => searchTool(catalogue, args),
  );

  server.registerTool(
    "get_profile",
    {
      title: "Lire un profil",
      description: "Renvoie un profil pseudonyme par son identifiant public (ex. FR-8F42K).",
      inputSchema: { id: z.string().min(3).max(20).describe("Identifiant public du profil") },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ id }) => getProfileTool(catalogue, id),
  );

  server.registerTool(
    "how_to_contact",
    {
      title: "Comment entrer en contact",
      description:
        "Explique comment joindre un freelance : la demande passe par Proofseen, le freelance reste anonyme jusqu'à son accord, et l'identité réelle est communiquée avant tout engagement.",
      inputSchema: { id: z.string().min(3).max(20).optional().describe("Identifiant public du profil, si connu") },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ id }) => contactTool(catalogue, id),
  );

  await server.connect(new StdioServerTransport());
};

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "erreur inconnue"}\n`);
  process.exitCode = 1;
});
