import { corsHeaders, json, requireAuthedUser, serviceClient } from "../_shared/user-auth.ts";

const HANDOVER_WEBHOOK =
  "https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/f8f632ef-674a-45b2-929d-5342c0b42ba9";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await requireAuthedUser(req);
  if (!auth.ok) return auth.res;

  let body: { item_id?: unknown; item_title?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const itemId = typeof body.item_id === "string" ? body.item_id.trim().slice(0, 200) : "";
  const itemTitle = typeof body.item_title === "string" ? body.item_title.trim().slice(0, 300) : "";
  if (!itemId) return json({ error: "item_id is required" }, 400);

  const sb = serviceClient();


  const { error } = await sb.from("academy_notify_requests").upsert(
    { email: auth.email, item_id: itemId, item_title: itemTitle || null },
    { onConflict: "email,item_id" },
  );
  if (error) return json({ error: error.message }, 500);

  try {
    await fetch(HANDOVER_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "academy_video_notify_request",
        email: auth.email,
        item_id: itemId,
        item_title: itemTitle,
        reason: `User requested a notification when the community lesson "${itemTitle || itemId}" drops.`,
        requested_at: new Date().toISOString(),
      }),
    });
  } catch (e) {
    console.error("notify webhook failed:", e);
  }

  return json({ ok: true });
});
