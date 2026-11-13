import { corsHeaders, json, requireAdmin } from "../_shared/admin-auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const gate = await requireAdmin(req);
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
    return json({ text: data.text ?? "" });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});