import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadClientView, loadClientViews } from "../src";

/*
 * Le magasin des dossiers clients, éprouvé sur de vrais fichiers.
 *
 * Il est sorti de `apps/cli` pour que le web puisse l'appeler sans importer une CLI. Ce déplacement crée **un risque
 * nouveau** que la version CLI n'avait pas : là-bas, les références venaient de `readdir`, donc du disque. Ici, le web
 * passera une référence **venue de l'URL**. Une chaîne reçue de l'extérieur qui entre dans un chemin, c'est une
 * traversée de répertoire — d'où le contrôle de forme avant toute lecture, et les tests qui le fixent.
 */

let root = "";
const now = () => new Date("2026-10-01T12:00:00+02:00");

const options = () => ({ clientsDir: join(root, "clients"), reportDirs: [join(root, "report")], runsDir: join(root, "runs"), now });

const identity = (id: string) => ({
  id,
  displayName: "Camille Dupont",
  nameVariants: ["Camille Dupont"],
  city: "Paris",
  stack: ["TypeScript"],
  ownedUrls: [{ url: "https://exemple.fr/", proofMethod: "well_known_file", verifiedAt: "2026-09-20T10:00:00+02:00" }],
});

const client = async (reference: string, files: Record<string, string>) => {
  const dir = join(root, "clients", reference);
  await mkdir(dir, { recursive: true });
  for (const [name, body] of Object.entries(files)) await writeFile(join(dir, name), body);
};

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "proofseen-store-"));
  await mkdir(join(root, "clients"), { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("une référence venue de l'extérieur ne construit pas un chemin", () => {
  it("refuse une traversée de répertoire plutôt que de lire ailleurs sur la machine", async () => {
    // Le web passera la référence de l'URL. Sans ce refus, `../..` sortirait du dossier des clients.
    for (const evil of ["../../etc/passwd", "..", "../clients", "FR-1AB2C/../../..", "a/b", "a\b"]) {
      expect(await loadClientView(evil, options())).toBeNull();
    }
  });

  it("refuse aussi ce qui a la bonne forme mais n'existe pas", async () => {
    expect(await loadClientView("FR-9ZZZZ", options())).toBeNull();
  });

  it("accepte une référence bien formée qui existe", async () => {
    await client("FR-1AB2C", { "identity.json": JSON.stringify(identity("FR-1AB2C")) });
    const view = await loadClientView("FR-1AB2C", options());
    expect(view?.reference).toBe("FR-1AB2C");
    expect(view?.displayName).toBe("Camille Dupont");
  });
});

describe("ce que le magasin rend", () => {
  it("n'affirme rien d'un dossier dont l'identité est illisible", async () => {
    await client("FR-1AB2C", { "identity.json": "{ tronqué" });
    const view = await loadClientView("FR-1AB2C", options());
    expect(view?.facts.identityReadable).toBe(false);
    expect(view?.displayName).toBeNull();
    expect(view?.action).toEqual({ kind: "unreadable" });
  });

  it("distingue un manifeste illisible d'un manifeste absent", async () => {
    // `missing` mènerait à `client-wave`, qui écraserait le fichier — `frozenAt` compris.
    await client("FR-1AB2C", {
      "identity.json": JSON.stringify(identity("FR-1AB2C")),
      "identity.surface-check.json": JSON.stringify({ identityId: "FR-1AB2C", checkedAt: "2026-09-28T09:00:00+02:00", pages: [{ url: "https://exemple.fr/", outcome: "clean", kinds: [] }] }),
      "manifest.json": '{"waveId":"X", TRONQUÉ',
    });
    const view = await loadClientView("FR-1AB2C", options());
    expect(view?.facts.manifest).toBe("unreadable");
    expect(view?.action).toEqual({ kind: "repair_manifest" });
  });

  it("ne porte que des noms de rapport, jamais un chemin de disque", async () => {
    await client("FR-1AB2C", { "identity.json": JSON.stringify(identity("FR-1AB2C")) });
    await mkdir(join(root, "report"), { recursive: true });
    await writeFile(join(root, "report", "audit-FR-1AB2C-2026-10-24.html"), "<html></html>");
    const view = await loadClientView("FR-1AB2C", options());
    expect(view?.reportFiles).toEqual(["audit-FR-1AB2C-2026-10-24.html"]);
    for (const file of view!.reportFiles) {
      expect(file.includes("/")).toBe(false);
      expect(file.includes("\\")).toBe(false);
    }
  });
});

describe("la liste complète", () => {
  it("rend un dossier vide quand le répertoire des clients n'existe pas", async () => {
    // Le web appellera avant qu'aucun client n'existe : lever ici ferait planter une page pour rien.
    expect(await loadClientViews({ ...options(), clientsDir: join(root, "nulle-part") })).toEqual([]);
  });

  it("ignore un dossier dont le nom n'est pas une référence, sans faire échouer le reste", async () => {
    await client("FR-1AB2C", { "identity.json": JSON.stringify(identity("FR-1AB2C")) });
    await mkdir(join(root, "clients", "notes perso"), { recursive: true });
    const views = await loadClientViews(options());
    expect(views.map((view) => view.reference)).toEqual(["FR-1AB2C"]);
  });
});
