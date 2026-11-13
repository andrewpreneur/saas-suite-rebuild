import type { GiveawayBreakdown, GiveawayLeader, GiveawayMe } from "@/constants/giveaway";

export type ChallengePlaceStatus =
  | { kind: "podium"; rank: 1 | 2 | 3; banner: string }
  | { kind: "chasing"; rank: number | null; rankLabel: string; gapLabel: string }
  | { kind: "guest"; message: string };

/** 1st, 2nd, 3rd, 4th — including the 11th/12th/13th exceptions. */
export function ordinal(n: number): string {
  const abs = Math.abs(Math.trunc(n));
  const mod100 = abs % 100;
  const suffix =
    mod100 >= 11 && mod100 <= 13
      ? "th"
      : abs % 10 === 1
        ? "st"
        : abs % 10 === 2
          ? "nd"
          : abs % 10 === 3
            ? "rd"
            : "th";
  return `${abs}${suffix}`;
}

export function initialsOf(name?: string | null) {
  const letters = (name || "")
    .split(/[ @._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return letters || "?";
}

function asRank(rank: number | null | undefined): number | null {
  if (rank == null) return null;
  const value = Number(rank);
  return Number.isFinite(value) ? value : null;
}

/**
 * Banner copy for a signed-in entrant on the podium, or their rank and the
 * point gap up to 3rd place.
 */
export function challengePlaceStatus(
  me: Pick<GiveawayMe, "rank" | "points"> | null | undefined,
  leaders: Pick<GiveawayLeader, "rank" | "points">[],
): ChallengePlaceStatus {
  if (!me) {
    return { kind: "guest", message: "Enter the challenge to get on the board." };
  }

  const rank = asRank(me.rank);
  if (rank === 1 || rank === 2 || rank === 3) {
    return { kind: "podium", rank, banner: `You're in ${ordinal(rank)} place!` };
  }

  const third =
    leaders.find((leader) => asRank(leader.rank) === 3) ??
    (leaders.length >= 3 ? leaders[2] : undefined);
  const rankLabel = rank ? `You're in ${ordinal(rank)} place` : "You're unranked";

  if (!third) {
    return { kind: "chasing", rank, rankLabel, gapLabel: "3rd place is still open" };
  }

  const gap = Math.max(0, third.points - me.points);
  return {
    kind: "chasing",
    rank,
    rankLabel,
    gapLabel:
      gap === 0
        ? "Tied on points with 3rd — an earlier entry holds the podium"
        : `${gap.toLocaleString()} pts behind 3rd`,
  };
}

/** Points already earned for one scoreboard rule. Mirrors the standings card. */
export function pointsForRule(
  key: string,
  breakdown: GiveawayBreakdown | null | undefined,
): number {
  const b = breakdown ?? {};
  if (key === "slack_connected") return b.slack_points ?? (b.slack_connected ? 20 : 0);
  if (key === "users_onboarded") return b.users_onboarded_points ?? 0;
  if (key === "module_completions") return b.module_completion_points ?? 0;
  if (key === "checklist_completions") return b.checklist_completion_points ?? 0;
  if (key === "login_days") return b.login_day_points ?? 0;
  return 0;
}
