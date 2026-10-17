import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applications, missions, storedFiles } from "@proofseen/db";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "../../../packages/db/test/support/database";
import { cvChoiceOf, prepareApplicationCv, pruneAfterWithdrawal, settleApplicationCv, type CvOptions } from "../src/data/application-cv";
import { storedPath } from "../src/data/uploads";
import { cvErrorCode, cvRefusalOf } from "../src/lib/application-cv-form";
import { cleanPdf } from "./support/pdf-samples";

/*
 * The CV attached to an application (C21): the stored one with a box, or one uploaded on the apply form with the same
 * checks as the profile CV. A fake PDF reader stands in for the worker where the test is about the flow, not the PDF.
 */

let t: TestDatabase;
let root: string;

beforeAll(async () => {
  t = await openTestDatabase();
  root = await mkdtemp(join(tmpdir(), "proofseen-application-cv-test-"));
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
  await rm(root, { recursive: true, force: true });
});

const NOW = new Date("2026-10-17T10:00:00Z");
const pdf = (text: string): File => new File([new Uint8Array(cleanPdf(text))], "cv.pdf", { type: "application/pdf" });
/** The PDF worker's answer for a plain CV, or one with active content. */
const reading = (active: boolean): CvOptions => ({ root, read: async () => ({ kind: "ok", text: "CV", active, links: [] }) });

const form = (entries: Readonly<Record<string, string | File>>): FormData => {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) data.append(name, value);
  return data;
};

const onDisk = async (id: string): Promise<boolean> => {
  const path = storedPath(id, root);
  if (path === null) return false;
  return stat(path).then(() => true, () => false);
};

const setup = async () => {
  const recruiter = await createUser(t.db);
  const org = await createOrganisation(t.db, recruiter);
  const draft = await missions(t.db).create({ userId: recruiter }, org, { title: "Data engineer", description: "Plateforme.", skills: ["Spark"], workMode: "remote" });
  if (draft === null) throw new Error("mission non créée");
  await missions(t.db).publish({ userId: recruiter }, draft.id, NOW);
  const userId = await createUser(t.db);
  await createProfile(t.db, userId);
  return { missionId: draft.id, recruiter, actor: { userId } };
};

describe("apply form: which CV", () => {
  it("an uploaded PDF wins over the box; the box alone attaches the stored CV; neither attaches none", () => {
    const file = pdf("CV");
    expect(cvChoiceOf(form({ cv: file, joindreCv: "1" }))).toEqual({ kind: "upload", file });
    expect(cvChoiceOf(form({ joindreCv: "1" }))).toEqual({ kind: "stored" });
    expect(cvChoiceOf(form({ cv: new File([], "vide.pdf"), joindreCv: "0" }))).toEqual({ kind: "none" });
    expect(cvChoiceOf(form({}))).toEqual({ kind: "none" });
  });

  it("reads back only known CV refusals from the address", () => {
    expect(cvRefusalOf(cvErrorCode("active_content"))).toBe("active_content");
    expect(cvRefusalOf("cv-no_cv")).toBe("no_cv");
    expect(cvRefusalOf("cv-<script>")).toBeNull();
    expect(cvRefusalOf("invalide")).toBeNull();
    expect(cvRefusalOf(undefined)).toBeNull();
  });
});

