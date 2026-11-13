// Service-role-only sender for one fake handover_requested event.
// The anon key is a valid Supabase JWT, so the gateway JWT check is not enough.
import { deliverGlobalHandover, postGlobalHandover, serviceRoleAuthorized, testHandoverPayload } from "../_shared/globalHandoverWebhook.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleAuthorized(req.headers.get("Authorization"), serviceKey)) return json({ error: "unauthorized" }, 401);

  const payload = testHandoverPayload();
  const url = (Deno.env.get("SUPPORT_HANDOVER_WEBHOOK_URL") || "").trim();
  if (!url) return json({ ok: true, skipped: "webhook_url_unset", payload });
  const authHeader = Deno.env.get("SUPPORT_HANDOVER_WEBHOOK_AUTH");
  try {
    const result = await deliverGlobalHandover(payload, url, authHeader?.trim() ? authHeader.trim() : undefined, postGlobalHandover);
    return json({ ok: result === "sent", result, payload });
  } catch (error) {
    console.error("global handover test failed", error instanceof Error ? error.message : error);
    return json({ ok: false, result: "failed", payload });
  }
});
