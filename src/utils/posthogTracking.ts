import posthog from "posthog-js";
import { CONSENT_EVENT, hasOptedOutOfTracking } from "./trackingConsent";
import { websiteEventProperties, websiteTrackingAllowed } from "./posthogPolicy";

let initialized = false;
let listening = false;

export function startWebsiteTracking() {
  const token = import.meta.env.VITE_LOVABLE_CONNECTOR_POSTHOG_API_KEY;
  const syncConsent = () => {
    if (!websiteTrackingAllowed(hasOptedOutOfTracking(), token)) {
      if (initialized) posthog.opt_out_capturing();
      return;
    }
    if (initialized) {
      if (posthog.has_opted_out_capturing()) posthog.opt_in_capturing();
      return;
    }
    initialized = true;
    posthog.init(token, {
      api_host: import.meta.env.VITE_LOVABLE_CONNECTOR_POSTHOG_REGION === "us"
        ? "https://us.i.posthog.com" : "https://eu.i.posthog.com",
      capture_pageview: "history_change",
      capture_pageleave: true,
      autocapture: false,
      disable_session_recording: true,
      disable_surveys: true,
      advanced_disable_flags: true,
      person_profiles: "never",
      before_send: (event) => {
        if (hasOptedOutOfTracking() || !event || !["$pageview", "$pageleave"].includes(event.event)) return null;
        event.properties = websiteEventProperties(event.properties);
        return event;
      },
    });
  };
  if (!listening) {
    listening = true;
    window.addEventListener(CONSENT_EVENT, syncConsent);
    window.addEventListener("storage", (event) => {
      if (event.key === "ss_tracking_optout") syncConsent();
    });
  }
  syncConsent();
}