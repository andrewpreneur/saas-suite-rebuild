import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function examplePayload(trigger: string, agency_id: string, owner_email: string) {
  const base = {
    test: true,
    trigger_type: trigger,
    agency_id,
    owner_email,
    email: "jane.doe@example.com",
    name: "Jane Doe",
    timestamp: new Date().toISOString(),
  };
  switch (trigger) {
    case "video_completed":
      return { ...base, metadata: { video_title: "Welcome to the Platform", video_id: "welcome-1", category: "Getting Started", duration_seconds: 142 } };
    case "existing_user_login":
      return { ...base, metadata: { login_count: 7, last_login: new Date(Date.now() - 86400000).toISOString() } };
    case "new_user_login":
      return { ...base, metadata: { signup_at: new Date().toISOString(), first_login: true } };
    case "onboarding_checklist_completed":
      return { ...base, metadata: { items_completed: 5, completed_at: new Date().toISOString() } };
    case "ai_support_engaged":
      return { ...base, metadata: { message: "How do I connect my domain?", session_id: "sess_example_123" } };
    case "human_handover":
      return { ...base, metadata: { reason: "User requested a human", last_message: "Can I talk to a real person?", session_id: "sess_example_123" } };
    default:
      return base;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { webhook_url, trigger_type, agency_id, owner_email } = await req.json();

    if (!webhook_url || typeof webhook_url !== "string" || !/^https?:\/\//i.test(webhook_url)) {
      return new Response(JSON.stringify({ ok: false, error: "Valid webhook_url is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!trigger_type) {
      return new Response(JSON.stringify({ ok: false, error: "trigger_type is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = examplePayload(trigger_type, agency_id || "test-agency", owner_email || "owner@example.com");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let status = 0;
    let responseText = "";
    try {
      const res = await fetch(webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      status = res.status;
      responseText = (await res.text()).slice(0, 500);
    } finally {
      clearTimeout(timeout);
    }

    const ok = status >= 200 && status < 300;
    return new Response(JSON.stringify({ ok, status, response: responseText, payload }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});