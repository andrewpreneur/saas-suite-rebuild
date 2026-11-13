import { corsHeaders, json, requireAuthedUser } from "../_shared/user-auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const gate = await requireAuthedUser(req);
  if (!gate.ok) return gate.res;

  const apiKey = Deno.env.get("ELEVENLABS_ADMIN_VOICE_API_KEY");
  if (!apiKey) return json({ error: "ELEVENLABS_ADMIN_VOICE_API_KEY not set" }, 500);

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return json({ error: "file required" }, 400);
    if (file.size < 1024) return json({ error: "recording too short — try again" }, 400);

    const upstream = new FormData();
    upstream.append("file", file, file.name || "recording.webm");
    upstream.append("model_id", "scribe_v1");
    upstream.append("language_code", "eng");

    const resp = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: upstream,
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.error("ElevenLabs STT error", resp.status, errText);
      return json({ error: "STT failed", status: resp.status, details: errText }, 502);
    }

    const data = await resp.json();
    const raw = String(data.text ?? "").trim();

    // Drop transcripts that are clearly not speech: silence, noise descriptors,
    // single-punctuation blips, or parenthetical annotations like
    // "(background noise)", "(air conditioner hums)", "(silence)".
    const cleaned = raw
      .replace(/[\u2018\u2019\u201C\u201D]/g, "'")
      .trim();

    const isParentheticalNoise = /^\s*[\[\(][^\)\]]{0,120}[\)\]]\s*$/.test(cleaned);
    const looksLikeNoiseWord = /^(um+|uh+|hmm+|mm+|hm+|ah+|oh+|\.|,|\?|!|-)\s*$/i.test(cleaned);
    const tooShort = cleaned.replace(/[^a-zA-Z0-9]/g, "").length < 3;

    if (!cleaned || isParentheticalNoise || looksLikeNoiseWord || tooShort) {
      console.log("STT: dropping non-speech transcript:", JSON.stringify(raw));
      return json({ text: "", dropped: true, reason: "non_speech" });
    }

    return json({ text: cleaned });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});