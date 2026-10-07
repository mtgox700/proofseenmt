import { describe, expect, it } from "vitest";
import { accountingCsv, type AccountingRow } from "../src/accounting-csv";

const ROW: AccountingRow = {
  issuedAt: new Date("2026-11-30T23:30:00Z"),
  number: "FR-ABCDE-2026-0001",
  seller: { legalName: "Camille Test EI", siret: "55210055400011", vatNumber: "FR40552100554" },
  label: "Mission de 10 jours",
  costCenter: "DATA",
  contractId: "0190a0b0-0000-7000-8000-000000000001",
  netCents: 600_000,
  vatRateBp: 2000,
  vatCents: 120_000,
  totalCents: 720_000,
  currency: "EUR",
  dueOn: "2026-12-30",
};

describe("export comptable", () => {
  it("écrit un CSV qu'ouvre un tableur français : BOM, point-virgule, virgule décimale, CRLF", () => {
    const csv = accountingCsv([ROW]);
    expect(csv.startsWith(String.fromCharCode(0xfeff))).toBe(true);
    const [header, line] = csv.slice(1).split("\r\n");
    expect(header?.split(";")).toHaveLength(14);
    // Émise le 30 novembre à 23 h 30 UTC : le 1er décembre à Paris.
    expect(line).toBe('2026-12-01;"FR-ABCDE-2026-0001";"Camille Test EI";"55210055400011";"FR40552100554";"Mission de 10 jours";"DATA";0190a0b0-0000-7000-8000-000000000001;6000,00;20,00;1200,00;7200,00;EUR;2026-12-30');
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("neutralise les cellules qui seraient lues comme des formules, et échappe les guillemets", () => {
    const csv = accountingCsv([{ ...ROW, seller: { ...ROW.seller, legalName: '=HYPERLINK("http://x")' }, costCenter: "-1+2", label: "@SUM(A1)" }]);
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(csv).toContain(`"'-1+2"`);
    expect(csv).toContain(`"'@SUM(A1)"`);
  });

  it("laisse vides les champs absents", () => {
    const line = accountingCsv([{ ...ROW, costCenter: null, seller: { ...ROW.seller, vatNumber: null } }]).split("\r\n")[1];
    expect(line).toContain(';"";"Mission de 10 jours";"";');
  });
});
