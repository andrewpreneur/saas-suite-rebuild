import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WEBHOOK_URL =
  "https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/9dd2ea5f-f718-4aa1-adb1-68d908a9e2b6";

interface Payload {
  owner_email?: string;
  old_agency_id?: string | null;
  new_agency_id?: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body: Payload = await req.json().catch(() => ({}));
    const { owner_email, old_agency_id, new_agency_id } = body;

    if (!owner_email) {
      return new Response(
        JSON.stringify({ error: "owner_email required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: owner } = await supabase
      .from("saas_suite_users")
      .select("email, full_name, agency_name, agency_id")
      .ilike("email", owner_email)
      .maybeSingle();

    if (!owner || !owner.email) {
      console.log("No owner found for", owner_email);
      return new Response(
        JSON.stringify({ skipped: true, reason: "owner not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const webhookPayload = {
      event: "agency_id_changed",
      owner_email: owner.email,
      full_name: owner.full_name || null,
      agency_name: owner.agency_name || null,
      old_agency_id: old_agency_id ?? null,
      new_agency_id: new_agency_id ?? owner.agency_id ?? null,
      timestamp: new Date().toISOString(),
    };

    console.log("Posting agency_id change to LeadConnector:", webhookPayload);

    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(webhookPayload),
    });

    const text = await res.text();
    console.log("Webhook response:", res.status, text);

    return new Response(
      JSON.stringify({ success: true, webhook_status: res.status }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("notify-agency-id-change error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
