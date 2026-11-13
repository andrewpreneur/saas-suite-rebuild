import { installBackendGuard } from "../lib/backendDisconnected";
import { HelmetProvider } from "react-helmet-async";
import { bootRoot } from "./bootRoot";
import App from "../App.tsx";
import "../index.css";
import { captureFbclid, captureAttribution, captureFbCookies } from "../utils/fbAttribution";
import { captureWebinarAttribution } from "../utils/webinarAttribution";
import { hasOptedOutOfTracking, initTrackingConsent } from "../utils/trackingConsent";
import { Buffer } from "buffer";
import { toast as sonnerToast } from "sonner";
import { installChunkReload } from "../lib/chunkReload";
import { startTextUsLift } from "../lib/liftTextUs";
import { installGlobalErrorLogging, logClientError } from "../lib/errorLog";

installBackendGuard();

installGlobalErrorLogging();
{
  const orig = sonnerToast.error.bind(sonnerToast);
  (sonnerToast as any).error = (msg: any, data?: any) => {
    logClientError("toast", typeof msg === "string" ? msg : "", typeof data?.description === "string" ? data.description : "");
    return orig(msg, data);
  };
}

// Polyfill Buffer for browser-side libs (e.g. gray-matter used in blog bulk import)
if (typeof (globalThis as any).Buffer === "undefined") {
  (globalThis as any).Buffer = Buffer;
}

export function boot() {
  installChunkReload();
  startTextUsLift();
  // Honour a stored cookie opt-out before any tracking runs.
  initTrackingConsent();

  if (!hasOptedOutOfTracking()) {
    // Capture fbclid from URL on first load so it persists across the signup flow
    captureFbclid();
    // Capture UTM / referrer / landing page attribution (first-touch with refresh on new UTMs)
    captureAttribution();
    // Separate first-touch copy for Viral Meetings registration. Signup capture
    // above still refreshes when a new campaign arrives.
    captureWebinarAttribution();
    // Snapshot Meta's _fbc/_fbp at first landing (fbc is first-touch-wins). Retry
    // shortly after so the pixel has had time to write its own cookies.
    captureFbCookies();
    setTimeout(() => captureFbCookies(), 2500);
  }

  bootRoot(
    <HelmetProvider>
      <App />
    </HelmetProvider>,
  );
}
