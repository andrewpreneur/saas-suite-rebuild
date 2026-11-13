import { useEffect, useState } from "react";
import { CHALLENGE_COUNTDOWN_END_ISO } from "@/constants/giveaway";
import { formatChallengeCountdown, type ChallengeCountdown } from "@/lib/challengeCountdown";

/** Live countdown to CHALLENGE_COUNTDOWN_END_ISO. Ticks once a second. */
export function useChallengeCountdown(
  endIso: string = CHALLENGE_COUNTDOWN_END_ISO,
): ChallengeCountdown {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [endIso]);

  return formatChallengeCountdown(now, endIso);
}
