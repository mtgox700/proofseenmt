import { describe, expect, it, vi } from "vitest";
import type { AutomaticProofMethod, DueProof, MarkVerifiedResult, OwnedUrlRecord, RecheckResult } from "@proofseen/db";
import { proofKit, type EvidenceProbe } from "@proofseen/profiles";
import { recheckProofs, verifyOwnedUrl } from "../src/data/ownership";

const SECRET = "un-secret-de-preuve-suffisamment-long-pour-le-hmac";
const ACTOR = { userId: "0192f1c4-0000-7000-8000-0000000000aa" };
const PROFILE = "0192f1c4-0000-7000-8000-000000000001";
const OTHER_PROFILE = "0192f1c4-0000-7000-8000-000000000002";
const ID = "0192f1c4-0000-7000-8000-000000000010";
const SITE = "https://camille.dev/";
const NOW = new Date("2026-10-14T09:00:00Z");

const record = (over: Partial<OwnedUrlRecord> = {}): OwnedUrlRecord => ({
  id: ID,
  profileId: PROFILE,
  url: SITE,
  proofMethod: "well_known_file",
  verifiedAt: null,
  checkedAt: null,
  failedAt: null,
  createdAt: NOW,
  ...over,
});

const kitFor = (profileId: string, url = SITE) => {
  const kit = proofKit(SECRET, profileId, url);
  if (kit === null) throw new Error("kit attendu");
  return kit;
};

/** Une sonde sans réseau, qui note ce qu'on lui demande. */
const probeServing = (pages: Record<string, string>) => {
  const asked: string[] = [];
  const probe: EvidenceProbe = {
    fetchText: async (url) => {
      asked.push(url);
      const body = pages[url];
      if (body === undefined) throw new Error("HTTP 404");
      return body;
    },
    resolveTxt: async (host) => {
      asked.push(`dns:${host}`);
      throw new Error("ENODATA");
    },
  };
  return { probe, asked };
};

/** Une sonde dont aucune lecture ne se termine : une cible qui envoie au goutte-à-goutte, ou un DNS muet. */
const hanging = (): EvidenceProbe => ({
  fetchText: () => new Promise<string>(() => undefined),
  resolveTxt: () => new Promise<readonly string[]>(() => undefined),
});

const repoWith = (found: OwnedUrlRecord | null, marked: MarkVerifiedResult = { kind: "verified", record: record({ verifiedAt: NOW }) }) => {
  const markVerified = vi.fn(async (_actor: unknown, _id: string, _method: AutomaticProofMethod, _now: Date) => marked);
  return { repo: { get: vi.fn(async () => found), markVerified }, markVerified };
};

describe("« Vérifier maintenant »", () => {
  it("enregistre la preuve quand le jeton du profil est posé, avec la méthode trouvée", async () => {
    const { probe } = probeServing({ [kitFor(PROFILE).wellKnown.url]: kitFor(PROFILE).wellKnown.content });
    const { repo, markVerified } = repoWith(record());
    expect(await verifyOwnedUrl(repo, ACTOR, ID, SECRET, NOW, probe)).toBe("proven");
    expect(markVerified).toHaveBeenCalledWith(ACTOR, ID, "well_known_file", NOW);
  });

  it("ne prouve rien avec le jeton d'un autre profil posé sur le même site", async () => {
    const { probe } = probeServing({ [kitFor(OTHER_PROFILE).wellKnown.url]: kitFor(OTHER_PROFILE).wellKnown.content, [SITE]: kitFor(OTHER_PROFILE).metaTag.tag });
    const { repo, markVerified } = repoWith(record());
    expect(await verifyOwnedUrl(repo, ACTOR, ID, SECRET, NOW, probe)).toBe("absent");
    expect(markVerified).not.toHaveBeenCalled();
  });

  it("ne lit rien pour une adresse qui n'est pas à la personne", async () => {
    const { probe, asked } = probeServing({});
    const { repo } = repoWith(null);
    expect(await verifyOwnedUrl(repo, ACTOR, ID, SECRET, NOW, probe)).toBe("not_found");
    expect(asked).toEqual([]);
  });

  it("n'envoie aucune requête vers LinkedIn ou Malt", async () => {
    const { probe, asked } = probeServing({});
    for (const found of [record({ url: "https://www.linkedin.com/in/camille", proofMethod: "profile_token" }), record({ url: "https://www.malt.fr/profile/camille" })]) {
      expect(await verifyOwnedUrl(repoWith(found).repo, ACTOR, ID, SECRET, NOW, probe)).toBe("manual_only");
    }
    expect(asked).toEqual([]);
  });

  it("rend le conflit quand l'adresse est déjà prouvée par un autre profil", async () => {
    const { probe } = probeServing({ [SITE]: kitFor(PROFILE).metaTag.tag });
    const { repo } = repoWith(record(), { kind: "already_proven_elsewhere" });
    expect(await verifyOwnedUrl(repo, ACTOR, ID, SECRET, NOW, probe)).toBe("already_proven_elsewhere");
  });
});

