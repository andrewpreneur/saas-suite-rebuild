import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  APP_BUILD_ID,
  clearVersionReload,
  isMidTyping,
  markVersionReload,
  nextVersionAction,
  reloadMarkerFor,
  remoteVersionId,
  shouldFetchVersion,
  VERSION_CHECK_INTERVAL_MS,
} from "@/lib/appVersion";

/**
 * Compares the running bundle with /version.json. Checks are shared and
 * throttled. A mismatch reloads on the next route change unless the user
 * is mid-typing, in which case a small prompt stays out of the way.
 */
export function AppVersionNotice() {
  const location = useLocation();
  const [prompt, setPrompt] = useState(false);
  const state = useRef({
    last: 0,
    stale: null as string | null,
    inflight: null as Promise<string | null> | null,
  });

  const check = useCallback(() => {
    const current = state.current;
    const now = Date.now();
    if (current.inflight) return current.inflight;
    if (!shouldFetchVersion(current.last, now, VERSION_CHECK_INTERVAL_MS)) {
      return Promise.resolve(current.stale);
    }
    current.last = now;
    current.inflight = (async () => {
      try {
        const res = await fetch(`/version.json?ts=${now}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(4000),
        });
        if (!res.ok) return current.stale;
        const remote = remoteVersionId(await res.json(), APP_BUILD_ID);
        current.stale = remote;
        if (!remote) clearVersionReload(window.sessionStorage);
      } catch {
        /* a missing or blocked version file must not reload the page */
      } finally {
        current.inflight = null;
      }
      return current.stale;
    })();
    return current.inflight;
  }, []);

  const apply = useCallback((remoteId: string | null, routeChanged: boolean) => {
    if (typeof navigator !== "undefined" && navigator.webdriver) return;
    const action = nextVersionAction({
      remoteId,
      routeChanged,
      midTyping: isMidTyping(document),
      alreadyReloadedFor: reloadMarkerFor(window.sessionStorage),
    });
    if (action === "prompt") {
      setPrompt(true);
      return;
    }
    if (action === "reload" && remoteId) {
      markVersionReload(window.sessionStorage, remoteId);
      window.location.reload();
    }
  }, []);

  useEffect(() => {
    let active = true;
    void check().then((remoteId) => {
      if (active) apply(remoteId, true);
    });
    return () => {
      active = false;
    };
  }, [location.pathname, location.search, check, apply]);

  useEffect(() => {
    const onWake = () => {
      void check().then((remoteId) => apply(remoteId, false));
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") onWake();
    };
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [check, apply]);

  if (!prompt) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[70] flex justify-center px-3">
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="pointer-events-auto rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground shadow-md"
      >
        New version available, refresh
      </button>
    </div>
  );
}
