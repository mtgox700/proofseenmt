import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { apiKeys } from "../src/api-keys";
import { createDb } from "../src/client";

/*
 * Contrôle de la lecture par clé d'API sur une vraie base : `setup` crée une entreprise jetable et sa clé (écrite dans le
 * fichier donné, jamais affichée), `revoke` la révoque, `cleanup` efface l'entreprise, ses clés et son propriétaire.
 *
 *   pnpm tsx scripts/api-key-check.ts setup <fichier> | revoke <fichier> | cleanup <fichier>
 */

interface State {
  readonly userId: string;
  readonly organisationId: string;
  readonly keyId: string;
  readonly key: string;
}

const [command, file] = process.argv.slice(2);
if (file === undefined) throw new Error("fichier d'état manquant");
const db = createDb(process.env.DATABASE_URL ?? "");
const now = new Date();

const run = async (): Promise<void> => {
  if (command === "setup") {
    const tag = randomBytes(6).toString("hex");
    const user = await db.user.create({ data: { clerkId: `apicheck_${tag}`, email: `apicheck-${tag}@example.invalid`, displayName: "Contrôle API" }, select: { id: true } });
    const org = await db.organisation.create({ data: { name: "Contrôle API (jetable)", kind: "pme", members: { create: { userId: user.id, role: "owner" } } }, select: { id: true } });
    // Une création de clé qui échoue ne laisse ni entreprise ni utilisateur jetables derrière elle.
    const created = await apiKeys(db)
      .create({ userId: user.id }, org.id, "contrôle", now)
      .catch(async (error: unknown) => {
        await db.organisation.delete({ where: { id: org.id } });
        await db.user.delete({ where: { id: user.id } });
        throw error;
      });
    if (created.kind !== "created") throw new Error(created.kind);
    const state: State = { userId: user.id, organisationId: org.id, keyId: created.summary.id, key: created.key };
    writeFileSync(file, JSON.stringify(state));
    console.log(`setup ok, préfixe ${created.summary.prefix}`);
    return;
  }
  const state = JSON.parse(readFileSync(file, "utf8")) as State;
  if (command === "revoke") {
    console.log(`revoke ${String(await apiKeys(db).revoke({ userId: state.userId }, state.organisationId, state.keyId, now))}`);
    return;
  }
  if (command === "cleanup") {
    const used = await db.apiKey.findUnique({ where: { id: state.keyId }, select: { lastUsedAt: true, revokedAt: true } });
    console.log(`clé utilisée : ${String(used?.lastUsedAt !== null)}, révoquée : ${String(used?.revokedAt !== null)}`);
    await db.organisation.delete({ where: { id: state.organisationId } });
    await db.user.delete({ where: { id: state.userId } });
    console.log(`cleanup ok, clés restantes ${await db.apiKey.count({ where: { organisationId: state.organisationId } })}`);
    return;
  }
  throw new Error(`commande inconnue ${command ?? ""}`);
};

run()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "échec");
    process.exitCode = 1;
  })
  .finally(() => void db.$disconnect());
