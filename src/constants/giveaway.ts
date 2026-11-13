/**
 * Move Your SaaS Challenge (Aug 17 – Oct 25, 2026) — shared config.
 * Point values MUST stay in sync with the public.giveaway_recalculate() DB function.
 *
 * The contest ends Sunday, October 25, 2026 at 11:59 p.m. America/Chicago
 * (CDT, UTC−5) = 2026-10-26T04:59:00Z. Labels, the sidebar countdown, and the
 * LevelUp ticket bonus all derive from GIVEAWAY_END_ISO. Deno nudge copy and
 * the SQL scoring cutoff duplicate this instant because they cannot import it.
 */
export const GIVEAWAY_NAME = "Move Your SaaS Challenge";
export const GIVEAWAY_TOTAL = 10000;

/** Official contest window (Central Time). */
export const GIVEAWAY_START_LABEL = "Monday, August 17, 2026 at 12:00 a.m. CT";
export const GIVEAWAY_START_SHORT = "August 17, 2026";
export const GIVEAWAY_START_ISO = "2026-08-17T00:00:00-05:00";
/** Sunday, October 25, 2026 at 11:59 p.m. America/Chicago (CDT, UTC−5). */
export const GIVEAWAY_END_ISO = "2026-10-26T04:59:00Z";
export const GIVEAWAY_END_LABEL = "Sunday, October 25, 2026 at 11:59 p.m. CT";
export const GIVEAWAY_END_SHORT = "October 25, 2026";
/** In-app Challenge nav countdown. Same instant as GIVEAWAY_END_ISO. */
export const CHALLENGE_COUNTDOWN_END_ISO = GIVEAWAY_END_ISO;
/** Winner announcement — the morning after the Sunday-night close. Pre-#72 used this same label. */
export const GIVEAWAY_WINNERS_LABEL = "Monday, October 26, 2026";
/** LevelUp summit tie-in. The contest end is GIVEAWAY_END_ISO, not this event. */
export const GIVEAWAY_LEVELUP_URL = "https://summit.gohighlevel.com";
export const GIVEAWAY_LEVELUP_NOTE =
  "Winners are announced Monday, October 26, 2026. LevelUp is HighLevel's annual summit — a free ticket is not guaranteed.";
export const GIVEAWAY_RULES_PATH = "/move-your-saas-challenge-rules";
/** Public marketing page for the challenge. */
export const GIVEAWAY_PATH = "/challenge";
/** Short "Aug 17 → Oct 25" style range used in badges and widgets. */
export const GIVEAWAY_RANGE_SHORT = "Aug 17 → Oct 25, 2026";

/**
 * LevelUp ticket bonus is scored when the challenge ends, not on a separate cutoff.
 * These aliases stay so older call sites keep reading the contest close.
 */
export const GIVEAWAY_TICKET_CUTOFF_LABEL = GIVEAWAY_END_LABEL;
export const GIVEAWAY_TICKET_CUTOFF_SHORT = GIVEAWAY_END_SHORT;
export const GIVEAWAY_TICKET_NOTE =
  "Bonus: whoever is sitting in 1st, 2nd or 3rd place when the challenge ends Sunday, October 25, 2026 at 11:59 p.m. CT also gets a chance at winning a free ticket to LevelUp, HighLevel's annual summit in Dallas, TX. A free ticket is not guaranteed.";
export const GIVEAWAY_WEEKS = [
  { week: "Week 1", dates: "Aug 17 – Aug 23, 2026" },
  { week: "Week 2", dates: "Aug 24 – Aug 30, 2026" },
  { week: "Week 3", dates: "Aug 31 – Sept 6, 2026" },
  { week: "Week 4", dates: "Sept 7 – Sept 13, 2026" },
  { week: "Week 5", dates: "Sept 14 – Sept 20, 2026" },
  { week: "Week 6", dates: "Sept 21 – Sept 27, 2026" },
  { week: "Week 7", dates: "Sept 28 – Oct 4, 2026" },
  { week: "Week 8", dates: "Oct 5 – Oct 11, 2026" },
  { week: "Week 9", dates: "Oct 12 – Oct 18, 2026" },
  { week: "Week 10", dates: "Oct 19 – Oct 25, 2026" },
] as const;

export const GIVEAWAY_PRIZES = [
  { place: "1st Place", amount: 5000, note: "Top points when the challenge closes" },
  { place: "2nd Place", amount: 3000, note: "Runner-up on the points leaderboard" },
  { place: "3rd Place", amount: 2000, note: "Third on the points leaderboard" },
] as const;

export const GIVEAWAY_POINT_RULES = [
  {
    key: "users_onboarded",
    label: "Onboard a net-new end user",
    points: "1 pt each",
    detail: "Every genuine end user onboarded into your account after you enter.",
  },
  {
    key: "module_completions",
    label: "Training video completed",
    points: "1 pt each",
    detail: "Each SaaSSuite training video your end users open and mark complete.",
  },
  {
    key: "checklist_completions",
    label: "Onboarding checklist completed",
    points: "1 pt each",
    detail: "Each onboarding checklist an end user of your account finishes.",
  },
  {
    key: "login_days",
    label: "End-user login days",
    points: "1 pt per user per day",
    detail: "Capped at one point per end user per calendar day, no matter how often they log in.",
  },
  {
    key: "slack_connected",
    label: "Install the SaaSSuite Slack app",
    points: "20 pts",
    detail: "One-time bonus, awarded once per entrant when installed after you enter.",
  },
] as const;

export const GIVEAWAY_FAIR_START_RULE =
  "Points only start counting the moment you enter — nothing before your entry date is backfilled, so everyone starts from zero. Entering earlier means a longer scoring window.";

export interface GiveawayBreakdown {
  users_onboarded?: number;
  users_onboarded_points?: number;
  module_completions?: number;
  module_completion_points?: number;
  checklist_completions?: number;
  checklist_completion_points?: number;
  login_days?: number;
  login_day_points?: number;
  slack_connected?: boolean;
  slack_points?: number;
}

export interface GiveawayMe {
  display_name: string;
  points: number;
  rank: number | null;
  opted_in_at: string;
  breakdown: GiveawayBreakdown;
}

export interface GiveawayStats {
  entrants: number;
  total_points: number;
  me: GiveawayMe | null;
}

export interface GiveawayLeader {
  rank: number;
  display_name: string;
  points: number;
  joined_at: string;
}
