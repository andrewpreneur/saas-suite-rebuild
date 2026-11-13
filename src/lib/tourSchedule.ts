/**
 * Auto-start rules for the interactive walkthroughs.
 *
 * - Fires once per login session until the tour is completed.
 * - Dismissing remembers the step so the next session resumes there.
 * - After 3 dismissals within 7 days it pauses until the oldest of those is a week old.
 * - Completing the whole tour stops it for good.
 * - End Tour / Finish Tour completes that tour on the first click and suppresses
 *   every other automatic tour for the rest of the login session.
 * - "Don't show tours" is one preference per person and blocks every auto-start.
 */
export type TourKind = "nav" | "hub";

const VERSION = "v1";
const WEEK = 7 * 24 * 60 * 60 * 1000;
const MAX_PER_WEEK = 3;

interface TourState {
  completed: boolean;
  step: number;
  dismissals: number[];
}

const emailKey = (email: string) => email.trim().toLowerCase();
const key = (kind: TourKind, email: string) => `ss_tour_${VERSION}:${kind}:${emailKey(email)}`;
const sessionKey = (kind: TourKind, email: string) => `ss_tour_shown_${VERSION}:${kind}:${emailKey(email)}`;
const disabledKey = (email: string) => `ss_tours_disabled_${VERSION}:${emailKey(email)}`;
const sessionSuppressKey = (email: string) => `ss_tours_suppress_${VERSION}:${emailKey(email)}`;
const sequenceKey = (id: string, email: string) => `ss_tour_${VERSION}:seq:${id}:${emailKey(email)}`;

export function toursDisabled(email: string | null | undefined): boolean {
  if (!email) return false;
  try { return localStorage.getItem(disabledKey(email)) === "1"; } catch { return false; }
}

/** One preference for every tour. Explicit buttons can still start one. */
export function setToursDisabled(email: string, disabled = true) {
  try {
    if (disabled) localStorage.setItem(disabledKey(email), "1");
    else localStorage.removeItem(disabledKey(email));
  } catch { /* ignore */ }
}

export function suppressAutoToursForSession(email: string) {
  try { sessionStorage.setItem(sessionSuppressKey(email), "1"); } catch { /* ignore */ }
}

export function autoToursSuppressedThisSession(email: string | null | undefined): boolean {
  if (!email) return false;
  try { return sessionStorage.getItem(sessionSuppressKey(email)) === "1"; } catch { return false; }
}

export function recordSequenceComplete(sequenceId: string, email: string) {
  if (!sequenceId) return;
  try { localStorage.setItem(sequenceKey(sequenceId, email), "1"); } catch { /* ignore */ }
}

export function sequenceCompleted(sequenceId: string, email: string | null | undefined): boolean {
  if (!email || !sequenceId) return false;
  try { return localStorage.getItem(sequenceKey(sequenceId, email)) === "1"; } catch { return false; }
}

export function readTour(kind: TourKind, email: string): TourState {
  try {
    const raw = localStorage.getItem(key(kind, email));
    if (raw) {
      const s = JSON.parse(raw) as Partial<TourState>;
      return { completed: !!s.completed, step: Number(s.step) || 0, dismissals: Array.isArray(s.dismissals) ? s.dismissals : [] };
    }
  } catch { /* storage unavailable */ }
  return { completed: false, step: 0, dismissals: [] };
}

function write(kind: TourKind, email: string, s: TourState) {
  try { localStorage.setItem(key(kind, email), JSON.stringify(s)); } catch { /* ignore */ }
}

export function recentDismissals(s: TourState, now = Date.now()) {
  return s.dismissals.filter((t) => now - t < WEEK);
}

/** Should this tour open on its own right now (and hasn't already this session)? */
export function shouldAutoStart(kind: TourKind, email: string | null | undefined): boolean {
  if (!email) return false;
  if (toursDisabled(email) || autoToursSuppressedThisSession(email)) return false;
  const s = readTour(kind, email);
  if (s.completed) return false;
  if (recentDismissals(s).length >= MAX_PER_WEEK) return false;
  try { if (sessionStorage.getItem(sessionKey(kind, email))) return false; } catch { /* ignore */ }
  return true;
}

export function markShownThisSession(kind: TourKind, email: string) {
  try { sessionStorage.setItem(sessionKey(kind, email), "1"); } catch { /* ignore */ }
}

export function recordDismiss(kind: TourKind, email: string, step: number) {
  const s = readTour(kind, email);
  write(kind, email, { completed: false, step: Math.max(0, step), dismissals: [...recentDismissals(s), Date.now()] });
}

export function recordComplete(kind: TourKind, email: string) {
  write(kind, email, { completed: true, step: 0, dismissals: [] });
}
