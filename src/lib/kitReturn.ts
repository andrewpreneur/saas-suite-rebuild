/** In-app One Feature Kit home. Paid checkout and the free-funnel bridge both use this. */
export const KIT_HOME_PATH = "/app/dashboard?view=kit";

/** Steps the kit tracker can put in the address bar. */
export const KIT_STEP_IDS = [
  "replay",
  "install-saas",
  "install-snapshot",
  "customize-video",
  "saas-training",
  "menu-training",
  "sales-page",
  "launch-ads",
  "launch-video",
] as const;

export type KitStepId = (typeof KIT_STEP_IDS)[number];

const KIT_RETURN_KEY = "kit_return_to";

export function kitStepLocation(stepId: string): string {
  return `/app/dashboard?view=kit&step=${encodeURIComponent(stepId)}`;
}

/** Accept only a same-app kit step URL. Anything else is dropped. */
export function kitReturnTarget(value: string | null | undefined): string | null {
  if (!value) return null;
  let path = value.trim();
  if (!path.startsWith("/app/dashboard") || path.startsWith("//") || path.includes("\\"))
    return null;
  if (path.includes("://")) return null;
  try {
    path = decodeURIComponent(path);
  } catch {
    return null;
  }
  if (!path.startsWith("/app/dashboard?") || path.includes("://") || path.startsWith("//"))
    return null;
  const query = path.slice(path.indexOf("?") + 1).split("#")[0] ?? "";
  const params = new URLSearchParams(query);
  if (params.get("view") !== "kit") return null;
  const step = params.get("step");
  if (step && !KIT_STEP_IDS.includes(step as KitStepId)) return null;
  const safe = new URLSearchParams();
  safe.set("view", "kit");
  if (step) safe.set("step", step);
  return `/app/dashboard?${safe.toString()}`;
}

export function withKitReturn(href: string, stepId: string): string {
  if (!href.startsWith("/app/")) return href;
  const hashAt = href.indexOf("#");
  const hash = hashAt >= 0 ? href.slice(hashAt) : "";
  const withoutHash = hashAt >= 0 ? href.slice(0, hashAt) : href;
  const [path, query = ""] = withoutHash.split("?");
  const params = new URLSearchParams(query);
  params.set("returnTo", kitStepLocation(stepId));
  return `${path}?${params.toString()}${hash}`;
}

export function rememberKitReturn(target: string | null): void {
  const safe = kitReturnTarget(target);
  if (!safe || typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(KIT_RETURN_KEY, safe);
  } catch {
    // A blocked store still leaves returnTo on the link itself.
  }
}

function readStoredKitReturn(raw: string, now: number): string | null {
  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as { path?: string; at?: number };
      if (!parsed.path || typeof parsed.at !== "number") return null;
      if (parsed.path === KIT_HOME_PATH && now - parsed.at > KIT_HOME_RETURN_TTL_MS) {
        clearKitReturn();
        return null;
      }
      return kitReturnTarget(parsed.path);
    } catch {
      return null;
    }
  }
  return kitReturnTarget(raw);
}

export function readRememberedKitReturn(now = Date.now()): string | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KIT_RETURN_KEY);
    if (!raw) return null;
    return readStoredKitReturn(raw, now);
  } catch {
    return null;
  }
}

export function clearKitReturn(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(KIT_RETURN_KEY);
  } catch {
    // Ignore a blocked store.
  }
}

/** Abandoned bridge arms expire. Step bookmarks are a plain path and are not timed. */
export const KIT_HOME_RETURN_TTL_MS = 10 * 60 * 1000;

/**
 * Arm the kit home for this tab only.
 * sessionStorage, consumed once, ignored after 10 minutes. No cookie and no profile field.
 */
export function armKitHomeReturn(now = Date.now()): void {
  const safe = kitReturnTarget(KIT_HOME_PATH);
  if (!safe || typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(KIT_RETURN_KEY, JSON.stringify({ path: safe, at: now }));
  } catch {
    // A blocked store still leaves the redirect on the auth URL.
  }
}

/** Quiz sign-in must return to the success page first. Every other bridge src may arm the kit. */
export function shouldArmKitReturn(src: string): boolean {
  return src !== "quiz";
}

/**
 * Read the bridge's one-shot home return and delete it.
 * A step bookmark (`?step=`) is left alone for the in-app back link.
 * A missing key leaves the caller on today's default.
 */