describe("apply form: attaching the CV", () => {
  it("the box without a stored CV is refused before anything is sent", async () => {
    const { actor } = await setup();
    expect(await prepareApplicationCv(t.db, actor, { kind: "stored" }, reading(false))).toEqual({ kind: "refused", code: "no_cv" });
    expect(await prepareApplicationCv(t.db, actor, { kind: "none" }, reading(false))).toEqual({ kind: "none" });
  });

  it("an uploaded CV goes through the PDF check: active content is refused and nothing is stored", async () => {
    const { actor } = await setup();
    expect(await prepareApplicationCv(t.db, actor, { kind: "upload", file: pdf("CV") }, reading(true))).toEqual({ kind: "refused", code: "active_content" });
    expect(await prepareApplicationCv(t.db, actor, { kind: "upload", file: new File([new TextEncoder().encode("<html>")], "cv.pdf") }, reading(false))).toEqual({ kind: "refused", code: "type" });
    expect(await t.db.storedFile.count({ where: { ownerId: actor.userId } })).toBe(0);
  });

  it("an uploaded CV sent with the application becomes the profile's CV; the one sent before stays with its company", async () => {
    const first = await setup();
    const sent = await prepareApplicationCv(t.db, first.actor, { kind: "upload", file: pdf("Premier CV") }, reading(false));
    if (sent.kind !== "ready") throw new Error(sent.kind);
    const applied = await applications(t.db).apply(first.actor, first.missionId, "Bonjour", NOW, [], sent.fileId);
    expect(applied.kind).toBe("applied");
    await settleApplicationCv(t.db, first.actor, sent, true, root);
    expect((await storedFiles(t.db).readable(sent.fileId, { userId: first.recruiter }))?.audience).toBe("recipient");

    // A second application, with a new PDF: the profile's CV changes, the first company keeps the first CV.
    const recruiter = await createUser(t.db);
    const org = await createOrganisation(t.db, recruiter);
    const second = await missions(t.db).create({ userId: recruiter }, org, { title: "Data engineer", description: "Plateforme.", skills: ["Spark"], workMode: "remote" });
    if (second === null) throw new Error("mission non créée");
    await missions(t.db).publish({ userId: recruiter }, second.id, NOW);
    const next = await prepareApplicationCv(t.db, first.actor, { kind: "upload", file: pdf("Second CV") }, reading(false));
    if (next.kind !== "ready") throw new Error(next.kind);
    expect((await applications(t.db).apply(first.actor, second.id, "Bonjour", NOW, [], next.fileId)).kind).toBe("applied");
    await settleApplicationCv(t.db, first.actor, next, true, root);
    expect((await storedFiles(t.db).latest(first.actor, "cv"))?.id).toBe(next.fileId);
    expect(await onDisk(sent.fileId)).toBe(true);
    expect((await storedFiles(t.db).readable(sent.fileId, { userId: first.recruiter }))?.audience).toBe("recipient");
    expect(await storedFiles(t.db).readable(next.fileId, { userId: first.recruiter })).toBeNull();
  });

  it("an uploaded CV of a refused application is removed again, row and bytes", async () => {
    const { actor, missionId } = await setup();
    const prepared = await prepareApplicationCv(t.db, actor, { kind: "upload", file: pdf("CV") }, reading(false));
    if (prepared.kind !== "ready") throw new Error(prepared.kind);
    expect(await onDisk(prepared.fileId)).toBe(true);
    // The note carries contact details: the application is refused.
    expect((await applications(t.db).apply(actor, missionId, "Appelez-moi au 06 12 34 56 78", NOW, [], prepared.fileId)).kind).toBe("contact_details");
    await settleApplicationCv(t.db, actor, prepared, false, root);
    expect(await t.db.storedFile.count({ where: { ownerId: actor.userId } })).toBe(0);
    expect(await onDisk(prepared.fileId)).toBe(false);
  });

  it("the stored CV is attached as is, and a withdrawal closes it to the company", async () => {
    const { actor, missionId, recruiter } = await setup();
    const saved = await prepareApplicationCv(t.db, actor, { kind: "upload", file: pdf("CV") }, reading(false));
    if (saved.kind !== "ready") throw new Error(saved.kind);
    await settleApplicationCv(t.db, actor, saved, true, root);
    const stored = await prepareApplicationCv(t.db, actor, { kind: "stored" }, reading(false));
    expect(stored).toEqual({ kind: "ready", fileId: saved.fileId, uploaded: false });
    const applied = await applications(t.db).apply(actor, missionId, "Bonjour", NOW, [], saved.fileId);
    if (applied.kind !== "applied") throw new Error(applied.kind);
    await settleApplicationCv(t.db, actor, stored, true, root);
    expect((await storedFiles(t.db).readable(saved.fileId, { userId: recruiter }))?.audience).toBe("recipient");

    expect(await applications(t.db).withdraw(actor, applied.applicationId)).toBe(true);
    await pruneAfterWithdrawal(t.db, actor, root);
    expect(await storedFiles(t.db).readable(saved.fileId, { userId: recruiter })).toBeNull();
    // Still the profile's CV: it stays.
    expect(await onDisk(saved.fileId)).toBe(true);
  });
});
