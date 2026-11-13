import { useEffect, useState } from "react";
import { Check, ChevronDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ghl } from "./ghlApi";
import { type PlanLink } from "../../../supabase/functions/_shared/connectedPlans";

export default function ConnectedPlanLinks({ agencyId }: { agencyId: string }) {
  const [result, setResult] = useState<{ links: PlanLink[]; unresolved: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    setBusy(true); setError(null); setResult(null);
    ghl<{ links: PlanLink[]; unresolved: string[] }>("setup_plans", agencyId)
      .then(data => { if (current) setResult(data); })
      .catch(e => { if (current) setError(e instanceof Error ? e.message : "Couldn't load your plan links."); })
      .finally(() => { if (current) setBusy(false); });
    return () => { current = false; };
  }, [agencyId, attempt]);
  return <section className="max-w-2xl border-b border-border pb-4" aria-label="HighLevel plan links">
    <div className="flex min-w-0 items-center justify-between gap-4">
      <h3 className="text-sm font-semibold">HighLevel plan links</h3>
      <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" title="Refresh plan links" aria-label="Refresh plan links" disabled={busy} onClick={() => setAttempt(n => n + 1)}>
        <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin motion-reduce:animate-none" : ""}`} />
      </Button>
    </div>
    {busy && <p role="status" className="text-sm text-muted-foreground">Checking HighLevel…</p>}
    {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
    {result && <details className="group">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        {!!(result.links ?? []).length && <Check className="h-4 w-4 shrink-0 text-primary" />}
        <span className="min-w-0 flex-1 text-muted-foreground">{(result.links ?? []).length} {(result.links ?? []).length === 1 ? "link" : "links"} connected{(result.unresolved ?? []).length ? ` · ${(result.unresolved ?? []).length} need attention` : ""}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <div className="space-y-3 pb-2 pt-2">
        {(result.links ?? []).map(link => <div key={link.agencyId} className="min-w-0 text-sm"><p className="break-words font-medium">{link.agencyId}</p><p className="break-all text-muted-foreground">{link.url}</p></div>)}
        {!!(result.unresolved ?? []).length && <p className="break-words text-sm text-muted-foreground">No unique matching HighLevel menu link for: {(result.unresolved ?? []).join(", ")}. Save each plan’s exact Hub URL in HighLevel, then refresh.</p>}
      </div>
    </details>}
  </section>;
}