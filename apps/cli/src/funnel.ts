import { funnel, getDb, type Cohort } from "@proofseen/db";
import { CliError } from "./files";

/*
 * funnel : l'entonnoir de la marketplace des deux côtés, lu dans la base. Des totaux par étape et leur part du total de
 * la cohorte — pas de l'étape précédente : les étapes ne s'emboîtent pas (un profil peut être contacté sans adresse
 * prouvée). Jamais une liste de personnes.
 */

export interface FunnelCommand {
  readonly log: (line: string) => void;
  readonly from: string | undefined;
  readonly to: string | undefined;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

const day = (name: string, value: string): Date => {
  const date = new Date(`${value}T00:00:00Z`);
  if (!DAY.test(value) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new CliError(`--${name} attend une date AAAA-MM-JJ.`);
  return date;
};

const share = (part: number, whole: number): string => (whole === 0 ? "—" : `${Math.round((part / whole) * 100)} %`);

const table = (log: (line: string) => void, title: string, steps: readonly (readonly [string, number])[]): void => {
  log(title);
  const total = steps[0]?.[1] ?? 0;
  steps.forEach(([label, count], i) => {
    log(`  ${label.padEnd(30)} ${String(count).padStart(6)}${i === 0 ? "" : `   ${share(count, total)}`}`);
  });
};

export const commandFunnel = async (o: FunnelCommand): Promise<void> => {
  if ((process.env.DATABASE_URL ?? "") === "") throw new CliError("DATABASE_URL absente : l'entonnoir se lit dans la base.");
  const cohort: Cohort = { ...(o.from === undefined ? {} : { from: day("from", o.from) }), ...(o.to === undefined ? {} : { to: day("to", o.to) }) };
  const m = await funnel(getDb()).measure(cohort);
  o.log(`Cohorte : ${o.from ?? "début"} → ${o.to ?? "aujourd'hui"} (date de création du profil ou de l'entreprise ; % du total)`);
  table(o.log, "Freelances", [
    ["profils créés", m.freelance.profiles],
    ["profils publiés", m.freelance.published],
    ["au moins une adresse prouvée", m.freelance.provenUrl],
    ["premier échange", m.freelance.firstExchange],
    ["sous contrat", m.freelance.contracted],
    ["payés", m.freelance.paid],
  ]);
  table(o.log, "Entreprises", [
    ["entreprises créées", m.company.organisations],
    ["mission publiée", m.company.missionPublished],
    ["premier échange", m.company.firstExchange],
    ["sous contrat", m.company.contracted],
    ["argent engagé", m.company.paid],
  ]);
  o.log(`Demandes d'audit sur la période : ${m.auditRequests}`);
};
