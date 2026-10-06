import { describe, expect, it } from "vitest";
import {
  SURFACE_CHECK_MAX_AGE_DAYS,
  SurfaceCheckRecordSchema,
  surfaceCheckBlocker,
  type SurfaceCheckRecord,
} from "../src/surface-record";

const SITE = "https://exemple.fr/profil/";
const EN = "https://exemple.fr/en/profil/";
const LINKEDIN = "https://www.linkedin.com/in/exemple";
const NOW = new Date("2026-10-24T09:00:00Z");

const record = (over: Partial<SurfaceCheckRecord> = {}): SurfaceCheckRecord =>
  SurfaceCheckRecordSchema.parse({
    identityId: "FR-1AB2C",
    checkedAt: "2026-10-20T09:00:00Z",
    pages: [{ url: SITE, outcome: "clean", kinds: [] }],
    ...over,
  });

const blocker = (over: Partial<SurfaceCheckRecord> = {}, urls: readonly string[] = [SITE], now = NOW) =>
  surfaceCheckBlocker({ record: record(over), identityId: "FR-1AB2C", urls, now });

describe("sans contrôle de surface, on ne mesure pas", () => {
  it("laisse passer un contrôle propre, récent, qui couvre les URL mesurées", () => {
    expect(blocker()).toBeNull();
  });

  it("bloque quand aucun contrôle n'a été enregistré", () => {
    expect(surfaceCheckBlocker({ record: null, identityId: "FR-1AB2C", urls: [SITE], now: NOW })).toMatch(/aucun contrôle/i);
  });

  it("bloque un contrôle qui porte sur une autre identité", () => {
    expect(blocker({ identityId: "FR-9ZZZZ" })).toMatch(/autre identité/i);
  });
});

describe("le contrôle se périme", () => {
  it("bloque au-delà de la limite d'âge : une page change après avoir été contrôlée", () => {
    const old = new Date(NOW.getTime() - (SURFACE_CHECK_MAX_AGE_DAYS + 1) * 86_400_000).toISOString();
    expect(blocker({ checkedAt: old })).toMatch(new RegExp(`${SURFACE_CHECK_MAX_AGE_DAYS} jours`));
  });

  it("accepte un contrôle juste dans la limite", () => {
    const edge = new Date(NOW.getTime() - (SURFACE_CHECK_MAX_AGE_DAYS - 1) * 86_400_000).toISOString();
    expect(blocker({ checkedAt: edge })).toBeNull();
  });

  it("bloque un contrôle daté du futur plutôt que de lui faire confiance", () => {
    expect(blocker({ checkedAt: "2026-12-01T09:00:00Z" })).toMatch(/futur/i);
  });
});

describe("ce que le contrôle doit couvrir", () => {
  it("bloque quand une URL qui sera mesurée n'a pas été contrôlée", () => {
    expect(blocker({}, [SITE, EN])).toMatch(/non contrôlée/i);
  });

  it("ne réclame pas de contrôle automatique sur une plateforme où il est interdit", () => {
    const withManual = record({ pages: [{ url: SITE, outcome: "clean", kinds: [] }, { url: LINKEDIN, outcome: "manual", kinds: [] }] });
    expect(surfaceCheckBlocker({ record: withManual, identityId: "FR-1AB2C", urls: [SITE, LINKEDIN], now: NOW })).toBeNull();
  });
});

describe("ce que le contrôle a trouvé", () => {
  it("bloque sur une manipulation, en la nommant", () => {
    expect(blocker({ pages: [{ url: SITE, outcome: "manipulated", kinds: ["hidden_text", "ai_instruction"] }] })).toMatch(
      /hidden_text.*ai_instruction|manipulation/,
    );
  });

  it("bloque sur une page qu'on n'a pas pu lire : illisible n'est pas propre", () => {
    expect(blocker({ pages: [{ url: SITE, outcome: "unreadable", kinds: [] }] })).toMatch(/illisible|relire/i);
  });

  it("ne bloque pas sur un simple bourrage de mots-clés", () => {
    expect(blocker({ pages: [{ url: SITE, outcome: "clean", kinds: ["stuffing"] }] })).toBeNull();
  });
});

describe("le fichier de contrôle refuse ce qui ne se vérifie pas", () => {
  it("refuse une date sans fuseau", () => {
    expect(() => record({ checkedAt: "2026-10-20" })).toThrow();
  });

  it("refuse un enregistrement sans page", () => {
    expect(() => record({ pages: [] })).toThrow();
  });
});
