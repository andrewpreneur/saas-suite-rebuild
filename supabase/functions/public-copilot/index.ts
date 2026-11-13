// Public, signed-out Copilot chat for saassuite.ai/copilot.
// Actions: history (visitor), chat (visitor, rate-limited), claim (signed-in: moves the
// visitor's chat into a new /app/copilot thread owned by the account).
import { corsHeaders, json, serviceClient, requireAuthedUser } from "../_shared/user-auth.ts";
import { publicSystemPrompt, sanitizePublicReply, isOverDailyLimit, publicDailyMessageLimit, publicMenuIntro, publicChosenName, publicSnapshotReply } from "../_shared/publicCopilotPolicy.ts";
import { ensureBookingOffer } from "../_shared/bookingOffer.ts";
import { createSnapshotRedactor, redactSnapshotSecrets } from "../_shared/snapshotAccess.ts";
import { readCompletion } from "../chat-copilot/workspaceStream.ts";

const VISITOR_RE = /^[a-f0-9-]{20,64}$/i;

async function hashIp(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown").split(",")[0].trim();
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("ss-public-copilot:" + ip));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "chat");
    const visitorId = String(body.visitorId || "");
    if (!VISITOR_RE.test(visitorId)) return json({ error: "Invalid visitor" }, 400);
    const db = serviceClient();

    const loadHistory = async () => {
      const { data } = await db.from("public_copilot_messages").select("id, role, content, created_at")
        .eq("visitor_id", visitorId).is("claimed_by", null).order("created_at").limit(1000);
      return data ?? [];
    };

    if (action === "history") return json({ messages: await loadHistory() });

    if (action === "claim") {
      const auth = await requireAuthedUser(req);
      if (!auth.ok) return auth.res;
      const history = await loadHistory();
      if (!history.length) return json({ threadId: null });
      const firstUser = history.find((m) => m.role === "user")?.content || "Chat from saassuite.ai";
      const { data: thread, error } = await db.from("copilot_threads")
        .insert({ owner_email: auth.email, title: String(firstUser).slice(0, 60), kind: "chat" }).select("id").single();
      if (error || !thread) return json({ error: "Could not save chat" }, 500);
      await db.from("copilot_thread_messages").insert(history.map((m) => ({ thread_id: thread.id, role: m.role, content: m.content, created_at: m.created_at })));
      await db.from("public_copilot_messages").update({ claimed_by: auth.email, claimed_thread_id: thread.id })
        .eq("visitor_id", visitorId).is("claimed_by", null);
      const name = publicChosenName(history);
      if (name) await db.from("copilot_preferences").upsert({ owner_email: auth.email, assistant_name: name }, { onConflict: "owner_email", ignoreDuplicates: true });
      return json({ threadId: thread.id });
    }

    // chat
    const content = String(body.content || "").trim().slice(0, 2000);
    if (!content) return json({ error: "Empty message" }, 400);
    const ipHash = await hashIp(req);
    const since = new Date(Date.now() - 86400000).toISOString();
    const [{ count: byVisitor }, { count: byIp }] = await Promise.all([
      db.from("public_copilot_messages").select("id", { count: "exact", head: true }).eq("visitor_id", visitorId).eq("role", "user").gte("created_at", since),
      db.from("public_copilot_messages").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).eq("role", "user").gte("created_at", since),
    ]);
    const now = Date.now();
    const limit = publicDailyMessageLimit(now);
    if (isOverDailyLimit(Math.max(byVisitor ?? 0, byIp ?? 0), now)) {
      return json({ limited: true, limit, content: `You've reached today's ${limit} free messages. Sign in (it's free) to keep chatting — your conversation comes with you.\n[[widget:signin]]` });
    }

    const history = await loadHistory();
    await db.from("public_copilot_messages").insert({ visitor_id: visitorId, ip_hash: ipHash, role: "user", content });

    const focus = typeof body.focus === "string" ? body.focus.slice(0, 80) : null;
    const intro = publicMenuIntro(history, content, focus, body.nameChoice);
    if (intro) {
      const { data: saved } = await db.from("public_copilot_messages").insert({ visitor_id: visitorId, ip_hash: ipHash, role: "assistant", content: intro.content }).select("id").single();
      return json({ ...intro, id: saved?.id });
    }

    const finishPublic = (text: string) => ensureBookingOffer(
      sanitizePublicReply(redactSnapshotSecrets(text, false), content, focus),
      content,
      { widget: true },
    );
    const snapshotReply = publicSnapshotReply(focus, content);
    if (snapshotReply) {
      const reply = finishPublic(snapshotReply);
      const { data: saved } = await db.from("public_copilot_messages").insert({ visitor_id: visitorId, ip_hash: ipHash, role: "assistant", content: reply }).select("id").single();
      return json({ content: reply, id: saved?.id });
    }

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) throw new Error("LOVABLE_API_KEY missing");
    const isMobile = !!body.client?.isMobile;
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Lovable-API-Key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        stream: true,
        messages: [
          { role: "system", content: publicSystemPrompt({ isMobile, focus }) },
          ...history.slice(-12).map((m) => ({ role: m.role, content: redactSnapshotSecrets(m.content, false) })),
          { role: "user", content: redactSnapshotSecrets(content, false) },
        ],
      }),
    });
    if (resp.status === 429) return json({ error: "Busy right now, try again in a moment." }, 429);
    if (resp.status === 402) return json({ error: "Copilot is temporarily unavailable." }, 402);
    if (!resp.ok) throw new Error(`AI ${resp.status}`);
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const emit = (event: Record<string, unknown>) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        const redactor = createSnapshotRedactor(false);
        let raw = "";
        try {
          await readCompletion(resp, (delta) => {
            raw += delta;
            const safe = redactor.push(delta);
            if (safe) emit({ type: "delta", text: safe });
          });
          const tail = redactor.flush();
          if (tail) emit({ type: "delta", text: tail });
          const reply = finishPublic(raw || "Sorry, I couldn't answer that. Try again?");
          const visible = redactSnapshotSecrets(raw, false);
          if (reply !== visible) emit({ type: "replace", text: reply });
          const { data: saved } = await db.from("public_copilot_messages").insert({ visitor_id: visitorId, ip_hash: ipHash, role: "assistant", content: reply }).select("id").single();
          emit({ type: "done", id: saved?.id });
        } catch (error) {
          console.error("public-copilot stream", error);
          emit({ type: "error", message: "Something went wrong. Please try again." });
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  } catch (e) {
    console.error("public-copilot", e);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
