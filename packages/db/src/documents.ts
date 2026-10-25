import { z } from "zod";
import type { Db } from "./client";
import { containsDirectContact, NO_CONTACT } from "./contact-detection";
import { accessTo, affairOf, anchorsOf, AffairSchema, authorSides, refusalFor, type Access, type Affair, type AffairFacts, type AuthorSides, type PartyRole, type Refusal } from "./document-affairs";
import { isUniqueViolation } from "./errors";
import type { DocumentType } from "./generated/enums";
import type { Prisma } from "./generated/client";
import type { Actor } from "./messaging";

/*
 * Le coffre : les documents d'une affaire et leurs versions.
 *
 * Un document ne contient aucun octet : chacune de ses versions (immuable, numérotée sans trou) porte l'empreinte SHA-256
 * des octets exacts conservés et la clé du fichier rangé sur le volume des dépôts. Ce module ne touche jamais le disque :
 * il dit quels documents existent, qui peut les lire, et enregistre les versions que l'application a déjà écrites (si
 * l'enregistrement est refusé, l'application efface le fichier ; un fichier sans ligne est de toute façon balayé).
 *
 * Qui lit quoi : les parties de l'affaire (voir document-affairs.ts), et personne d'autre. Une personne étrangère reçoit
 * `null`, comme pour un document qui n'existe pas. Chaque ouverture et chaque création est consignée dans un journal en
 * ajout seul : qui, quoi, quand, rien de plus (ni adresse IP, ni navigateur).
 *
 * Le rendu (gabarit, PDF) n'est pas ici : il est fourni par un `DocumentRenderer`, branché sur le moteur de documents.
 */

export type { Affair, AffairFacts, AffairKind, PartyRole, Refusal } from "./document-affairs";
export { AFFAIR_KINDS, AffairSchema } from "./document-affairs";

export const DOCUMENT_TYPES = ["service_agreement", "quote", "acceptance_report", "nda", "amendment"] as const;
export const DOCUMENT_LANGS = ["fr", "en"] as const;
export type DocumentLang = (typeof DOCUMENT_LANGS)[number];

/** Ce qu'on demande au moteur de rendu. La date du document est celle de la version (`at`), jamais l'horloge du rendu. */
export interface RenderRequest {
  readonly type: DocumentType;
  readonly lang: DocumentLang;
  readonly facts: AffairFacts;
  /** Le numéro que portera la version. */
  readonly version: number;
  /** Le rang du document parmi ceux de même sorte de l'affaire (l'avenant n° 2 a le rang 2) ; 1 pour les autres. */
  readonly slot: number;
  /** La date de la version : le rendu la lit ici, et le coffre l'enregistre à l'identique. */
  readonly at: Date;
  /**
   * Les choix des parties que le gabarit demande et que l'affaire ne porte pas (mode de travail, régime des droits…),
   * tels que l'API les a reçus. Le moteur les valide ; le coffre n'en lit aucun.
   */
  readonly inputs: Readonly<Record<string, unknown>>;
}

/**
 * Le moteur refuse de rendre : gabarit pas prêt, variables manquantes ou invalides, source expirée, décision du founder
 * en attente… `code` est le nom de l'erreur du moteur, `missing` les noms des variables concernées (des noms de gabarit,
 * jamais des valeurs : aucune donnée personnelle). L'API le rend en 409 « gabarit incomplet », pour que l'écran sache
 * quoi demander.
 */
export class RenderRefusedError extends Error {
  constructor(
    readonly code: string,
    readonly missing: readonly string[] = [],
  ) {
    super(`rendu refusé : ${code}`);
    this.name = "RenderRefusedError";
  }
}

