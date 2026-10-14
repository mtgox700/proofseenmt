import { createHash } from "node:crypto";
import { z } from "zod";
import { containsContact, containsDirectContact, NO_CONTACT } from "./contact-detection";

/*
 * Ce que le freelance déclare pour demander la confirmation d'une mission passée, et les règles qui ne dépendent pas
 * de la base. La période se donne au mois (« AAAA-MM ») : une mission vérifiée se publie en durée, jamais en dates
 * exactes. Le résumé ne doit contenir aucune coordonnée : il sera publié tel quel si le client confirme.
 */

/** Une demande sans réponse expire au bout de trente jours, sans rien publier. */
export const CONFIRMATION_TTL_DAYS = 30;
/** Demandes en attente au plus par freelance : au-delà, il attend des réponses ou retire une demande. */
export const MAX_PENDING_CONFIRMATIONS = 5;
export const CONFIRMATION_SUMMARY_MAX = 2000;
/**
 * Demandes au plus vers une même adresse de contact sur 30 jours, tous freelances confondus : la demande ne doit pas
 * devenir un moyen d'envoyer des e-mails au nom de Proofseen à qui l'on veut.
 */
export const MAX_REQUESTS_PER_CONTACT = 3;

const CLIENT_KINDS = ["startup", "scaleup", "grand_groupe", "eti", "pme", "secteur_public", "editeur_logiciel", "esn", "association"] as const;

const Month = z
  .string()
  .trim()
  .regex(/^(19[7-9]\d|20\d\d)-(0[1-9]|1[0-2])$/)
  .transform((m) => new Date(`${m}-01T00:00:00Z`));

const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), schema.nullable().default(null));

export const ConfirmationInputSchema = z
  .object({
    role: z.string().trim().min(2).max(200).refine((v) => !containsContact(v), { message: NO_CONTACT }),
    // Le nom du client peut être un nom de domaine (« acme.fr ») ; un moyen de joindre quelqu'un, non.
    clientName: z.string().trim().min(2).max(200).refine((v) => !containsDirectContact(v), { message: NO_CONTACT }),
    clientKind: z.enum(CLIENT_KINDS),
    clientSiret: optional(z.string().transform((v) => v.replace(/\s/g, "")).pipe(z.string().regex(/^\d{14}$/))),
    contactEmail: optional(z.string().trim().toLowerCase().max(254).pipe(z.email())),
    startedOn: Month,
    endedOn: Month,
    summary: z.string().trim().min(10).max(CONFIRMATION_SUMMARY_MAX).refine((v) => !containsContact(v), { message: NO_CONTACT }),
  })
  .refine((c) => c.clientSiret !== null || c.contactEmail !== null, { message: "SIRET ou e-mail du contact requis", path: ["contactEmail"] })
  .refine((c) => c.endedOn >= c.startedOn, { message: "la fin précède le début", path: ["endedOn"] });

export type ConfirmationInput = z.input<typeof ConfirmationInputSchema>;
export type ParsedConfirmation = z.output<typeof ConfirmationInputSchema>;

/** Empreinte gardée en base : le jeton lui-même n'y est jamais. */
export const confirmationTokenHash = (token: string): string => createHash("sha256").update(token, "utf8").digest("hex");

/** Un jeton plausible (base64url, longueur d'un HMAC-SHA256) : tout le reste est refusé sans lire la base. */
export const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;

/**
 * Forme de comparaison d'une adresse : sans sous-adresse (« moi+client@x.fr » est « moi@x.fr »), et sans les points
 * de la partie locale chez Gmail, qui les ignore. Sert seulement à reconnaître une même boîte, jamais à écrire.
 */
export const mailboxKey = (email: string): string => {
  const at = email.lastIndexOf("@");
  const domain = email.slice(at + 1).toLowerCase();
  const local = email.slice(0, at).toLowerCase().replace(/\+.*$/, "");
  return `${domain === "gmail.com" || domain === "googlemail.com" ? local.replace(/\./g, "") : local}@${domain === "googlemail.com" ? "gmail.com" : domain}`;
};

/** Le domaine d'une adresse, en minuscules : la seule trace gardée de qui a confirmé par lien. */
export const emailDomain = (email: string): string => email.slice(email.lastIndexOf("@") + 1).toLowerCase();

/** Le mois courant (premier jour, UTC) : une mission qui se termine après lui n'est pas encore passée. */
export const monthOf = (now: Date): Date => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
