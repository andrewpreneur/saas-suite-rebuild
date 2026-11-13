/** How often a tab asks the server which build is deployed. */
export const VERSION_CHECK_INTERVAL_MS = 5 * 60 * 1000;

export const APP_BUILD_ID: string =
  typeof __APP_BUILD_ID__ === "string" && __APP_BUILD_ID__ ? __APP_BUILD_ID__ : "dev";

const RELOAD_KEY = "ss_app_version_reload";

export type TypingTarget = {
  tagName?: string;
  type?: string;
  value?: string;
  isContentEditable?: boolean;
} | null;

export type TypingProbe = {
  activeElement: TypingTarget;
  querySelectorAll: (selector: string) => ArrayLike<TypingTarget>;
};

/** A focused text control, or any text control that already has a draft. */
export function isTypingTarget(element: TypingTarget): boolean {
  const tag = element?.tagName?.toUpperCase() || "";
  if (tag === "TEXTAREA") return true;
  if (element?.isContentEditable) return true;
  if (tag !== "INPUT") return false;
  const type = (element?.type || "text").toLowerCase();
  return !["button", "submit", "checkbox", "radio", "file", "hidden", "reset", "image", "range", "color"].includes(type);
}

export function isMidTyping(doc: TypingProbe): boolean {
  if (isTypingTarget(doc.activeElement)) return true;
  const fields = Array.from(doc.querySelectorAll("textarea, input, [contenteditable='true']"));
  return fields.some((field) => isTypingTarget(field) && (field?.value || "").trim().length > 0);
}

/** Remote id when the deployed build is different. Matching or unreadable payloads are not stale. */
export function remoteVersionId(payload: unknown, localId: string): string | null {
  if (!payload || typeof payload !== "object") return null;
  const id = (payload as { id?: unknown }).id;
  if (typeof id !== "string") return null;
  const remote = id.trim();
  if (!remote || remote === localId) return null;
  return remote;
}

export function shouldFetchVersion(lastAt: number, now: number, interval = VERSION_CHECK_INTERVAL_MS): boolean {
  return now - lastAt >= interval;
}

export type VersionAction = "none" | "reload" | "prompt";

/**
 * A newer build reloads on the next navigation. A draft or a reload that
 * already happened for this id shows a prompt instead, so typing is kept
 * and a cached bundle cannot reload forever.
 */
export function nextVersionAction(input: {
  remoteId: string | null;
  routeChanged: boolean;
  midTyping: boolean;
  alreadyReloadedFor?: string | null;
}): VersionAction {
  if (!input.remoteId) return "none";
  if (input.midTyping || input.alreadyReloadedFor === input.remoteId) return "prompt";
  if (input.routeChanged) return "reload";
  return "none";
}

export function reloadMarkerFor(storage: Pick<Storage, "getItem"> | null): string | null {
  try {
    return storage?.getItem(RELOAD_KEY) || null;
  } catch {
    return null;
  }
}

export function markVersionReload(storage: Pick<Storage, "setItem"> | null, id: string) {
  try {
    storage?.setItem(RELOAD_KEY, id);
  } catch {
    /* a private window can still reload once */
  }
}

export function clearVersionReload(storage: Pick<Storage, "removeItem"> | null) {
  try {
    storage?.removeItem(RELOAD_KEY);
  } catch {
    /* ignore */
  }
}
