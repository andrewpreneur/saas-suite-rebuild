import { Helmet } from "react-helmet-async";
import { matchPath, useLocation } from "react-router-dom";
import { canonicalFunnelPath } from "@/funnel/one-feature-kit/host";

/**
 * Central indexing policy. Anything not on the allowlist below gets
 * `noindex, follow` — app routes, auth, admin, per-tenant pages, and paid
 * campaign landers that duplicate the homepage pitch.
 */
export const INDEXABLE_ROUTES = [
  "/",
  "/pricing",
  "/onboardings",
  "/support",
  "/branding-tool",
  "/login-tracking",
  "/email-warmup",
  "/affiliate",
  "/saaspartner",
  "/webinar",
  "/breakdown",
  "/blog",
  "/blog/:slug",
  "/alternatives/:competitor",
  "/for/:niche",
  "/privacy",
  "/terms",
  "/accessibility",
  "/book",
];

/**
 * These pre-ad funnels set their own single `noindex, nofollow` through PageSEO.
 * RobotsPolicy's blanket `noindex, follow` was the second robots tag.
 */
export const PAGE_OWNED_ROBOTS = new Set([
  "/onefeaturetraining-2",
  "/onefeaturetraining-success",
  "/onefeaturetraining-5",
  "/onefeaturetraining-quiz",
  "/agents",
  "/work-with-us",
  "/highlevelers",
  "/highlevelers-upgrade",
  "/founders-plan",
]);

function pathKey(pathname: string) {
  return (pathname || "/").replace(/\/+$/, "") || "/";
}

const RobotsPolicy = () => {
  const { pathname } = useLocation();
  const hostname = typeof window === "undefined" ? "" : window.location.hostname;
  if (PAGE_OWNED_ROBOTS.has(pathKey(pathname))) return null;
  const indexable =
    INDEXABLE_ROUTES.some((pattern) => matchPath({ path: pattern, end: true }, pathname)) ||
    canonicalFunnelPath(pathname, hostname) !== null;

  if (indexable) return null;

  return (
    <Helmet>
      <meta name="robots" content="noindex, follow" />
    </Helmet>
  );
};

export default RobotsPolicy;