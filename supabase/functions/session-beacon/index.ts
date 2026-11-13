import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { sessionBeaconCors } from "./cors.ts";

// Accepts POST bodies delivered by navigator.sendBeacon (which cannot send
// PATCH or auth headers) so activity events survive tab close / navigation.
// sendBeacon uses credentials: "include", so the origin is echoed. A wildcard
// Access-Control-Allow-Origin makes the browser drop the beacon.
Deno.serve(async (req) => {
  const corsHeaders = sessionBeaconCors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const raw = await req.text();
    const body = raw ? JSON.parse(raw) : {};
    const sessionId: string | undefined = body.sessionId;
    const events = Array.isArray(body.events) ? body.events : null;
    const finalize = body.finalize === true;

    if (!sessionId) {
      return new Response(JSON.stringify({ error: "sessionId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: existing } = await supabase
      .from("user_activity_sessions")
      .select("id, status, session_ended_at, events")
      .eq("id", sessionId)
      .maybeSingle();

    if (!existing) {
      return new Response(JSON.stringify({ ok: false, reason: "unknown session" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

    // Only grow the event list — never clobber a longer server-side copy
    if (events) {
      const current = Array.isArray(existing.events) ? existing.events : [];
      if (events.length >= current.length) update.events = events;
    }

    if (finalize && existing.status === "active") {
      update.status = "pending_analysis";
      update.session_ended_at = existing.session_ended_at ?? new Date().toISOString();
    }

    await supabase.from("user_activity_sessions").update(update).eq("id", sessionId);

    if (finalize) {
      // Analysis runs after the response so beacon delivery stays instant
      // @ts-ignore EdgeRuntime is provided by the Supabase runtime
      EdgeRuntime.waitUntil(
        supabase.functions.invoke("analyze-user-session", { body: { sessionId } }),
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[session-beacon]", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