/** Ce que le moteur rend : les octets (un PDF), et de quoi les rejouer. L'empreinte est calculée par le coffre, pas reçue. */
export interface RenderedDocument {
  readonly bytes: Uint8Array;
  readonly templateId: string;
  readonly templateVersion: string;
  readonly engine: string;
  /**
   * L'empreinte du CONTENU rendu (SHA-256 hexadécimal du contenu canonique du gabarit), celle que le pied de page du PDF imprime
   * et dessine en poinçon. Ce n'est pas celle du fichier (`sha256`, calculée par le coffre sur les octets) : deux rendus du même
   * contenu ont la même empreinte de contenu, pas forcément les mêmes octets.
   */
  readonly contentDigest: string;
  /** Les valeurs avec lesquelles le gabarit a été rendu (données personnelles : jamais dans les journaux). */
  readonly variables: Readonly<Record<string, unknown>>;
}

export interface DocumentRenderer {
  render(request: RenderRequest): Promise<RenderedDocument>;
}

/**
 * Qui a écrit une version, vu de la personne, sans jamais donner un nom : elle-même (`you`), un collègue de sa propre
 * entreprise (`colleague`), l'autre partie (`other_party`), quelqu'un qui n'est plus partie de l'affaire (`former_member`,
 * un ancien membre de l'entreprise), ou un compte supprimé depuis (`removed`).
 */
export type VersionAuthor = "you" | "colleague" | "other_party" | "former_member" | "removed";

export interface VersionSummary {
  readonly number: number;
  /** Empreinte du fichier (SHA-256 des octets exacts conservés). */
  readonly sha256: string;
  /** Empreinte du contenu : celle que le PDF imprime en pied de page et dessine en poinçon, et que l'écran dessine. */
  readonly contentDigest: string;
  readonly size: number;
  readonly contentType: string;
  readonly templateVersion: string;
  readonly engine: string;
  readonly reason: string;
  readonly createdAt: Date;
  readonly by: VersionAuthor;
  /** Le côté de l'auteur dans l'affaire (le freelance, ou l'entreprise) ; nul s'il n'est plus partie ou si son compte est supprimé. */
  readonly side: PartyRole | null;
}

export interface DocumentSummary {
  readonly id: string;
  readonly affair: Affair;
  readonly type: DocumentType;
  readonly slot: number;
  readonly templateId: string;
  readonly lang: DocumentLang;
  readonly createdAt: Date;
  readonly versionCount: number;
  readonly latest: VersionSummary | null;
}

export interface DocumentDetail extends DocumentSummary {
  /** De la plus récente à la plus ancienne. */
  readonly versions: readonly VersionSummary[];
}

export interface OpenedVersion {
  readonly document: DocumentSummary;
  readonly version: VersionSummary;
  /** Où sont les octets sur le volume des dépôts. */
  readonly storageKey: string;
}

/**
 * Les valeurs figées d'une version : de quoi la rejouer (aperçu vérifié, comparaison clause par clause). Elles portent des
 * données personnelles (identité des deux parties) : lues côté serveur par les pages des parties, JAMAIS rendues en JSON
 * par l'API, jamais journalisées.
 */
export interface FrozenVersion {
  readonly templateId: string;
  readonly templateVersion: string;
  readonly engine: string;
  readonly contentDigest: string;
  readonly variables: Readonly<Record<string, unknown>>;
}

/** Combien de documents au plus par page de « Tous mes documents ». */
export const MINE_PAGE_SIZE = 50;
const MINE_SORTS = ["recent", "oldest", "type"] as const;

/**
 * Ce que la personne choisit pour « Tous mes documents » : la sorte, qui a déposé la dernière version (elle-même, ou
 * quelqu'un d'autre), le tri (date de dépôt de la dernière version, décroissante par défaut) et la page (à partir de 1).
 */
export const MineQuerySchema = z.object({
  type: z.enum(DOCUMENT_TYPES).optional(),
  by: z.enum(["you", "other"]).optional(),
  sort: z.enum(MINE_SORTS).default("recent"),
  page: z.number().int().min(1).max(10_000).default(1),
});

export type MineQuery = z.input<typeof MineQuerySchema>;

export interface MinePage {
  readonly items: readonly DocumentSummary[];
  /** Tous les documents qui répondent aux filtres, pas seulement ceux de la page. */
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly pages: number;
}

