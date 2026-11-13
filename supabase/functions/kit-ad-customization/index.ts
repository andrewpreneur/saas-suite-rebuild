import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.24.2";
import { KIT_AD_TEMPLATE_META, kitAdTemplateMeta } from "../_shared/kit-ad-templates.ts";
import { entitledKitLineIds } from "../_shared/kit-entitlement.ts";

const schema = z.object({
  businessName: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(4000).optional().default(""),
  templateIds: z.array(z.string().trim().min(1)).min(1).max(KIT_AD_TEMPLATE_META.length),
  logoBase64: z.string().trim().min(1).max(8_000_000),
  logoContentType: z.enum(["image/png", "image/jpeg", "image/webp"]),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

function logoBytes(value: string, contentType: string): Uint8Array {
  const payload = value.replace(/^data:[^;]+;base64,/, "");
  const binary = atob(payload);
  if (binary.length > 4 * 1024 * 1024) throw new Error("That logo is over 4 MB.");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const webp = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
  if (contentType === "image/png" && !png) throw new Error("Upload a PNG, JPEG, or WebP logo.");
  if (contentType === "image/jpeg" && !jpeg) throw new Error("Upload a PNG, JPEG, or WebP logo.");
  if (contentType === "image/webp" && !webp) throw new Error("Upload a PNG, JPEG, or WebP logo.");
  return bytes;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Not authenticated" }, 401);

  const supaUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supaUrl || !anonKey || !serviceKey) return json({ error: "Customization isn't available yet." }, 500);

  const userClient = createClient(supaUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: userResult, error: userError } = await userClient.auth.getUser();
  const user = userResult?.user;
  const email = user?.email?.trim().toLowerCase();
  if (userError || !user || !email) return json({ error: "Not authenticated" }, 401);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Check the business name, logo, and templates." }, 400);
  const input = parsed.data;
  const templateIds = [...new Set(input.templateIds)];

  try {
    const admin = createClient(supaUrl, serviceKey);
    const [{ data: purchases, error: purchaseError }, { data: profile }] = await Promise.all([
      admin.from("kit_purchases").select("line_id").eq("email", email),
      admin.from("saas_suite_users").select("full_name, approval, trial_source, landing_page, checkout_page, referrer, source").ilike("email", email).maybeSingle(),
    ]);
    if (purchaseError) return json({ error: "We couldn't confirm your kit purchase." }, 500);
    const lines = new Set(entitledKitLineIds((purchases ?? []).map(row => row.line_id), profile));
    const ownsLaunch = lines.has("launch");
    const ownsKit = lines.has("kit");
    if (!ownsLaunch && !ownsKit) return json({ error: "Buy the kit before requesting customization." }, 403);
    const templates = templateIds.map(id => kitAdTemplateMeta(id));
    if (templates.some(item => !item)) return json({ error: "Choose templates from the library." }, 400);
    if (templates.some(item => !ownsLaunch && !(ownsKit && item?.inKit))) {
      return json({ error: "Choose templates included with your purchase." }, 403);
    }

    const bytes = logoBytes(input.logoBase64, input.logoContentType);
    const requestId = crypto.randomUUID();
    const logoPath = `${user.id}/${requestId}.${EXT[input.logoContentType]}`;
    const { error: uploadError } = await admin.storage.from("kit-ad-logos").upload(logoPath, bytes, {
      contentType: input.logoContentType,
      upsert: false,
    });
    if (uploadError) return json({ error: "We couldn't save that logo. Please try again." }, 500);

    const { error: insertError } = await admin.from("kit_ad_requests").insert({
      id: requestId,
      user_id: user.id,
      email,
      business_name: input.businessName,
      notes: input.notes,
      template_ids: templateIds,
      logo_path: logoPath,
    });
    if (insertError) {
      await admin.storage.from("kit-ad-logos").remove([logoPath]);
      return json({ error: "We couldn't save that request. Please try again." }, 500);
    }

    const name = typeof profile?.full_name === "string" && profile.full_name.trim() ? profile.full_name.trim() : email;
    const logoUrl = admin.storage.from("kit-ad-logos").getPublicUrl(logoPath).data.publicUrl;
    const agency = Deno.env.get("KIT_SLACK_AGENCY_ID")?.trim();
    const slackToken = Deno.env.get("SLACK_NOTIFY_TOKEN");
    if (agency && slackToken) {
      await fetch(`${supaUrl}/functions/v1/slack-notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${slackToken}` },
        body: JSON.stringify({
          agency_id: agency,
          event_type: "kit_ad_customization_request",
          data: {
            name,
            email,
            business_name: input.businessName,
            logo_url: logoUrl,
            notes: input.notes,
            templates: templates.map(item => item?.title),
          },
        }),
      }).catch(() => console.warn("Kit ad customization Slack ping failed"));
    }

    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "We couldn't send that request. Please try again.";
    const status = message.includes("logo") ? 400 : 500;
    return json({ error: message }, status);
  }
});
