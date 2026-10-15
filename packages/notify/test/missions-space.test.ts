import { describe, expect, it } from "vitest";
import { renderEmail } from "../src/index";

const BASE = "https://proofseen.com/";
const TO = { lang: "fr" as const, displayName: "Camille" };

describe("e-mails de l'espace missions", () => {
  it("dit au freelance que sa candidature a été lue, jamais par qui", () => {
    const email = renderEmail({ kind: "application_read", payload: { applicationId: "a-1", missionId: "m-1" }, to: TO }, BASE);
    expect(email.subject).toBe("Votre candidature a été lue");
    expect(email.text).toContain("https://proofseen.com/fr/app/missions");
    expect(email.text).not.toMatch(/a-1/);
  });

  it("annonce une invitation à postuler, avec la mission, et laisse le choix", () => {
    const email = renderEmail({ kind: "mission_invitation", payload: { invitationId: "i-1", missionId: "m-2" }, to: { ...TO, lang: "en" } }, BASE);
    expect(email.subject).toBe("A company invites you to apply");
    expect(email.html).toContain('href="https://proofseen.com/en/missions/m-2"');
    expect(email.text).toMatch(/You decide/);
  });

  it("signale la nouvelle mission d'une entreprise suivie", () => {
    const email = renderEmail({ kind: "company_mission", payload: { missionId: "m-3" }, to: TO }, BASE);
    expect(email.subject).toBe("Une entreprise que vous suivez publie une mission");
    expect(email.text).toContain("https://proofseen.com/fr/missions/m-3");
  });
});
