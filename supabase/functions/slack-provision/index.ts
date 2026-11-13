// Retired in favor of the distributed OAuth install flow (slack-install / slack-oauth).
// Also handles Slack Events for app_uninstalled and tokens_revoked so we deactivate
// per-workspace installs when a customer removes SaaSSuite from their workspace.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { deactivateInstallByTeam } from "../_shared/slack-workspace.ts";

const SIGNING_SECRET = Deno.env.get("SLACK_SIGNING_SECRET") ?? "";

async function verifySlack(req: Request, rawBody: string): Promise<boolean> {
  if (!SIGNING_SECRET) return false;
  const ts = req.headers.get("x-slack-request-timestamp");
  const sig = req.headers.get("x-slack-signature");
  if (!ts || !sig) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(ts)) > 300) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SIGNING_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`v0:${ts}:${rawBody}`));
  const hex = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const expected = `v0=${hex}`;
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const rawBody = await req.text();

  try {
    const preview = JSON.parse(rawBody);
    if (preview?.type === "url_verification" && preview?.challenge) {
      return new Response(preview.challenge, { headers: { "Content-Type": "text/plain" } });
    }
  } catch { /* not JSON */ }

  if (!(await verifySlack(req, rawBody))) {
    return new Response("invalid signature", { status: 401 });
  }

  let payload: any = {};
  try { payload = JSON.parse(rawBody); } catch { /* ignore */ }

  const teamId = payload?.team_id ?? payload?.event?.team ?? "";
  const event = payload?.event ?? {};
  const eventType = event?.type;

  if (eventType === "app_uninstalled" || eventType === "tokens_revoked") {
    if (teamId) {
      await deactivateInstallByTeam(teamId);
      console.log(`Deactivated Slack install for team ${teamId} (event: ${eventType})`);
    }
    return new Response("", { status: 200 });
  }

  // Free-text conversation with the AI CoPilot: @mentions, DMs, and replies in
  // the thread of a proactive check-in. Slack retries are dropped so a retry
  // never produces a duplicate answer.
  const isRetry = !!req.headers.get("x-slack-retry-num");
  const isHumanMessage =
    (eventType === "app_mention" || eventType === "message") &&
    !isRetry &&
    !event.bot_id &&
    event.subtype === undefined &&
    typeof event.text === "string" &&
    event.text.trim().length > 0;

  if (isHumanMessage) {
    const text = String(event.text).replace(/<@[A-Z0-9]+>/g, "").trim();
    const work = (async () => {
      try {
        const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/copilot-nudge-reply`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            text,
            channel: "slack",
            slack_team_id: teamId,
            slack_channel_id: event.channel,
            slack_thread_ts: event.thread_ts ?? event.ts,
          }),
        });
        if (!res.ok) console.error("copilot-nudge-reply failed:", res.status, (await res.text()).slice(0, 300));
      } catch (e) {
        console.error("slack event -> copilot-nudge-reply error:", e);
      }
    })();
    // @ts-ignore Deno edge runtime background task
    if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as any).waitUntil) {
      // @ts-ignore
      (EdgeRuntime as any).waitUntil(work);
    }
  }

  return new Response("", { status: 200 });
});