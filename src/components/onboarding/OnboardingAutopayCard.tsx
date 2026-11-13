import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";

/** Pay Manually vs Auto-Pay Upon Booking ($60 charged per booked call). */
export default function OnboardingAutopayCard({ ownerEmail }: { ownerEmail: string }) {
  const [autopay, setAutopay] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"manual" | "auto">("manual");
  const [consent, setConsent] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("saas_suite_users")
      .select("onboarding_autopay")
      .ilike("email", ownerEmail)
      .maybeSingle();
    const on = Boolean((data as any)?.onboarding_autopay);
    setAutopay(on);
    setMode(on ? "auto" : "manual");
    setLoading(false);
  };

  useEffect(() => {
    if (!ownerEmail) return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("autopaySetup");
    (async () => {
      if (sessionId) {
        const { data, error } = await supabase.functions.invoke("onboarding-autopay", {
          body: { action: "confirm", session_id: sessionId, owner_email: ownerEmail },
        });
        params.delete("autopaySetup");
        window.history.replaceState({}, "", `${window.location.pathname}${params.toString() ? `?${params}` : ""}`);
        if (error || data?.error) toast.error(data?.error || "Could not turn on auto-pay");
        else toast.success("Auto-pay is on");
      }
      await load();
    })();
  }, [ownerEmail]);

  const enable = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("onboarding-autopay", {
      body: { action: "setup", consent: true, owner_email: ownerEmail },
    });
    setBusy(false);
    if (error || !data?.url) {
      toast.error(data?.error || "Could not start card setup");
      return;
    }
    window.location.href = data.url;
  };

  const disable = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("onboarding-autopay", {
      body: { action: "disable", owner_email: ownerEmail },
    });
    setBusy(false);
    if (error || data?.error) return toast.error("Could not switch to manual");
    setAutopay(false);
    setMode("manual");
    setConsent(false);
    toast.success("Switched to Pay Manually");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CreditCard className="w-4 h-4" /> Payment for Booked Calls
          {!loading && <Badge variant={autopay ? "default" : "secondary"}>{autopay ? "Auto-Pay" : "Manual"}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="inline-flex rounded-lg border p-1 gap-1">
          <Button size="sm" variant={mode === "manual" ? "default" : "ghost"} onClick={() => (autopay ? void disable() : setMode("manual"))} disabled={busy || loading}>
            Pay Manually
          </Button>
          <Button size="sm" variant={mode === "auto" ? "default" : "ghost"} onClick={() => setMode("auto")} disabled={busy || loading}>
            Auto-Pay Upon Booking
          </Button>
        </div>

        {mode === "manual" && (
          <p className="text-sm text-muted-foreground">Each booked call uses one call from your balance. Buy more calls whenever you need them.</p>
        )}

        {mode === "auto" && !autopay && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 text-destructive flex-shrink-0" />
              <span>Any onboarding call booked for your agency will automatically charge your card on file $60.</span>
            </div>
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
              <span>I understand and want my card charged $60 automatically for every onboarding call booked for my agency.</span>
            </label>
            <Button variant="accent" onClick={() => void enable()} disabled={!consent || busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Save card and turn on Auto-Pay
            </Button>
          </div>
        )}

        {autopay && (
          <p className="text-sm text-muted-foreground">
            Auto-Pay is on. Each booked call charges your saved card $60 and your call balance stays the same. If a charge
            fails, one call is used from your balance instead.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
