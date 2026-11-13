import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_TARGETS = [
  "prompt_personality",
  "prompt_goals",
  "prompt_additional_instructions",
  "prompt_training_doc",
  "general",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const secret = Deno.env.get("COPILOT_WEBHOOK_SECRET");
    if (!secret) {
      return new Response(JSON.stringify({ error: "Server not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const provided = req.headers.get("x-webhook-secret");
    if (!provided || provided !== secret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      owner_email,
      message,
      target_field,
      operation,
      source,
      metadata,
    } = body as Record<string, unknown>;

    if (typeof owner_email !== "string" || !owner_email.includes("@")) {
      return new Response(
        JSON.stringify({ error: "owner_email is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (typeof message !== "string" || message.trim().length === 0) {
      return new Response(JSON.stringify({ error: "message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let normalizedTarget: string | null = null;
    if (target_field !== undefined && target_field !== null && target_field !== "") {
      if (typeof target_field !== "string" || !ALLOWED_TARGETS.includes(target_field)) {
        return new Response(
          JSON.stringify({
            error: `target_field must be one of: ${ALLOWED_TARGETS.join(", ")}`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      normalizedTarget = target_field;
    }

    const op = operation === "replace" ? "replace" : "append";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("copilot_pending_suggestions")
      .insert({
        owner_email: owner_email.toLowerCase().trim(),
        message: message.trim(),
        target_field: normalizedTarget,
        operation: op,
        source: typeof source === "string" ? source : "webhook",
        metadata: metadata && typeof metadata === "object" ? metadata : {},
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("Insert error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, suggestion_id: data.id }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("copilot-webhook error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
