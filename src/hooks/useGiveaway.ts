import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { GiveawayLeader, GiveawayStats } from "@/constants/giveaway";

/**
 * Live giveaway state: public stats/counter, leaderboard, and the caller's own
 * standing.
 *
 * IMPORTANT: reads are separated from rescoring. `giveaway_rescore_me` WRITES to
 * giveaway_entries, so calling it from the realtime handler created a feedback
 * loop (write -> postgres_changes -> refresh -> write -> ...) that hammered the
 * API with tens of thousands of requests per hour and starved the rest of the
 * app. Realtime and polling now only read; rescoring happens once per mount
 * (throttled) and after an explicit opt-in.
 */
const RESCORE_MIN_INTERVAL_MS = 60_000;
let lastRescoreAt = 0;

export function useGiveaway(pollMs = 60000) {
  const [stats, setStats] = useState<GiveawayStats | null>(null);
  const [leaders, setLeaders] = useState<GiveawayLeader[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOptingIn, setIsOptingIn] = useState(false);
  const inFlightRef = useRef(false);

  // Read-only refresh. Safe to call from realtime/polling.
  const refresh = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const [statsRes, boardRes] = await Promise.all([
        supabase.rpc("giveaway_stats"),
        supabase.rpc("giveaway_leaderboard", { _limit: 50 }),
      ]);
      if (!statsRes.error && statsRes.data) setStats(statsRes.data as unknown as GiveawayStats);
      if (!boardRes.error && boardRes.data) setLeaders((boardRes.data as unknown as GiveawayLeader[]) ?? []);
    } finally {
      inFlightRef.current = false;
      setIsLoading(false);
    }
  }, []);

  // Rescore (a write) then read. Throttled across the whole tab.
  const rescoreAndRefresh = useCallback(async () => {
    const now = Date.now();
    if (now - lastRescoreAt > RESCORE_MIN_INTERVAL_MS) {
      lastRescoreAt = now;
      try {
        await supabase.rpc("giveaway_rescore_me" as never);
      } catch {
        // non-fatal: fall back to the cron-scored values
      }
    }
    await refresh();
  }, [refresh]);

  useEffect(() => {
    void rescoreAndRefresh();
    const interval = setInterval(() => void refresh(), pollMs);

    let debounce: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(`giveaway-entries-live-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "giveaway_entries" }, () => {
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(() => void refresh(), 3000);
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      if (debounce) clearTimeout(debounce);
      supabase.removeChannel(channel);
    };
  }, [refresh, rescoreAndRefresh, pollMs]);

  const optIn = useCallback(
    async (displayName?: string, acceptRules = true) => {
      setIsOptingIn(true);
      try {
        const { error } = await supabase.rpc("giveaway_opt_in", {
          _display_name: displayName?.trim() || null,
          _accept_rules: acceptRules,
        } as never);
        if (error) throw error;
        lastRescoreAt = 0;
        await rescoreAndRefresh();
        return { ok: true as const };
      } catch (e) {
        return { ok: false as const, error: e instanceof Error ? e.message : "Could not enter" };
      } finally {
        setIsOptingIn(false);
      }
    },
    [rescoreAndRefresh],
  );

  return {
    stats,
    leaders,
    isLoading,
    isOptingIn,
    isEntered: !!stats?.me,
    refresh,
    optIn,
  };
}
