import { useState, useEffect } from "react";
import { Banner } from "@/components/ui/banner";
import { Tag } from "@/components/ui/tag";
import { SectionCard } from "@/components/premium/SectionCard";
import { Field, SectionFooter } from "@/components/premium/settings/Field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { ExternalLink, CheckCircle2, Clock, Target } from "lucide-react";
import { PageHeader } from "@/components/platform/PageHeader";
import { LoadNotice } from "@/components/platform/LoadNotice";
import { LOAD_TIMEOUT_MESSAGE, armLoadDeadline, loadErrorText, withDeadline } from "@/lib/loadSettle";

export function FreeLeadsRequest() {
  const { toast } = useToast();
  const { email } = useUser();
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [leadsUrl, setLeadsUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("pending");

  const [formData, setFormData] = useState({
    businessKeywords: "",
    city: "",
    country: "",
  });

  useEffect(() => {
    checkExistingSubmission();
  }, [email, loadAttempt]);

  const checkExistingSubmission = async () => {
    if (!email) {
      setIsLoading(false);
      setLoadError(null);
      return;
    }
    setLoadError(null);
    const stop = armLoadDeadline(() => {
      setIsLoading(false);
      setLoadError(LOAD_TIMEOUT_MESSAGE);
    });

    try {
      const { data, error } = await withDeadline(supabase
        .from("free_leads")
        .select("*")
        .eq("user_email", email)
        .maybeSingle());

      if (error) throw error;

      if (data) {
        setHasSubmitted(true);
        setFormData({
          businessKeywords: data.business_keywords,
          city: data.city,
          country: data.country,
        });
        setLeadsUrl((data as any).leads_url ?? null);
        setStatus((data as any).status ?? "pending");
      }
      setLoadError(null);
    } catch (error) {
      console.error("Error checking submission:", error);
      setLoadError(loadErrorText(error, "Couldn't load free leads."));
    } finally {
      stop();
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast({
        title: "Error",
        description: "You must be logged in to submit this form.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.businessKeywords.trim() || !formData.city.trim() || !formData.country.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("free_leads").insert({
        user_email: email,
        business_keywords: formData.businessKeywords,
        city: formData.city,
        country: formData.country,
      });

      if (error) throw error;

      setHasSubmitted(true);
      toast({
        title: "Success!",
        description: "Your free leads request has been submitted successfully.",
      });
    } catch (error: any) {
      console.error("Error submitting request:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadError || isLoading) {
    return (
      <LoadNotice
        loading={isLoading}
        error={loadError}
        label="Loading free leads…"
        onRetry={() => setLoadAttempt((attempt) => attempt + 1)}
      />
    );
  }

  const header = (
    <PageHeader
      eyebrow="Grow"
      title="Free leads"
      subtitle="Tell us who you want to reach. You can submit this request once."
    />
  );

  const summary = (
    <dl className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-3">
      <div className="min-w-0 sm:col-span-3">
        <dt className="text-xs text-muted-foreground">Business keywords or industries</dt>
        <dd className="mt-0.5 break-words text-sm font-medium text-foreground">{formData.businessKeywords}</dd>
      </div>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">City</dt>
        <dd className="mt-0.5 break-words text-sm font-medium text-foreground">{formData.city}</dd>
      </div>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">Country</dt>
        <dd className="mt-0.5 break-words text-sm font-medium text-foreground">{formData.country}</dd>
      </div>
    </dl>
  );

  if (hasSubmitted) {
    if (status === "delivered" && leadsUrl) {
      return (
        <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6">
          {header}
          <SectionCard
            icon={<CheckCircle2 />}
            title="Your free leads are ready"
            description="Your leads list has been delivered. Open it in a new tab."
            actions={<Tag tone="success"><CheckCircle2 aria-hidden="true" />Delivered</Tag>}
          >
            <div className="space-y-4">
              <Button asChild variant="accent" className="h-11 w-full sm:h-10 sm:w-auto">
                <a href={leadsUrl} target="_blank" rel="noopener noreferrer">
                  Open leads list <ExternalLink />
                </a>
              </Button>
              {summary}
            </div>
          </SectionCard>
        </div>
      );
    }
    return (
      <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6">
        {header}
        <SectionCard
          icon={<Clock />}
          title="Free leads request submitted"
          description="You have used your free leads token. Here is what you sent us."
          actions={<Tag tone="info"><Clock aria-hidden="true" />In progress</Tag>}
        >
          <div className="space-y-4">
            {summary}
            <Banner tone="info" title="Nothing else to do.">
              Your free leads will be processed and delivered to you shortly.
            </Banner>
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6">
      {header}
      <SectionCard
        icon={<Target />}
        title="Request your free leads"
        description="Describe the businesses you want to reach and where they are."
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <Banner
            tone="warning"
            title="First, add your categories to the Google Sheet."
            action={
              <Button asChild variant="outline" size="sm" className="h-11 sm:h-9">
                <a
                  href="https://docs.google.com/spreadsheets/d/18sA5NE8hP_rb3OWyHNeem9lTv64GCMo4KjksOT1xk10/edit?usp=sharing"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open the Google Sheet <ExternalLink />
                </a>
              </Button>
            }
          >
            If you skip this step, you will not receive any leads.
          </Banner>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Business keywords or industries"
              htmlFor="businessKeywords"
              hint="Separate each one with a comma."
              className="sm:col-span-2"
            >
              <Textarea
                id="businessKeywords"
                placeholder="e.g., Real Estate, HVAC, Plumbing, Dental Clinics"
                value={formData.businessKeywords}
                onChange={(e) => setFormData({ ...formData, businessKeywords: e.target.value })}
                rows={4}
                required
              />
            </Field>
            <Field label="City" htmlFor="city">
              <Input
                id="city"
                type="text"
                placeholder="e.g., New York"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                autoComplete="address-level2"
                required
              />
            </Field>
            <Field label="Country" htmlFor="country">
              <Input
                id="country"
                type="text"
                placeholder="e.g., United States"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                autoComplete="country-name"
                required
              />
            </Field>
          </div>

          <SectionFooter note="All three fields are required. You can only submit this form once.">
            <Button type="submit" variant="accent" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit free leads request"}
            </Button>
          </SectionFooter>
        </form>
      </SectionCard>
    </div>
  );
}
