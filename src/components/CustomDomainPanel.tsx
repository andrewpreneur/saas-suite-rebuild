import { useEffect, useState } from "react";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Banner } from "@/components/ui/banner";
import { Tag } from "@/components/ui/tag";
import { SectionCard } from "@/components/premium/SectionCard";
import { Field, SectionFooter } from "@/components/premium/settings/Field";
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
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading custom domain">
        <div className="px-skeleton h-24 rounded-lg" />
        <div className="px-skeleton h-40 rounded-lg" />
      </div>
    );
  }

  if (!state?.custom_domain_access) {
    return (
      <SectionCard
        icon={<Globe />}
        title="Custom Domain"
        description="This upgrade hasn't been purchased on your account yet."
      >
        <Button asChild variant="accent" className="h-11 sm:h-10">
          <a href="https://link.saassuite.ai/payment-link/6a3af2039f7c6c76d1f86d4c" target="_blank" rel="noreferrer">
            Purchase Custom Domain <ExternalLink className="w-4 h-4 ml-2" />
          </a>
        </Button>
      </SectionCard>
    );
  }

  const isLive = state.custom_domain_live;
  const isPending = !!state.custom_domain && !isLive;

  return (
    <div className="space-y-6">
      {isLive && (
        <Banner tone="success" title="Your domain is live.">
          <span className="break-all font-mono">{state.custom_domain}</span> now serves your SaaS experience.
        </Banner>
      )}

      {isPending && (
        <Banner tone="warning" title="Request received.">
          <span className="break-all font-mono">{state.custom_domain}</span> is in the queue. We'll notify you once
          it's live. Need to change it? Update it below and submit again.
        </Banner>
      )}

      <SectionCard
        icon={<Globe />}
        title="Custom Domain"
        description={
          <>
            Replace <span className="break-all font-mono">yoursoftwareonboarding.com</span> with your own domain or
            subdomain across your SaaS experience.
          </>
        }
        actions={
          isLive ? (
            <Tag tone="success"><CheckCircle2 aria-hidden="true" />Live</Tag>
          ) : isPending ? (
            <Tag tone="warning"><Clock aria-hidden="true" />Pending</Tag>
          ) : undefined
        }
      >
        <Field
          label="Domain or subdomain"
          htmlFor="domain"
          hint={
            <>
              Use a root domain (<span className="font-mono">yoursite.com</span>) or a subdomain (
              <span className="font-mono">app.yoursite.com</span>). After you submit, our team wires it up and
              notifies you the moment it goes live.
            </>
          }
        >
          <Input
            id="domain"
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            placeholder="app.yoursite.com"
            className="font-mono sm:max-w-md"
            disabled={submitting}
          />
        </Field>
        <SectionFooter note={!domainInput.trim() ? "Enter a domain to submit it." : undefined}>
          <Button variant="accent" onClick={handleSubmit} disabled={submitting || !domainInput.trim()}>
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isPending || isLive ? "Update domain" : "Submit domain"}
          </Button>
        </SectionFooter>
      </SectionCard>
    </div>
  );
}