const Reason = z.string().trim().min(1).max(300).refine((text) => !containsDirectContact(text), { message: NO_CONTACT });
const MAX_VARIABLES_CHARS = 200_000;

/** Une version déjà rendue et écrite sur le disque, à enregistrer. */
export const NewVersionSchema = z.object({
  storageKey: z.uuid(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  contentDigest: z.string().regex(/^[0-9a-f]{64}$/),
  size: z.number().int().min(1).max(20 * 1024 * 1024),
  contentType: z.literal("application/pdf"),
  templateId: z.string().min(1).max(80),
  templateVersion: z.string().min(1).max(40),
  engine: z.string().min(1).max(80),
  variables: z.record(z.string(), z.unknown()).refine((v) => JSON.stringify(v).length <= MAX_VARIABLES_CHARS, { message: "valeurs trop volumineuses" }),
  reason: Reason,
});

export type NewVersion = z.input<typeof NewVersionSchema>;

/** Où ranger la version : dans un document existant, ou dans le document (sorte, affaire) qu'on ouvre à cette occasion. */
export type VersionTarget =
  | { readonly documentId: string }
  | { readonly affair: Affair; readonly type: DocumentType; readonly lang: DocumentLang; /** Un nouveau document de même sorte (avenant suivant), plutôt que le document existant. */ readonly additional?: boolean };

export type PrepareResult =
  | { readonly kind: "ready"; readonly facts: AffairFacts; readonly lang: DocumentLang; readonly type: DocumentType; readonly nextVersion: number; readonly slot: number }
  | { readonly kind: "refused"; readonly reason: Refusal }
  /** Une autre version est arrivée depuis celle que la personne avait vue : `latest` est le numéro de la dernière (0 : aucune). */
  | { readonly kind: "stale"; readonly latest: number }
  | { readonly kind: "absent" };

export type RecordResult =
  | { readonly kind: "recorded"; readonly document: DocumentSummary; readonly version: VersionSummary }
  | { readonly kind: "refused"; readonly reason: Refusal }
  /** Même sens que pour `prepare` : la dernière version n'est plus celle que la personne attendait (double envoi, ou l'autre partie a déposé). */
  | { readonly kind: "stale"; readonly latest: number }
  | { readonly kind: "invalid" }
  | { readonly kind: "absent" };

export interface Documents {
  /** Les documents d'une affaire, du plus récent au plus ancien ; `null` si la personne n'est pas partie de l'affaire. */
  list(actor: Actor, affair: Affair): Promise<readonly DocumentSummary[] | null>;
  /** Un document avec toutes ses versions ; `null` pour une personne étrangère à son affaire, comme pour un document inconnu. */
  find(actor: Actor, documentId: string): Promise<DocumentDetail | null>;
  /** Une version à servir : consigne l'accès (qui, quoi, quand) et rend la clé du fichier. */
  open(actor: Actor, documentId: string, number: number, now: Date): Promise<OpenedVersion | null>;
  /**
   * Avant de rendre : l'accès de la personne et les règles de l'affaire, puis les faits à remettre au moteur. Un contrat
   * sans objet, ou dans un état qui ne permet pas cette version, est refusé ici. `expected` est le numéro de la dernière
   * version que la personne a vue (0 : aucune) : si une autre est arrivée depuis, le résultat est « stale », avant tout rendu.
   */
  prepare(actor: Actor, target: VersionTarget, expected: number): Promise<PrepareResult>;
  /**
   * Enregistre une version dont le fichier est déjà écrit : mêmes contrôles que `prepare`, numérotation sous verrou. La
   * version n'est enregistrée que si la dernière est toujours `expected` : un double envoi, ou deux parties qui préparent en
   * même temps, ne créent qu'une version, l'autre reçoit « stale » avec le numéro de la dernière.
   */
  record(actor: Actor, target: VersionTarget, version: NewVersion, now: Date, expected: number): Promise<RecordResult>;
  /**
   * Les valeurs figées d'une version, pour la page du document (aperçu vérifié, comparaison). Même autorisation par objet que
   * `find` : `null` pour une personne étrangère, un document ou une version inconnus. Ne consigne rien (ce n'est pas un
   * téléchargement) ; ne passe jamais par l'API.
   */
  frozen(actor: Actor, documentId: string, number: number): Promise<FrozenVersion | null>;
  /**
   * « Tous mes documents » : ceux de toutes les affaires dont la personne est partie (jamais le brouillon d'un devis pour
   * l'entreprise), filtrés, triés et paginés par 50. `null` si la demande est invalide (filtre inconnu, page absurde).
   */
  listMine(actor: Actor, query: MineQuery): Promise<MinePage | null>;
}

const Uuid = z.uuid();
const VERSION_SELECT = { number: true, sha256: true, contentDigest: true, size: true, contentType: true, templateVersion: true, engine: true, reason: true, createdAt: true, authorId: true } as const;
const DOCUMENT_SELECT = { id: true, contractId: true, quoteId: true, conversationId: true, organisationId: true, profileId: true, type: true, slot: true, templateId: true, lang: true, createdAt: true } as const;

type VersionRow = Prisma.DocumentVersionGetPayload<{ select: typeof VERSION_SELECT }>;
type DocumentRow = Prisma.DocumentGetPayload<{ select: typeof DOCUMENT_SELECT }>;

/** Qui lit, de quel côté il est, et de quel côté sont les auteurs des versions lues. */
interface Viewer {
  readonly actor: Actor;
  readonly role: PartyRole;
  readonly sides: AuthorSides;
}

const viewerOf = async (db: Db | Prisma.TransactionClient, actor: Actor, affair: Affair, role: PartyRole, rows: readonly VersionRow[]): Promise<Viewer> => ({
  actor,
  role,
  sides: await authorSides(db, affair, rows.map((row) => row.authorId)),
});

const summaryOfVersion = (row: VersionRow, viewer: Viewer): VersionSummary => {
  const { authorId, ...rest } = row;
  const side = authorId === null ? null : (viewer.sides.get(authorId) ?? null);
  const by: VersionAuthor =
    authorId === null ? "removed" : authorId === viewer.actor.userId ? "you" : side === null ? "former_member" : side === "company" && viewer.role === "company" ? "colleague" : "other_party";
  return { ...rest, by, side };
};

const summaryOfDocument = (row: DocumentRow, versions: readonly VersionRow[], viewer: Viewer): DocumentSummary | null => {
  const affair = affairOf(row);
  if (affair === null) return null;
  const [latest] = versions;
  return {
    id: row.id,
    affair,
    type: row.type,
    slot: row.slot,
    templateId: row.templateId,
    lang: row.lang === "en" ? "en" : "fr",
    createdAt: row.createdAt,
    versionCount: versions.length,
    latest: latest === undefined ? null : summaryOfVersion(latest, viewer),
  };
};

/** Le document, son affaire, et l'accès de la personne ; `null` si elle n'en est pas partie. */
const readable = async (db: Db, actor: Actor, documentId: string): Promise<{ readonly row: DocumentRow; readonly versions: readonly VersionRow[]; readonly access: Access } | null> => {
  if (!Uuid.safeParse(documentId).success) return null;
  const row = await db.document.findUnique({ where: { id: documentId }, select: { ...DOCUMENT_SELECT, versions: { select: VERSION_SELECT, orderBy: { number: "desc" } } } });
  if (row === null) return null;
  const { versions, ...document } = row;
  const affair = affairOf(document);
  if (affair === null) return null;
  const access = await accessTo(db, actor, affair);
  return access === null ? null : { row: document, versions, access };
};

/**
 * Les documents des affaires dont la personne est partie : la même règle que `accessTo` (contrat : freelance ou membre de
 * l'entreprise ; devis : le freelance, ou l'entreprise hors brouillon ; fil : ses deux parties ; entreprise : ses membres ;
 * profil : son titulaire). Chaque ligne de la page est ensuite revérifiée par `accessTo`.
 */
const mineWhere = (userId: string): Prisma.DocumentWhereInput => {
  const company = { members: { some: { userId } } };
  return {
    OR: [
      { contract: { OR: [{ profile: { userId } }, { organisation: company }] } },
      { quote: { OR: [{ conversation: { profile: { userId } } }, { status: { not: "draft" }, conversation: { organisation: company } }] } },
      { conversation: { OR: [{ profile: { userId } }, { organisation: company }] } },
      { organisation: company },
      { profile: { userId } },
    ],
  };
};

interface Candidate {
  readonly id: string;
  readonly type: DocumentType;
  /** La date de dépôt de la dernière version (celle du document si, par exception, il n'en a pas). */
  readonly at: Date;
  readonly authorId: string | null;
}

const byDate = (sign: 1 | -1) => (a: Candidate, b: Candidate): number => sign * (a.at.getTime() - b.at.getTime()) || (a.id < b.id ? -sign : a.id > b.id ? sign : 0);

const SORTERS: Readonly<Record<(typeof MINE_SORTS)[number], (a: Candidate, b: Candidate) => number>> = {
  recent: byDate(-1),
  oldest: byDate(1),
  type: (a, b) => (a.type < b.type ? -1 : a.type > b.type ? 1 : byDate(-1)(a, b)),
};

/** Un document en résumé pour cette personne, après revérification de son accès ; `null` si elle n'en est pas (ou plus) partie. */
const summaryFor = async (db: Db, actor: Actor, row: DocumentRow, versions: readonly VersionRow[]): Promise<DocumentSummary | null> => {
  const affair = affairOf(row);
  const access = affair === null ? null : await accessTo(db, actor, affair);
  if (affair === null || access === null) return null;
  return summaryOfDocument(row, versions, await viewerOf(db, actor, affair, access.role, versions));
};

const listMineFor = async (db: Db, actor: Actor, raw: MineQuery): Promise<MinePage | null> => {
  const parsed = MineQuerySchema.safeParse(raw);
  if (!parsed.success) return null;
  const { type, by, sort, page } = parsed.data;
  const found = await db.document.findMany({
    where: { AND: [mineWhere(actor.userId), type === undefined ? {} : { type }] },
    select: { id: true, type: true, createdAt: true, versions: { orderBy: { number: "desc" }, take: 1, select: { createdAt: true, authorId: true } } },
  });
  const candidates: Candidate[] = found
    .map((row) => ({ id: row.id, type: row.type, at: row.versions[0]?.createdAt ?? row.createdAt, authorId: row.versions[0]?.authorId ?? null }))
    .filter((c) => by === undefined || (by === "you") === (c.authorId === actor.userId))
    .sort(SORTERS[sort]);
  const ids = candidates.slice((page - 1) * MINE_PAGE_SIZE, page * MINE_PAGE_SIZE).map((c) => c.id);
  const rows = ids.length === 0 ? [] : await db.document.findMany({ where: { id: { in: ids } }, select: { ...DOCUMENT_SELECT, versions: { select: VERSION_SELECT, orderBy: { number: "desc" } } } });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const items: DocumentSummary[] = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (row === undefined) continue;
    const { versions, ...document } = row;
    const summary = await summaryFor(db, actor, document, versions);
    if (summary !== null) items.push(summary);
  }
  return { items, total: candidates.length, page, pageSize: MINE_PAGE_SIZE, pages: Math.ceil(candidates.length / MINE_PAGE_SIZE) };
};

