import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  VIDEO_COMPLETED_DEDUPE_MS,
  isDuplicateVideoCompleted,
  videoIdentity,
} from "../_shared/educationVideoEvent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DISPATCH_URL =
  "https://auth.saassuite.ai/functions/v1/dispatch-workflow";

// Triggers we accept directly from the client (login is special-cased)
const VALID_TRIGGERS = new Set([
  "login",
  "new_user_login",
  "existing_user_login",
  "video_completed",
  "onboarding_checklist_completed",
  "ai_support_engaged",
  "human_handover",
]);

// Triggers that should only ever fire ONCE per (agency_id, user) combination
const ONCE_PER_USER = new Set([
  "onboarding_checklist_completed",
  "ai_support_engaged",
]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    let {
      agency_id,
      trigger_type,
      user_email,
      user_name,
      metadata,
    } = body ?? {};

    if (!agency_id || !trigger_type) {
      return json({ error: "agency_id and trigger_type are required" }, 400);
    }
    if (!VALID_TRIGGERS.has(trigger_type)) {
      return json({ error: `Unknown trigger_type: ${trigger_type}` }, 400);
    }

    user_email = user_email ? String(user_email).toLowerCase().trim() : null;
    user_name = user_name ? String(user_name).trim() : null;
    metadata = metadata && typeof metadata === "object" ? metadata : {};

    if (!user_email && !user_name) {
      return json({ error: "user_email or user_name is required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve "login" to new_user_login or existing_user_login
    if (trigger_type === "login") {
      const { data: prior, error: priorErr } = await supabase
        .from("platform_events")
        .select("id")
        .eq("agency_id", agency_id)
        .in("trigger_type", ["new_user_login", "existing_user_login", "login"])
        .or(
          user_email
            ? `user_email.eq.${user_email}`
            : `user_name.eq.${user_name}`,
        )
        .limit(1);
      if (priorErr) console.error("login lookup error:", priorErr);
      trigger_type = prior && prior.length > 0
        ? "existing_user_login"
        : "new_user_login";
    }

    // Education and onboarding both reach this function for one new completion.
    // Ignore the second call for the same video inside a short window.
    if (trigger_type === "video_completed") {
      const incoming = videoIdentity(metadata);
      if (incoming && (user_email || user_name)) {
        const since = new Date(Date.now() - VIDEO_COMPLETED_DEDUPE_MS).toISOString();
        let recent = supabase
          .from("platform_events")
          .select("metadata, created_at")
          .eq("agency_id", agency_id)
          .eq("trigger_type", "video_completed")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(25);
        recent = user_email
          ? recent.eq("user_email", user_email)
          : recent.eq("user_name", user_name);
        const { data: priorRows, error: priorVideoErr } = await recent;
        if (priorVideoErr) console.error("video_completed dedupe lookup error:", priorVideoErr);
        const duplicate = (priorRows ?? []).some((row) =>
          isDuplicateVideoCompleted({
            incoming,
            prior: videoIdentity(row.metadata),
            priorCreatedAt: row.created_at,
          })
        );
        if (duplicate) return json({ success: true, skipped: "already_fired" });
      }
    }

    // Once-per-user dedupe
    if (ONCE_PER_USER.has(trigger_type)) {
      const { data: prior } = await supabase
        .from("platform_events")
        .select("id")
        .eq("agency_id", agency_id)
        .eq("trigger_type", trigger_type)
        .or(
          user_email
            ? `user_email.eq.${user_email}`
            : `user_name.eq.${user_name}`,
        )
        .limit(1);
      if (prior && prior.length > 0) {
        return json({ success: true, skipped: "already_fired" });
      }
    }

    // Log it
    const { error: insertErr } = await supabase
      .from("platform_events")
      .insert({
        agency_id,
        user_email,
        user_name,
        trigger_type,
        metadata,
      });
    if (insertErr) console.error("platform_events insert error:", insertErr);

    // Forward to the dispatch-workflow endpoint
    let dispatched = false;
    let dispatchStatus: number | null = null;
    try {
      const res = await fetch(DISPATCH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agency_id,
          trigger_type,
          user_email,
          user_name,
          metadata,
        }),
      });
      dispatched = res.ok;
      dispatchStatus = res.status;
      if (!res.ok) {
        console.error(
          `dispatch-workflow ${res.status}:`,
          await res.text().catch(() => ""),
        );
      }
    } catch (e) {
      console.error("dispatch-workflow call failed:", e);
    }

    return json({
      success: true,
      trigger_type,
      dispatched,
      dispatch_status: dispatchStatus,
    });
  } catch (err) {
    console.error("fire-platform-event error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
