import { CHALLENGE_COUNTDOWN_END_ISO } from "@/constants/giveaway";

export type ChallengeCountdown = {
  ended: boolean;
  /** Expanded sidebar copy, e.g. "3d 9h 12m" or "Challenge ended". */
  label: string;
  /** Collapsed-sidebar badge, e.g. "3d" or "End". */
  short: string;
};

/** Format the time remaining until the challenge countdown deadline. */
export function formatChallengeCountdown(
  nowMs: number,
  endIso: string = CHALLENGE_COUNTDOWN_END_ISO,
): ChallengeCountdown {
  const endMs = Date.parse(endIso);
  const diff = endMs - nowMs;
  if (!Number.isFinite(endMs) || diff <= 0) {
    return { ended: true, label: "Challenge ended", short: "End" };
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return {
      ended: false,
      label: `${days}d ${hours}h ${minutes}m`,
      short: `${days}d`,
    };
  }
  if (hours > 0) {
    return {
      ended: false,
      label: `${hours}h ${minutes}m ${seconds}s`,
      short: `${hours}h`,
    };
  }
  return {
    ended: false,
    label: `${minutes}m ${seconds}s`,
    short: minutes > 0 ? `${minutes}m` : `${seconds}s`,
  };
}
