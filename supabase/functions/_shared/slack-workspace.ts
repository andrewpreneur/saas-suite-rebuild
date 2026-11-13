// Shared helper: resolve a workspace bot_token by agency_id or team_id.
// NEVER log the returned token. NEVER return it in an HTTP response.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const client = createClient(SUPABASE_URL, SERVICE_ROLE);

export type SlackInstall = {
  agency_id: string;
  slack_team_id: string | null;
  slack_channel_id: string | null;
  bot_token: string;
  bot_user_id: string | null;
  team_domain: string | null;
  webhook_url: string | null;
  alert_assigned_chat?: boolean;
  alert_assigned_ticket?: boolean;
  alert_assigned_updates?: boolean;
  alert_new_unassigned_chats?: boolean;
  alert_new_unassigned_tickets?: boolean;
};

function cleanAgencyId(id: string) {
  return id.replace(/NO$/i, "");
}

export async function getInstallByAgency(agencyId: string): Promise<SlackInstall | null> {
  const clean = cleanAgencyId(agencyId);
  const { data: owner, error: ownerError } = await client
    .from("saas_suite_users")
    .select("agency_id, agency_id_basic, agency_id_advanced, agency_id_elite")
    .or(
      `agency_id.eq.${clean},agency_id_basic.eq.${clean},agency_id_advanced.eq.${clean},agency_id_elite.eq.${clean}`,
    )
    .limit(1)
    .maybeSingle();

  if (ownerError) {
    console.error("getInstallByAgency owner lookup failed:", ownerError.message);
  }

  const agencyIds = Array.from(
    new Set([
      clean,
      owner?.agency_id,
      owner?.agency_id_basic,
      owner?.agency_id_advanced,
      owner?.agency_id_elite,
    ].filter(Boolean) as string[]),
  );

  const { data, error } = await client
    .from("slack_channel_agency_map")
    .select("agency_id, slack_team_id, slack_channel_id, bot_token, bot_user_id, team_domain, webhook_url, is_active, installed_at, alert_assigned_chat, alert_assigned_ticket, alert_assigned_updates, alert_new_unassigned_chats, alert_new_unassigned_tickets")
    .in("agency_id", agencyIds)
    .eq("is_active", true)
    .not("bot_token", "is", null)
    .order("installed_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("getInstallByAgency lookup failed:", error.message);
    return null;
  }
  if (!data?.bot_token) return null;
  return data as SlackInstall;
}

export async function getInstallByTeam(teamId: string): Promise<SlackInstall | null> {
  if (!teamId) return null;
  const { data, error } = await client
    .from("slack_channel_agency_map")
    .select("agency_id, slack_team_id, slack_channel_id, bot_token, bot_user_id, team_domain, webhook_url, is_active, installed_at")
    .eq("slack_team_id", teamId)
    .eq("is_active", true)
    .not("bot_token", "is", null)
    .order("installed_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("getInstallByTeam lookup failed:", error.message);
    return null;
  }
  if (!data?.bot_token) return null;
  return data as SlackInstall;
}

export async function deactivateInstallByTeam(teamId: string) {
  if (!teamId) return;
  const { error } = await client
    .from("slack_channel_agency_map")
    .update({ is_active: false, bot_token: null })
    .eq("slack_team_id", teamId);
  if (error) console.error("deactivateInstallByTeam failed:", error.message);
}