import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isPlatformAdminEmail } from "../_shared/platformAdmins.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WEBHOOK_URL = "https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/8b1d0a0f-0d9e-4466-8c23-0245bddf9f3d";

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
    const warmedDomain = String(body.warmed_domain || "").trim();
    if (!userEmail || !warmedDomain) {
      return new Response(JSON.stringify({ error: "user_email and warmed_domain required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Update most recent warmup request for this user
    const { data: latest } = await admin
      .from("email_warmup_requests")
      .select("id")
      .ilike("user_email", userEmail)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latest) {
      await admin.from("email_warmup_requests")
        .update({ status: "complete", warmed_domain: warmedDomain })
        .eq("id", latest.id);
    } else {
      await admin.from("email_warmup_requests").insert({
        user_email: userEmail,
        agency_name: "(admin fulfilled)",
        sender_name: "(admin fulfilled)",
        sender_email: warmedDomain,
        profile_image_link: "",
        status: "complete",
        warmed_domain: warmedDomain,
      });
    }

    // Fire webhook
    const webhookResp = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "email_warmup_complete",
        user_email: userEmail,
        warmed_domain: warmedDomain,
        completed_at: new Date().toISOString(),
      }),
    });
    await webhookResp.text();

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