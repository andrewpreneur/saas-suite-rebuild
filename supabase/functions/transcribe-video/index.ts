import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isPlatformAdminEmail } from "../_shared/platformAdmins.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TranscribeBody {
  video_id?: string;
  video_ids?: string[];
  agency_id?: string;
  target_email?: string;
  mode?: "list" | "preflight" | "preflight_one" | "transcribe_one" | "batch";
}

interface VideoResult {
  video_id: string;
  title?: string;
  transcribed: boolean;
  status: "success" | "failed";
  error?: string;
}

interface VideoRow {
  id: string;
  agency_id: string;
  title: string;
  video_url: string;
  is_embed: boolean;
}

interface PreflightResult {
  id: string;
  title: string;
  valid: boolean;
  error?: string;
}

const MEDIA_EXTENSION_RE = /\.(mp4|m4v|mov|webm|mp3|m4a|wav|aac|ogg|oga|flac)(\?|#|$)/i;
const PLAYER_PAGE_RE = /vimeo\.com|youtube\.com|youtu\.be|loom\.com|wistia/i;

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized.includes("@") ? normalized : null;
}

function timeoutSignal(ms: number): { signal: AbortSignal; cancel: () => void } {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, cancel: () => clearTimeout(timer) };
}

function filenameFromUrl(videoUrl: string, contentType: string | null): string {
  try {
    const pathname = new URL(videoUrl).pathname;
    const last = pathname.split("/").filter(Boolean).pop();
    if (last && /\.[a-z0-9]{2,5}$/i.test(last)) return last;
  } catch (_) { /* ignore */ }
  if (contentType?.includes("audio/mpeg")) return "audio.mp3";
  if (contentType?.includes("audio/wav")) return "audio.wav";
  if (contentType?.includes("audio/mp4")) return "audio.m4a";
  if (contentType?.includes("video/webm")) return "video.webm";
  if (contentType?.includes("video/quicktime")) return "video.mov";
  return "video.mp4";
}

async function downloadMedia(videoUrl: string): Promise<{ ok: true; blob: Blob; filename: string } | { ok: false; reason: string }> {
  const { signal, cancel } = timeoutSignal(120_000);
  try {
    const resp = await fetch(videoUrl, { method: "GET", signal });
    if (!resp.ok) return { ok: false, reason: `download_http_${resp.status}` };
    const contentType = resp.headers.get("content-type");
    const blob = await resp.blob();
    if (!blob.size) return { ok: false, reason: "download_empty_file" };
    return { ok: true, blob, filename: filenameFromUrl(videoUrl, contentType) };
  } catch (err) {
    const message = err instanceof Error && err.name === "AbortError" ? "download_timeout" : "download_exception";
    console.error("Media download failed:", err);
    return { ok: false, reason: message };
  } finally {
    cancel();
  }
}

async function transcribeOne(
  apiKey: string,
  videoUrl: string,
): Promise<{ ok: true; text: string; language: string | null } | { ok: false; reason: string }> {
  // Use ElevenLabs source_url so we never have to download the file into the
  // edge function's memory (which blows up the 256MB limit on larger videos).
  // We try source_url first; if ElevenLabs rejects the URL, we fall back to
  // streaming the file through ourselves as a last resort.
  try {
    const form = new FormData();
    form.append("model_id", "scribe_v2");
    form.append("source_url", videoUrl);
    form.append("tag_audio_events", "false");
    form.append("diarize", "false");
    form.append("timestamps_granularity", "none");

    const resp = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: form,
    });

    if (resp.ok) {
      const data = await resp.json();
      const text = (data?.text || "").toString().trim();
      if (!text) return { ok: false, reason: "empty_text" };
      return { ok: true, text, language: data?.language_code || null };
    }

    const errText = await resp.text().catch(() => "");
    console.error("ElevenLabs source_url error", resp.status, errText.slice(0, 500));

    // 4xx errors from source_url often mean the URL is unreachable from
    // ElevenLabs. Fall back to downloading & uploading ourselves, but only
    // for small files — for big files we just surface the error.
    if (resp.status >= 400 && resp.status < 500) {
      const media = await downloadMedia(videoUrl);
      if (!media.ok) return { ok: false, reason: media.reason };
      // Refuse files > 100MB to avoid OOM in the edge function.
      if (media.blob.size > 100 * 1024 * 1024) {
        return { ok: false, reason: `elevenlabs_${resp.status}` };
      }
      const form2 = new FormData();
      form2.append("model_id", "scribe_v2");
      form2.append("file", media.blob, media.filename);
      form2.append("tag_audio_events", "false");
      form2.append("diarize", "false");
      form2.append("timestamps_granularity", "none");
      const resp2 = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
        method: "POST",
        headers: { "xi-api-key": apiKey },
        body: form2,
      });
      if (!resp2.ok) {
        const errText2 = await resp2.text().catch(() => "");
        console.error("ElevenLabs file-upload fallback error", resp2.status, errText2.slice(0, 500));
        return { ok: false, reason: `elevenlabs_${resp2.status}` };
      }
      const data2 = await resp2.json();
      const text2 = (data2?.text || "").toString().trim();
      if (!text2) return { ok: false, reason: "empty_text" };
      return { ok: true, text: text2, language: data2?.language_code || null };
    }

    return { ok: false, reason: `elevenlabs_${resp.status}` };
  } catch (err) {
    console.error("Transcription exception:", err);
    return { ok: false, reason: "exception" };
  }
}

