import { describe, expect, it } from "vitest";
import { OwnedUrlSchema } from "@proofseen/core";
import { CLIENT_KINDS, EVIDENCE_KINDS, PublicProfileSchema } from "@proofseen/profiles";
import { AvailabilityStatus, ClientKind, EvidenceKind, ProofMethod } from "../src/generated/enums";

/*
 * Les vocabulaires fermés existent maintenant à deux endroits : dans les schémas zod des paquets, et dans les
 * énumérations de la base. Deux définitions d'un même fait finissent toujours par diverger — c'est l'origine des trois
 * premiers défauts de ce dépôt. Ce test fixe l'accord : ajouter un type de client d'un côté sans l'autre le fait échouer.
 */

const sorted = (values: Iterable<string>) => [...values].sort();

describe("la base et les paquets parlent le même vocabulaire", () => {
  it("types de client", () => {
    expect(sorted(Object.values(ClientKind))).toEqual(sorted(CLIENT_KINDS));
  });

  it("types de preuve d'une mission vérifiée", () => {
    expect(sorted(Object.values(EvidenceKind))).toEqual(sorted(EVIDENCE_KINDS));
  });

  it("méthodes de preuve de possession", () => {
    expect(sorted(Object.values(ProofMethod))).toEqual(sorted(OwnedUrlSchema.shape.proofMethod.options));
  });

  it("statuts de disponibilité", () => {
    expect(sorted(Object.values(AvailabilityStatus))).toEqual(sorted(PublicProfileSchema.shape.availability.shape.status.options));
  });
});
