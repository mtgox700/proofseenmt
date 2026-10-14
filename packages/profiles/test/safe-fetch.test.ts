import { createServer, request as httpRequest, type Server, type ServerResponse } from "node:http";
import { request as httpsRequest } from "node:https";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MAX_EVIDENCE_BYTES, isBlockedAddress, safeFetchText, type RequestImpl } from "../src/safe-fetch";

type LookupCallback = (e: Error | null, address: string | readonly { address: string; family: number }[], family?: number) => void;

/** Résolveur sans réseau : tout nom pointe vers `address`, sous la forme que Node demande (`all` ou non). */
const resolvingTo = (address: string) =>
  ((_hostname: string, options: { all?: boolean }, callback: LookupCallback) =>
    options.all === true ? callback(null, [{ address, family: 4 }]) : callback(null, address, 4)) as never;

/** Transport qui échoue au moindre appel : prouve qu'un refus tombe AVANT toute connexion. */
const noConnection = () => {
  const calls: string[] = [];
  const requestImpl: RequestImpl = (options) => {
    calls.push(String(options.hostname));
    throw new Error("aucune connexion ne devait partir");
  };
  return { requestImpl, calls };
};

describe("les adresses qu'on ne compose jamais sur la foi d'un tiers", () => {
  it("refuse la boucle locale, le réseau privé et les métadonnées d'instance cloud", () => {
    for (const ip of ["127.0.0.1", "127.9.9.9", "0.0.0.0", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1"]) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });

  it("refuse les équivalents IPv6, y compris une IPv4 encapsulée", () => {
    for (const ip of ["::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:169.254.169.254"]) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });

  it("refuse les IPv4 transportées sous toutes leurs formes IPv6 : compatible, mappée en hexadécimal, 6to4, NAT64, Teredo", () => {
    for (const ip of [
      "::7f00:1", // IPv4-compatible (::/96), forme que le parseur d'URL produit
      "::127.0.0.1",
      "::a9fe:a9fe",
      "::808:808", // ::/96 est refusé en entier, même vers une IPv4 publique
      "::ffff:7f00:1", // IPv4 mappée, forme hexadécimale
      "0:0:0:0:0:ffff:7f00:1",
      "::ffff:a9fe:a9fe",
      "::ffff:0:7f00:1", // IPv4 traduite (SIIT)
      "2002:7f00:1::1", // 6to4
      "2002:808:808::1",
      "64:ff9b::a9fe:a9fe", // NAT64
      "64:ff9b::808:808",
      "64:ff9b:1::1",
      "2001:0:4136:e378::1", // Teredo
      "fec0::1", // site-local (obsolète)
      "100::1", // préfixe de rejet
    ]) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });

  it("accepte une adresse publique ordinaire", () => {
    for (const ip of ["216.198.79.1", "8.8.8.8", "2606:4700::1111", "2a00:1450:4007:80f::200e", "::ffff:8.8.8.8"]) expect(isBlockedAddress(ip), ip).toBe(false);
  });

  it("refuse ce qui n'est pas une adresse : on ne valide pas ce qu'on ne comprend pas", () => {
    for (const value of ["", "localhost", "999.1.1.1", "pas-une-ip"]) expect(isBlockedAddress(value), value).toBe(true);
  });
});

describe("la récupération elle-même", () => {
  it("refuse une adresse qui n'est pas en https, sans même ouvrir de connexion", async () => {
    await expect(safeFetchText("http://exemple.fr/", { timeoutMs: 500 })).rejects.toThrow(/https/);
  });

  it("refuse une IP littérale dès la première adresse, sous toutes ses écritures, sans connexion", async () => {
    // Node saute `lookup` pour une IP littérale : le contrôle à la connexion ne la verrait jamais.
    const { requestImpl, calls } = noConnection();
    for (const url of ["https://127.0.0.1/", "https://[::1]/", "https://2130706433/", "https://0x7f.0.0.1/", "https://169.254.169.254/latest/meta-data/", "https://[::ffff:7f00:1]/", "https://8.8.8.8/"]) {
      await expect(safeFetchText(url, { timeoutMs: 500, requestImpl, isBlocked: () => false }), url).rejects.toThrow(/IP littérale/);
    }
    expect(calls).toEqual([]);
  });

  it("refuse tout port autre que 443, sans connexion", async () => {
    const { requestImpl, calls } = noConnection();
    await expect(safeFetchText("https://exemple.fr:8443/", { timeoutMs: 500, requestImpl })).rejects.toThrow(/port/);
    expect(calls).toEqual([]);
  });

  it("refuse de se connecter quand le nom résout vers une adresse interne", async () => {
    // Le refus vient du moment de la connexion, ce qui ferme aussi la réattribution DNS. Le résolveur est injecté :
    // un test de sécurité qui dépend du DNS réel devient instable, et un test instable finit par être ignoré.
    await expect(safeFetchText("https://client-malin.example/", { timeoutMs: 1000, lookupImpl: resolvingTo("169.254.169.254") })).rejects.toThrow(
      /adresse interne refusée \(169\.254\.169\.254\)/,
    );
  });

  it("se connecte quand le nom résout vers une adresse publique", async () => {
    // Le refus doit venir de l'adresse, pas du fait qu'on refuse tout : ici la connexion est tentée, puis échoue
    // ailleurs (aucun serveur à cette adresse) — ce qui prouve que le garde-fou a laissé passer.
    await expect(
      safeFetchText("https://client-honnete.example/", { timeoutMs: 300, lookupImpl: resolvingTo("203.0.113.200"), isBlocked: () => false }),
    ).rejects.not.toThrow(/adresse interne refusée/);
  });
});

describe("contre une cible réelle, hostile par nature", () => {
  let server: Server;
  let port: number;
  let handler: (res: ServerResponse) => void;
  let hits: string[];
  let closed: boolean;

  /*
   * Le serveur d'essai parle http sur un port local quelconque. Le transport injecté y conduit chaque saut ; tout le
   * reste est le chemin de production : contrôle de l'adresse avant chaque saut, `lookup` à la connexion, plafonds.
   * `isBlocked: () => false` laisse passer la boucle locale du serveur d'essai : seul le contrôle des IP littérales et
   * des ports, indépendant de lui, peut alors refuser.
   */
  const toLocal: RequestImpl = (options, callback) => httpRequest({ ...options, protocol: "http:", port }, callback);
  const read = (url = "https://client.example/", over: Record<string, unknown> = {}) =>
    safeFetchText(url, { timeoutMs: 1000, isBlocked: () => false, lookupImpl: resolvingTo("127.0.0.1"), requestImpl: toLocal, ...over });

  beforeEach(async () => {
    hits = [];
    closed = false;
    handler = (res) => {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("preuve");
    };
    server = createServer((req, res) => {
      hits.push(req.url ?? "");
      res.on("close", () => {
        closed = true;
      });
      handler(res);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as { port: number }).port;
  });
  afterEach(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("lit le corps d'une réponse ordinaire", async () => {
    expect(await read()).toBe("preuve");
  });

  it("n'accepte pas un serveur en clair présenté comme https", async () => {
    // Même chemin, mais en TLS : la poignée de main échoue contre un serveur en clair, et c'est le comportement voulu.
    const tls: RequestImpl = (options, callback) => httpsRequest({ ...options, port }, callback);
    await expect(read("https://client.example/", { requestImpl: tls })).rejects.toThrow();
  });

  it("refuse une redirection vers une IP littérale interne, avant de la suivre", async () => {
    for (const target of ["https://127.0.0.1:8443/", "https://127.0.0.1/", "https://10.0.0.7/", "https://169.254.169.254/latest/meta-data/", "https://[::1]/", "https://[::ffff:7f00:1]/", "https://[64:ff9b::a9fe:a9fe]/"]) {
      hits = [];
      handler = (res) => {
        res.writeHead(302, { location: target });
        res.end();
      };
      await expect(read(), target).rejects.toThrow(/IP littérale|port/);
      expect(hits, target).toEqual(["/"]);
    }
  });

  it("refuse une redirection vers un autre port ou en clair", async () => {
    for (const target of ["https://autre.example:8443/", "http://autre.example/"]) {
      hits = [];
      handler = (res) => {
        res.writeHead(301, { location: target });
        res.end();
      };
      await expect(read(), target).rejects.toThrow(/port|https/);
      expect(hits, target).toEqual(["/"]);
    }
  });

  it("borne le nombre de redirections", async () => {
    handler = (res) => {
      res.writeHead(302, { location: "https://boucle.example/suivant" });
      res.end();
    };
    await expect(read("https://client.example/", { maxRedirects: 2 })).rejects.toThrow(/trop de redirections/);
    expect(hits).toHaveLength(3);
  });

  it("plafonne le corps", async () => {
    handler = (res) => {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("x".repeat(MAX_EVIDENCE_BYTES + 1024));
    };
    await expect(read()).rejects.toThrow(/trop grande/);
  });

  it("coupe une cible qui envoie au goutte-à-goutte : délai total, pas seulement d'inactivité", async () => {
    // Un octet toutes les 50 ms ne déclenche jamais un délai d'inactivité d'une seconde : seul le délai total l'arrête.
    handler = (res) => {
      res.writeHead(200, { "content-type": "text/plain" });
      const timer = setInterval(() => res.write("x"), 50);
      res.on("close", () => clearInterval(timer));
    };
    const started = Date.now();
    await expect(read("https://client.example/", { deadlineMs: 400 })).rejects.toThrow(/délai total/);
    expect(Date.now() - started).toBeLessThan(1_500);
    // La connexion est bien fermée, pas seulement abandonnée côté promesse.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(closed).toBe(true);
  });

  it("le délai total couvre toute la chaîne de redirections", async () => {
    handler = (res) => {
      setTimeout(() => {
        res.writeHead(302, { location: "https://lent.example/suivant" });
        res.end();
      }, 150);
    };
    await expect(read("https://client.example/", { deadlineMs: 400, maxRedirects: 5 })).rejects.toThrow(/délai total/);
    expect(hits.length).toBeLessThanOrEqual(3);
  });
});
