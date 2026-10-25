import { describe, expect, it } from "vitest";
import {
  daysBetween,
  formatBp,
  formatDate,
  formatDateTime,
  formatInt,
  formatMoney,
  frenchSpacing,
  isIsoDate,
  typography,
} from "../src/format";

const NNBSP = " ";
const NBSP = " ";

describe("formatInt", () => {
  it("groups thousands with a narrow no-break space in French and a comma in English", () => {
    expect(formatInt(1234567, "fr")).toBe(`1${NNBSP}234${NNBSP}567`);
    expect(formatInt(1234567, "en")).toBe("1,234,567");
  });

  it("leaves numbers below one thousand alone and keeps zero", () => {
    expect(formatInt(0, "fr")).toBe("0");
    expect(formatInt(999, "en")).toBe("999");
  });

  it("refuses what is not a safe integer", () => {
    expect(() => formatInt(1.5, "fr")).toThrow(RangeError);
    expect(() => formatInt(Number.NaN, "fr")).toThrow(RangeError);
    expect(() => formatInt(2 ** 53, "fr")).toThrow(RangeError);
  });
});

describe("formatMoney", () => {
  it("prints French amounts with a comma, narrow space for thousands and a no-break space before the ISO code", () => {
    expect(formatMoney(123456, "EUR", "fr")).toBe(`1${NNBSP}234,56${NBSP}EUR`);
    expect(formatMoney(50000, "EUR", "fr")).toBe(`500,00${NBSP}EUR`);
    expect(formatMoney(5, "EUR", "fr")).toBe(`0,05${NBSP}EUR`);
    expect(formatMoney(0, "EUR", "fr")).toBe(`0,00${NBSP}EUR`);
  });

  it("prints English amounts as CODE 1,234.56", () => {
    expect(formatMoney(123456, "EUR", "en")).toBe(`EUR${NBSP}1,234.56`);
    expect(formatMoney(100, "GBP", "en")).toBe(`GBP${NBSP}1.00`);
  });

  it("handles amounts of ten million euros without floating point", () => {
    expect(formatMoney(1_000_000_099, "EUR", "fr")).toBe(`10${NNBSP}000${NNBSP}000,99${NBSP}EUR`);
  });

  it("refuses negative, fractional and unsafe amounts and malformed currencies", () => {
    expect(() => formatMoney(-1, "EUR", "fr")).toThrow(RangeError);
    expect(() => formatMoney(1.5, "EUR", "fr")).toThrow(RangeError);
    expect(() => formatMoney(10, "eur", "fr")).toThrow(RangeError);
    expect(() => formatMoney(10, "EURO", "fr")).toThrow(RangeError);
  });
});

describe("formatBp", () => {
  it("prints whole and fractional percentages without trailing zeros", () => {
    expect(formatBp(1000, "fr")).toBe(`10${NBSP}%`);
    expect(formatBp(1111, "fr")).toBe(`11,11${NBSP}%`);
    expect(formatBp(2050, "fr")).toBe(`20,5${NBSP}%`);
    expect(formatBp(5, "fr")).toBe(`0,05${NBSP}%`);
    expect(formatBp(0, "fr")).toBe(`0${NBSP}%`);
  });

  it("prints the English form with a point and no space", () => {
    expect(formatBp(1111, "en")).toBe("11.11%");
    expect(formatBp(10000, "en")).toBe("100%");
  });

  it("refuses values outside 0 to 10000", () => {
    expect(() => formatBp(-1, "fr")).toThrow(RangeError);
    expect(() => formatBp(10001, "fr")).toThrow(RangeError);
    expect(() => formatBp(1.2, "fr")).toThrow(RangeError);
  });
});

describe("dates", () => {
  it("prints French and English long dates from a hard-coded month table", () => {
    expect(formatDate("2026-10-24", "fr")).toBe("24 octobre 2026");
    expect(formatDate("2026-10-24", "en")).toBe("24 October 2026");
    expect(formatDate("2027-02-28", "fr")).toBe("28 février 2027");
    expect(formatDate("2026-12-01", "fr")).toBe("1er décembre 2026");
    expect(formatDate("2026-12-01", "en")).toBe("1 December 2026");
  });

  it("knows calendar days: leap years yes, 30 February no", () => {
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2027-02-29")).toBe(false);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("1900-02-29")).toBe(false);
    expect(isIsoDate("2000-02-29")).toBe(true);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2026-1-1")).toBe(false);
    expect(isIsoDate("2026-10-24T00:00:00Z")).toBe(false);
    expect(() => formatDate("2026-02-30", "fr")).toThrow(RangeError);
  });

  it("counts days between two ISO dates", () => {
    expect(daysBetween("2028-05-01", "2028-06-30")).toBe(60);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    expect(daysBetween("2028-06-30", "2028-05-01")).toBe(-60);
  });

  it("prints UTC date-times only, never the local zone of the server", () => {
    expect(formatDateTime("2026-10-24T14:03:07Z", "fr")).toBe("24 octobre 2026 à 14:03:07 UTC");
    expect(formatDateTime("2026-10-24T14:03:07+00:00", "en")).toBe("24 October 2026, 14:03:07 UTC");
    expect(formatDateTime("2026-10-24T14:03:07.250Z", "fr")).toBe("24 octobre 2026 à 14:03:07 UTC");
    expect(() => formatDateTime("2026-10-24T14:03:07+02:00", "fr")).toThrow(RangeError);
    expect(() => formatDateTime("2026-10-24T25:00:00Z", "fr")).toThrow(RangeError);
    expect(() => formatDateTime("2026-10-24", "fr")).toThrow(RangeError);
  });
});

describe("frenchSpacing", () => {
  it("puts a narrow no-break space before ; ! ? and a no-break space before :", () => {
    expect(frenchSpacing("Vraiment ? Oui ! Voici ; et là : fin")).toBe(
      `Vraiment${NNBSP}? Oui${NNBSP}! Voici${NNBSP}; et là${NBSP}: fin`,
    );
  });

  it("glues quotation marks to the quoted words with narrow no-break spaces", () => {
    expect(frenchSpacing("ci-après « le Prestataire », agissant")).toBe(
      `ci-après «${NNBSP}le Prestataire${NNBSP}», agissant`,
    );
  });

  it("glues a number to its percent sign, euro sign and the abbreviation n°", () => {
    expect(frenchSpacing("10 % et 20 € selon le n° 5")).toBe(`10${NBSP}% et 20${NBSP}€ selon le n°${NBSP}5`);
  });

  it("does not touch times, addresses and text without a space before the sign", () => {
    expect(frenchSpacing("à 14:03:07 sur https://proofseen.fr/a?b=1")).toBe("à 14:03:07 sur https://proofseen.fr/a?b=1");
  });

  it("is idempotent and keeps other spaces, accents and emoji-free text intact", () => {
    const once = frenchSpacing("L'HAŸ-LES-ROSES : Łukasz Nguyễn ; « x » ?");
    expect(frenchSpacing(once)).toBe(once);
    expect(once.normalize("NFC")).toBe(once);
    expect(once).toContain("L'HAŸ-LES-ROSES");
  });

  it("typography applies it to French only", () => {
    expect(typography("fr", "a : b")).toBe(`a${NBSP}: b`);
    expect(typography("en", "a : b")).toBe("a : b");
  });
});
