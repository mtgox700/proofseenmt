import { afterEach, describe, expect, it, vi } from "vitest";
import { KEY_PATH, notifyMissionChanged } from "../src/data/indexnow";

const MISSION = "0199a1b2-0000-7000-8000-000000000001";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("notification IndexNow d'une mission", () => {
  it("ne part jamais sans clé ni adresse publique configurées", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("INDEXNOW_KEY", "");
    vi.stubEnv("PROOFSEEN_PUBLIC_URL", "https://proofseen.com");
    notifyMissionChanged(MISSION);
    vi.stubEnv("INDEXNOW_KEY", "6f6d6c0b1234abcd");
    vi.stubEnv("PROOFSEEN_PUBLIC_URL", "");
    notifyMissionChanged(MISSION);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("annonce les deux langues et le sitemap, sur le domaine configuré", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("INDEXNOW_KEY", "6f6d6c0b1234abcd");
    vi.stubEnv("PROOFSEEN_PUBLIC_URL", "https://proofseen.com/");
    notifyMissionChanged(MISSION);

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.indexnow.org/indexnow");
    expect(JSON.parse(String(init.body))).toEqual({
      host: "proofseen.com",
      key: "6f6d6c0b1234abcd",
      keyLocation: `https://proofseen.com${KEY_PATH}`,
      urlList: [`https://proofseen.com/fr/missions/${MISSION}`, `https://proofseen.com/en/missions/${MISSION}`, "https://proofseen.com/sitemap-missions.xml"],
    });
  });

  it("n'annonce une même page qu'une fois en cinq minutes, même enregistrée en boucle", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("INDEXNOW_KEY", "6f6d6c0b1234abcd");
    vi.stubEnv("PROOFSEEN_PUBLIC_URL", "https://proofseen.com/");
    const other = "0199a1b2-0000-7000-8000-000000000002";
    for (let i = 0; i < 5; i += 1) notifyMissionChanged(other);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refuse une clé hors protocole plutôt que de l'envoyer", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("INDEXNOW_KEY", "court");
    vi.stubEnv("PROOFSEEN_PUBLIC_URL", "https://proofseen.com");
    notifyMissionChanged(MISSION);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
