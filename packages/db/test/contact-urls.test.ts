import { describe, expect, it } from "vitest";
import { CompanyPublicInputSchema } from "../src/company-pages";
import { NO_CONTACT } from "../src/contact-detection";
import { CONTACT_HOSTS, isContactHost, urlCarriesContact } from "../src/contact-urls";
import { CertificationInputSchema, PortfolioInputSchema } from "../src/profile-section-schemas";

/*
 * Une adresse web publiée (réalisation, vérification d'une certification, site d'une entreprise) ne doit pas devenir
 * un moyen de joindre la personne hors de Proofseen (revue de sécurité vague 2, M4) : ni service de messagerie, de prise
 * de rendez-vous ou de raccourcissement, ni e-mail ou téléphone glissé dans le chemin, la requête ou le fragment.
 */

describe("liste des services de contact direct", () => {
  it("ne contient que des noms d'hôte en minuscules, sans doublon", () => {
    expect(new Set(CONTACT_HOSTS).size).toBe(CONTACT_HOSTS.length);
    for (const host of CONTACT_HOSTS) expect(host).toMatch(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/);
    for (const host of ["wa.me", "api.whatsapp.com", "t.me", "telegram.me", "signal.me", "m.me", "calendly.com", "cal.com", "bit.ly", "tinyurl.com", "linktr.ee"]) {
      expect(isContactHost(host), host).toBe(true);
    }
  });

  it("reconnaît un sous-domaine, pas un domaine qui finit pareil", () => {
    expect(isContactHost("www.calendly.com")).toBe(true);
    expect(isContactHost("api.whatsapp.com")).toBe(true);
    expect(isContactHost("notcalendly.com")).toBe(false);
    expect(isContactHost("example.com")).toBe(false);
  });
});

describe("coordonnées dans une adresse web", () => {
  it.each([
    "https://wa.me/33612345678",
    "https://api.whatsapp.com/send?phone=33612345678",
    "https://t.me/jeandev",
    "https://calendly.com/jean/30min",
    "https://www.cal.com/jean",
    "https://bit.ly/3abcDEF",
    "https://linktr.ee/jean",
    "https://www.linkedin.com/in/jean-dupont",
    "https://www.instagram.com/jean.dev",
    "https://example.com/contact/jean.dupont@gmail.com",
    "https://example.com/contact/jean.dupont%40gmail.com",
    "https://example.com/?tel=06%2012%2034%2056%2078",
    "https://example.com/?appel=%2B33612345678",
    "https://example.com/#06-12-34-56-78",
    "https://0612345678.example.fr/",
  ])("refuse %s", (url) => {
    expect(urlCarriesContact(url)).toBe(true);
  });

  it.each([
    "https://github.com/camille/discord-bot",
    "https://www.behance.net/gallery/123456789/Tableau-de-bord",
    "https://www.credly.com/badges/3f8a1b2c-1234-5678-9abc-def012345678/public_url",
    "https://learn.microsoft.com/api/credentials/share/fr-fr/CamilleMartin-1234/A1B2C3D4E5F6A7B8?sharingId=E1A2B3C4D5E6F7A8",
    "https://demo.example.com/2023/06/15/123",
    "https://aws.example.com/verify/123",
    "https://www.coursera.org/account/accomplishments/verify/ABCD1234EFGH",
    "https://acme.fr",
  ])("accepte %s", (url) => {
    expect(urlCarriesContact(url)).toBe(false);
  });

  it("lit une adresse dont un échappement est mal formé sans planter", () => {
    expect(urlCarriesContact("https://example.com/%E0%A4%A/projet")).toBe(false);
    expect(urlCarriesContact("https://example.com/%E0%A4%A/jean@gmail.com")).toBe(true);
  });
});

describe("champs d'adresse des profils et des entreprises", () => {
  const refusedForContact = (result: { success: boolean; error?: { issues: readonly { message: string }[] } }): boolean =>
    !result.success && (result.error?.issues.some((issue) => issue.message === NO_CONTACT) ?? false);

  it("refuse une réalisation ou une certification qui mène à un contact direct", () => {
    expect(refusedForContact(PortfolioInputSchema.safeParse({ title: "Prendre rendez-vous", url: "https://calendly.com/jean" }))).toBe(true);
    expect(refusedForContact(PortfolioInputSchema.safeParse({ title: "Démo", url: "https://wa.me/33612345678" }))).toBe(true);
    expect(refusedForContact(CertificationInputSchema.safeParse({ name: "AWS SAA", credentialUrl: "https://bit.ly/xyz" }))).toBe(true);
    expect(PortfolioInputSchema.safeParse({ title: "Démo", url: "https://demo.example.com" }).success).toBe(true);
    expect(CertificationInputSchema.safeParse({ name: "AWS SAA", credentialUrl: "https://www.credly.com/badges/3f8a1b2c-1234-5678-9abc-def012345678" }).success).toBe(true);
  });

  it("refuse un site d'entreprise qui mène à un contact direct", () => {
    expect(refusedForContact(CompanyPublicInputSchema.safeParse({ publicName: "Acme", website: "calendly.com/acme" }))).toBe(true);
    expect(refusedForContact(CompanyPublicInputSchema.safeParse({ publicName: "Acme", website: "https://acme.fr/contact/rh@acme.fr" }))).toBe(true);
    expect(CompanyPublicInputSchema.safeParse({ publicName: "Acme", website: "acme.fr" }).success).toBe(true);
  });
});
