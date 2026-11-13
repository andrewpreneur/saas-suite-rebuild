import { useEffect } from "react";
import { isTestTraffic } from "@/utils/testTraffic";

type Fbq = ((...args: unknown[]) => void) & Record<string, unknown>;

/** Blocks any third-party browser script from emitting the retired webinar event. */
export function useWebinarMetaGuard() {
  useEffect(() => {
    const current = window.fbq as Fbq | undefined;
    if (typeof current !== "function") return;
    const testTraffic = isTestTraffic();

    const guarded = ((...args: unknown[]) => {
      const command = args[0];
      if (testTraffic && (command === "init" || command === "track" || command === "trackSingle" || command === "trackCustom")) {
        return;
      }
      const eventName = command === "trackSingle" ? args[2] : args[1];
      if (
        (command === "track" || command === "trackSingle" || command === "trackCustom") &&
        eventName === "CompleteRegistration"
      ) {
        console.warn("[meta] blocked retired webinar CompleteRegistration event");
        return;
      }
      current(...args);
    }) as Fbq;

    Object.assign(guarded, current);
    window.fbq = guarded as typeof window.fbq;

    return () => {
      if (window.fbq === guarded) window.fbq = current as typeof window.fbq;
    };
  }, []);
}