/*
 * What an empty screen of the connected space proposes next (C23). The marketplace starts empty: a screen with nothing
 * to show says what the person can do about it, each with its link, instead of only "nothing yet". The order is the
 * order the person should try them in. Inviting (`/app/invitations`) is only ever offered here, on connected screens:
 * the public pages stay the same for every visitor.
 */

export type EmptyScreen = "feed_following" | "feed_discover" | "missions_for_you" | "companies_none" | "companies_filtered";
export type NextStepRole = "freelance" | "company";

export const NEXT_STEP_KEYS = [
  "publish_profile",
  "follow_companies",
  "find_freelancers",
  "discover",
  "write_post",
  "post_mission",
  "mission_alert",
  "browse_missions",
  "clear_filters",
  "invite_clients",
  "invite_freelancers",
] as const;
export type NextStepKey = (typeof NEXT_STEP_KEYS)[number];

export interface NextStep {
  readonly key: NextStepKey;
  readonly href: string;
}

/** Paths under `/[lang]`; the public mission list is the only one outside the connected space. */
const PATHS: Readonly<Record<NextStepKey, string>> = {
  publish_profile: "app",
  follow_companies: "app/entreprises",
  find_freelancers: "app/recherche",
  discover: "app/fil?onglet=decouvrir",
  write_post: "app/fil#post-body",
  post_mission: "app/missions/nouvelle",
  mission_alert: "app/alertes",
  browse_missions: "missions",
  clear_filters: "app/entreprises",
  invite_clients: "app/invitations",
  invite_freelancers: "app/invitations",
};

const invite = (role: NextStepRole): NextStepKey => (role === "freelance" ? "invite_clients" : "invite_freelancers");

const KEYS: Readonly<Record<EmptyScreen, (role: NextStepRole, published: boolean) => readonly NextStepKey[]>> = {
  feed_following: (role) => (role === "freelance" ? ["follow_companies", "discover", invite(role)] : ["find_freelancers", "post_mission", invite(role)]),
  feed_discover: (role) => ["write_post", invite(role)],
  // Nothing is matched without a published profile: publishing comes first, through the guided steps of the home.
  missions_for_you: (role, published) => [...(published ? [] : ["publish_profile" as const]), "follow_companies", "mission_alert", "browse_missions", invite(role)],
  companies_none: (role) => (role === "freelance" ? ["invite_clients", "browse_missions"] : ["invite_freelancers", "post_mission"]),
  companies_filtered: () => ["clear_filters"],
};

/** The next steps of an empty screen, in order. `published`: whether the freelancer's profile is published. */
export const nextSteps = (lang: string, screen: EmptyScreen, role: NextStepRole, published = true): readonly NextStep[] =>
  KEYS[screen](role, published).map((key) => ({ key, href: `/${lang}/${PATHS[key]}` }));
