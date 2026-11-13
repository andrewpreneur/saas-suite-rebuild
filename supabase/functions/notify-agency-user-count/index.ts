import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WEBHOOK_URL =
  "https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/bf449f14-652a-4706-b0f4-a03f677e49bb";

interface Payload {
  agency_id?: string;
  owner_email?: string;
  new_user_email?: string;
  new_user_name?: string;
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
    const { agency_id, owner_email: providedEmail, new_user_email, new_user_name } = body;

    if (!agency_id && !providedEmail) {
      return new Response(
        JSON.stringify({ error: "agency_id or owner_email required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the owner of this agency (across all tier variants)
    let owner: any = null;

    if (providedEmail) {
      const { data } = await supabase
        .from("saas_suite_users")
        .select(
          "email, full_name, agency_name, plan, agency_id, agency_id_basic, agency_id_advanced, agency_id_elite, original_agency_id, original_agency_id_basic, original_agency_id_advanced, original_agency_id_elite"
        )
        .ilike("email", providedEmail)
        .maybeSingle();
      owner = data;
    } else if (agency_id) {
      const { data } = await supabase
        .from("saas_suite_users")
        .select(
          "email, full_name, agency_name, plan, agency_id, agency_id_basic, agency_id_advanced, agency_id_elite, original_agency_id, original_agency_id_basic, original_agency_id_advanced, original_agency_id_elite"
        )
        .or(
          `agency_id.eq.${agency_id},agency_id_basic.eq.${agency_id},agency_id_advanced.eq.${agency_id},agency_id_elite.eq.${agency_id},original_agency_id.eq.${agency_id},original_agency_id_basic.eq.${agency_id},original_agency_id_advanced.eq.${agency_id},original_agency_id_elite.eq.${agency_id}`
        )
        .maybeSingle();
      owner = data;
    }

    if (!owner || !owner.email) {
      console.log("No owner found for", { agency_id, providedEmail });
      return new Response(
        JSON.stringify({ skipped: true, reason: "owner not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Aggregate unique client count across all the owner's agency IDs
    const agencyIds = Array.from(
      new Set(
        [
          owner.agency_id,
          owner.agency_id_basic,
          owner.agency_id_advanced,
          owner.agency_id_elite,
          owner.original_agency_id,
          owner.original_agency_id_basic,
          owner.original_agency_id_advanced,
          owner.original_agency_id_elite,
        ].filter(Boolean)
      )
    );

    const uniqueClientIds = new Set<string>();
    for (const aid of agencyIds) {
      const { data } = await supabase.rpc("get_agency_clients", { p_agency_id: aid as string });
      if (Array.isArray(data)) {
        for (const c of data) uniqueClientIds.add((c as any).user_id);
      }
    }

    const agency_user_count = uniqueClientIds.size;

    // The hub often saves the row first and fills in name/email a moment later,
    // so re-read the newest row for this agency before deciding who it is.
    let trimmedName = (new_user_name || "").trim();
    let trimmedEmail = (new_user_email || "").trim();
    if ((!trimmedName || !trimmedEmail) && agency_id) {
      await new Promise((r) => setTimeout(r, 2500));
      const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const { data: fresh } = await supabase
        .from("user_progress")
        .select("email, name")
        .eq("agency_id", agency_id)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (fresh) {
        trimmedName = trimmedName || (fresh.name || "").trim();
        trimmedEmail = trimmedEmail || (fresh.email || "").trim();
      }
      console.log("notify-agency-user-count re-read", { agency_id, hasName: !!trimmedName, hasEmail: !!trimmedEmail });
    }
    const isGuest =
      !trimmedEmail && (!trimmedName || /^guest\s*user/i.test(trimmedName));

    const webhookPayload: Record<string, unknown> = {
      owner_email: owner.email,
      full_name: owner.full_name || null,
      agency_name: owner.agency_name || null,
      ss_plan: owner.plan || null,
      agency_user_count,
      timestamp: new Date().toISOString(),
    };

    if (!isGuest) {
      webhookPayload.new_user_email = trimmedEmail || null;
      webhookPayload.new_user_name = trimmedName || null;
    }

    console.log("Posting to LeadConnector:", webhookPayload);

    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(webhookPayload),
    });

    const text = await res.text();
    console.log("Webhook response:", res.status, text);

    // Default Slack fan-out: fire "user_login" (new account onboarded)
    // for every real end-user creation. Skips silently if the agency has
    // no Slack install or no SLACK_NOTIFY_TOKEN configured.
    if (!isGuest && (trimmedEmail || trimmedName)) {
      try {
        await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/slack-auto-notify`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agency_id: agencyIds[0] ?? agency_id,
              event_type: "user_login",
              data: {
                user_email: trimmedEmail || null,
                user_name: trimmedName || null,
                is_new_user: true,
              },
            }),
          },
        );
      } catch (slackErr) {
        console.error("slack-auto-notify (new user) failed:", slackErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, agency_user_count, webhook_status: res.status }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("notify-agency-user-count error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
