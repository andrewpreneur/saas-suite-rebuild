import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { trackingPixelsAllowed } from "@/utils/trackingConsent";
import { canonicalFunnelPath, isKitHost } from "@/funnel/one-feature-kit/host";

/**
 * Fires a Meta Pixel PageView on every client-side route change.
 * The base pixel in index.html covers the initial page load; this covers SPA navigation.
 * Skipped entirely for visitors who opted out of advertising cookies.
 */
const MetaPixelRouteTracker = () => {
  const location = useLocation();
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      // index.html already fired PageView for the initial load
      firstRun.current = false;
      return;
    }
    if (!trackingPixelsAllowed()) return;
    if (isKitHost(window.location.hostname)) return;
    if (canonicalFunnelPath(location.pathname, window.location.hostname)) return;
    const fbq = (window as any).fbq;
    if (typeof fbq === "function") {
      fbq("track", "PageView");
    }
  }, [location.pathname, location.search]);

  return null;
};

export default MetaPixelRouteTracker;