describe("la relecture planifiée", () => {
  const due = (n: number, profileId = PROFILE): DueProof[] =>
    Array.from({ length: n }, (_, i) => ({ id: `0192f1c4-0000-7000-8000-${String(100 + i).padStart(12, "0")}`, profileId, url: `https://site${i}.dev/` }));

  const repoFor = (proofs: readonly DueProof[], answer: (method: AutomaticProofMethod | null) => RecheckResult | null) => {
    const recorded: (AutomaticProofMethod | null)[] = [];
    const repo = {
      dueForRecheck: vi.fn(async () => proofs),
      recordRecheck: vi.fn(async (_id: string, method: AutomaticProofMethod | null) => {
        recorded.push(method);
        return answer(method);
      }),
    };
    return { repo, recorded };
  };

  it("confirme les preuves toujours en place et compte celles qui ne se relisent plus", async () => {
    const proofs = due(3);
    const pages = Object.fromEntries(proofs.slice(0, 2).map((p) => [kitFor(PROFILE, p.url).wellKnown.url, kitFor(PROFILE, p.url).wellKnown.content]));
    const { probe } = probeServing(pages);
    const { repo, recorded } = repoFor(proofs, (method) => (method === null ? "grace" : "confirmed"));
    expect(await recheckProofs(repo, SECRET, NOW, probe)).toEqual({ checked: 3, confirmed: 2, grace: 1, revoked: 0, failed: 0, deferred: 0 });
    expect(recorded.filter((m) => m === "well_known_file")).toHaveLength(2);
  });

  it("compte une preuve retirée après sa grace, et une écriture qui échoue sans arrêter le passage", async () => {
    const { probe } = probeServing({});
    let call = 0;
    const repo = {
      dueForRecheck: vi.fn(async () => due(3)),
      recordRecheck: vi.fn(async (): Promise<RecheckResult | null> => {
        call += 1;
        if (call === 1) throw new Error("base indisponible");
        return call === 2 ? "revoked" : null;
      }),
    };
    expect(await recheckProofs(repo, SECRET, NOW, probe)).toEqual({ checked: 3, confirmed: 0, grace: 0, revoked: 1, failed: 2, deferred: 0 });
  });

  it("ne relit rien quand rien n'est dû", async () => {
    const { probe, asked } = probeServing({});
    const { repo } = repoFor([], () => "confirmed");
    expect(await recheckProofs(repo, SECRET, NOW, probe)).toEqual({ checked: 0, confirmed: 0, grace: 0, revoked: 0, failed: 0, deferred: 0 });
    expect(asked).toEqual([]);
  });

  it("une cible qui ne répond jamais ne retient pas le passage : chaque relecture a son délai, rien n'est enregistré", async () => {
    const { repo, recorded } = repoFor(due(2), () => "confirmed");
    const started = Date.now();
    const report = await recheckProofs(repo, SECRET, NOW, hanging(), { perCheckMs: 50, budgetMs: 5_000 });
    expect(report).toEqual({ checked: 2, confirmed: 0, grace: 0, revoked: 0, failed: 2, deferred: 0 });
    expect(Date.now() - started).toBeLessThan(1_000);
    // Une relecture coupée n'est pas un échec de la preuve : l'adresse reste due, sans entamer sa grâce.
    expect(recorded).toEqual([]);
  });

  it("le passage entier a un budget : ce qui reste est remis au passage suivant", async () => {
    const { repo } = repoFor(due(12), () => "confirmed");
    const started = Date.now();
    const report = await recheckProofs(repo, SECRET, NOW, hanging(), { perCheckMs: 100, budgetMs: 150 });
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(report.deferred).toBeGreaterThan(0);
    expect(report.checked + report.deferred).toBe(12);
    expect(report.failed).toBe(report.checked);
  });
});

describe("« Vérifier maintenant » face à une cible qui traîne", () => {
  it("répond dans le délai, sans rien enregistrer", async () => {
    const { repo, markVerified } = repoWith(record());
    const started = Date.now();
    expect(await verifyOwnedUrl(repo, ACTOR, ID, SECRET, NOW, hanging(), { deadlineMs: 50 })).toBe("absent");
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(markVerified).not.toHaveBeenCalled();
  });
});
