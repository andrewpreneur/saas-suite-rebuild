import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { deferGlobalHandoverRequested, notifyGlobalHandoverFromEnv } from "../_shared/globalHandoverWebhook.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VALID_TRIGGERS = new Set([
  "video_completed",
  "existing_user_login",
  "new_user_login",
  "onboarding_checklist_completed",
  "ai_support_engaged",
  "human_handover",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const {
      agency_id,
      trigger_type,
      user_email,
      user_name,
      metadata,
    } = body as {
      agency_id?: string;
      trigger_type?: string;
      user_email?: string;
      user_name?: string;
      metadata?: Record<string, unknown>;
    };

    if (!agency_id || !trigger_type || !VALID_TRIGGERS.has(trigger_type)) {
      return new Response(
        JSON.stringify({ error: "agency_id and valid trigger_type required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Strip any "NO" suspension suffix
    const cleanAgencyId = agency_id.replace(/NO$/i, "");

    // Client hub and embeds call this for every agency (fire-platform-event
    // forwards human_handover here before the Advanced-plan workflow check).
    // A Copilot "test this workflow" call is not a customer asking for a person.
    // defer_global_handover on the body or in metadata holds this POST until
    // support-handover-alert sends the customer's real issue.
    const meta = metadata && typeof metadata === "object" ? metadata : {};
    if (
      trigger_type === "human_handover" &&
      meta.source !== "AI CoPilot manual trigger" &&
      !deferGlobalHandoverRequested(body)
    ) {
      const lastMessage = typeof meta.last_message === "string" ? meta.last_message
        : typeof meta.message === "string" ? meta.message
        : typeof meta.reason === "string" ? meta.reason : null;
      try {
        await notifyGlobalHandoverFromEnv({
          event: "handover_requested",
          agencyId: cleanAgencyId,
          customerEmail: user_email || null,
          customerName: user_name || null,
          userIdentifier: user_email || user_name || null,
          lastCustomerMessage: lastMessage,
        }, supabase);
      } catch (handoverError) {
        console.error("global handover webhook failed", handoverError);
      }
    }

    // Look up workflow across all agency_id columns
    const { data: owner } = await supabase
      .from("saas_suite_users")
      .select("email, plan, agency_id, agency_id_basic, agency_id_advanced, agency_id_elite")
      .or(
        `agency_id.eq.${cleanAgencyId},agency_id_basic.eq.${cleanAgencyId},agency_id_advanced.eq.${cleanAgencyId},agency_id_elite.eq.${cleanAgencyId}`
      )
      .maybeSingle();

    if (!owner) {
      return new Response(JSON.stringify({ ok: true, skipped: "agency not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (owner.plan !== "ADVANCED") {
      return new Response(JSON.stringify({ ok: true, skipped: "not on ADVANCED plan" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try each agency_id variant to find the workflow
    const candidates = [
      owner.agency_id,
      owner.agency_id_basic,
      owner.agency_id_advanced,
      owner.agency_id_elite,
    ].filter(Boolean) as string[];

    const { data: workflows } = await supabase
      .from("workflows")
      .select("agency_id, webhook_url, enabled, slack_enabled")
      .in("agency_id", candidates)
      .eq("trigger_type", trigger_type)
      .eq("enabled", true);

    const wf = workflows?.[0];
    if (!wf) {
      return new Response(JSON.stringify({ ok: true, skipped: "no workflow configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = {
      trigger_type,
      agency_id: cleanAgencyId,
      owner_email: owner.email,
      email: user_email ?? null,
      name: user_name ?? null,
      metadata: metadata ?? {},
      timestamp: new Date().toISOString(),
    };

    // Track handover state for the admin support page
    if (trigger_type === "human_handover" && user_email) {
      try {
        await supabase.rpc("mark_handover_requested", {
          _agency_id: cleanAgencyId,
          _user_identifier: user_email,
        });
      } catch (err) {
        console.error("mark_handover_requested failed:", err);
      }
    }

    // 1) Webhook fan-out
    let webhookStatus: number | null = null;
    if (wf.webhook_url && wf.webhook_url.trim().length > 0) {
      try {
        const res = await fetch(wf.webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        webhookStatus = res.status;
      } catch (err) {
        console.error("webhook post failed:", err);
      }
    }

    // 2) Slack fan-out (via slack-notify)
    let slackStatus: number | null = null;
    if (wf.slack_enabled) {
      const slackToken = Deno.env.get("SLACK_NOTIFY_TOKEN");
      if (!slackToken) {
        console.warn("SLACK_NOTIFY_TOKEN not configured; skipping Slack dispatch");
      } else {
        // Map workflow trigger_type → slack-notify event_type
        const eventMap: Record<string, string> = {
          video_completed: "video_completed",
          existing_user_login: "user_login",
          new_user_login: "user_login",
          ai_support_engaged: "support_started",
          human_handover: "human_handover",
          onboarding_checklist_completed: "onboarding_checklist_completed",
        };
        const event_type = eventMap[trigger_type] ?? trigger_type;
        const data: Record<string, unknown> = {
          user_email: user_email ?? null,
          user_name: user_name ?? null,
          ...(metadata ?? {}),
        };
        if (trigger_type === "new_user_login") data.is_new_user = true;

        try {
          const notifyRes = await fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/slack-notify`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${slackToken}`,
              },
              body: JSON.stringify({
                agency_id: cleanAgencyId,
                event_type,
                data,
              }),
            },
          );
          slackStatus = notifyRes.status;
          if (!notifyRes.ok) {
            const errBody = await notifyRes.text();
            console.error("slack-notify failed:", notifyRes.status, errBody);
          }
        } catch (err) {
          console.error("slack-notify call failed:", err);
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        dispatched: true,
        webhook_status: webhookStatus,
        slack_status: slackStatus,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("dispatch-workflow error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});