export function consumeKitHomeReturn(now = Date.now()): string | null {
  const value = readRememberedKitReturn(now);
  if (value !== KIT_HOME_PATH) return null;
  clearKitReturn();
  return KIT_HOME_PATH;
}

const BRIDGE_SOURCES = new Set(["quiz", "oft5", "oft4", "oft2"]);

function carryValue(value: string): string | null {
  let clean = "";
  for (const char of value.trim()) {
    const code = char.charCodeAt(0);
    if (code <= 31 || code === 127) continue;
    clean += char;
  }
  if (!clean || clean.length > 200) return null;
  if (clean.includes("://") || clean.startsWith("//") || clean.includes("\\")) return null;
  return clean;
}

function carrySearchKey(key: string): boolean {
  return (
    key.startsWith("utm_") ||
    key === "fbclid" ||
    key === "src" ||
    key === "lead" ||
    key === "lead_id"
  );
}

function writeCarry(
  target: URLSearchParams,
  key: string,
  value: string | null | undefined,
  allowDelete: boolean,
) {
  if (!carrySearchKey(key)) return;
  if (!value) {
    if (allowDelete) target.delete(key);
    return;
  }
  const clean = carryValue(value);
  if (!clean) return;
  if (key === "src" && !BRIDGE_SOURCES.has(clean)) return;
  if ((key === "lead" || key === "lead_id") && !/^[A-Za-z0-9_-]{1,80}$/.test(clean)) return;
  target.set(key, clean);
}

function copySafeCarry(
  target: URLSearchParams,
  search: string,
  extra?: Record<string, string | null | undefined>,
) {
  const incoming = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  incoming.forEach((value, key) => writeCarry(target, key, value, false));
  if (!extra) return;
  for (const [key, value] of Object.entries(extra)) writeCarry(target, key, value, true);
}

/** Kit home plus the attribution already on this visit. Anything else is dropped. */
export function kitHomeWithAttribution(
  search: string,
  extra?: Record<string, string | null | undefined>,
): string {
  const next = new URLSearchParams();
  next.set("view", "kit");
  copySafeCarry(next, search, extra);
  return `/app/dashboard?${next.toString()}`;
}

export type TrainingSuccessAuthVia = "google" | "email";

/**
 * Where a sign-in started on the success page returns.
 * Both quiz and non-quiz come back to this page. A cancelled or expired
 * provider return then stays here, instead of opening the app with no session
 * (that path stores the address for the next login). Non-quiz adds go=kit so a
 * live session can continue into the kit. Quiz omits it so the 3 questions run.
 */
export function trainingSuccessAuthPath(
  src: string,
  via: TrainingSuccessAuthVia,
  search: string,
): string {
  if (src === "quiz") {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    params.set("src", "quiz");
    params.set("via", via);
    params.delete("go");
    for (const key of [
      "auth",
      "error",
      "error_code",
      "error_description",
      "code",
      "access_token",
      "refresh_token",
    ]) {
      params.delete(key);
    }
    return `/onefeaturetraining-success?${params.toString()}`;
  }
  const params = new URLSearchParams();
  copySafeCarry(params, search, src && BRIDGE_SOURCES.has(src) ? { src } : undefined);
  params.set("via", via);
  params.set("go", "kit");
  return `/onefeaturetraining-success?${params.toString()}`;
}

/**
 * Provider error on the success page. Sends the visitor to the quiz with
 * auth=cancelled or auth=expired, and drops the one-shot kit arm from this attempt.
 * Returns null when this load is not an error return.
 */
export function successAuthErrorPath(search: string, hash: string): string | null {
  const incoming = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const hashed = new URLSearchParams(hash.replace(/^#/, ""));
  const mark =
    incoming.get("error") ||
    hashed.get("error") ||
    incoming.get("error_code") ||
    hashed.get("error_code");
  if (!mark) return null;
  const next = new URLSearchParams(incoming);
  next.delete("error");
  next.delete("error_code");
  next.delete("error_description");
  next.delete("go");
  const code = hashed.get("error_code") || incoming.get("error_code");
  next.set("auth", code === "otp_expired" ? "expired" : "cancelled");
  clearKitReturn();
  return `/onefeaturetraining-quiz?${next.toString()}`;
}

/** The kit step to restore: the URL param wins, then the value saved when the step was opened. */
export function currentKitReturn(search: string): string | null {
  return kitReturnTarget(new URLSearchParams(search).get("returnTo")) || readRememberedKitReturn();
}
