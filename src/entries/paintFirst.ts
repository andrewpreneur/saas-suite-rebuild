/** Paid ad landers. Their HTML is already the page, so the boot must not cover it with the empty Suspense fallback. */
export const PAINT_FIRST_PATHS = [
  "/onefeaturetraining-1",
  "/onefeaturetraining-2",
  "/onefeaturetraining-3",
  "/onefeaturetraining-4",
  "/onefeaturetraining-5",
  "/onefeaturetraining-success",
  "/onefeaturetraining-quiz",
  "/aisaas",
  "/agents",
  "/work-with-us",
  "/highlevelers",
  "/highlevelers-upgrade",
  "/founders-plan",
  "/one-feature-away",
  "/black-friday",
  "/skool-challenge",
] as const;

export function pathKey(pathname: string) {
  return (pathname || "/").replace(/\/+$/, "") || "/";
}

export function isPaintFirstPath(pathname: string) {
  return (PAINT_FIRST_PATHS as readonly string[]).includes(pathKey(pathname));
}

/**
 * The app shell's Suspense fallback is an empty full-screen div. That is not
 * a rendered page. A heading, or any other real text, means React committed
 * the route (or the route error) and the prerender can step aside.
 */
export function renderedPastFallback(snapshot: {
  loading: boolean;
  heading: string;
  textLength: number;
}) {
  if (snapshot.loading) return false;
  if (snapshot.heading.trim()) return true;
  return snapshot.textLength > 40;
}
