import { supabase } from "@/integrations/supabase/client";
import type { AuthAccountState } from "@/lib/kitLoginFlow";

async function invokeAuthFunction(name: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (data && typeof data === "object") return data as Record<string, unknown>;
  const context = error && typeof error === "object" && "context" in error
    ? (error as { context?: unknown }).context
    : null;
  if (context instanceof Response) {
    const parsed = await context.clone().json().catch(() => null);
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  }
  throw new Error("Could not reach the account service. Please try again.");
}

/** One email in. The server returns new, password, or needs_password. Never a user list. */
export async function fetchAuthAccountState(email: string): Promise<AuthAccountState> {
  const data = await invokeAuthFunction("auth-account-state", { email });
  if (data.state === "new" || data.state === "password" || data.state === "needs_password") return data.state;
  throw new Error(typeof data.error === "string" ? data.error : "Error checking account status. Please try again.");
}

export async function requestPasswordCode(email: string, nextPath: string | null): Promise<Record<string, unknown>> {
  return invokeAuthFunction("set-initial-password", { action: "send_code", email, next: nextPath });
}

export async function submitPasswordCode(email: string, code: string, password: string): Promise<Record<string, unknown>> {
  return invokeAuthFunction("set-initial-password", { action: "set_password", email, code, password });
}
