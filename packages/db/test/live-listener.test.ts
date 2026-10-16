import { describe, expect, it, vi } from "vitest";
import { pgLiveListener, type ListenerClient, type ListenerClientConfig } from "../src/live-listener";

/*
 * L'écouteur des événements en direct face à une connexion qui ne répond plus (revue de sécurité vague 3, L7) : une
 * connexion muette, qui ne renvoie ni erreur ni fin, est détectée par un ping sans réponse et rouverte ; l'ouverture
 * elle-même a un délai. Une fausse connexion remplace Postgres.
 */

interface FakeClient extends ListenerClient {
  readonly config: ListenerClientConfig;
  readonly ended: boolean;
}

/** `silentPing` : la connexion accepte LISTEN puis ne répond plus jamais à un ping. */
const fakeFactory = (silentPing: (index: number) => boolean) => {
  const clients: FakeClient[] = [];
  const create = (config: ListenerClientConfig): ListenerClient => {
    const index = clients.length;
    let ended = false;
    const client: FakeClient = {
      config,
      get ended() {
        return ended;
      },
      connect: async () => undefined,
      query: (text: string) => (text === "SELECT 1" && silentPing(index) ? new Promise<never>(() => undefined) : Promise.resolve(undefined)),
      end: async () => {
        ended = true;
      },
      on: () => client,
      removeAllListeners: () => client,
    };
    clients.push(client);
    return client;
  };
  return { clients, create };
};

describe("écouteur en direct", () => {
  it("rouvre une connexion dont le ping reste sans réponse, et prévient l'application", async () => {
    const factory = fakeFactory((index) => index === 0);
    const onReconnect = vi.fn();
    const listener = pgLiveListener("postgres://test", { createClient: factory.create, pingMs: 20, pingTimeoutMs: 30, retryMs: 10, log: () => undefined });
    listener.start({ onSignal: () => undefined, onReconnect });
    await vi.waitFor(() => expect(onReconnect).toHaveBeenCalledTimes(1), { timeout: 5_000, interval: 10 });
    expect(factory.clients[0]?.ended).toBe(true);
    expect(factory.clients.length).toBeGreaterThanOrEqual(2);
    await listener.stop();
  });

  it("ouvre la connexion avec un délai, et garde une connexion qui répond", async () => {
    const factory = fakeFactory(() => false);
    const onReconnect = vi.fn();
    const listener = pgLiveListener("postgres://test", { createClient: factory.create, pingMs: 10, pingTimeoutMs: 50, log: () => undefined });
    listener.start({ onSignal: () => undefined, onReconnect });
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(factory.clients).toHaveLength(1);
    expect(factory.clients[0]?.config).toMatchObject({ connectionString: "postgres://test", connectionTimeoutMillis: 10_000, keepAlive: true });
    expect(onReconnect).not.toHaveBeenCalled();
    await listener.stop();
  });
});
