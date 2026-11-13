import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { ExternalLink, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

  if (hasSubmitted) {
    if (status === "delivered" && leadsUrl) {
      return (
        <div className="mx-auto w-full max-w-2xl space-y-4 p-1">
          <PageHeader
            title="Free leads"
            subtitle="Tell us who you want to reach. You can submit this request once."
          />
          <Card className="max-w-2xl w-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                <CardTitle>Your Free Leads Are Ready!</CardTitle>
              </div>
              <CardDescription>Your leads list has been delivered. Open the link below to access them.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <a
                href={leadsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
              >
                Open Leads List <ExternalLink className="h-4 w-4" />
              </a>
              <div className="pt-4 border-t space-y-2 text-sm text-muted-foreground">
                <p><strong className="text-foreground">Keywords:</strong> {formData.businessKeywords}</p>
                <p><strong className="text-foreground">Location:</strong> {formData.city}, {formData.country}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 p-1">
        <PageHeader
          title="Free leads"
          subtitle="Tell us who you want to reach. You can submit this request once."
        />
        <Card className="max-w-2xl w-full">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <CardTitle>Free Leads Request Submitted</CardTitle>
            </div>
            <CardDescription>
              You have already used your free leads token. Here's your submitted information:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Business Keywords/Industries</Label>
              <p className="mt-1 text-foreground">{formData.businessKeywords}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">City</Label>
              <p className="mt-1 text-foreground">{formData.city}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Country</Label>
              <p className="mt-1 text-foreground">{formData.country}</p>
            </div>
            <Alert>
              <AlertDescription>
                Your free leads will be processed and delivered to you shortly.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-1">
      <PageHeader
        title="Free leads"
        subtitle="Tell us who you want to reach. You can submit this request once."
      />
      <div className="flex items-center justify-center">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <CardTitle>Request Your Free Leads</CardTitle>
          <CardDescription>
            Fill out the form below to receive your free leads. You can only submit this form once.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6">
            <AlertDescription className="flex items-start gap-2">
              <ExternalLink className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <strong>Important:</strong> You must input your categories on{" "}
                <a
                  href="https://docs.google.com/spreadsheets/d/18sA5NE8hP_rb3OWyHNeem9lTv64GCMo4KjksOT1xk10/edit?usp=sharing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-primary"
                >
                  this Google Sheet
                </a>
                . If you do not complete this step, you will not receive any leads.
              </div>
            </AlertDescription>
          </Alert>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="businessKeywords">Business Keywords/Industries to Search For *</Label>
              <Textarea
                id="businessKeywords"
                placeholder="e.g., Real Estate, HVAC, Plumbing, Dental Clinics"
                value={formData.businessKeywords}
                onChange={(e) => setFormData({ ...formData, businessKeywords: e.target.value })}
                rows={4}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                type="text"
                placeholder="e.g., New York"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Country *</Label>
              <Input
                id="country"
                type="text"
                placeholder="e.g., United States"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit Free Leads Request"}
            </Button>
          </form>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
