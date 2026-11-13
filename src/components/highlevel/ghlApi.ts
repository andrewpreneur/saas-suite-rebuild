import { supabase } from "@/integrations/supabase/client";

export async function ghl<T = any>(action: string, agencyId: string, extra: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("ghl-connection", {
    body: { action, agency_id: agencyId, ...extra },
  });
  if (error) {
    let msg = "Request failed";
    try {
      const ctx: any = (error as any).context;
      const j = ctx?.json ? await ctx.json() : null;
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

// Public webhooks live on the SaaS Suite white-label domain.
export const FUNCTIONS_BASE = "https://auth.saassuite.ai/functions/v1";
export const WEBHOOK_URL = `${FUNCTIONS_BASE}/apply-menu-preset`;
export const ASSIGN_WEBHOOK_URL = `${FUNCTIONS_BASE}/assign-menu-link`;
