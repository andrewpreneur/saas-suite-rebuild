import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { logCustomerMessage } from "../_shared/journey-log.ts";

// New community post -> notify Andrew
const NEW_POST_WEBHOOK =
  "https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/104346a3-a72b-4c79-b466-945525039441";
// Reply / like -> notify the original poster (swap for a dedicated webhook when available)
const INTERACTION_WEBHOOK =
  "https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/da0754f4-2261-419f-9b7c-9d4f285fe8ab";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { event, post_id, comment_id, parent_comment_id } = await req.json().catch(() => ({}));
    const allowed = ["new_post", "post_comment", "comment_reply", "post_like", "comment_like"];
    if (!allowed.includes(event)) return json({ error: "invalid event" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return json({ error: "unauthorized" }, 401);

    const profileFor = async (id?: string | null) => {
      if (!id) return null;
      const { data } = await admin.from("community_profiles").select("id, display_name, email, handle").eq("id", id).maybeSingle();
      return data;
    };
    let actor = await profileFor(u.user.id);
    if (!actor && u.user.email) {
      const { data } = await admin.from("community_profiles").select("id, display_name, email, handle")
        .ilike("email", u.user.email.trim().toLowerCase()).maybeSingle();
      actor = data;
    }
    const actorOut = {
      name: actor?.display_name || u.user.user_metadata?.full_name || null,
      email: (actor?.email || u.user.email || "").toLowerCase() || null,
    };

    const { data: post } = post_id
      ? await admin.from("community_posts").select("id, title, body, author_id").eq("id", post_id).maybeSingle()
      : { data: null };
    if (!post) return json({ error: "post not found" }, 404);
    const postAuthor = await profileFor(post.author_id);

    let comment: any = null;
    if (comment_id) {
      const { data } = await admin.from("community_comments").select("id, body, author_id").eq("id", comment_id).maybeSingle();
      comment = data;
    }
    let parent: any = null;
    if (parent_comment_id) {
      const { data } = await admin.from("community_comments").select("id, body, author_id").eq("id", parent_comment_id).maybeSingle();
      parent = data;
    }

    // Who is being responded to
    let target = postAuthor;
    let targetContent = post.body;
    if (event === "comment_reply" && parent) { target = await profileFor(parent.author_id); targetContent = parent.body; }
    if (event === "comment_like" && comment) { target = await profileFor(comment.author_id); targetContent = comment.body; }

    const isNewPost = event === "new_post";
    if (!isNewPost && target?.id && target.id === actor?.id) return json({ ok: true, skipped: "self" });

    const payload = {
      event,
      post_id: post.id,
      post_title: post.title,
      post_body: post.body,
      post_author_name: postAuthor?.display_name ?? null,
      post_author_email: postAuthor?.email?.toLowerCase() ?? null,
      recipient_name: isNewPost ? null : target?.display_name ?? null,
      recipient_email: isNewPost ? null : target?.email?.toLowerCase() ?? null,
      recipient_content: isNewPost ? null : targetContent,
      actor_name: actorOut.name,
      actor_email: actorOut.email,
      reply_body: event === "post_comment" || event === "comment_reply" ? comment?.body ?? null : null,
      link: `https://saassuite.ai/app/community?post=${post.id}`,
      timestamp: new Date().toISOString(),
    };
    const res = await fetch(isNewPost ? NEW_POST_WEBHOOK : INTERACTION_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (!isNewPost) {
      await logCustomerMessage({
        userEmail: payload.recipient_email,
        channel: "webhook",
        templateKey: "community_interaction",
        provider: "ghl",
        status: res.ok ? "sent" : "failed",
        source: "community-notify",
        detail: res.ok ? event : `http_${res.status}`,
      });
    }
    return json({ ok: true, status: res.status });
  } catch (e) {
    console.error("community-notify error", e);
    return json({ error: e instanceof Error ? e.message : "error" }, 500);
  }
});
