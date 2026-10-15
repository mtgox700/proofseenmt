import { notFound } from "next/navigation";
import { getDb, ReasonSchema, users, type Db, type Operator, type OperatorResult } from "@proofseen/db";
import { hasDatabase } from "@/data/intake-sink";
import { throttled } from "@/data/throttle";
import type { Lang } from "@/i18n";
import { langOf } from "@/lib/market";
import { OPERATOR_ACTION_RULE, operatorOnly } from "@/lib/operator-access";
import { session, type Person } from "@/lib/session";

/*
 * The back-office context (C19). The operator role is read from the session on every page and every action (the
 * OPERATOR_EMAILS allowlist, verified addresses only), never from a form; anyone else gets the 404 of an unknown page.
 * The database repositories then refuse to open without the operator capability built here.
 */

export interface OperatorContext {
  readonly person: Person;
  readonly operator: Operator;
  readonly db: Db;
}

const contextOf = async (person: Person): Promise<OperatorContext> => {
  const db = getDb();
  const { userId, suspension } = await users(db).ensure({ clerkId: person.id, email: person.email, displayName: person.name });
  // An operator account suspended by another operator loses the back office too, including the power to lift it.
  if (suspension !== null) notFound();
  return { person, operator: { role: "operator", userId }, db };
};

/** For back-office pages: the context, or `"unconfigured"` without a database. Non-operators never get past the first line. */
export const operatorPage = async (): Promise<OperatorContext | "unconfigured"> => {
  const person = operatorOnly(await session());
  if (!hasDatabase() || person.email === "") return "unconfigured";
  return contextOf(person);
};

export interface OperatorActionContext extends OperatorContext {
  readonly lang: Lang;
  /** True when this operator has run too many actions of this kind in the last minute: the action must stop. */
  readonly limited: boolean;
}

/** For back-office server actions and route handlers: the same check, then the per-operator throttle of `scope`. */
export const operatorAction = async (formData: FormData, scope: string): Promise<OperatorActionContext> => {
  const lang = langOf(formData.get("lang"));
  const person = operatorOnly(await session());
  if (!hasDatabase() || person.email === "") notFound();
  const context = await contextOf(person);
  const limited = await throttled(`operator:${scope}`, context.operator.userId, OPERATOR_ACTION_RULE, new Date());
  return { ...context, lang, limited };
};

/** The text of a form field, `""` when absent. */
export const field = (formData: FormData, name: string): string => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

/** The reason typed by the operator, if it would be accepted. */
export const reasonOf = (formData: FormData): string | null => {
  const parsed = ReasonSchema.safeParse(field(formData, "reason"));
  return parsed.success ? parsed.data : null;
};

/** The flag a back-office page reads after an action: `?etat=fait`, `?etat=inchange`… */
export const OUTCOME_FLAGS: Readonly<Record<OperatorResult | "invalid" | "too_many" | "self", string>> = {
  done: "fait",
  unchanged: "inchange",
  absent: "absent",
  invalid: "invalide",
  too_many: "trop",
  self: "soi",
};
