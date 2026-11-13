import { corsHeaders, json, requireAdmin } from "../_shared/admin-auth.ts";

const DEFAULT_VOICE = "JBFqnCBsd6RMkjVDRZzb"; // George

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;

  const apiKey = Deno.env.get("ELEVENLABS_ADMIN_VOICE_API_KEY");
  if (!apiKey) return json({ error: "ELEVENLABS_ADMIN_VOICE_API_KEY not set" }, 500);

  try {
    const body = await req.json();
    // List voices shortcut
    if (body?.action === "list_voices") {
      const r = await fetch("https://api.elevenlabs.io/v2/voices?page_size=100", {
        headers: { "xi-api-key": apiKey },
      });
      const j = await r.json();
      return json(j, r.status);
    }
    const { text, voiceId, modelId, settings } = body ?? {};
    if (!text || typeof text !== "string") return json({ error: "text required" }, 400);

    const clamp = (n: unknown, min: number, max: number, d: number) => {
      const v = typeof n === "number" ? n : d;
      return Math.min(max, Math.max(min, v));
    };
    const voice = voiceId || DEFAULT_VOICE;
    const model = typeof modelId === "string" && modelId ? modelId : "eleven_turbo_v2_5";
    const voice_settings = {
      stability: clamp(settings?.stability, 0, 1, 0.4),
      similarity_boost: clamp(settings?.similarity_boost, 0, 1, 0.75),
      style: clamp(settings?.style, 0, 1, 0.3),
      use_speaker_boost: settings?.use_speaker_boost !== false,
      speed: clamp(settings?.speed, 0.7, 1.2, 1.05),
    };

    const resp = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}/stream?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text, model_id: model, voice_settings }),
      },
    );

    if (!resp.ok || !resp.body) {
      const errText = await resp.text().catch(() => "");
      console.error("ElevenLabs TTS error", resp.status, errText);
      return json({ error: "TTS failed", status: resp.status, details: errText }, 502);
    }

    return new Response(resp.body, {
      headers: { ...corsHeaders, "Content-Type": "audio/mpeg" },
    });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});