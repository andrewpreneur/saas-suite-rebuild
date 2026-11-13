import { useEffect, useState } from "react";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/premium/settings/Field";
import { Disclosure, FieldError, PageSection, StatusRow } from "@/components/premium/settings/Page";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ExternalLink } from "lucide-react";

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
  const [domainError, setDomainError] = useState("");

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
      setDomainError("Enter a domain or subdomain without https://, like app.yoursite.com.");
      return;
    }
    setDomainError("");
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("submit-custom-domain", {
        body: { domain: raw },
      });
      if (error) throw error;
      if (!(data as any)?.ok) throw new Error((data as any)?.error || "Failed to submit");
      toast({ title: "Request received", description: "We'll notify you once your domain is live." });
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
        <div className="px-skeleton h-12 rounded-lg" />
        <div className="px-skeleton h-24 rounded-lg" />
      </div>
    );
  }

  if (!state?.custom_domain_access) {
    return (
      <div>
        <StatusRow tone="off" label="Not active" detail="An add-on. Buy it, then enter your domain here.">
          <Button asChild variant="accent" className="h-11 flex-1 sm:h-10 sm:flex-none">
            <a href="https://link.saassuite.ai/payment-link/6a3af2039f7c6c76d1f86d4c" target="_blank" rel="noreferrer">
              Buy Custom Domain <ExternalLink aria-hidden="true" />
            </a>
          </Button>
        </StatusRow>
        <Disclosure label="How it works">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              Buy the add-on. It replaces <span className="break-all font-mono">yoursoftwareonboarding.com</span> with
              your own domain or subdomain, such as <span className="font-mono">app.yoursite.com</span>.
            </li>
            <li>Come back to this page and enter the exact domain you want.</li>
            <li>Our team connects it and tells you the moment it is live.</li>
          </ol>
        </Disclosure>
      </div>
    );
  }

  const isLive = state.custom_domain_live;
  const isPending = !!state.custom_domain && !isLive;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <StatusRow
        tone={isLive ? "on" : isPending ? "pending" : "off"}
        label={
          isLive ? (
            <>
              Live on <span className="font-mono [overflow-wrap:anywhere]">{state.custom_domain}</span>
            </>
          ) : isPending ? (
            <>
              Request received for <span className="font-mono [overflow-wrap:anywhere]">{state.custom_domain}</span>
            </>
          ) : (
            "No domain yet"
          )
        }
        detail={
          isLive
            ? "Your SaaS experience is served from this domain."
            : isPending
              ? "Our team is connecting it and will tell you when it is live."
              : "Enter the domain you want and our team connects it for you."
        }
      />
      <PageSection>
        <Field label="Domain or subdomain" htmlFor="domain" hint="A root domain or a subdomain, like app.yoursite.com.">
          <Input
            id="domain"
            value={domainInput}
            onChange={(e) => {
              setDomainInput(e.target.value);
              setDomainError("");
            }}
            placeholder="app.yoursite.com"
            className="font-mono sm:max-w-md"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={submitting}
            aria-invalid={!!domainError}
            aria-describedby={domainError ? "domain-error" : undefined}
          />
          <FieldError id="domain-error">{domainError}</FieldError>
        </Field>
        <div className="mt-4 flex justify-end">
          <Button
            type="submit"
            variant="accent"
            className="h-11 w-full sm:h-10 sm:w-auto"
            disabled={submitting || !domainInput.trim()}
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" /> Sending domain
              </>
            ) : isPending || isLive ? (
              "Update domain"
            ) : (
              "Submit domain"
            )}
          </Button>
        </div>
      </PageSection>
    </form>
  );
}
