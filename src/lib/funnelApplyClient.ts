import { supabase } from "@/integrations/supabase/client";

export type FunnelApplyName = "agents" | "highlevelers" | "highlevelers_upgrade" | "founders_plan";

export function funnelSessionId(funnel: FunnelApplyName): string {
  const key = `funnel_apply_session:${funnel}`;
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/** One browser session for /founders-plan. The server still collapses to one row per email. */
export function foundersPlanSessionId() {
  const key = "founders_plan_session";
  try {
    const existing = localStorage.getItem(key);
    if (existing && existing.length >= 8) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(key, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/** Shared by both HighLevelers pages so a refresh resumes the same application. */
export function highlevelersSessionId() {
  const key = "hl_apply_session";
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(key, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function visitContext() {
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  params.forEach((value, key) => {
    if (key.startsWith("utm_") || key === "fbclid") utm[key] = value.slice(0, 200);
  });
  return { utm, landing_url: window.location.href.slice(0, 500) };
}

export async function saveFunnelStep(body: Record<string, unknown>): Promise<{
  ok: boolean;
  already_applied?: boolean;
  already_claimed?: boolean;
  first_name?: string;
  path?: string;
  lead_already_sent?: boolean;
  created?: boolean;
  event_id?: string;
  lead_id?: string;
  forwarded?: boolean;
  error?: string;
}> {
  const { data, error } = await supabase.functions.invoke("funnel-apply", { body });
  if (error) return { ok: false, error: error.message || "Could not save" };
  const payload = (data ?? {}) as {
    ok?: boolean;
    already_applied?: boolean;
    already_claimed?: boolean;
    first_name?: string;
    path?: string;
    lead_already_sent?: boolean;
    created?: boolean;
    event_id?: string;
    lead_id?: string;
    forwarded?: boolean;
    error?: string;
  };
  if (payload.error)
    return { ok: false, error: payload.error, already_applied: payload.already_applied, already_claimed: payload.already_claimed };
  return {
    ok: payload.ok !== false,
    already_applied: payload.already_applied,
    already_claimed: payload.already_claimed,
    first_name: payload.first_name,
    path: payload.path,
    lead_already_sent: payload.lead_already_sent,
    created: payload.created,
    event_id: payload.event_id,
    lead_id: payload.lead_id,
    forwarded: payload.forwarded,
  };
}