function friendlyError(reason: string, url: string): string {
  if (reason.startsWith("download_http_")) return `Could not download the media file (${reason.replace("download_http_", "HTTP ")}).`;
  if (reason === "download_timeout") return "Timed out downloading the media file.";
  if (reason === "download_empty_file") return "Downloaded file was empty.";
  if (reason === "download_exception") return "Network error while downloading the media file.";
  if (reason === "empty_text") return "Transcription returned empty text (no audio detected).";
  if (reason === "exception") return "Network error while contacting ElevenLabs.";
  if (reason.startsWith("elevenlabs_400") || reason.startsWith("elevenlabs_422")) {
    if (PLAYER_PAGE_RE.test(url)) {
      return "Player-page URLs aren't transcribable here. Use a direct .mp4/.mp3 file URL.";
    }
    return "ElevenLabs couldn't access the file at this URL (must be a direct, publicly downloadable media file).";
  }
  if (reason.startsWith("elevenlabs_401") || reason.startsWith("elevenlabs_403")) {
    return "ElevenLabs auth failed (check API key).";
  }
  if (reason.startsWith("elevenlabs_429")) return "ElevenLabs rate limit hit — try again later.";
  if (reason.startsWith("elevenlabs_5")) return "ElevenLabs server error — try again later.";
  return reason;
}

