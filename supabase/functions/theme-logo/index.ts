// Hosts a HighLevel theme logo in the existing public "logos" bucket.
// Reads stay public. Writes use the same check as location-theme: a SaaS Suite
// owner or branding admin, or a HighLevel user confirmed with the agency token
// plus a THEME_SAVE_SECRET grant. When the page sends no user id, the same grant
// is enough if the location belongs to the agency. A claimed type or role is not
// enough. A user HighLevel rejects stays rejected.
// Not deployed from this change. Set THEME_SAVE_SECRET, apply
// supabase/migrations/20261022185601_theme_save_audit.sql, then deploy theme-logo
// with location-theme and dynamic-styles.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { themeOwnerAgencyIds } from "../_shared/themeSaveAuth.ts";
import { authorizeThemeWrite, recordThemeSave, type ThemeSaveAction } from "../_shared/themeSaveGate.ts";
import {
  MAX_LOGO_BYTES,
  MAX_THEME_LOGOS_PER_AGENCY,
  normalizeAgencyKey,
  normalizeLocationId,
  safeHttpsUrl,
  sniffLogo,
  themeLogoObjectPath,
} from "../_shared/themeLogo.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

const BUCKET = "logos";
const COOLDOWN_MS = 2000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function coolingDown(updatedAt: string | null | undefined) {
  if (!updatedAt) return false;
  const then = Date.parse(updatedAt);
  return Number.isFinite(then) && Date.now() - then < COOLDOWN_MS;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!["GET", "POST", "DELETE"].includes(req.method)) return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Logo hosting isn't available yet." }, 500);

  try {
    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > MAX_LOGO_BYTES + 64 * 1024) return json({ error: "That logo is over 2 MB." }, 413);

    const url = new URL(req.url);
    let agencyRaw = url.searchParams.get("agencyKey") || "";
    let locationRaw = url.searchParams.get("locationId") || "";
    let logoUrl = "";
    let file: File | null = null;
    let userId = "";
    let userEmail = "";
    let saveToken = "";

    if (req.method !== "GET") {
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("multipart/form-data")) {
        const form = await req.formData();
        agencyRaw = String(form.get("agencyKey") || "");
        locationRaw = String(form.get("locationId") || "");
        userId = String(form.get("userId") || "");
        userEmail = String(form.get("userEmail") || "");
        saveToken = String(form.get("saveToken") || "");
        const uploaded = form.get("file");
        file = uploaded instanceof File ? uploaded : null;
      } else {
        const body = await req.json().catch(() => ({}));
        agencyRaw = String(body.agencyKey || "");
        locationRaw = String(body.locationId || "");
        logoUrl = String(body.logoUrl || "").trim();
        userId = String(body.userId || "");
        userEmail = String(body.userEmail || "");
        saveToken = String(body.saveToken || "");
      }
    }

    const agencyId = normalizeAgencyKey(agencyRaw);
    const locationId = normalizeLocationId(locationRaw);
    if (!agencyId || !locationId) return json({ error: "That account could not be matched." }, 400);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: owners, error: ownerError } = await admin
      .from("saas_suite_users")
      .select("id, email, white_label_domain, custom_domain, agency_id, agency_id_basic, agency_id_advanced, agency_id_elite")
      .or(`agency_id.eq.${agencyId},agency_id_basic.eq.${agencyId},agency_id_advanced.eq.${agencyId},agency_id_elite.eq.${agencyId}`)
      .limit(1);
    if (ownerError) throw ownerError;
    if (!owners?.length) return json({ error: "That agency was not found." }, 404);

    const { data: existing, error: existingError } = await admin
      .from("theme_logos")
      .select("logo_url, storage_path, updated_at")
      .eq("agency_id", agencyId)
      .eq("location_id", locationId)
      .maybeSingle();
    if (existingError) throw existingError;

    if (req.method === "GET") {
      return json({ logoUrl: safeHttpsUrl(existing?.logo_url) ? existing.logo_url : null });
    }

    const owner = owners[0];
    const action: ThemeSaveAction = req.method === "DELETE" ? "logo_delete" : "logo_save";
    const decision = await authorizeThemeWrite({
      admin,
      req,
      agencyId,
      locationId,
      saveToken,
      claimedUserId: userId,
      claimedUserEmail: userEmail,
      action,
      ownerAgencyIds: themeOwnerAgencyIds(agencyId, owner),
      ownerEmail: owner.email || null,
      whiteLabelDomain: owner.white_label_domain || null,
      customDomain: owner.custom_domain || null,
    });
    if (!decision.ok) return json({ error: decision.error }, decision.status);

    if (coolingDown(existing?.updated_at)) {
      return json({ error: "Please wait a moment before changing the logo again." }, 429);
    }

    const removeStored = async () => {
      const path = existing?.storage_path;
      if (themeLogoObjectPath(agencyId, locationId, path)) {
        await admin.storage.from(BUCKET).remove([path]);
      }
    };

    if (req.method === "DELETE") {
      if (existing) {
        const { error } = await admin.from("theme_logos").delete().eq("agency_id", agencyId).eq("location_id", locationId);
        if (error) throw error;
        await removeStored();
        await recordThemeSave(admin, {
          agencyId,
          locationId,
          action: "logo_delete",
          via: decision.via,
          userId: decision.userId,
          email: decision.email,
          origin: req.headers.get("Origin"),
          ok: true,
        });
      }
      return json({ logoUrl: null });
    }

    if (file) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes.byteLength > MAX_LOGO_BYTES) return json({ error: "That logo is over 2 MB." }, 400);
      const sniffed = sniffLogo(bytes, file.type);
      if (!sniffed) return json({ error: "Use a PNG, JPG, SVG, or WebP image." }, 400);

      if (!existing) {
        const { count, error: countError } = await admin
          .from("theme_logos")
          .select("agency_id", { count: "exact", head: true })
          .eq("agency_id", agencyId);
        if (countError) throw countError;
        if ((count || 0) >= MAX_THEME_LOGOS_PER_AGENCY) {
          return json({ error: "This agency has too many saved logos." }, 429);
        }
      }

      const path = `theme/${agencyId}/${locationId}/${crypto.randomUUID()}.${sniffed.ext}`;
      const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, bytes, {
        contentType: sniffed.contentType,
        upsert: false,
      });
      if (uploadError) return json({ error: "We couldn't store that logo. Please try again." }, 500);

      const publicUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      if (!safeHttpsUrl(publicUrl)) {
        await admin.storage.from(BUCKET).remove([path]);
        return json({ error: "We couldn't store that logo. Please try again." }, 500);
      }

      const { error: upsertError } = await admin.from("theme_logos").upsert({
        agency_id: agencyId,
        location_id: locationId,
        logo_url: publicUrl,
        storage_path: path,
        updated_at: new Date().toISOString(),
      });
      if (upsertError) {
        await admin.storage.from(BUCKET).remove([path]);
        return json({ error: "We couldn't store that logo. Please try again." }, 500);
      }
      await removeStored();
      await recordThemeSave(admin, {
        agencyId,
        locationId,
        action: "logo_save",
        via: decision.via,
        userId: decision.userId,
        email: decision.email,
        origin: req.headers.get("Origin"),
        ok: true,
      });
      return json({ logoUrl: publicUrl });
    }

    if (!safeHttpsUrl(logoUrl)) return json({ error: "Paste an https link to the logo." }, 400);
    if (existing?.logo_url === logoUrl) return json({ logoUrl });

    if (!existing) {
      const { count, error: countError } = await admin
        .from("theme_logos")
        .select("agency_id", { count: "exact", head: true })
        .eq("agency_id", agencyId);
      if (countError) throw countError;
      if ((count || 0) >= MAX_THEME_LOGOS_PER_AGENCY) {
        return json({ error: "This agency has too many saved logos." }, 429);
      }
    }

    const { error: upsertError } = await admin.from("theme_logos").upsert({
      agency_id: agencyId,
      location_id: locationId,
      logo_url: logoUrl,
      storage_path: null,
      updated_at: new Date().toISOString(),
    });
    if (upsertError) throw upsertError;
    await removeStored();
    await recordThemeSave(admin, {
      agencyId,
      locationId,
      action: "logo_save",
      via: decision.via,
      userId: decision.userId,
      email: decision.email,
      origin: req.headers.get("Origin"),
      ok: true,
    });
    return json({ logoUrl });
  } catch (error) {
    console.error("[theme-logo]", error);
    return json({ error: "We couldn't update that logo. Please try again." }, 500);
  }
});
