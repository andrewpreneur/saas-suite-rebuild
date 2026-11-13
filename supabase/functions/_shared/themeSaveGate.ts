// Live checks for a theme or logo write. The decision rules live in themeSaveAuth.ts.
// This file talks to Supabase and HighLevel. Tests cover the rules without this file.
//
// THEME_SAVE_SECRET is read from the environment. This code does not create it.
// A missing audit table does not fail the save: the HighLevel or Supabase check still holds.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { GhlError, loadClient, locationBelongs } from "./ghl.ts";
import { hintUserEmail, hintUserId } from "./locationTheme.ts";
import {
  THEME_SAVE_WINDOW_MS,
  decideThemeWrite,
  highlevelEditorCanWrite,
  hostFromDomain,
  readHighlevelUser,
  supabaseBrandingEditor,
  themeSaveOriginAllowed,
  themeSaveRateLimited,
  verifyThemeSaveToken,
  type ThemeWriteDecision,
} from "./themeSaveAuth.ts";

export type ThemeSaveAction = "theme_save" | "logo_save" | "logo_delete";

function bearerToken(req: Request): string | null {
  const header = req.headers.get("Authorization") || "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) return null;
  return token;
}

async function recentSuccessfulSaves(admin: any, agencyId: string): Promise<number | null> {
  try {
    const since = new Date(Date.now() - THEME_SAVE_WINDOW_MS).toISOString();
    const { count, error } = await admin
      .from("theme_save_audit")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agencyId)
      .eq("ok", true)
      .gte("created_at", since);
    if (error || typeof count !== "number") return null;
    return count;
  } catch {
    return null;
  }
}

async function signedInEditor(admin: any, req: Request, ownerEmail: string | null): Promise<{
  sawUser: boolean;
  editor: boolean;
  email: string | null;
  userId: string | null;
}> {
  const token = bearerToken(req);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!token || !supabaseUrl || !anonKey) return { sawUser: false, editor: false, email: null, userId: null };
  try {
    const sb = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data, error } = await sb.auth.getUser(token);
    const email = !error && data.user?.email ? data.user.email.toLowerCase() : "";
    if (!email) return { sawUser: false, editor: false, email: null, userId: null };
    const userId = data.user?.id || null;
    if (supabaseBrandingEditor({ email, ownerEmail, adminStatus: null, branding: null })) {
      return { sawUser: true, editor: true, email, userId };
    }
    if (!ownerEmail) return { sawUser: true, editor: false, email, userId };
    const { data: rows } = await admin
      .from("account_admins")
      .select("status, permissions")
      .ilike("owner_email", String(ownerEmail || ""))
      .ilike("admin_email", email)
      .eq("status", "accepted")
      .limit(1);
    const row = rows?.[0];
    const editor = supabaseBrandingEditor({
      email,
      ownerEmail,
      adminStatus: row?.status || null,
      branding: row?.permissions?.branding,
    });
    return { sawUser: true, editor, email, userId };
  } catch {
    return { sawUser: false, editor: false, email: null, userId: null };
  }
}

function requestOrigin(req: Request): string | null {
  const raw = req.headers.get("Origin");
  if (!raw || raw === "null") return null;
  return raw.slice(0, 200);
}

export async function recordThemeSave(admin: any, row: {
  agencyId: string;
  locationId: string;
  action: ThemeSaveAction;
  via: "supabase" | "highlevel" | "rejected";
  userId: string | null;
  email: string | null;
  origin: string | null;
  ok: boolean;
}) {
  try {
    const { error } = await admin.from("theme_save_audit").insert({
      agency_id: row.agencyId,
      location_id: row.locationId,
      action: row.action,
      via: row.via,
      user_id: row.userId ? String(row.userId).slice(0, 80) : null,
      user_email: row.email ? String(row.email).slice(0, 320) : null,
      origin: row.origin && row.origin !== "null" ? String(row.origin).slice(0, 200) : null,
      ok: row.ok,
    });
    if (error) console.error("[theme-save-audit]", error.message);
  } catch (error) {
    console.error("[theme-save-audit]", error instanceof Error ? error.message : "insert failed");
  }
}

