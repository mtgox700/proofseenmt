import { Client } from "pg";
import { LIVE_CHANNEL, parseLiveSignal, type LiveSignal } from "./live";

/*
 * L'écouteur des événements en direct (C15) : une connexion Postgres dédiée, ouverte une fois par processus, qui fait
 * `LISTEN proofseen_live`. Elle ne passe pas par Prisma : une connexion du pool ne reste pas à l'écoute, et un
 * LISTEN posé sur une connexion prêtée serait perdu au prochain emprunt.
 *
 * Une connexion coupée (base redémarrée, réseau, proxy de Railway qui ferme une connexion muette) est rouverte avec
 * une attente croissante, et l'application est prévenue (`onReconnect`) : les signaux émis pendant la coupure sont
 * perdus, les écrans doivent relire. Un `SELECT 1` régulier garde la connexion vivante et détecte une coupure
 * silencieuse : sans réponse sous `pingTimeoutMs`, la connexion est tenue pour morte et rouverte, et l'ouverture
 * elle-même échoue au bout de `connectTimeoutMs` (revue de sécurité vague 3, L7) : une connexion muette ne laisse plus
 * l'écouteur attendre indéfiniment.
 *
 * Cet écouteur est injecté dans l'application : les tests utilisent un faux, sans Postgres ni PGlite.
 */

export interface LiveHandlers {
  onSignal(signal: LiveSignal): void;
  /** La connexion a été rouverte après une coupure : des signaux ont pu être perdus. */
  onReconnect(): void;
}

export interface LiveListener {
  start(handlers: LiveHandlers): void;
  stop(): Promise<void>;
}

/** Ce que l'écouteur utilise d'une connexion `pg` ; une fausse la remplace dans les tests. */
export interface ListenerClient {
  connect(): Promise<unknown>;
  query(text: string): Promise<unknown>;
  end(): Promise<unknown>;
  on(event: "notification", listener: (message: { readonly channel: string; readonly payload?: string | undefined }) => void): unknown;
  on(event: "error", listener: (error: Error) => void): unknown;
  on(event: "end", listener: () => void): unknown;
  removeAllListeners(): unknown;
}

export interface ListenerClientConfig {
  readonly connectionString: string;
  readonly keepAlive: boolean;
  readonly application_name: string;
  readonly connectionTimeoutMillis: number;
}

export interface PgListenerOptions {
  /** Première attente avant de rouvrir, doublée à chaque échec jusqu'à `maxRetryMs`. */
  readonly retryMs?: number;
  readonly maxRetryMs?: number;
  readonly pingMs?: number;
  /** Au-delà, un ping sans réponse fait rouvrir la connexion. */
  readonly pingTimeoutMs?: number;
  /** Délai d'ouverture d'une connexion. */
  readonly connectTimeoutMs?: number;
  /** Fabrique de la connexion ; `pg` par défaut. */
  readonly createClient?: (config: ListenerClientConfig) => ListenerClient;
  /** Journal d'erreur : seulement le nom de l'erreur, un message de pilote peut contenir l'hôte de la base. */
  readonly log?: (message: string, error?: unknown) => void;
}

const DEFAULTS = { retryMs: 1_000, maxRetryMs: 30_000, pingMs: 60_000, pingTimeoutMs: 8_000, connectTimeoutMs: 10_000 } as const;

const pgClient = (config: ListenerClientConfig): ListenerClient => new Client({ ...config });

/** Une requête qui doit répondre avant `ms`, ou échoue. */
const within = (work: Promise<unknown>, ms: number): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("délai dépassé")), ms);
    work.then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error("échec"));
      },
    );
  });

export const pgLiveListener = (connectionString: string, options: PgListenerOptions = {}): LiveListener => {
  const retryMs = options.retryMs ?? DEFAULTS.retryMs;
  const maxRetryMs = options.maxRetryMs ?? DEFAULTS.maxRetryMs;
  const pingMs = options.pingMs ?? DEFAULTS.pingMs;
  const pingTimeoutMs = options.pingTimeoutMs ?? DEFAULTS.pingTimeoutMs;
  const connectTimeoutMs = options.connectTimeoutMs ?? DEFAULTS.connectTimeoutMs;
  const createClient = options.createClient ?? pgClient;
  const log = options.log ?? (() => undefined);
  let handlers: LiveHandlers | null = null;
  let client: ListenerClient | null = null;
  let stopped = false;
  let connectedOnce = false;
  let wait = retryMs;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;

  const drop = (): void => {
    if (pingTimer !== null) clearInterval(pingTimer);
    pingTimer = null;
    const old = client;
    client = null;
    if (old !== null) {
      old.removeAllListeners();
      // Une erreur tardive de l'ancienne connexion ne doit pas faire tomber le processus.
      old.on("error", () => undefined);
      void old.end().catch(() => undefined);
    }
  };

  const schedule = (): void => {
    if (stopped || retryTimer !== null) return;
    drop();
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void connect();
    }, wait);
    wait = Math.min(wait * 2, maxRetryMs);
  };

  const connect = async (): Promise<void> => {
    if (stopped) return;
    const next = createClient({ connectionString, keepAlive: true, application_name: "proofseen-live", connectionTimeoutMillis: connectTimeoutMs });
    client = next;
    next.on("notification", (message) => {
      if (message.channel !== LIVE_CHANNEL) return;
      const signal = parseLiveSignal(message.payload);
      if (signal !== null) handlers?.onSignal(signal);
    });
    next.on("error", (error) => {
      log("live listener: connection error", error);
      schedule();
    });
    next.on("end", () => schedule());
    try {
      await next.connect();
      await next.query(`LISTEN ${LIVE_CHANNEL}`);
    } catch (error) {
      log("live listener: connect failed", error);
      schedule();
      return;
    }
    if (client !== next) return;
    wait = retryMs;
    let pinging = false;
    pingTimer = setInterval(() => {
      if (pinging) return;
      pinging = true;
      within(next.query("SELECT 1"), pingTimeoutMs)
        .catch((error: unknown) => {
          log("live listener: ping failed", error);
          if (client === next) schedule();
        })
        .finally(() => {
          pinging = false;
        });
    }, pingMs);
    pingTimer.unref?.();
    if (connectedOnce) handlers?.onReconnect();
    connectedOnce = true;
  };

  return {
    start(h) {
      handlers = h;
      if (client === null && retryTimer === null && !stopped) void connect();
    },
    async stop() {
      stopped = true;
      if (retryTimer !== null) clearTimeout(retryTimer);
      retryTimer = null;
      drop();
    },
  };
};
