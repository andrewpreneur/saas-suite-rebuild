import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import {
  CHALLENGE_COUNTDOWN_END_ISO,
  GIVEAWAY_END_ISO,
  GIVEAWAY_END_LABEL,
  GIVEAWAY_END_SHORT,
  GIVEAWAY_RANGE_SHORT,
  GIVEAWAY_WINNERS_LABEL,
  GIVEAWAY_TICKET_CUTOFF_LABEL,
} from "../src/constants/giveaway";
import { formatChallengeCountdown } from "../src/lib/challengeCountdown";
import { challengePlaceStatus, ordinal, pointsForRule } from "../src/lib/challengePlace";
import { PODIUM_SLOT_ORDER } from "../src/components/giveaway/podiumTiers";

const END = Date.parse(CHALLENGE_COUNTDOWN_END_ISO);

describe("challenge countdown", () => {
  test("deadline is Oct 25, 2026 at 11:59 p.m. America/Chicago", () => {
    expect(GIVEAWAY_END_ISO).toBe("2026-10-26T04:59:00Z");
    expect(CHALLENGE_COUNTDOWN_END_ISO).toBe(GIVEAWAY_END_ISO);
    expect(END).toBe(Date.parse("2026-10-26T04:59:00Z"));
    expect(GIVEAWAY_END_LABEL).toBe("Sunday, October 25, 2026 at 11:59 p.m. CT");
    expect(GIVEAWAY_END_SHORT).toBe("October 25, 2026");
    expect(GIVEAWAY_RANGE_SHORT).toBe("Aug 17 → Oct 25, 2026");
    expect(GIVEAWAY_WINNERS_LABEL).toBe("Monday, October 26, 2026");
    expect(GIVEAWAY_TICKET_CUTOFF_LABEL).toBe(GIVEAWAY_END_LABEL);
    const migration = readFileSync(
      "supabase/migrations/20261023032741_challenge_end_sunday_oct_25.sql",
      "utf8",
    );
    expect(migration).toContain("'2026-10-26 04:59:00+00'::timestamptz");
    expect(migration).not.toContain("2026-10-27");
    expect(migration).not.toContain("2026-10-26 04:59:59");
    const nudge = readFileSync("supabase/functions/_shared/nudge-core.ts", "utf8");
    expect(nudge).toContain('end_iso: "2026-10-26T04:59:00Z"');
    expect(nudge).toContain('winners_announced: "October 26, 2026"');
    expect(nudge).not.toContain("2026-10-27T04:59:00Z");
    expect(nudge).not.toContain("2026-10-26T04:59:59Z");
    expect(nudge).not.toContain("Tuesday, October 27");
    expect(nudge).not.toContain("September 30, 2026");
  });

  test("formats days, hours, and minutes", () => {
    const now = END - (3 * 86400 + 9 * 3600 + 12 * 60) * 1000;
    expect(formatChallengeCountdown(now)).toEqual({
      ended: false,
      label: "3d 9h 12m",
      short: "3d",
    });
  });

  test("includes seconds once under a day so the clock can tick", () => {
    const now = END - (2 * 3600 + 5 * 60 + 9) * 1000;
    expect(formatChallengeCountdown(now).label).toBe("2h 5m 9s");
    expect(formatChallengeCountdown(now).short).toBe("2h");
  });

  test("shows minutes and seconds in the last hour", () => {
    const now = END - (12 * 60 + 4) * 1000;
    expect(formatChallengeCountdown(now)).toEqual({
      ended: false,
      label: "12m 4s",
      short: "12m",
    });
  });

  test("the phone layout keeps the podium in three columns", () => {
    const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
    expect(css).toContain(".mobile-type .podium-grid");
    expect(css).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))");
  });

  test("reads Challenge ended at and after the deadline", () => {
    expect(formatChallengeCountdown(END).label).toBe("Challenge ended");
    expect(formatChallengeCountdown(END + 1000)).toEqual({
      ended: true,
      label: "Challenge ended",
      short: "End",
    });
  });
});

describe("challenge podium place", () => {
  test("podium visual order is 2nd, 1st, 3rd", () => {
    expect(PODIUM_SLOT_ORDER.map((slot) => slot.rank)).toEqual([2, 1, 3]);
  });

  test("highlights 1st, 2nd, and 3rd with a place banner", () => {
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(2)).toBe("2nd");
    expect(ordinal(3)).toBe("3rd");
    expect(ordinal(11)).toBe("11th");
    expect(ordinal(21)).toBe("21st");
    for (const rank of [1, 2, 3] as const) {
      expect(challengePlaceStatus({ rank, points: 10 }, [])).toEqual({
        kind: "podium",
        rank,
        banner: `You're in ${ordinal(rank)} place!`,
      });
    }
  });

  test("shows rank and the gap to 3rd when outside the podium", () => {
    const status = challengePlaceStatus({ rank: 8, points: 40 }, [
      { rank: 1, points: 200 },
      { rank: 2, points: 120 },
      { rank: 3, points: 90 },
    ]);
    expect(status).toEqual({
      kind: "chasing",
      rank: 8,
      rankLabel: "You're in 8th place",
      gapLabel: "50 pts behind 3rd",
    });
  });

  test("explains a points tie that still loses the podium", () => {
    const status = challengePlaceStatus({ rank: 4, points: 90 }, [{ rank: 3, points: 90 }]);
    expect(status.kind).toBe("chasing");
    if (status.kind === "chasing") {
      expect(status.gapLabel).toContain("Tied on points with 3rd");
    }
  });

  test("asks guests to enter", () => {
    expect(challengePlaceStatus(null, []).kind).toBe("guest");
  });

  test("reads earned points from a breakdown", () => {
    expect(
      pointsForRule("users_onboarded", { users_onboarded_points: 4, slack_connected: true }),
    ).toBe(4);
    expect(pointsForRule("slack_connected", { slack_connected: true })).toBe(20);
    expect(pointsForRule("login_days", {})).toBe(0);
  });
});