export async function authorizeThemeWrite(input: {
  admin: any;
  req: Request;
  agencyId: string;
  locationId: string;
  saveToken: string;
  claimedUserId: string;
  claimedUserEmail?: string;
  action: ThemeSaveAction;
  ownerEmail: string | null;
  // Plan slugs on the same owner row. A grant for one of them covers the others.
  ownerAgencyIds?: readonly string[];
  whiteLabelDomain: string | null;
  customDomain: string | null;
}): Promise<ThemeWriteDecision> {
  const origin = requestOrigin(input.req);
  const originAllowed = themeSaveOriginAllowed(origin, [
    hostFromDomain(input.whiteLabelDomain),
    hostFromDomain(input.customDomain),
  ]);
  const recent = await recentSuccessfulSaves(input.admin, input.agencyId);
  const signedIn = await signedInEditor(input.admin, input.req, input.ownerEmail);
  const secret = Deno.env.get("THEME_SAVE_SECRET") || "";

  let tokenOk = false;
  let ghl: "disconnected" | "down" | "unknown-user" | "ready" = "disconnected";
  let editor = false;
  let verifiedUserId: string | null = null;
  let verifiedEmail: string | null = null;
  let locationMiss = false;
  let grantLocation = false;

  if (!signedIn.editor && secret) {
    tokenOk = await verifyThemeSaveToken(
      input.saveToken,
      secret,
      input.agencyId,
      input.locationId,
      Math.floor(Date.now() / 1000),
      input.ownerAgencyIds || [],
    );
  }

  const rateLimited = recent != null && themeSaveRateLimited(recent);
  if (!signedIn.editor && secret && tokenOk && originAllowed && !rateLimited) {
    try {
      const client = await loadClient(input.admin, input.agencyId);
      if (!client) {
        ghl = "disconnected";
      } else {
        const companyId = String(client.conn?.company_id || "");
        let resolved = hintUserId(input.claimedUserId);
        let emailAmbiguous = false;
        if (!resolved) {
          const email = hintUserEmail(input.claimedUserEmail);
          if (email && companyId) {
            try {
              const users = await client.api.usersByEmail(companyId, email);
              const exact = (Array.isArray(users) ? users : []).filter((row: { email?: string; id?: string }) =>
                String(row?.email || "").trim().toLowerCase() === email && row?.id
              );
              if (exact.length === 1) resolved = String(exact[0].id);
              else if (exact.length > 1) emailAmbiguous = true;
            } catch (error) {
              if (!(error instanceof GhlError && (error.status === 400 || error.status === 404))) ghl = "down";
            }
          }
        }
        if (ghl === "down") {
          // The agency token could not be used. Do not fall open to the location grant.
        } else if (resolved) {
          // A presented user who is not an editor stays rejected. Do not use the location grant.
          try {
            const payload = await client.api.user(resolved);
            const user = readHighlevelUser(payload);
            if (!user) {
              ghl = "unknown-user";
            } else {
              ghl = "ready";
              verifiedUserId = user.id;
              verifiedEmail = user.email;
              let locationInCompany = user.locationIds.includes(input.locationId);
              const highlevelEditor = user.type === "agency" || user.role === "admin";
              if (!locationInCompany && input.locationId !== "agency" && highlevelEditor) {
                locationInCompany = await locationBelongs(input.admin, input.agencyId, input.locationId, client);
              }
              editor = highlevelEditorCanWrite(user, companyId, input.locationId, locationInCompany);
              locationMiss = highlevelEditor && !editor && input.locationId !== "agency" && !locationInCompany;
            }
          } catch (error) {
            ghl = error instanceof GhlError && (error.status === 400 || error.status === 404) ? "unknown-user" : "down";
          }
        } else if (emailAmbiguous) {
          ghl = "unknown-user";
        } else {
          ghl = "unknown-user";
          if (input.locationId === "agency") grantLocation = true;
          else {
            grantLocation = await locationBelongs(input.admin, input.agencyId, input.locationId, client);
            locationMiss = !grantLocation;
          }
        }
      }
    } catch {
      ghl = "down";
    }
  }

  let decision: ThemeWriteDecision;
  if (signedIn.sawUser && !signedIn.editor) {
    decision = { ok: false, status: 403, error: "Only the agency owner or a branding admin can save this theme." };
  } else {
    decision = decideThemeWrite({
      rateLimited,
      originAllowed,
      supabaseEditor: signedIn.editor,
      supabaseEmail: signedIn.email,
      supabaseUserId: signedIn.userId,
      secretConfigured: !!secret,
      tokenOk,
      ghl,
      editor,
      verifiedUserId,
      verifiedEmail,
      grantLocation,
    });
    if (!decision.ok && locationMiss && decision.error.startsWith("Only a confirmed agency user")) {
      decision = { ok: false, status: 403, error: "That sub-account is not part of this HighLevel agency." };
    }
  }

  if (!decision.ok) {
    await recordThemeSave(input.admin, {
      agencyId: input.agencyId,
      locationId: input.locationId,
      action: input.action,
      via: "rejected",
      userId: signedIn.userId || hintUserId(input.claimedUserId),
      email: signedIn.email,
      origin,
      ok: false,
    });
  }
  return decision;
}
