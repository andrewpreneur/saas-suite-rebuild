/**
 * Post-auth deep links.
 *
 * A visitor can land on an in-app URL (e.g. /app/agency-support) while logged
 * out. We stash that destination in a `next` query param + storage so signup /
 * login can drop them straight there — skipping onboarding.
 */

const STORAGE_KEY = "post_auth_redirect";

/** Only in-app paths are allowed as redirect targets (no open redirects). */
function isSafeAppPath(path: string | null | undefined): path is string {
  return !!path && /^\/(app|copilot)(\/|\?|$)/.test(path) && !path.includes("\\");
}

/**
 * Remember where the visitor was headed before hitting the auth wall.
 * Stored in sessionStorage AND localStorage (30-minute TTL) so the destination
 * survives magic-link / OAuth round-trips that reopen the app in a new tab —
 * otherwise login falls back to the Client Hub and the deep link is lost.
 */
const TTL_MS = 30 * 60 * 1000;

export function rememberNextPath(path: string) {
  if (!isSafeAppPath(path)) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, path);
  } catch {
    /* private mode */
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ path, at: Date.now() }));
  } catch {
    /* private mode */
  }
}

function readPersistedNextPath(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { path?: string; at?: number };
    if (!parsed?.at || Date.now() - parsed.at > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return isSafeAppPath(parsed.path) ? parsed.path : null;
  } catch {
    return null;
  }
}

/**
 * Resolve the pending destination from the URL (`next=`), sessionStorage, or the
 * TTL-bounded localStorage copy. Reading from the URL also persists it, so it
 * survives the auth round-trip.
 */
export function readNextPath(): string | null {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("next");
    if (fromUrl) {
      const decoded = decodeURIComponent(fromUrl);
      if (isSafeAppPath(decoded)) {
        rememberNextPath(decoded);
        return decoded;
      }
    }
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (isSafeAppPath(stored)) return stored;
    return readPersistedNextPath();
  } catch {
    return null;
  }
}

export function clearNextPath() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

/** Deep-linked signups go straight to the feature — onboarding is skipped. */
const SKIP_ONBOARDING_KEY = "skip_onboarding_deeplink";

export function markSkipOnboarding() {
  try {
    sessionStorage.setItem(SKIP_ONBOARDING_KEY, "1");
  } catch {
    /* noop */
  }
}

export function shouldSkipOnboarding(): boolean {
  try {
    return sessionStorage.getItem(SKIP_ONBOARDING_KEY) === "1";
  } catch {
    return false;
  }
}

/** Drop the skip once the kit page is on screen, so later routes are not stuck for the rest of the tab. */
export function clearSkipOnboarding() {
  try {
    sessionStorage.removeItem(SKIP_ONBOARDING_KEY);
  } catch {
    /* noop */
  }
}

/**
 * Community-first signups (from the /community squeeze page) get a short
 * interactive tour the first time they land in the hub. One-shot flag.
 */
const COMMUNITY_TOUR_KEY = "community_tour_pending";

/** True when a `next` destination points at the community hub. */
export function isCommunityPath(path: string | null | undefined): boolean {
  return !!path && path.startsWith("/app/community");
}

export function markCommunityTour() {
  try {
    localStorage.setItem(COMMUNITY_TOUR_KEY, "1");
  } catch {
    /* private mode */
  }
}

/** Reads AND clears the flag so the tour only ever runs once. */
export function consumeCommunityTour(): boolean {
  try {
    const pending = localStorage.getItem(COMMUNITY_TOUR_KEY) === "1";
    if (pending) localStorage.removeItem(COMMUNITY_TOUR_KEY);
    return pending;
  } catch {
    return false;
  }
}
