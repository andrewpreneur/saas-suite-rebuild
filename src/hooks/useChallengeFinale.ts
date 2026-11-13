import { useEffect, useState } from "react";
import { challengeFinaleState } from "../lib/challengeFinale";

export function useChallengeFinale() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  return challengeFinaleState(now);
}