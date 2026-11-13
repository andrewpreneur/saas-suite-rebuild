import { isPaintFirstPath, pathKey } from "./entries/paintFirst";

// Load analytics separately so it never delays the page or either entry graph.
void import("./utils/posthogTracking")
  .then(({ startWebsiteTracking }) => startWebsiteTracking())
  .catch(() => { /* Analytics failure must not interrupt the website. */ });

/**
 * Split the paid funnel from the rest of the app before either graph loads.
 * /one-feature-kit (and onefeaturekit.com) download the funnel entry only.
 */
const path = window.location.pathname;
const host = window.location.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
const funnel =
  host === "onefeaturekit.com" ||
  path === "/one-feature-kit" ||
  path.startsWith("/one-feature-kit/");

/** Start the lander chunk with the app shell, and try again if the fetch fails. The prerender stays up either way. */
function preloadPaintFirst(pathname: string) {
  const key = pathKey(pathname);
  const load =
    key === "/aisaas"
      ? () => import("./pages/AiSaasTrial")
      : key === "/onefeaturetraining-1" || key === "/onefeaturetraining-2"
        ? () => import("./pages/OneFeatureTraining")
        : key === "/onefeaturetraining-success"
          ? () => import("./pages/OneFeatureTrainingSuccess")
          : key === "/onefeaturetraining-quiz"
            ? () => import("./pages/OneFeatureQuiz")
            : key === "/onefeaturetraining-3" || key === "/onefeaturetraining-4" || key === "/onefeaturetraining-5"
              ? () => import("./pages/OneFeatureStrategy")
              : key === "/agents"
                ? () => import("./pages/AgentsApply")
                : key === "/work-with-us"
                  ? () => import("./pages/WorkWithUs")
                  : key === "/highlevelers" || key === "/highlevelers-upgrade"
                    ? () => import("./pages/HighLevelers")
                    : key === "/founders-plan"
                      ? () => import("./pages/FoundersPlan")
                      : null;
  if (
    key === "/onefeaturetraining-1" ||
    key === "/onefeaturetraining-2" ||
    key === "/onefeaturetraining-5"
  ) {
    const warmSuccess = (left: number) => {
      import("./pages/OneFeatureTrainingSuccess").catch(() => {
        if (left > 1) window.setTimeout(() => warmSuccess(left - 1), 500);
      });
    };
    warmSuccess(3);
  }
  if (!load) return;
  const attempt = (left: number) => {
    load().catch(() => {
      if (left > 1) window.setTimeout(() => attempt(left - 1), 500);
    });
  };
  attempt(3);
}

// Separate import() calls so Vite preloads only the branch that runs.
// A ternary made the sales page preload the app graph, including Stripe.
if (funnel) {
  void import("./entries/funnel").then((mod) => mod.boot());
} else {
  if (isPaintFirstPath(path)) preloadPaintFirst(path);
  void import("./entries/app").then((mod) => mod.boot());
}
