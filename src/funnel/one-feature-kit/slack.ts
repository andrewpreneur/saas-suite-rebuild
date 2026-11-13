import { KIT_SLACK_AGENCY_ID } from "./stripe";
import { kitPaymentCapability } from "./payment";
import {
  ONE_FEATURE_KIT_PAYMENTS_LIVE,
  formatUsd,
  orderTotalCents,
  type KitDraft,
} from "./order";

export type KitSlackPing = {
  sent: boolean;
  reason: string;
};

export type KitSlackPlan = {
  send: boolean;
  reason: string;
  payload: {
    agency_id: string;
    event_type: "one_feature_kit_purchase";
    data: {
      checkout_id: string | null;
      name: string;
      email: string;
      phone: string;
      total: string;
      lines: string[];
    };
  };
};

/** What a confirmed purchase would post. Does not call Slack. */
export function planKitSlackPing(draft: KitDraft): KitSlackPlan {
  const payload = {
    agency_id: KIT_SLACK_AGENCY_ID,
    event_type: "one_feature_kit_purchase" as const,
    data: {
      checkout_id: draft.checkoutId,
      name: draft.contact.firstName,
      email: draft.contact.email,
      phone: draft.contact.phone,
      total: formatUsd(orderTotalCents(draft)),
      lines: draft.lines.map((line) => line.label),
    },
  };
  if (!draft.checkoutId || draft.checkoutId.startsWith("stub_")) {
    return { send: false, reason: "No confirmed checkout yet.", payload };
  }
  if (!ONE_FEATURE_KIT_PAYMENTS_LIVE) {
    return {
      send: false,
      reason: "Payments are not live, so no Slack ping is sent.",
      payload,
    };
  }
  if (!KIT_SLACK_AGENCY_ID) {
    return {
      send: false,
      reason: "KIT_SLACK_AGENCY_ID is empty, so slack-notify is not called.",
      payload,
    };
  }
  return { send: true, reason: "Ready to post through slack-notify.", payload };
}

/**
 * Posts a purchase ping only when payments are live and an agency id is set.
 * The browser never calls this while the stub is in force. The server function
 * `one-feature-kit-purchase-notify` is what actually reaches Slack.
 */
export async function maybeNotifyKitPurchase(draft: KitDraft): Promise<KitDraft> {
  if (draft.slackPing?.sent) return draft;
  const plan = planKitSlackPing(draft);
  if (!plan.send) {
    return { ...draft, slackPing: { sent: false, reason: plan.reason } };
  }
  const base = import.meta.env.VITE_SUPABASE_URL;
  if (!base) {
    return {
      ...draft,
      slackPing: { sent: false, reason: "VITE_SUPABASE_URL is not set." },
    };
  }
  const response = await fetch(`${base}/functions/v1/one-feature-kit-purchase-notify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...plan.payload, capability: kitPaymentCapability() }),
  });
  if (!response.ok) {
    return {
      ...draft,
      slackPing: { sent: false, reason: `Slack notify returned ${response.status}.` },
    };
  }
  const result = await response.json();
  return { ...draft, slackPing: { sent: !result.skipped, reason: result.skipped ? `Skipped: ${result.skipped}` : "Posted through slack-notify." } };
}
