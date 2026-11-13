import { expect, test } from "bun:test";
import { challengeFinaleState, challengeWinners, CHALLENGE_PAYOUT_BUSINESS_DAYS } from "../src/lib/challengeFinale";

test("final countdown starts at 11 PM Chicago on October 25, not before", () => {
  expect(challengeFinaleState(Date.parse("2026-10-26T03:59:59Z")).visible).toBe(false);
  expect(challengeFinaleState(Date.parse("2026-10-26T04:00:00Z"))).toEqual({ visible: true, ended: false, secondsRemaining: 3600 });
});
test("celebration starts at midnight Chicago and not at the scoring cutoff", () => {
  expect(challengeFinaleState(Date.parse("2026-10-26T04:59:00Z"))).toEqual({ visible: true, ended: false, secondsRemaining: 60 });
  expect(challengeFinaleState(Date.parse("2026-10-26T04:59:59Z")).ended).toBe(false);
  expect(challengeFinaleState(Date.parse("2026-10-26T05:00:00Z"))).toEqual({ visible: true, ended: true, secondsRemaining: 0 });
});
test("only ranks one two and three are winners, sorted by place", () => {
  const rows = [4, 2, 1, 3].map(rank => ({ rank, display_name: `Entrant ${rank}`, points: 100 - rank, joined_at: "2026-08-17" }));
  expect(challengeWinners(rows).map(row => row.rank)).toEqual([1, 2, 3]);
});
test("payout processing range is five to ten business days", () => {
  expect(CHALLENGE_PAYOUT_BUSINESS_DAYS).toEqual({ min: 5, max: 10 });
});