/**
 * Preserves UTM and tracking query parameters when navigating between pages.
 * Call this to append current URL search params to a target path.
 */

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;
const SCHEME = /[a-z][a-z0-9+.-]*:/i;

/**
 * A post-auth `next` may only be a same-origin relative path.
 * One leading slash. Protocol-relative, backslash, scheme, and control characters are dropped.
 */
export function sanitizeNextPath(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const path = value.trim();
  if (!isSameOriginPath(path)) return null;
  try {
    const decoded = decodeURIComponent(path);
    if (decoded !== path && !isSameOriginPath(decoded)) return null;
  } catch {
    return null;
  }
  return path;
}

function isSameOriginPath(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  if (path.includes("\\") || path.includes("://")) return false;
  if (CONTROL_CHARS.test(path)) return false;
  const pathOnly = path.split("?")[0]?.split("#")[0] ?? path;
  if (SCHEME.test(pathOnly)) return false;
  return true;
}

const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'msclkid', 'dclid', 'twclid', 'li_fat_id',
  'mc_cid', 'mc_eid', 'ref', 'am_id', '_gl', 'ttclid', 'ScCid',
  'irclickid', 'hsa_cam', 'hsa_grp', 'hsa_ad', 'hsa_src', 'hsa_net',
  'hsa_ver', 'hsa_acc', 'hsa_kw', 'hsa_mt', 'hsa_tgt', 'hsa_ol',
  // Post-auth deep link destination (e.g. /app/community/prompts).
  // Copied only after sanitizeNextPath, so /login and /app/learning cannot inherit an open redirect.
  'next',
  'copilot_focus', 'utm_id',
  'returnTo',
];

/**
 * Get current tracking params from the URL as a URLSearchParams object.
 */
export function getTrackingParams(): URLSearchParams {
  const current = new URLSearchParams(window.location.search);
  const tracking = new URLSearchParams();
  
  for (const key of TRACKING_PARAMS) {
    const val = current.get(key);
    if (!val) continue;
    if (key === "next") {
      const safe = sanitizeNextPath(val);
      if (safe) tracking.set(key, safe);
      continue;
    }
    tracking.set(key, val);
  }
  
  return tracking;
}

/**
 * Append tracking params to a path string. 
 * If the path already has query params, they are merged (existing ones take precedence).
 */
export function appendTrackingParams(path: string): string {
  const tracking = getTrackingParams();
  
  const [basePath, existingQuery] = path.split('?');
  const merged = new URLSearchParams(tracking.toString());
  
  // Existing params in the path take precedence. `next` is still sanitized.
  if (existingQuery) {
    const existing = new URLSearchParams(existingQuery);
    existing.forEach((val, key) => {
      if (key !== "next") {
        merged.set(key, val);
        return;
      }
      const safe = sanitizeNextPath(val);
      if (safe) merged.set(key, safe);
      else merged.delete(key);
    });
  }
  
  const queryString = merged.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

/**
 * React Router navigate wrapper - use with navigate(navigateWithParams('/signup'))
 */
export function navigateWithParams(path: string): string {
  return appendTrackingParams(path);
}
