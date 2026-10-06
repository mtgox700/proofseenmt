import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkAccess } from "@proofseen/access";
import { commandAccess, commandIntake } from "../src/intake";

/*
 * L'inscription bout en bout. Elle existe parce que sans elle, personne ne peut ouvrir un dossier seul — et une phase
 * de test où des gens arrivent d'eux-mêmes est impossible.
 */

const SECRET = "un-secret-de-test-de-plus-de-32-caracteres";
const NOW = new Date("2026-09-30T09:00:00+02:00");

let dir = "";
const logs: string[] = [];
const log = (message: string) => void logs.push(message);

const submission = (over: Record<string, unknown> = {}) => ({
  displayName: "Camille Dupont",
  urls: ["https://camille-dupont.fr/"],
  email: "camille@exemple.fr",
  lang: "fr",
  consentAt: "2026-09-30T08:59:00+02:00",
  ...over,
});

const write = async (body: Record<string, unknown>): Promise<string> => {
  const path = join(dir, "inscription.json");
  await writeFile(path, JSON.stringify(body));
  return path;
};

const intake = (path: string, over: Partial<Parameters<typeof commandIntake>[0]> = {}) =>
  commandIntake({ log, now: () => NOW, submissionPath: path, outDir: join(dir, "clients"), ...over });

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "proofseen-intake-"));
  logs.length = 0;
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("une inscription ouvre un dossier complet", () => {
  it("écrit l'identité, la demande, le contact et le dossier d'offres", async () => {
    const out = await intake(await write(submission()));
    for (const file of ["identity.json", "request.json", "contact.json", "offres"]) expect(existsSync(join(out, file))).toBe(true);
  });

  it("garde l'e-mail hors de l'identité, qui alimente le profil public", async () => {
    // Le point de toute la séparation : ce qui entre dans `identity.json` peut finir indexé.
    const out = await intake(await write(submission()));
    expect(await readFile(join(out, "identity.json"), "utf8")).not.toContain("camille@exemple.fr");
    expect(await readFile(join(out, "contact.json"), "utf8")).toContain("camille@exemple.fr");
  });

  it("ne compte aucune adresse comme prouvée d'office", async () => {
    // Une possession cochée d'office ferait sauter le garde-fou qui interdit de mesurer sans preuve.
    const out = await intake(await write(submission()));
    const identity = JSON.parse(await readFile(join(out, "identity.json"), "utf8")) as { ownedUrls: { verifiedAt: string | null }[] };
    expect(identity.ownedUrls.every((owned) => owned.verifiedAt === null)).toBe(true);
  });

  it("tire une référence au hasard quand on ne lui en impose pas", async () => {
    const out = await intake(await write(submission()));
    expect(out).toMatch(/FR-[A-Z0-9]{5}$/);
  });
});

describe("ce que l'inscription refuse avant d'écrire", () => {
  it("refuse une inscription qui n'apporte que des plateformes non vérifiables, sans rien créer", async () => {
    // Ouvrir le dossier reviendrait à promettre une mesure qu'on ne pourra jamais commencer.
    const path = await write(submission({ urls: ["https://www.linkedin.com/in/camille/", "https://www.malt.fr/profile/camille"] }));
    await expect(intake(path)).rejects.toThrow(/aucune adresse vérifiable/);
    expect(existsSync(join(dir, "clients"))).toBe(false);
  });

  it("n'écrase jamais un dossier existant", async () => {
    const path = await write(submission());
    await intake(path, { reference: "FR-1AB2C" });
    await expect(intake(path, { reference: "FR-1AB2C" })).rejects.toThrow(/existe déjà/);
  });

  it("refuse une inscription mal formée plutôt que d'en deviner les trous", async () => {
    await expect(intake(await write(submission({ email: "pas-une-adresse" })))).rejects.toThrow();
    await expect(intake(await write(submission({ urls: ["http://camille-dupont.fr/"] })))).rejects.toThrow();
  });
});

