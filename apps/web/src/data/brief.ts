import { z } from "zod";
import { missionFiltersFromBrief, profileFiltersFromBrief, type MissionBriefFilters, type ProfileBriefFilters } from "@proofseen/db";
import { createBriefTranslator, fetchTransport, type BriefTarget } from "@proofseen/engines";
import { logError } from "../lib/log";
import { throttled } from "./throttle";

/*
 * A need written in one sentence, turned into visible search filters, shared by the JSON route (`/api/search/brief`)
 * and the server action of the company search page. The model only proposes filter values: it sees no profile, sorts
 * nothing, has no tool. The filters go back to the person, who reviews and edits them before any search, and the list
 * keeps the order the person chooses (AI Act: no automatic ranking of people).
 *
 * Each call is paid: a per-person limit and a platform-wide daily cap, the same counters whichever door is used.
 * Without a configured model the outcome is "unconfigured" and the page shows the plain form only.
 */

export const BRIEF_MODEL = "claude-haiku-4-5-20251001";
const PER_PERSON = { windowMs: 60 * 60_000, max: 20 };
const DAY_MS = 24 * 60 * 60_000;
const DEFAULT_DAILY_CAP = 300;

export const BriefTextSchema = z.string().trim().min(5).max(600);

export type BriefTranslate = (target: BriefTarget, brief: string) => Promise<{ readonly candidate: unknown }>;

export type BriefOutcome<T> =
  | { readonly kind: "ok"; readonly filters: T }
  | { readonly kind: "unconfigured" | "throttled" | "invalid" | "not_understood" | "failed" };

export interface BriefOptions {
  /** Injected in tests: no paid call ever leaves a test. */
  readonly translate?: BriefTranslate;
  readonly now?: Date;
}

const apiKey = (): string => process.env.ANTHROPIC_API_KEY ?? "";

/** True when a model is configured: without it, no brief box is shown. */
export const briefConfigured = (): boolean => apiKey() !== "";

const dailyCap = (): number => {
  const value = Number(process.env.PROOFSEEN_BRIEF_DAILY_CAP ?? "");
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_DAILY_CAP;
};

const run = async <T>(target: BriefTarget, parse: (candidate: unknown) => T | null, userId: string, raw: unknown, options: BriefOptions): Promise<BriefOutcome<T>> => {
  if (options.translate === undefined && !briefConfigured()) return { kind: "unconfigured" };
  const now = options.now ?? new Date();
  if (await throttled("brief", userId, PER_PERSON, now)) return { kind: "throttled" };
  const brief = BriefTextSchema.safeParse(raw);
  if (!brief.success) return { kind: "invalid" };
  // The platform-wide cap is counted last, so refused requests do not use it up.
  if (await throttled("brief-daily", "platform", { windowMs: DAY_MS, max: dailyCap() }, now)) return { kind: "throttled" };
  try {
    const translate = options.translate ?? createBriefTranslator({ apiKey: apiKey(), model: BRIEF_MODEL, transport: fetchTransport });
    const filters = parse((await translate(target, brief.data)).candidate);
    return filters === null ? { kind: "not_understood" } : { kind: "ok", filters };
  } catch (error) {
    logError("brief translation failed", error);
    return { kind: "failed" };
  }
};

export const translateProfileBrief = (userId: string, raw: unknown, options: BriefOptions = {}): Promise<BriefOutcome<ProfileBriefFilters>> =>
  run("profiles", profileFiltersFromBrief, userId, raw, options);

export const translateMissionBrief = (userId: string, raw: unknown, options: BriefOptions = {}): Promise<BriefOutcome<MissionBriefFilters>> =>
  run("missions", missionFiltersFromBrief, userId, raw, options);
