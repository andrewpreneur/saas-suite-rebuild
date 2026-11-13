import { installBackendGuard } from "../lib/backendDisconnected";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { HelmetProvider } from "react-helmet-async";
import { bootRoot } from "./bootRoot";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import RobotsPolicy from "@/components/RobotsPolicy";
import OneFeatureKit from "@/pages/OneFeatureKit";
import { isKitHost, kitSlashlessRedirect } from "@/funnel/one-feature-kit/host";
import { scheduleInteractOrIdle } from "@/funnel/one-feature-kit/scheduleTask";
import "@/funnel/one-feature-kit/funnel.css";
import { installChunkReload } from "@/lib/chunkReload";
import { startTextUsLift } from "@/lib/liftTextUs";
import { RouteErrorBoundary, lazyRoute } from "@/lib/lazyRoute";
import { AppVersionNotice } from "@/components/AppVersionNotice";
import { captureKitAttribution } from "@/funnel/one-feature-kit/attribution";
import { captureAttribution, captureFbclid, captureFbCookies } from "@/utils/fbAttribution";
import { hasOptedOutOfTracking, initTrackingConsent } from "@/utils/trackingConsent";

installBackendGuard();


const NotFound = lazyRoute(() => import("@/pages/NotFound"));

const fallback = (
  <div role="status" aria-label="Loading" style={{ minHeight: "100vh", background: "#fff" }} />
);

function Missing() {
  return (
    <Suspense fallback={fallback}>
      <NotFound />
    </Suspense>
  );
}

/** Replace a trailing-slash kit URL before the router reads it. Search and hash stay. */
function applyKitSlashlessRedirect() {
  const target = kitSlashlessRedirect(
    window.location.pathname,
    window.location.search,
    window.location.hash,
    window.location.hostname,
  );
  if (!target) return;
  window.history.replaceState(
    window.history.state,
    "",
    `${target.pathname}${target.search}${target.hash}`,
  );
}

/** In-app visits to /one-feature-kit/…/ never render the 404 while the URL is rewritten. */
function KitSlashGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const target = kitSlashlessRedirect(
    location.pathname,
    location.search,
    location.hash,
    window.location.hostname,
  );
  if (target) return <Navigate to={target} replace />;
  return children;
}

function DeferredCookies() {
  const [ready, setReady] = useState(false);
  useEffect(() => scheduleInteractOrIdle(() => setReady(true), 10_000), []);
  if (!ready) return null;
  return (
    <Suspense fallback={null}>
    </Suspense>
  );
}

/**
 * Sales funnel only. The main app (admin, dashboard, copilot) is a separate
 * entry so this route does not download it.
 */
export function boot() {
  applyKitSlashlessRedirect();
  installChunkReload();
  startTextUsLift();
  initTrackingConsent();
  if (!hasOptedOutOfTracking()) {
    captureFbclid();
    captureAttribution();
    captureFbCookies();
    captureKitAttribution();
  }

  const kitHost = isKitHost(window.location.hostname);
  bootRoot(
    <HelmetProvider>
      <BrowserRouter>
        <AppVersionNotice />
        <RobotsPolicy />
        <RouteErrorBoundary>
          <KitSlashGate>
            {kitHost ? (
              <Routes>
                <Route path="/" element={<OneFeatureKit />} />
                <Route
                  path="/business-in-a-box"
                  element={<Navigate to="/ghl-signup-and-upgrade" replace />}
                />
                <Route path="/affiliate-club" element={<Navigate to="/launch-pack" replace />} />
                <Route path="/snapshot" element={<Navigate to="/launch-pack" replace />} />
                <Route path="/dfy-branding" element={<Navigate to="/launch-pack" replace />} />
                <Route path="/watch-us-build" element={<Navigate to="/launch-pack" replace />} />
                <Route
                  path="/one-feature-kit/business-in-a-box"
                  element={<Navigate to="/ghl-signup-and-upgrade" replace />}
                />
                <Route
                  path="/one-feature-kit/affiliate-club"
                  element={<Navigate to="/launch-pack" replace />}
                />
                <Route
                  path="/one-feature-kit/snapshot"
                  element={<Navigate to="/launch-pack" replace />}
                />
                <Route
                  path="/one-feature-kit/dfy-branding"
                  element={<Navigate to="/launch-pack" replace />}
                />
                <Route
                  path="/one-feature-kit/watch-us-build"
                  element={<Navigate to="/launch-pack" replace />}
                />
                <Route path="/one-feature-kit" element={<OneFeatureKit />} />
                <Route path="/one-feature-kit/:step" element={<OneFeatureKit />} />
                <Route path="/:step" element={<OneFeatureKit />} />
                <Route path="*" element={<Missing />} />
              </Routes>
            ) : (
              <Routes>
                <Route
                  path="/one-feature-kit/business-in-a-box"
                  element={<Navigate to="/one-feature-kit/ghl-signup-and-upgrade" replace />}
                />
                <Route
                  path="/one-feature-kit/affiliate-club"
                  element={<Navigate to="/one-feature-kit/launch-pack" replace />}
                />
                <Route
                  path="/one-feature-kit/snapshot"
                  element={<Navigate to="/one-feature-kit/launch-pack" replace />}
                />
                <Route
                  path="/one-feature-kit/dfy-branding"
                  element={<Navigate to="/one-feature-kit/launch-pack" replace />}
                />
                <Route
                  path="/one-feature-kit/watch-us-build"
                  element={<Navigate to="/one-feature-kit/launch-pack" replace />}
                />
                <Route path="/one-feature-kit" element={<OneFeatureKit />} />
                <Route path="/one-feature-kit/:step" element={<OneFeatureKit />} />
                <Route path="*" element={<Missing />} />
              </Routes>
            )}
          </KitSlashGate>
        </RouteErrorBoundary>
        <DeferredCookies />
      </BrowserRouter>
    </HelmetProvider>,
  );

  const path = window.location.pathname;
  const sales = path === "/one-feature-kit" || (kitHost && path === "/");
  window.setTimeout(
    () => {
      void import("@/lib/errorLog").then((mod) => mod.installGlobalErrorLogging());
    },
    sales ? 10_000 : 0,
  );
}
