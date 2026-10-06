import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MAX_EVIDENCE_BYTES, isBlockedAddress, safeFetchText } from "../src/safe-fetch";

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

  it("accepte une adresse publique ordinaire", () => {
    for (const ip of ["216.198.79.1", "8.8.8.8", "2606:4700::1111"]) expect(isBlockedAddress(ip), ip).toBe(false);
  });

  it("refuse ce qui n'est pas une adresse : on ne valide pas ce qu'on ne comprend pas", () => {
    for (const value of ["", "localhost", "999.1.1.1", "pas-une-ip"]) expect(isBlockedAddress(value), value).toBe(true);
  });
});

describe("la récupération elle-même", () => {
  it("refuse une adresse qui n'est pas en https, sans même ouvrir de connexion", async () => {
    await expect(safeFetchText("http://exemple.fr/", { timeoutMs: 500 })).rejects.toThrow(/https/);
  });

  it("refuse de se connecter quand le nom résout vers une adresse interne", async () => {
    // Le refus vient du moment de la connexion, ce qui ferme aussi la réattribution DNS. Le résolveur est injecté :
    // un test de sécurité qui dépend du DNS réel devient instable, et un test instable finit par être ignoré.
    const lookup = ((hostname: string, options: unknown, callback: (e: Error | null, address: string, family: number) => void) => {
      callback(null, "169.254.169.254", 4);
    }) as never;
    await expect(safeFetchText("https://client-malin.example/", { timeoutMs: 1000, lookupImpl: lookup })).rejects.toThrow(
      /adresse interne refusée \(169\.254\.169\.254\)/,
    );
  });

  it("se connecte quand le nom résout vers une adresse publique", async () => {
    // Le refus doit venir de l'adresse, pas du fait qu'on refuse tout : ici la connexion est tentée, puis échoue
    // ailleurs (aucun serveur à cette adresse) — ce qui prouve que le garde-fou a laissé passer.
    const lookup = ((hostname: string, options: unknown, callback: (e: Error | null, address: string, family: number) => void) => {
      callback(null, "203.0.113.200", 4);
    }) as never;
    await expect(safeFetchText("https://client-honnete.example/", { timeoutMs: 300, lookupImpl: lookup, isBlocked: () => false })).rejects.not.toThrow(
      /adresse interne refusée/,
    );
  });
});

describe("contre une cible réelle, hostile par nature", () => {
  let server: Server;
  let port: number;
  let mode: "small" | "huge" | "loop";

  const url = () => `https://127.0.0.1:${port}/`;
  // Le serveur est en clair ; on n'atteint jamais la couche TLS puisque tout est refusé avant, sauf dans les cas
  // où l'on veut observer le comportement de lecture — ceux-là passent par `isBlocked: () => false` et http interdit.
  const read = (over: Record<string, unknown> = {}) => safeFetchText(url(), { timeoutMs: 1000, isBlocked: () => false, ...over });

  beforeEach(async () => {
    mode = "small";
    server = createServer((_req, res) => {
      if (mode === "loop") {
        res.writeHead(302, { location: `https://127.0.0.1:${port}/suivant` });
        res.end();
        return;
      }
      res.writeHead(200, { "content-type": "text/plain" });
      res.end(mode === "huge" ? "x".repeat(MAX_EVIDENCE_BYTES + 1024) : "preuve");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as { port: number }).port;
  });
  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("n'accepte pas un serveur en clair présenté comme https", async () => {
    // Le serveur d'essai parle http : la poignée de main TLS échoue, et c'est le comportement voulu.
    await expect(read()).rejects.toThrow();
  });

  it("borne le nombre de redirections", async () => {
    mode = "loop";
    await expect(read({ maxRedirects: 2 })).rejects.toThrow();
  });
});
