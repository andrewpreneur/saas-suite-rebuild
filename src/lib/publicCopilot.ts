import { publicVisitorStorageKey } from "../../supabase/functions/_shared/publicCopilotPolicy";
export * from "../../supabase/functions/_shared/publicCopilotPolicy";

const LEGACY_VISITOR_KEY = "ss_public_copilot_visitor";
const PENDING_KEY = "ss_public_copilot_pending";
const PENDING_FOCUS_KEY = "ss_public_copilot_pending_focus";

/** Stable random id for this feature page's signed-out chat. */
export function getVisitorId(focus?: string | null): string {
  const key = publicVisitorStorageKey(focus);
  try {
    let id = localStorage.getItem(key);
    if (!id && !focus) {
      id = localStorage.getItem(LEGACY_VISITOR_KEY);
      if (id) localStorage.setItem(key, id);
    }
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(key, id); }
    return id;
  } catch { return crypto.randomUUID(); }
}
/** Mark that this page's chat should come along at sign-in. */
export function markPendingClaim(focus?: string | null) {
  try {
    localStorage.setItem(PENDING_KEY, getVisitorId(focus));
    localStorage.setItem(PENDING_FOCUS_KEY, publicVisitorStorageKey(focus));
  } catch { /* private mode */ }
}
export function readPendingVisitorId(): string | null {
  try { return localStorage.getItem(PENDING_KEY); } catch { return null; }
}
export function clearPendingVisitorId() {
  try {
    const key = localStorage.getItem(PENDING_FOCUS_KEY);
    localStorage.removeItem(PENDING_KEY);
    localStorage.removeItem(PENDING_FOCUS_KEY);
    if (key) localStorage.removeItem(key);
  } catch { /* private mode */ }
}
