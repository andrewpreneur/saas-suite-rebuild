// Replay a One Feature Kit onboarding notification for an existing row.
// Dry-run is the default. Nothing is posted until you pass --send.
// Customer email is not sent. The function posts Slack and the GoHighLevel
// onboarding workflow. GHL_KIT_ONBOARDING_WEBHOOK_URL overrides that hook.
// A blank value skips GoHighLevel. It does not use Resend.
//
// Do not run --send against the live project without approval.
//
//   bun scripts/notify-kit-onboarding.ts --id <funnel_onboarding uuid> --email buyer@example.com
//   SLACK_NOTIFY_TOKEN=... bun scripts/notify-kit-onboarding.ts --id <uuid> --email buyer@example.com --send
//
// Kiro's Oct 22 row starts with c2efe4f6. Look up the full id in the admin
// customer view. Pass that id and kiro@raqib.io. Dry-run first.

import { KIT_ONBOARDING_WEBHOOK_FALLBACK, kitOnboardingWebhookUrl } from "../supabase/functions/_shared/kit-onboarding-notify.ts";

const FUNCTION_URL =
  process.env.KIT_ONBOARDING_NOTIFY_URL ??
  "https://auth.saassuite.ai/functions/v1/kit-onboarding-notify";

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) return undefined;
  return value;
}

const send = process.argv.includes("--send");
const id = flag("--id")?.trim() ?? "";
const email = flag("--email")?.trim().toLowerCase() ?? "";
const token = process.env.SLACK_NOTIFY_TOKEN ?? "";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

if (!uuid.test(id) || !email.includes("@")) {
  console.error("Usage: bun scripts/notify-kit-onboarding.ts --id <uuid> --email <buyer email> [--send]");
  process.exit(1);
}

const body = { id, email, replay: true };

if (!send) {
  const ghlWebhookUrl = kitOnboardingWebhookUrl(process.env.GHL_KIT_ONBOARDING_WEBHOOK_URL);
  console.log(JSON.stringify({
    dry_run: true,
    url: FUNCTION_URL,
    body,
    ghl_webhook_url: ghlWebhookUrl,
    ghl_webhook_default: KIT_ONBOARDING_WEBHOOK_FALLBACK,
    note: ghlWebhookUrl
      ? "No request was sent. Pass --send with SLACK_NOTIFY_TOKEN after approval. The function posts Slack and this GoHighLevel webhook."
      : "No request was sent. GHL_KIT_ONBOARDING_WEBHOOK_URL is blank, so GoHighLevel is skipped. Pass --send with SLACK_NOTIFY_TOKEN after approval to post Slack only.",
  }, null, 2));
  process.exit(0);
}

if (!token) {
  console.error("Set SLACK_NOTIFY_TOKEN. The token is not printed.");
  process.exit(1);
}

const response = await fetch(FUNCTION_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify(body),
});
const raw = await response.text();
console.log(JSON.stringify({ status: response.status, body: raw.slice(0, 2000) }));
process.exit(response.ok ? 0 : 1);