async function preflightVideo(v: VideoRow): Promise<PreflightResult> {
  try {
    let reason: string | null = null;

    if (v.is_embed) {
      reason = "Embed-code videos can't be transcribed (no direct video URL).";
    } else if (!v.video_url || typeof v.video_url !== "string" || !/^https?:\/\//i.test(v.video_url)) {
      reason = "Missing or invalid video URL.";
    } else if (PLAYER_PAGE_RE.test(v.video_url)) {
      reason = "Player-page URL (Vimeo/YouTube/Loom/Wistia). Use a direct .mp4/.mp3 file URL.";
    } else if (MEDIA_EXTENSION_RE.test(v.video_url)) {
      reason = null;
    } else {
      try {
        const { signal, cancel } = timeoutSignal(6000);
        const head = await fetch(v.video_url, { method: "HEAD", signal });
        cancel();
        if (!head.ok) {
          reason = `URL not reachable (HTTP ${head.status}).`;
        } else {
          const ct = (head.headers.get("content-type") || "").toLowerCase();
          if (ct && !/audio|video|octet-stream|binary/.test(ct)) {
            reason = `URL is not a media file (content-type: ${ct}).`;
          }
        }
      } catch (_e) {
        reason = null;
      }
    }

    return reason
      ? { id: v.id, title: v.title, valid: false, error: reason }
      : { id: v.id, title: v.title, valid: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown preflight error";
    return { id: v.id, title: v.title, valid: false, error: msg };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ELEVENLABS_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Auth — validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const callerEmail = (claimsData.claims.email as string | undefined)?.trim().toLowerCase();
    if (!callerEmail) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    const body: TranscribeBody = await req.json().catch(() => ({}));
    const mode = body.mode || "batch";
    const targetEmail = normalizeEmail(body.target_email);
    const requestedEmail = targetEmail || callerEmail;
    const isAdminCaller = isPlatformAdminEmail(callerEmail);

    if (targetEmail && targetEmail !== callerEmail && !isAdminCaller) {
      const { data: relationship } = await adminClient
        .from("account_admins")
        .select("id")
        .ilike("admin_email", callerEmail)
        .ilike("owner_email", targetEmail)
        .eq("status", "accepted")
        .maybeSingle();

      if (!relationship) {
        return new Response(
          JSON.stringify({ error: "Not authorized for requested account" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Resolve the effective owner's agency IDs. In impersonation/account-switching,
    // the JWT still belongs to the admin, so the client must pass target_email and
    // the function must scope videos to that effective account instead of callerEmail.
    let ownerRow: Record<string, string | null> | null = null;
    {
      const { data } = await adminClient
        .from("saas_suite_users")
        .select(
          "agency_id, agency_id_basic, agency_id_advanced, agency_id_elite, original_agency_id, original_agency_id_basic, original_agency_id_advanced, original_agency_id_elite",
        )
        .ilike("email", requestedEmail)
        .maybeSingle();
      ownerRow = data as Record<string, string | null> | null;
    }

    if (!ownerRow?.agency_id && !targetEmail) {
      // Maybe an invited account admin — find the owner's email.
      const { data: adminRow } = await adminClient
        .from("account_admins")
        .select("owner_email")
        .ilike("admin_email", callerEmail)
        .eq("status", "accepted")
        .maybeSingle();
      if (adminRow?.owner_email) {
        const { data: ownerData } = await adminClient
          .from("saas_suite_users")
          .select(
            "agency_id, agency_id_basic, agency_id_advanced, agency_id_elite, original_agency_id, original_agency_id_basic, original_agency_id_advanced, original_agency_id_elite",
          )
          .ilike("email", String(adminRow.owner_email).trim().toLowerCase())
          .maybeSingle();
        ownerRow = ownerData as Record<string, string | null> | null;
      }
    }

    if (!ownerRow?.agency_id) {
      return new Response(
        JSON.stringify({ error: "No agency found for user" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Custom videos live on the user's PRIMARY agency_id only. Pulling videos
    // from every owned agency_id (including legacy original_agency_id_*)
    // surfaces orphaned videos from past account migrations (e.g. a stale
    // "Welcome to SaaSSuite!" video sitting on an old highlevel agency id).
    // We strictly scope to the primary agency_id here.
    const primaryAgencyId = ownerRow.agency_id;
    const ownedAgencyIdSet = [primaryAgencyId];

    let query = adminClient
      .from("custom_onboarding_videos")
      .select("id, agency_id, title, video_url, is_embed")
      .eq("agency_id", primaryAgencyId);

    if (body.video_id) {
      query = query.eq("id", body.video_id);
    } else if (body.video_ids?.length) {
      query = query.in("id", body.video_ids);
    }

    const { data: videos, error: videosErr } = await query;
    if (videosErr) {
      console.error("Failed loading videos:", videosErr);
      return new Response(
        JSON.stringify({ error: "Failed to load videos" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (mode === "list") {
      return new Response(
        JSON.stringify({
          success: true,
          mode: "list",
          videos: ((videos || []) as VideoRow[]).map((v) => ({ id: v.id, title: v.title })),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (mode === "preflight_one") {
      const v = ((videos || []) as VideoRow[])[0];
      if (!v) {
        return new Response(
          JSON.stringify({ success: false, error: "Video not found or not owned" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const result = await preflightVideo(v);
      await adminClient
        .from("custom_onboarding_videos")
        .update(result.valid
          ? { transcription_status: "pending", transcription_error: null }
          : {
              transcription_status: "failed",
              transcription_error: result.error,
              transcription_attempted_at: new Date().toISOString(),
            })
        .eq("id", v.id);

      return new Response(
        JSON.stringify({ success: true, mode: "preflight_one", result }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ============ PREFLIGHT MODE ============
    // Validate every video URL: skip embeds, mark obvious player-page URLs as failed,
    // HEAD-check direct URLs and reject non-audio/video content. Returns list of valid IDs.
    if (mode === "preflight") {
      const valid: Array<{ id: string; title: string }> = [];
      const invalid: Array<{ id: string; title: string; error: string }> = [];

      for (const v of ((videos || []) as VideoRow[])) {
        const result = await preflightVideo(v);

        if (!result.valid) {
          invalid.push({ id: result.id, title: result.title, error: result.error || "Invalid video URL" });
          await adminClient
            .from("custom_onboarding_videos")
            .update({
              transcription_status: "failed",
              transcription_error: result.error || "Invalid video URL",
              transcription_attempted_at: new Date().toISOString(),
            })
            .eq("id", v.id);
        } else {
          valid.push({ id: v.id, title: v.title });
          // Reset to pending so the UI shows the right state going into transcription
          await adminClient
            .from("custom_onboarding_videos")
            .update({
              transcription_status: "pending",
              transcription_error: null,
            })
            .eq("id", v.id);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          mode: "preflight",
          total: (videos || []).length,
          valid,
          invalid,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results: VideoResult[] = [];

    // Process one video — never throws, always returns a VideoResult
    const processVideo = async (v: VideoRow): Promise<VideoResult> => {
      try {
        if (v.is_embed) {
          await adminClient
            .from("custom_onboarding_videos")
            .update({
              transcription_status: "failed",
              transcription_error: "Embed-code videos can't be transcribed (no direct video URL).",
              transcription_attempted_at: new Date().toISOString(),
            })
            .eq("id", v.id);
          return { video_id: v.id, title: v.title, transcribed: false, status: "failed", error: "embed_unsupported" };
        }

        if (!v.video_url || typeof v.video_url !== "string" || !/^https?:\/\//i.test(v.video_url)) {
          await adminClient
            .from("custom_onboarding_videos")
            .update({
              transcription_status: "failed",
              transcription_error: "Missing or invalid video URL.",
              transcription_attempted_at: new Date().toISOString(),
            })
            .eq("id", v.id);
          return { video_id: v.id, title: v.title, transcribed: false, status: "failed", error: "invalid_url" };
        }

        await adminClient
          .from("custom_onboarding_videos")
          .update({
            transcription_status: "processing",
            transcription_error: null,
            transcription_attempted_at: new Date().toISOString(),
          })
          .eq("id", v.id);

        const result = await transcribeOne(apiKey, v.video_url);

        if (result.ok) {
          await adminClient
            .from("custom_onboarding_videos")
            .update({
              transcription: result.text,
              transcription_language: result.language,
              transcription_status: "success",
              transcription_error: null,
              transcription_attempted_at: new Date().toISOString(),
            })
            .eq("id", v.id);
          return { video_id: v.id, title: v.title, transcribed: true, status: "success" };
        } else {
          const friendly = friendlyError(result.reason, v.video_url);
          await adminClient
            .from("custom_onboarding_videos")
            .update({
              transcription_status: "failed",
              transcription_error: friendly,
              transcription_attempted_at: new Date().toISOString(),
            })
            .eq("id", v.id);
          return { video_id: v.id, title: v.title, transcribed: false, status: "failed", error: friendly };
        }
      } catch (err) {
        const msg = (err as Error)?.message || "unknown_error";
        console.error(`Unexpected error processing ${v.id}:`, err);
        try {
          await adminClient
            .from("custom_onboarding_videos")
            .update({
              transcription_status: "failed",
              transcription_error: msg.slice(0, 500),
              transcription_attempted_at: new Date().toISOString(),
            })
            .eq("id", v.id);
        } catch (_) { /* ignore */ }
        return { video_id: v.id, title: v.title, transcribed: false, status: "failed", error: msg };
      }
    };

    // ============ SINGLE MODE ============
    // Process exactly one video so the client can drive the loop and show progress.
    // ALWAYS return 200 — even on "not found" — so the client loop continues.
    if (mode === "transcribe_one") {
      const v = (videos || [])[0];
      if (!v) {
        return new Response(
          JSON.stringify({ success: false, error: "Video not found or not owned" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const r = await processVideo(v);
      return new Response(
        JSON.stringify({ success: true, mode: "transcribe_one", result: r }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ============ BATCH MODE (legacy fallback) ============
    const concurrency = 5;
    const queue = [...(videos || [])];
    while (queue.length > 0) {
      const batch = queue.splice(0, concurrency);
      const batchResults = await Promise.all(batch.map(processVideo));
      results.push(...batchResults);
    }

    const successCount = results.filter((r) => r.transcribed).length;
    const failedCount = results.length - successCount;

    return new Response(
      JSON.stringify({
        success: true,
        total: results.length,
        succeeded: successCount,
        failed: failedCount,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("transcribe-video fatal:", err);
    // Always return 200 per spec so UI doesn't break — include success:false
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});