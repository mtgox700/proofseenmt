import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { loadClientViews } from "../src/client-load";

/*
 * Le lecteur des dossiers clients, éprouvé sur de vrais fichiers.
 *
 * Ces tests existent pour une raison précise : la version précédente traitait **tout** échec de lecture comme
 * « absent ». Un `manifest.json` corrompu s'affichait donc « vague absente », la prochaine action devenait
 * `client-wave`, et la relancer aurait réécrit par-dessus — y compris par-dessus un manifeste figé, c'est-à-dire
 * par-dessus l'instrument avec lequel un client payant a été mesuré. Aucun test unitaire ne le voyait : le défaut
 * vivait dans la lecture du disque, pas dans la logique.
 */

let root = "";
const now = () => new Date("2026-09-29T12:00:00+02:00");

const identity = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  displayName: "Camille Dupont",
  nameVariants: ["Camille Dupont"],
  city: "Paris",
  stack: ["TypeScript"],
  ownedUrls: [{ url: `https://exemple-${id}.fr`, proofMethod: "well_known_file", verifiedAt: "2026-09-20T10:00:00+02:00" }],
  ...overrides,
});

const client = async (reference: string, files: Record<string, string>) => {
  const dir = join(root, "clients", reference);
  await mkdir(dir, { recursive: true });
  for (const [name, body] of Object.entries(files)) await writeFile(join(dir, name), body);
};

const load = () => loadClientViews({ clientsDir: join(root, "clients"), reportDir: join(root, "report"), runsDir: join(root, "runs"), now });

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "proofseen-clients-"));
  await mkdir(join(root, "clients"), { recursive: true });
});

describe("un fichier illisible n'est pas un fichier absent", () => {
  it("refuse de proposer client-wave par-dessus un manifeste corrompu", async () => {
    await client("FR-AAAAA", {
      "identity.json": JSON.stringify(identity("id-a")),
      "identity.surface-check.json": JSON.stringify({ identityId: "id-a", checkedAt: "2026-09-26T09:00:00+02:00", pages: [{ url: "https://exemple-id-a.fr", outcome: "clean", kinds: [] }] }),
      "manifest.json": '{"waveId":"AUDIT-FR-AAAAA", TRONQUÉ',
    });
    const [view] = await load();
    expect(view!.facts.manifest).toBe("unreadable");
    expect(view!.action).toEqual({ kind: "repair_manifest" });
    expect(view!.unreadable).toEqual(["manifest.json"]);
  });

  it("propose bien client-wave quand le manifeste est réellement absent", async () => {
    await client("FR-AAAAA", {
      "identity.json": JSON.stringify(identity("id-a")),
      "identity.surface-check.json": JSON.stringify({ identityId: "id-a", checkedAt: "2026-09-26T09:00:00+02:00", pages: [{ url: "https://exemple-id-a.fr", outcome: "clean", kinds: [] }] }),
    });
    const [view] = await load();
    expect(view!.facts.manifest).toBe("missing");
    expect(view!.action).toEqual({ kind: "build_wave" });
    expect(view!.unreadable).toEqual([]);
  });

  it("nomme une trace de contrôle corrompue au lieu de la dire jamais faite", async () => {
    await client("FR-AAAAA", { "identity.json": JSON.stringify(identity("id-a")), "identity.surface-check.json": "{ pas du json" });
    const [view] = await load();
    expect(view!.facts.surface).toBe("unreadable");
    expect(view!.action).toEqual({ kind: "check_surface", reason: "unreadable" });
    expect(view!.unreadable).toContain("identity.surface-check.json");
  });

  it("n'affirme rien d'un client dont l'identité est illisible", async () => {
    await client("FR-CCCCC", { "identity.json": "{ tronqué" });
    const [view] = await load();
    expect(view!.facts.identityReadable).toBe(false);
    expect(view!.displayName).toBeNull();
    expect(view!.action).toEqual({ kind: "unreadable" });
    // Aucune case cochée au hasard : zéro ici veut dire « inconnu », et l'action le dit.
    expect(view!.facts.verifiedUrls).toBe(0);
  });
});

describe("ce qui est lu vient bien du disque", () => {
  it("compte les URL prouvées, pas les URL déclarées", async () => {
    const two = identity("id-a", {
      ownedUrls: [
        { url: "https://prouvee.fr", proofMethod: "well_known_file", verifiedAt: "2026-09-20T10:00:00+02:00" },
        { url: "https://declaree.fr", proofMethod: "meta_tag", verifiedAt: null },
      ],
    });
    await client("FR-AAAAA", { "identity.json": JSON.stringify(two) });
    const [view] = await load();
    expect(view!.facts.ownedUrls).toBe(2);
    expect(view!.facts.verifiedUrls).toBe(1);
  });

  it("réclame les champs en attente avant la preuve de possession", async () => {
    await client("FR-AAAAA", { "identity.json": JSON.stringify(identity("id-a", { city: "À RENSEIGNER" })) });
    const [view] = await load();
    expect(view!.facts.hasPlaceholders).toBe(true);
    expect(view!.action).toEqual({ kind: "fill_identity" });
  });

  it("trouve un rapport écrit dans le dossier de rapports comme dans celui du client", async () => {
    await client("FR-AAAAA", { "identity.json": JSON.stringify(identity("id-a")) });
    await mkdir(join(root, "report"), { recursive: true });
    await writeFile(join(root, "report", "audit-FR-AAAAA-2026-10-24.html"), "<html></html>");
    const [view] = await load();
    expect(view!.reportFiles).toEqual(["audit-FR-AAAAA-2026-10-24.html"]);
    expect(view!.complete).toBe(true);
  });

  it("ne confond pas deux clients dont la référence commence pareil", async () => {
    await client("FR-AAAAA", { "identity.json": JSON.stringify(identity("id-a")) });
    await client("FR-AAAAAB", { "identity.json": JSON.stringify(identity("id-b")) });
    await mkdir(join(root, "report"), { recursive: true });
    await writeFile(join(root, "report", "audit-FR-AAAAAB-2026-10-24.html"), "<html></html>");
    const views = await load();
    // Le préfixe `audit-FR-AAAAA-` ne doit pas attraper `audit-FR-AAAAAB-` : le tiret fait la séparation.
    expect(views.find((v) => v.reference === "FR-AAAAA")!.reportFiles).toEqual([]);
    expect(views.find((v) => v.reference === "FR-AAAAAB")!.reportFiles).toHaveLength(1);
  });
});
