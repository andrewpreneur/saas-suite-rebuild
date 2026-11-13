import type { GiveawayLeader } from "../constants/giveaway";

export const CHALLENGE_FINALE_START_ISO = "2026-10-26T04:00:00Z";
export const CHALLENGE_FINALE_END_ISO = "2026-10-26T05:00:00Z";
export const CHALLENGE_PAYOUT_BUSINESS_DAYS = { min: 5, max: 10 } as const;

export function challengeFinaleState(now: number) {
  const start = Date.parse(CHALLENGE_FINALE_START_ISO);
  const end = Date.parse(CHALLENGE_FINALE_END_ISO);
  return {
    visible: now >= start,
    ended: now >= end,
    secondsRemaining: Math.max(0, Math.ceil((end - now) / 1000)),
  };
}

export function challengeWinners(leaders: GiveawayLeader[]) {
  return leaders.filter(leader => Number(leader.rank) >= 1 && Number(leader.rank) <= 3)
    .sort((a, b) => Number(a.rank) - Number(b.rank));
}