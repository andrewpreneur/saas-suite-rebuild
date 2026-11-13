import { useEffect } from "react";
import { trackingPixelsAllowed } from "@/utils/trackingConsent";

declare global {
  interface Window {
    fbq: (...args: any[]) => void;
    _fbq: any;
  }
}

const META_PIXEL_ID = "745177780828109";

/**
 * Shared Meta Pixel hook. The pixel itself is installed once in index.html,
 * so this only fires events (never re-inits, which would trigger a
 * "Duplicate Pixel ID" error and drop events). Events are suppressed for
 * visitors who opted out of advertising cookies.
 */
export const useMetaPixel = (customEvent?: string) => {
  useEffect(() => {
    if (typeof window.fbq !== "function") return;
    if (!trackingPixelsAllowed()) return;
    if (customEvent) {
      // eventID lets Meta dedupe this against any matching server-side copy
      // sent through the meta-capi function with the same id.
      const eventID = `${customEvent}_${window.location.pathname}`;
      window.fbq("track", customEvent, {}, { eventID });
    }
  }, [customEvent]);
};