const FrozenValues = z.record(z.string(), z.unknown());

export const documents = (db: Db): Documents => {
  /**
   * La cible d'un enregistrement : le document existant (par son identifiant, ou son rang 1 pour une affaire et une sorte),
   * l'accès de la personne à son affaire. `null` : étranger, inconnu ou invalide, tous répondus « absent ».
   */
  const resolve = async (tx: Db | Prisma.TransactionClient, actor: Actor, target: VersionTarget) => {
    if ("documentId" in target) {
      if (!Uuid.safeParse(target.documentId).success) return null;
      const existing = await tx.document.findUnique({ where: { id: target.documentId }, select: DOCUMENT_SELECT });
      const affair = existing === null ? null : affairOf(existing);
      const access = existing === null || affair === null ? null : await accessTo(tx, actor, affair);
      return existing === null || affair === null || access === null ? null : { affair, type: existing.type, lang: existing.lang === "en" ? ("en" as const) : ("fr" as const), access, existing };
    }
    if (!AffairSchema.safeParse(target.affair).success) return null;
    const access = await accessTo(tx, actor, target.affair);
    if (access === null) return null;
    const existing = target.additional === true ? null : await tx.document.findFirst({ where: { ...anchorsOf(target.affair), type: target.type, slot: 1 }, select: DOCUMENT_SELECT });
    return { affair: target.affair, type: target.type, lang: existing?.lang === "en" ? ("en" as const) : existing === null ? target.lang : ("fr" as const), access, existing };
  };

  const recordOnce = async (actor: Actor, target: VersionTarget, input: z.output<typeof NewVersionSchema>, now: Date, expected: number): Promise<RecordResult> =>
    db.$transaction(async (tx): Promise<RecordResult> => {
      const checked = await resolve(tx, actor, target);
      if (checked === null) return { kind: "absent" };
      const refusal = refusalFor(checked.type, checked.affair, checked.access.facts);
      if (refusal !== null) return { kind: "refused", reason: refusal };

      let document = checked.existing;
      const created = document === null;
      if (document === null) {
        // Un document qui n'existe pas encore n'a aucune version : qui en attendait une l'a vue dans un autre document.
        if (expected !== 0) return { kind: "stale", latest: 0 };
        // Un nouveau document : rang 1, ou le suivant quand on en demande un autre de même sorte (avenant).
        const used = await tx.document.aggregate({ where: { ...anchorsOf(checked.affair), type: checked.type }, _max: { slot: true } });
        document = await tx.document.create({ data: { ...anchorsOf(checked.affair), type: checked.type, slot: (used._max.slot ?? 0) + 1, templateId: input.templateId, lang: checked.lang }, select: DOCUMENT_SELECT });
      }
      // Numérotation sous verrou du document : deux enregistrements simultanés se suivent au lieu de se disputer un numéro, et
      // le second voit la version du premier (double envoi, ou l'autre partie a déposé entre-temps).
      await tx.$queryRaw`SELECT "id" FROM "Document" WHERE "id" = ${document.id}::uuid FOR UPDATE`;
      const last = await tx.documentVersion.aggregate({ where: { documentId: document.id }, _max: { number: true } });
      const latest = last._max.number ?? 0;
      if (latest !== expected) return { kind: "stale", latest };
      const number = latest + 1;
      const row = await tx.documentVersion.create({
        data: {
          documentId: document.id,
          number,
          sha256: input.sha256,
          contentDigest: input.contentDigest,
          storageKey: input.storageKey,
          size: input.size,
          contentType: input.contentType,
          templateVersion: input.templateVersion,
          engine: input.engine,
          variables: input.variables as Prisma.InputJsonObject,
          reason: input.reason,
          authorId: actor.userId,
          createdAt: now,
        },
        select: VERSION_SELECT,
      });
      if (created) await tx.documentAccess.create({ data: { documentId: document.id, action: "created", userId: actor.userId, at: now } });
      await tx.documentAccess.create({ data: { documentId: document.id, versionNumber: number, action: "version_created", userId: actor.userId, at: now } });
      const all = await tx.documentVersion.findMany({ where: { documentId: document.id }, select: VERSION_SELECT, orderBy: { number: "desc" } });
      const viewer = await viewerOf(tx, actor, checked.affair, checked.access.role, all);
      const summary = summaryOfDocument(document, all, viewer);
      return summary === null ? { kind: "absent" } : { kind: "recorded", document: summary, version: summaryOfVersion(row, viewer) };
    });

  return {
    async list(actor, affair) {
      if (!AffairSchema.safeParse(affair).success) return null;
      const access = await accessTo(db, actor, affair);
      if (access === null) return null;
      const rows = await db.document.findMany({
        where: anchorsOf(affair),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { ...DOCUMENT_SELECT, versions: { select: VERSION_SELECT, orderBy: { number: "desc" } } },
      });
      const viewer = await viewerOf(db, actor, affair, access.role, rows.flatMap((row) => row.versions));
      return rows.flatMap(({ versions, ...row }) => {
        const summary = summaryOfDocument(row, versions, viewer);
        return summary === null ? [] : [summary];
      });
    },

    async find(actor, documentId) {
      const found = await readable(db, actor, documentId);
      if (found === null) return null;
      const affair = affairOf(found.row);
      if (affair === null) return null;
      const viewer = await viewerOf(db, actor, affair, found.access.role, found.versions);
      const summary = summaryOfDocument(found.row, found.versions, viewer);
      return summary === null ? null : { ...summary, versions: found.versions.map((v) => summaryOfVersion(v, viewer)) };
    },

    async open(actor, documentId, number, now) {
      if (!Number.isInteger(number) || number < 1) return null;
      const found = await readable(db, actor, documentId);
      if (found === null) return null;
      const stored = await db.documentVersion.findUnique({ where: { documentId_number: { documentId, number } }, select: { ...VERSION_SELECT, storageKey: true } });
      if (stored === null) return null;
      const affair = affairOf(found.row);
      if (affair === null) return null;
      const viewer = await viewerOf(db, actor, affair, found.access.role, found.versions);
      const summary = summaryOfDocument(found.row, found.versions, viewer);
      if (summary === null) return null;
      await db.documentAccess.create({ data: { documentId, versionNumber: number, action: "downloaded", userId: actor.userId, at: now } });
      const { storageKey, ...row } = stored;
      return { document: summary, version: summaryOfVersion(row, viewer), storageKey };
    },

    async frozen(actor, documentId, number) {
      if (!Number.isInteger(number) || number < 1) return null;
      const found = await readable(db, actor, documentId);
      if (found === null) return null;
      const stored = await db.documentVersion.findUnique({ where: { documentId_number: { documentId, number } }, select: { templateVersion: true, engine: true, contentDigest: true, variables: true } });
      const values = stored === null ? null : FrozenValues.safeParse(stored.variables);
      if (stored === null || values === null || !values.success) return null;
      return { templateId: found.row.templateId, templateVersion: stored.templateVersion, engine: stored.engine, contentDigest: stored.contentDigest, variables: values.data };
    },

    listMine: (actor, query) => listMineFor(db, actor, query),

    async prepare(actor, target, expected) {
      const checked = await resolve(db, actor, target);
      if (checked === null) return { kind: "absent" };
      const refusal = refusalFor(checked.type, checked.affair, checked.access.facts);
      if (refusal !== null) return { kind: "refused", reason: refusal };
      const last = checked.existing === null ? null : await db.documentVersion.aggregate({ where: { documentId: checked.existing.id }, _max: { number: true } });
      const latest = last?._max.number ?? 0;
      // Dès l'avant-rendu : inutile de rendre un document que l'enregistrement refuserait.
      if (latest !== expected) return { kind: "stale", latest };
      // Le rang du document : celui du document existant, ou le suivant quand `record` en ouvrira un nouveau (même règle).
      const used = checked.existing === null ? await db.document.aggregate({ where: { ...anchorsOf(checked.affair), type: checked.type }, _max: { slot: true } }) : null;
      const slot = checked.existing?.slot ?? (used?._max.slot ?? 0) + 1;
      return { kind: "ready", facts: checked.access.facts, lang: checked.lang, type: checked.type, nextVersion: latest + 1, slot };
    },

    async record(actor, target, raw, now, expected) {
      const parsed = NewVersionSchema.safeParse(raw);
      if (!parsed.success || !Number.isInteger(expected) || expected < 0) return { kind: "invalid" };
      try {
        return await recordOnce(actor, target, parsed.data, now, expected);
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        // Deux ouvertures simultanées du même document : l'unicité a départagé, la seconde retrouve le document de la première
        // (et reçoit « stale » si elle attendait une première version).
        return recordOnce(actor, target, parsed.data, now, expected);
      }
    },
  };
};
