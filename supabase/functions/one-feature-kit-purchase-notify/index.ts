import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.24.2";
import { KIT_POST_PURCHASE_IDS } from "../_shared/kit-catalog.ts";
import { kitHash, kitNotify, kitStripe, verifiedKitSession } from "../_shared/kit-payment.ts";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const schema = z.object({ event_type: z.literal("one_feature_kit_purchase"), capability: z.string().uuid().optional(), data: z.object({
  checkout_id: z.string().regex(/^cs_live_[A-Za-z0-9]+$/).max(255),
  offer_id: z.enum(KIT_POST_PURCHASE_IDS).optional(), payment_intent_id: z.string().regex(/^pi_[A-Za-z0-9]+$/).max(255).optional(),
}) });
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid purchase" }, 400);
  try {
    const body = parsed.data;
    const internalToken = Deno.env.get("SLACK_NOTIFY_TOKEN");
    const provided = req.headers.get("authorization")?.replace(/^Bearer /, "");
    const internal = internalToken && provided && await kitHash(provided) === await kitHash(internalToken);
    const stripe = kitStripe();
    if (!internal) {
      if (!body.capability || body.data.offer_id) return json({ error: "Unauthorized" }, 401);
      await verifiedKitSession(stripe, body.data.checkout_id, body.capability);
    }
    // Browser-supplied names, totals, lines and agency IDs are never trusted.
    const result = await kitNotify(stripe, body.data.checkout_id, body.data.offer_id, body.data.payment_intent_id);
    if (result && typeof result === "object" && "skipped" in result && result.skipped) {
      console.error("kit purchase notify skipped", JSON.stringify(result));
    }
    return json(result);
  } catch (error) {
    console.error("kit purchase notify failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "Purchase notification could not be confirmed" }, 502);
  }
});
