// Re-fire saassuite.kit_purchased for one Checkout Session.
// Dry-run is the default. Nothing is posted and no claim or log row is written
// until you pass --send.
//
// --send calls one-feature-kit-refire, which builds the body with
// kitPurchasedPayload, claims lynkific:<session> (and meta:<session> unless
// --skip-meta), and writes customer_message_events source manual_refire
// with the GoHighLevel HTTP status and response id.
//
// Do not pass --send against the live project without approval.
// The Oct 22 buyer (cs_live_b1dV…) is handled separately. This script does
// not insert that customer's rows.
//
//   bun scripts/refire-kit-purchased.ts --session cs_live_...
//   SUPABASE_SERVICE_ROLE_KEY=... bun scripts/refire-kit-purchased.ts --session cs_live_... --send
//   SUPABASE_SERVICE_ROLE_KEY=... bun scripts/refire-kit-purchased.ts --session cs_live_... --send --skip-meta

import { kitMetaActionKey, kitPurchaseEventId } from "../supabase/functions/_shared/kit-meta.ts";
import {
  kitLynkificActionKey,
  kitPurchasedPayload,
  kitPurchasedSendLog,
  kitPurchasedWebhookUrl,
} from "../supabase/functions/_shared/kit-lynkific.ts";

const FUNCTION_URL =
  process.env.KIT_PURCHASED_REFIRE_URL ??
  "https://auth.saassuite.ai/functions/v1/one-feature-kit-refire";

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) return undefined;
  return value;
}

const send = process.argv.includes("--send");
const skipMeta = process.argv.includes("--skip-meta");
const session = flag("--session")?.trim() ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!/^cs_live_[A-Za-z0-9]+$/.test(session)) {
  console.error("Usage: bun scripts/refire-kit-purchased.ts --session cs_live_... [--send] [--skip-meta]");
  process.exit(1);
}

const claim = kitLynkificActionKey(session);
const purchaseClaim = kitMetaActionKey(session);
const eventId = kitPurchaseEventId(session);
const webhookUrl = kitPurchasedWebhookUrl(
  process.env.GHL_KIT_PURCHASED_WEBHOOK_URL,
  process.env.LYNKIFIC_KIT_WEBHOOK_URL,
);
const logPreview = kitPurchasedSendLog({
  email: "(loaded from the Checkout Session on send)",
  checkoutSessionId: session,
  source: "manual_refire",
  outcome: "sent",
  httpStatus: null,
  responseId: null,
});

if (!send) {
  console.log(JSON.stringify({
    dry_run: true,
    url: FUNCTION_URL,
    checkout_session_id: session,
    claim,
    purchase_claim: skipMeta ? null : purchaseClaim,
    event_id: eventId,
    payload_builder: kitPurchasedPayload.name,
    ghl_webhook_url: webhookUrl,
    skip_meta: skipMeta,
    log: {
      template_key: logPreview.templateKey,
      source: logPreview.source,
      event: logPreview.metadata.event,
      checkout_session_id: logPreview.metadata.checkout_session_id,
    },
    note: "No request was sent. Pass --send with SUPABASE_SERVICE_ROLE_KEY after approval. The function claims, posts kit_purchased, and logs the GoHighLevel status.",
  }, null, 2));
  process.exit(0);
}

if (!serviceKey) {
  console.error("Set SUPABASE_SERVICE_ROLE_KEY. The key is not printed.");
  process.exit(1);
}

const response = await fetch(FUNCTION_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
  },
  body: JSON.stringify({ checkout_session_id: session, skip_meta: skipMeta }),
});
const raw = await response.text();
console.log(JSON.stringify({ status: response.status, body: raw.slice(0, 2000) }));
process.exit(response.ok ? 0 : 1);
