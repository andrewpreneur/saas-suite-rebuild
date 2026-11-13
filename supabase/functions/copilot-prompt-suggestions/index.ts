import { corsHeaders, json, requireAdmin, serviceClient } from "../_shared/admin-auth.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const MODEL = "google/gemini-2.5-flash";

const SYSTEM = `You are a prompt engineer reviewing the SaaSSuite "AI CoPilot" assistant.

You receive:
1. Messages the platform owner (Andrew) rated THUMBS DOWN, each with the user's question, the CoPilot's bad answer, the owner's corrected answer, and notes.
2. Messages rated THUMBS UP (good behaviour worth preserving).

Produce concrete, copy-pasteable changes to the CoPilot's system prompt.

Return STRICT JSON only, no markdown fence:
{
  "themes": [
    {
      "title": "short theme name",
      "problem": "what the CoPilot keeps getting wrong, 1-2 sentences",
      "evidence_count": 3,
      "prompt_snippet": "the exact instruction line(s) to add or change in the system prompt",
      "severity": "high" | "medium" | "low"
    }
  ],
  "keep_doing": ["short bullets of behaviour the up-votes show is working"],
  "summary": "2-3 sentence overall read"
}

Rules:
- 2 to 6 themes, ordered most impactful first. Group similar failures into one theme.
- prompt_snippet must be imperative instruction text for the assistant, not a description of the fix.
- Ground every theme in the supplied examples. If there is not enough data, say so in summary and return fewer themes.
- Never invent product facts. If a correction states a fact, reuse that exact fact in the snippet.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;

  try {
    const sb = serviceClient();

    const { data: ratings, error } = await sb
      .from("copilot_message_ratings")
      .select("rating, question_text, answer_text, corrected_answer, notes, owner_email, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;

    const downs = (ratings ?? []).filter((r: any) => r.rating === "down");
    const ups = (ratings ?? []).filter((r: any) => r.rating === "up");

    if (downs.length === 0 && ups.length === 0) {
      return json({
        themes: [],
        keep_doing: [],
        summary:
          "No rated CoPilot messages yet. Thumbs-down a few bad answers (and add the correct reply) and suggestions will appear here.",
        counts: { down: 0, up: 0 },
      });
    }

    const trim = (s: unknown, n = 1200) => String(s ?? "").slice(0, n);
    const payload = {
      thumbs_down: downs.slice(0, 60).map((r: any) => ({
        question: trim(r.question_text),
        bad_answer: trim(r.answer_text),
        corrected_answer: trim(r.corrected_answer),
        notes: trim(r.notes, 400),
      })),
      thumbs_up: ups.slice(0, 30).map((r: any) => ({
        question: trim(r.question_text, 400),
        good_answer: trim(r.answer_text, 600),
      })),
    };

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: JSON.stringify(payload) },
        ],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("Gateway error:", resp.status, text);
      return json(
        { error: `AI gateway ${resp.status}`, details: text },
        resp.status === 402 || resp.status === 429 ? resp.status : 502,
      );
    }

    const data = await resp.json();
    const raw: string = data.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : { themes: [], keep_doing: [], summary: cleaned };
    }

    return json({
      themes: Array.isArray(parsed.themes) ? parsed.themes : [],
      keep_doing: Array.isArray(parsed.keep_doing) ? parsed.keep_doing : [],
      summary: String(parsed.summary ?? ""),
      counts: { down: downs.length, up: ups.length },
    });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
