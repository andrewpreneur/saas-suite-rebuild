import { FUNNEL_BASE, FUNNEL_ROUTES } from "./order";
import { slashlessPathname } from "./steps";

/** Custom domain for this funnel. saassuite.ai keeps its own routes. */
export const KIT_HOSTS = ["onefeaturekit.com", "www.onefeaturekit.com"] as const;

export const KIT_SITE = "https://onefeaturekit.com";

/** Step slug on the kit domain, and the tail of /one-feature-kit/:step. */
export const KIT_STEP_SLUGS = [
  "checkout",
  "ghl-signup-and-upgrade",
  "launch-pack",
  "webinar-sales-system",
  "thank-you",
] as const;

const STEP_TO_CANONICAL: Record<string, string> = {
  checkout: FUNNEL_ROUTES.checkout,
  "ghl-signup-and-upgrade": FUNNEL_ROUTES.ghl,
  "launch-pack": FUNNEL_ROUTES.launch,
  "webinar-sales-system": FUNNEL_ROUTES.webinar,
  "thank-you": FUNNEL_ROUTES.thanks,
  "business-in-a-box": FUNNEL_ROUTES.ghl,
  "affiliate-club": FUNNEL_ROUTES.launch,
  snapshot: FUNNEL_ROUTES.launch,
  "dfy-branding": FUNNEL_ROUTES.launch,
  "watch-us-build": FUNNEL_ROUTES.launch,
};

export function isKitHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return (KIT_HOSTS as readonly string[]).includes(host);
}

/** Map a browser path to the canonical /one-feature-kit path, or null. */
export function canonicalFunnelPath(pathname: string, hostname: string): string | null {
  if (pathname === FUNNEL_BASE) return FUNNEL_ROUTES.sales;
  if (pathname.startsWith(`${FUNNEL_BASE}/`)) {
    return STEP_TO_CANONICAL[pathname.slice(FUNNEL_BASE.length + 1)] ?? null;
  }
  if (!isKitHost(hostname)) return null;
  if (pathname === "/") return FUNNEL_ROUTES.sales;
  const slug = pathname.replace(/^\//, "");
  return STEP_TO_CANONICAL[slug] ?? null;
}

/**
 * Slashless location for a kit step that was opened with a trailing slash.
 * Search and hash are copied unchanged so fbclid and UTMs survive.
 * Returns null when the path is already slashless or is not a kit step.
 */
export function kitSlashlessRedirect(
  pathname: string,
  search = "",
  hash = "",
  hostname = "",
): { pathname: string; search: string; hash: string } | null {
  const next = slashlessPathname(pathname);
  if (next === pathname) return null;
  if (canonicalFunnelPath(next, hostname) == null) return null;
  return { pathname: next, search, hash };
}

/** Public URL path for a canonical funnel path on this host. */
export function publicFunnelPath(canonicalPath: string, hostname: string): string {
  if (!isKitHost(hostname)) return canonicalPath;
  if (canonicalPath === FUNNEL_ROUTES.sales) return "/";
  if (canonicalPath.startsWith(`${FUNNEL_BASE}/`)) return canonicalPath.slice(FUNNEL_BASE.length);
  return canonicalPath;
}

const POLICY_PATHS = new Set([
  "/terms",
  "/privacy",
  "/refunds",
  "/cookies",
  "/accessibility",
  "/support",
]);

/** Rewrite in-page links so the kit domain stays inside the funnel. */
export function rewriteHref(href: string, hostname: string): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  if (href === FUNNEL_BASE || href.startsWith(`${FUNNEL_BASE}/`)) {
    return publicFunnelPath(href, hostname);
  }
  if (isKitHost(hostname) && POLICY_PATHS.has(href)) {
    return `https://saassuite.ai${href}`;
  }
  return href;
}
