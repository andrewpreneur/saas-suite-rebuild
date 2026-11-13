import { supabase } from "@/integrations/supabase/client";

const checked = new Set<string>();
export function clearInstallationAuditSession() { checked.clear(); }
export async function auditInstallationOnLogin(email: string) {
  const clean = email.trim().toLowerCase();
  if (!clean || checked.has(clean)) return;
  checked.add(clean);
  try {
    const { data, error } = await supabase.from("saas_suite_users").select("agency_id").eq("email", clean).maybeSingle();
    if (error || !data?.agency_id) return;
    const { data: result, error: auditError } = await supabase.functions.invoke("ghl-connection", { body: { action: "audit_installation", agency_id: data.agency_id } });
    if (auditError) return; // Connection missing or denied; never block login.
    window.dispatchEvent(new CustomEvent("installation-audit-complete", { detail: result }));
    const audit = result?.audit;
    if (audit && (audit.installedJs === false || audit.installedCss === false || !audit.servedJs?.runtimeCurrent || !audit.servedCss?.runtimeCurrent)) {
      const { toast } = await import("sonner");
      toast.warning("Your HighLevel installation needs checking", { description: "Open the Client Hub installation guide to review your plan links and installed code." });
    }
  } catch { /* Best effort, independent of auth/navigation. */ }
}