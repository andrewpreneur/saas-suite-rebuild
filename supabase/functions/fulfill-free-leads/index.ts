import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logCustomerMessage } from "../_shared/journey-log.ts";
import { isPlatformAdminEmail } from "../_shared/platformAdmins.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WEBHOOK_URL = "https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/11748813-23af-49ba-b957-d9d7c08f5bb5";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userResp } = await userClient.auth.getUser();
    const callerEmail = userResp?.user?.email?.toLowerCase();
    if (!isPlatformAdminEmail(callerEmail)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const userEmail = String(body.user_email || "").trim().toLowerCase();
    const leadsUrl = String(body.leads_url || "").trim();
    if (!userEmail || !leadsUrl) {
      return new Response(JSON.stringify({ error: "user_email and leads_url required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: latest } = await admin
      .from("free_leads")
      .select("id")
      .ilike("user_email", userEmail)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latest) {
      await admin.from("free_leads")
        .update({ status: "delivered", leads_url: leadsUrl })
        .eq("id", latest.id);
    } else {
      return new Response(JSON.stringify({ error: "No free leads request found for this user" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const webhookResp = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "free_leads_delivered",
        user_email: userEmail,
        leads_url: leadsUrl,
        delivered_at: new Date().toISOString(),
      }),
    });
    await webhookResp.text();
    await logCustomerMessage({
      userEmail,
      channel: "webhook",
      templateKey: "free_leads_delivered",
      provider: "ghl",
      status: webhookResp.ok ? "sent" : "failed",
      source: "fulfill-free-leads",
      detail: webhookResp.ok ? null : `http_${webhookResp.status}`,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});