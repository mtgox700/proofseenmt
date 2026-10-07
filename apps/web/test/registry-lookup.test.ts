import { describe, expect, it, vi } from "vitest";
import { lookUp } from "../src/data/registry-lookup";

describe("consultation du répertoire des entreprises", () => {
  it("interroge l'API publique par SIRET, sans clé, et rend sa réponse", async () => {
    const fetchMock = vi.fn(async () => Response.json({ results: [] }));
    expect(await lookUp("99913805000011", fetchMock as unknown as typeof fetch)).toEqual({ results: [] });
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe("https://recherche-entreprises.api.gouv.fr/search?q=99913805000011&per_page=1");
  });

  it("échoue sur une réponse en erreur : aucun verdict n'est tiré d'une panne", async () => {
    const fetchMock = vi.fn(async () => new Response("rate limited", { status: 429 }));
    await expect(lookUp("99913805000011", fetchMock as unknown as typeof fetch)).rejects.toThrow("429");
  });
});
