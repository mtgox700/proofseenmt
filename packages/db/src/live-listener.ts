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
 * silencieuse.
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

export interface PgListenerOptions {
  /** Première attente avant de rouvrir, doublée à chaque échec jusqu'à `maxRetryMs`. */
  readonly retryMs?: number;
  readonly maxRetryMs?: number;
  readonly pingMs?: number;
  /** Journal d'erreur : seulement le nom de l'erreur, un message de pilote peut contenir l'hôte de la base. */
  readonly log?: (message: string, error?: unknown) => void;
}

const DEFAULTS = { retryMs: 1_000, maxRetryMs: 30_000, pingMs: 60_000 } as const;

export const pgLiveListener = (connectionString: string, options: PgListenerOptions = {}): LiveListener => {
  const retryMs = options.retryMs ?? DEFAULTS.retryMs;
  const maxRetryMs = options.maxRetryMs ?? DEFAULTS.maxRetryMs;
  const pingMs = options.pingMs ?? DEFAULTS.pingMs;
  const log = options.log ?? (() => undefined);
  let handlers: LiveHandlers | null = null;
  let client: Client | null = null;
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
    const next = new Client({ connectionString, keepAlive: true, application_name: "proofseen-live" });
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
    pingTimer = setInterval(() => {
      next.query("SELECT 1").catch((error: unknown) => {
        log("live listener: ping failed", error);
        schedule();
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
