// Cron worker: retries queued/retrying menu automation events that are due.
// Safe to call without auth: it only advances already-stored jobs and
// returns a count, never job data.
import { processEvent, serviceClient } from "../_shared/ghl.ts";

Deno.serve(async () => {
  const sb = serviceClient();
  const { data: due } = await sb.from("menu_automation_events").select("*")
    .in("status", ["queued", "retrying"]).lte("next_run_at", new Date().toISOString())
    .order("next_run_at").limit(25);
  for (const ev of due ?? []) await processEvent(sb, ev);
  return new Response(JSON.stringify({ processed: (due ?? []).length }), { headers: { "Content-Type": "application/json" } });
});
