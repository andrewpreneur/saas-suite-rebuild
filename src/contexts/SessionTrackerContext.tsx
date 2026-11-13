import React, { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";

/** Coarse device class so the email can tell "mobile only, never installed" stories. */
const getDevice = (): "mobile" | "tablet" | "desktop" => {
  const w = typeof window !== "undefined" ? window.innerWidth : 1280;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/iPad|Tablet/i.test(ua) || (w >= 768 && w < 1024)) return "tablet";
  if (/Mobi|Android|iPhone/i.test(ua) || w < 768) return "mobile";
  return "desktop";
};

interface TrackedEvent {
  type: string;
  label?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

interface SessionTrackerContextType {
  trackEvent: (type: string, label?: string, metadata?: Record<string, any>) => void;
  endSessionNow: () => Promise<void>;
}

const SessionTrackerContext = createContext<SessionTrackerContextType | undefined>(undefined);

// Session ends when one of these "completion" actions is observed
const COMPLETION_ACTIONS = new Set([
  "agency_name_saved",
  "branding_colors_saved",
  "branding_tool_installed",
  "menu_links_install_completed",
]);

const MIN_SESSION_MS = 15 * 60 * 1000; // 15 min minimum
const MAX_SESSION_MS = 30 * 60 * 1000; // 30 min hard cap
const FLUSH_INTERVAL_MS = 10 * 1000; // flush events to DB every 10s

const BEACON_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/session-beacon`;

/**
 * Deliver events with a transport that survives tab close / backgrounding.
 * sendBeacon can only POST without headers, so it targets an edge function
 * instead of the PostgREST PATCH endpoint (which silently dropped everything).
 */
const beacon = (payload: Record<string, unknown>) => {
  const body = JSON.stringify(payload);
  try {
    if (navigator.sendBeacon) {
      const ok = navigator.sendBeacon(BEACON_URL, new Blob([body], { type: "application/json" }));
      if (ok) return;
    }
  } catch {
    /* fall through */
  }
  fetch(BEACON_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
};

export const SessionTrackerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { email, isImpersonating } = useUser();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const sessionStartRef = useRef<number>(0);
  const eventsBufferRef = useRef<TrackedEvent[]>([]);
  const allEventsRef = useRef<TrackedEvent[]>([]);
  const completionFiredRef = useRef(false);
  const flushTimerRef = useRef<number | null>(null);
  const maxTimerRef = useRef<number | null>(null);
  const finalizingRef = useRef(false);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Start a session when user logs in
  useEffect(() => {
    if (!email || isImpersonating) return;
    if (sessionId) return;

    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("user_activity_sessions")
          .insert({
            user_email: email,
            session_started_at: new Date().toISOString(),
            events: [],
            status: "active",
          })
          .select("id")
          .maybeSingle();

        if (cancelled || error || !data) return;
        setSessionId(data.id);
        sessionIdRef.current = data.id;
        sessionStartRef.current = Date.now();
        completionFiredRef.current = false;
        finalizingRef.current = false;

        // Keep events that fired before the row existed, then stamp the login
        allEventsRef.current = [
          ...allEventsRef.current,
          {
            type: "login",
            label: "Signed in",
            metadata: { device: getDevice(), width: window.innerWidth, path: window.location.pathname },
            timestamp: new Date().toISOString(),
          },
        ];

        // Hard cap timer
        maxTimerRef.current = window.setTimeout(() => {
          finalizeSession("max_duration");
        }, MAX_SESSION_MS);
      } catch (e) {
        console.error("[SessionTracker] failed to start session", e);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, isImpersonating]);

  const flushBuffer = useCallback(async () => {
    if (!sessionId || eventsBufferRef.current.length === 0) return;
    const toFlush = eventsBufferRef.current;
    eventsBufferRef.current = [];
    try {
      await supabase
        .from("user_activity_sessions")
        .update({
          events: allEventsRef.current as any,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);
    } catch (e) {
      console.error("[SessionTracker] flush failed", e);
      // put back
      eventsBufferRef.current = [...toFlush, ...eventsBufferRef.current];
    }
  }, [sessionId]);

  // Periodic flush
  useEffect(() => {
    if (!sessionId) return;
    flushTimerRef.current = window.setInterval(flushBuffer, FLUSH_INTERVAL_MS);
    return () => {
      if (flushTimerRef.current) window.clearInterval(flushTimerRef.current);
    };
  }, [sessionId, flushBuffer]);

  const finalizeSession = useCallback(
    async (reason: string) => {
      if (!sessionId || finalizingRef.current) return;
      finalizingRef.current = true;

      if (maxTimerRef.current) window.clearTimeout(maxTimerRef.current);
      if (flushTimerRef.current) window.clearInterval(flushTimerRef.current);

      try {
        await supabase
          .from("user_activity_sessions")
          .update({
            events: allEventsRef.current as any,
            session_ended_at: new Date().toISOString(),
            status: "pending_analysis",
            updated_at: new Date().toISOString(),
          })
          .eq("id", sessionId);

        // Trigger AI analysis (fire and forget)
        supabase.functions
          .invoke("analyze-user-session", { body: { sessionId } })
          .catch((e) => console.error("[SessionTracker] analyze invoke failed", e));
      } catch (e) {
        console.error("[SessionTracker] finalize failed", e);
      }

      setSessionId(null);
    },
    [sessionId]
  );

  const trackEvent = useCallback(
    (type: string, label?: string, metadata?: Record<string, any>) => {
      const evt: TrackedEvent = {
        type,
        label,
        metadata,
        timestamp: new Date().toISOString(),
      };
      eventsBufferRef.current.push(evt);
      allEventsRef.current.push(evt);

      // Events fired before the session row exists are kept and flushed later
      if (!sessionId) return;

      // Check completion conditions
      if (COMPLETION_ACTIONS.has(type) && !completionFiredRef.current) {
        completionFiredRef.current = true;
        const elapsed = Date.now() - sessionStartRef.current;
        // If past minimum, finalize soon. Otherwise, wait until min reached.
        const wait = Math.max(0, MIN_SESSION_MS - elapsed);
        window.setTimeout(() => finalizeSession("completion_action"), wait);
      }
    },
    [sessionId, finalizeSession]
  );

  const endSessionNow = useCallback(async () => {
    await flushBuffer();
    await finalizeSession("manual");
  }, [flushBuffer, finalizeSession]);

  // Persist on backgrounding and on unload. `visibilitychange` is the only
  // reliable signal on mobile Safari/Chrome; `pagehide` covers desktop closes.
  useEffect(() => {
    const flushViaBeacon = (finalize: boolean) => {
      const id = sessionIdRef.current;
      if (!id || finalizingRef.current) return;
      eventsBufferRef.current = [];
      beacon({ sessionId: id, events: allEventsRef.current, finalize });
      if (finalize) {
        finalizingRef.current = true;
        if (maxTimerRef.current) window.clearTimeout(maxTimerRef.current);
        if (flushTimerRef.current) window.clearInterval(flushTimerRef.current);
        sessionIdRef.current = null;
        setSessionId(null); // a returning (bfcache) visitor starts a fresh session
      }
    };

    // Hidden tab = save what we have, but keep the session open in case they return
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushViaBeacon(false);
    };
    const onPageHide = () => flushViaBeacon(true);

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onPageHide);
    };
  }, []);

  return (
    <SessionTrackerContext.Provider value={{ trackEvent, endSessionNow }}>
      {children}
    </SessionTrackerContext.Provider>
  );
};

export const useSessionTracker = (): SessionTrackerContextType => {
  const ctx = useContext(SessionTrackerContext);
  if (!ctx) {
    // Fail-safe no-op so consumer code never throws
    return {
      trackEvent: () => {},
      endSessionNow: async () => {},
    };
  }
  return ctx;
};

/**
 * Records a page_view for every in-app route change. Must be mounted inside the
 * router (the provider itself wraps the router, so it can't use useLocation).
 */
export const SessionRouteTracker: React.FC = () => {
  const { trackEvent } = useSessionTracker();
  const location = useLocation();
  const lastRef = useRef<string>("");

  useEffect(() => {
    const path = location.pathname;
    if (path === lastRef.current) return;
    lastRef.current = path;
    trackEvent("page_view", path, { device: getDevice() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return null;
};
