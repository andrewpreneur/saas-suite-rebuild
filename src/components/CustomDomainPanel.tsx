import { useEffect, useState } from "react";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Globe, Loader2, CheckCircle2, Clock, ExternalLink } from "lucide-react";

interface DomainState {
  custom_domain_access: boolean;
  custom_domain: string | null;
  custom_domain_live: boolean;
  custom_domain_submitted_at: string | null;
}

export function CustomDomainPanel() {
  const { email } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [state, setState] = useState<DomainState | null>(null);
  const [domainInput, setDomainInput] = useState("");

  const load = async () => {
    if (!email) return;
    setLoading(true);
    const { data } = await supabase
      .from("saas_suite_users")
      .select("custom_domain_access, custom_domain, custom_domain_live, custom_domain_submitted_at")
      .ilike("email", email)
      .maybeSingle();
    setState(data as any);
    setDomainInput((data as any)?.custom_domain || "");
    setLoading(false);
  };

  useEffect(() => { load(); }, [email]);

  const handleSubmit = async () => {
    const raw = domainInput.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(raw)) {
      toast({ title: "Invalid domain", description: "Enter a valid domain or subdomain (e.g. app.yoursite.com).", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("submit-custom-domain", {
        body: { domain: raw },
      });
      if (error) throw error;
      if (!(data as any)?.ok) throw new Error((data as any)?.error || "Failed to submit");
      toast({ title: "Request received!", description: "We'll notify you once your domain is live." });
      await load();
    } catch (e: any) {
      toast({ title: "Submission failed", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!state?.custom_domain_access) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Globe className="w-5 h-5" /> Custom Domain</CardTitle>
          <CardDescription>This upgrade hasn't been purchased on your account yet.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <a href="https://link.saassuite.ai/payment-link/6a3af2039f7c6c76d1f86d4c" target="_blank" rel="noreferrer">
              Purchase Custom Domain <ExternalLink className="w-4 h-4 ml-2" />
            </a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isLive = state.custom_domain_live;
  const isPending = !!state.custom_domain && !isLive;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1 flex items-center gap-2"><Globe className="w-5 h-5" /> Custom Domain</h3>
        <p className="text-sm text-muted-foreground">
          Replace <span className="font-mono">yoursoftwareonboarding.com</span> with your own domain or subdomain across your SaaS experience.
        </p>
      </div>

      {isLive && (
        <Alert className="border-green-300 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Your custom domain <span className="font-mono font-semibold">{state.custom_domain}</span> is <strong>live</strong>.
          </AlertDescription>
        </Alert>
      )}

      {isPending && (
        <Alert className="border-amber-300 bg-amber-50">
          <Clock className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <strong>Request received!</strong> We've got <span className="font-mono">{state.custom_domain}</span> in the queue.
            You'll be notified once it's live. Need to change it? Update below and re-submit.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your Domain</CardTitle>
          <CardDescription>
            Enter the root domain (e.g. <span className="font-mono">yoursite.com</span>) or subdomain (e.g. <span className="font-mono">app.yoursite.com</span>) you want to use.
            After you submit, our team will wire it up and notify you the moment it goes live.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="domain">Domain or subdomain</Label>
            <Input
              id="domain"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              placeholder="app.yoursite.com"
              className="font-mono"
              disabled={submitting}
            />
          </div>
          <Button onClick={handleSubmit} disabled={submitting || !domainInput.trim()}>
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isPending || isLive ? "Update Domain" : "Submit Domain"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}