describe("le lien d'espace", () => {
  it("n'est émis que si un secret est fourni, et ouvre bien ce dossier-là", async () => {
    await intake(await write(submission()), { reference: "FR-1AB2C", accessSecret: SECRET });
    const line = logs.find((message) => message.startsWith("Lien d'espace"));
    expect(line).toBeDefined();
    const token = line!.split("?t=")[1]!;
    expect(checkAccess({ token, secret: SECRET, now: NOW, expected: "FR-1AB2C" }).ok).toBe(true);
    // Et rien d'autre : présenté sur la page d'un autre dossier, il ne vaut rien.
    expect(checkAccess({ token, secret: SECRET, now: NOW, expected: "FR-9ZZZZ" }).ok).toBe(false);
  });

  it("ouvre quand même le dossier sans secret, en le disant", async () => {
    // Un secret manquant ne doit pas faire perdre l'inscription de quelqu'un.
    const out = await intake(await write(submission()));
    expect(existsSync(join(out, "identity.json"))).toBe(true);
    expect(logs.join("\n")).toContain("PROOFSEEN_ACCESS_SECRET");
  });

  const access = (over: Partial<Parameters<typeof commandAccess>[0]> = {}) =>
    commandAccess({ log, now: () => NOW, reference: "FR-1AB2C", secret: SECRET, ttlDays: 7, clientsDir: join(dir, "clients"), ...over });

  it("se ré-émet pour un dossier déjà ouvert", async () => {
    const token = await access();
    const check = checkAccess({ token, secret: SECRET, now: new Date(NOW.getTime() + 6 * 24 * 3600 * 1000) });
    expect(check.ok).toBe(true);
    expect(checkAccess({ token, secret: SECRET, now: new Date(NOW.getTime() + 8 * 24 * 3600 * 1000) }).ok).toBe(false);
  });

  it("ré-émet dans la langue du destinataire, lue dans son dossier", async () => {
    // Même défaut que celui corrigé dans `intake`, et il vivait toujours ici : le lien partait sans la langue.
    // La langue a été demandée à l'inscription ; ne pas s'en servir reviendrait à l'avoir demandée pour rien.
    await intake(await write(submission({ lang: "en" })), { reference: "FR-1AB2C" });
    await access();
    expect(logs.join(" | ")).toContain("/en/espace/FR-1AB2C?t=");
  });

  it("retombe sur le français quand le dossier n'existe pas, sans échouer", async () => {
    // Réémettre un lien doit rester possible même si le contact est illisible : on choisit une langue, on le dit.
    await access({ reference: "FR-9ZZZZ" });
    expect(logs.join(" | ")).toContain("/fr/espace/FR-9ZZZZ?t=");
  });

  it("refuse de signer sans secret plutôt que d'émettre un lien faible", async () => {
    await expect(access({ secret: undefined })).rejects.toThrow(/PROOFSEEN_ACCESS_SECRET/);
  });
});

describe("deux inscriptions ne se marchent pas dessus", () => {
  it("ouvre deux dossiers distincts", async () => {
    await intake(await write(submission()), { reference: "FR-1AB2C" });
    await intake(await write(submission({ displayName: "Louis Martin", email: "louis@exemple.fr" })), { reference: "FR-9ZZZZ" });
    expect((await readdir(join(dir, "clients"))).sort()).toEqual(["FR-1AB2C", "FR-9ZZZZ"]);
  });
});

describe("ce que la commande n'affirme pas", () => {
  it("renvoie vers la langue de l'inscription, pas vers une langue par défaut", async () => {
    // `/fr/espace/…` et `/en/espace/…` sont deux routes distinctes : accueillir quelqu'un dans la mauvaise langue
    // sur la page qu'il attendait est un accueil raté.
    await intake(await write(submission({ lang: "en" })), { reference: "FR-1AB2C", accessSecret: SECRET });
    const joined = logs.join(" | ");
    expect(joined).toContain("/en/espace/FR-1AB2C?t=");
    expect(joined).not.toContain("/fr/espace/");
  });

  it("imprime l'empreinte du secret, jamais le secret", async () => {
    // Deux secrets différents entre la CLI et le site rendent TOUS les liens « non valide » en silence : rien ne
    // plante, les gens cliquent et ne voient rien. L'empreinte rend la comparaison possible sans exposer le secret.
    await intake(await write(submission()), { reference: "FR-1AB2C", accessSecret: SECRET });
    const line = logs.find((message) => message.startsWith("Empreinte du secret"));
    expect(line).toBeDefined();
    expect(line).toMatch(/[0-9a-f]{8}/);
    expect(logs.join(" | ")).not.toContain(SECRET);
  });
});
