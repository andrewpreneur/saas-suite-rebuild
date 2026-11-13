// Slack interactivity handler (buttons, modals). Stub — validates signature, ACKs 200.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getInstallByTeam } from "../_shared/slack-workspace.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-slack-signature, x-slack-request-timestamp",
};

const SIGNING_SECRET = Deno.env.get("SLACK_SIGNING_SECRET") ?? "";

async function verifySlack(req: Request, rawBody: string): Promise<boolean> {
  if (!SIGNING_SECRET) return false;
  const ts = req.headers.get("x-slack-request-timestamp");
  const sig = req.headers.get("x-slack-signature");
  if (!ts || !sig) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - Number(ts)) > 60 * 5) return false;

  const base = `v0:${ts}:${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SIGNING_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const macBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(base));
  const hex = Array.from(new Uint8Array(macBuf))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  const expected = `v0=${hex}`;
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const rawBody = await req.text();
  const ok = await verifySlack(req, rawBody);
  if (!ok) return new Response("invalid signature", { status: 401, headers: corsHeaders });

  // Slack sends interactivity as form-encoded with a `payload` JSON string.
  // Parse for logging so future handlers have context. No-op for now.
  try {
    const params = new URLSearchParams(rawBody);
    const payload = params.get("payload");
    if (payload) {
      const parsed = JSON.parse(payload);
      const teamId = parsed?.team?.id ?? parsed?.user?.team_id ?? "";
      const install = teamId ? await getInstallByTeam(teamId) : null;
      console.log(
        "slack-interactions payload type:", parsed?.type,
        "callback_id:", parsed?.callback_id,
        "team:", teamId,
        "agency:", install?.agency_id ?? "(unlinked)",
      );
    }
  } catch (e) {
    console.error("interactions parse error:", e);
  }

  return new Response("", { status: 200, headers: corsHeaders });
});
