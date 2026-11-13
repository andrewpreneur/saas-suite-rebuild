import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import MarketingLayout from "@/components/MarketingLayout";
import PageSEO from "@/components/PageSEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { readWaitlistInvoke } from "@/lib/saasPartnerSubmit";
import {
  SAAS_PARTNER_MAX_LOGO_BYTES,
  SAAS_PARTNER_SOURCE,
  bytesToBase64,
  evaluateSaasPartnerSubmission,
  inspectLogo,
  type SaasPartnerField,
} from "../../supabase/functions/_shared/saasPartnerWaitlist";

const COPY =
  "SaaSSuite is a resource hub for SaaS founders, entrepreneurs and business owners. Add your SaaS to our directory and all our users can see it.";

const FIELD_IDS: Record<SaasPartnerField, string> = {
  business_name: "saas-partner-business",
  website: "saas-partner-website",
  contact_name: "saas-partner-name",
  email: "saas-partner-email",
  phone: "saas-partner-phone",
  affiliate_link: "saas-partner-affiliate",
  logo: "saas-partner-logo",
  started_at: "saas-partner-started-at",
};

type FieldErrors = Partial<Record<SaasPartnerField, string>>;

type LogoPayload = { base64: string; contentType: string };

const emptyForm = {
  businessName: "",
  website: "",
  contactName: "",
  email: "",
  phone: "",
  affiliateLink: "",
  companyUrl: "",
};

function RequiredMark() {
  return (
    <>
      <span className="text-destructive" aria-hidden="true">
        {" "}
        *
      </span>
      <span className="sr-only"> required</span>
    </>
  );
}

export default function SaasPartner() {
  const [params] = useSearchParams();
  const formTitleId = useId();
  const thanksRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [startedAt, setStartedAt] = useState(() => String(Date.now()));
  const [formKey, setFormKey] = useState(0);
  const [values, setValues] = useState(emptyForm);
  const [logo, setLogo] = useState<LogoPayload | null>(null);
  const [logoRejected, setLogoRejected] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [summaryFocus, setSummaryFocus] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [doneName, setDoneName] = useState("");

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  useEffect(() => {
    if (done) thanksRef.current?.focus();
  }, [done]);

  useEffect(() => {
    if (summaryFocus > 0) errorRef.current?.focus();
  }, [summaryFocus]);

  const focusIssue = (field: string | undefined) => {
    if (field === "started_at") {
      setSummaryFocus((tick) => tick + 1);
      return;
    }
    if (field && field in FIELD_IDS) document.getElementById(FIELD_IDS[field as SaasPartnerField])?.focus();
  };

  const setField = (key: keyof typeof emptyForm, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const clearLogo = () => {
    setLogo(null);
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  };

  const onLogo = async (file: File | null) => {
    setErrors((current) => ({ ...current, logo: undefined }));
    if (!file) {
      setLogoRejected("");
      clearLogo();
      return;
    }
    if (file.size > SAAS_PARTNER_MAX_LOGO_BYTES) {
      clearLogo();
      const message = "Logo must be a PNG, JPG, WEBP, or SVG under 2 MB.";
      setLogoRejected(message);
      setErrors((current) => ({ ...current, logo: message }));
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const inspected = inspectLogo(bytes, file.type || "");
    const accepted = inspected.logo;
    if (!inspected.ok || !accepted) {
      clearLogo();
      const message = inspected.error || "Upload a PNG, JPG, WEBP, or SVG logo.";
      setLogoRejected(message);
      setErrors((current) => ({ ...current, logo: message }));
      return;
    }
    setLogoRejected("");
    const url = URL.createObjectURL(new Blob([accepted.bytes.slice()], { type: accepted.contentType }));
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return url;
    });
    setLogo({ base64: bytesToBase64(accepted.bytes), contentType: accepted.contentType });
  };

  const reset = () => {
    setDone(false);
    setDoneName("");
    setValues(emptyForm);
    setErrors({});
    setFormError("");
    setLogoRejected("");
    clearLogo();
    setStartedAt(String(Date.now()));
    setFormKey((key) => key + 1);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (logoRejected) {
      setErrors((current) => ({ ...current, logo: logoRejected }));
      setFormError(logoRejected);
      document.getElementById(FIELD_IDS.logo)?.focus();
      return;
    }
    setFormError("");
    const payload: Record<string, unknown> = {
      business_name: values.businessName,
      website: values.website,
      contact_name: values.contactName,
      email: values.email,
      phone: values.phone,
      affiliate_link: values.affiliateLink,
      company_url: values.companyUrl,
      started_at: startedAt,
      source: SAAS_PARTNER_SOURCE,
      utm_source: params.get("utm_source") || "",
      utm_medium: params.get("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || "",
      utm_content: params.get("utm_content") || "",
      utm_term: params.get("utm_term") || "",
    };
    if (logo) {
      payload.logo_base64 = logo.base64;
      payload.logo_content_type = logo.contentType;
    }

    const decision = evaluateSaasPartnerSubmission(payload, Date.now());
    if (decision.kind === "invalid") {
      setErrors(decision.fields);
      setFormError(decision.error);
      focusIssue(decision.field);
      return;
    }

    setSubmitting(true);
    try {
      const invoked = await supabase.functions.invoke("saas-partner-waitlist", { body: payload });
      const result = await readWaitlistInvoke(invoked);
      if (!result.ok) {
        setFormError(result.error || "We couldn't add you to the waitlist. Please try again.");
        const next: FieldErrors = {};
        const source = result.fields || (result.field ? { [result.field]: result.error } : {});
        for (const key of Object.keys(FIELD_IDS) as SaasPartnerField[]) {
          if (source[key]) next[key] = source[key];
        }
        setErrors(next);
        focusIssue(result.field);
        return;
      }
      setErrors({});
      setDoneName(values.businessName.trim());
      setDone(true);
    } catch {
      setFormError("We couldn't add you to the waitlist. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MarketingLayout>
      <PageSEO
        title="Let us Promote Your SaaS | SaaSSuite"
        description={COPY}
        path="/saaspartner"
      />
      <div data-testid="saas-partner-page" className="bg-background text-foreground">
        <section className="border-b border-border/70 bg-gradient-background">
          <div className="mx-auto max-w-3xl px-4 py-10 text-center sm:px-6 sm:py-16">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">Join the SaaS directory waitlist</p>
            <h1 className="mx-auto mt-3 max-w-3xl text-3xl font-bold leading-tight sm:text-5xl">Let us Promote Your SaaS</h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">{COPY}</p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6 sm:py-12">
          <div className="rounded-lg border border-border bg-card p-4 shadow-elevated sm:p-7">
            {done ? (
              <div data-testid="saas-partner-thanks" className="py-6 text-center" aria-live="polite">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
                  <CheckCircle2 className="h-9 w-9" aria-hidden="true" />
                </div>
                <h2 ref={thanksRef} tabIndex={-1} className="mt-5 text-2xl font-bold outline-none">
                  You're on the waitlist
                </h2>
                <p className="mx-auto mt-3 max-w-md leading-7 text-muted-foreground">
                  Thanks. We received {doneName || "your SaaS"} and will review it for the directory.
                </p>
                <Button type="button" variant="outline" className="mt-6 min-h-11" onClick={reset}>
                  Add another SaaS
                </Button>
              </div>
            ) : (
              <form key={formKey} data-testid="saas-partner-form" onSubmit={submit} noValidate aria-labelledby={formTitleId} className="space-y-5">
                <div>
                  <h2 id={formTitleId} className="text-2xl font-bold">
                    Join the SaaS directory waitlist
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    No account needed. Fields marked required must be completed. Affiliate signup link and logo are optional.
                  </p>
                </div>

                <Field
                  id={FIELD_IDS.business_name}
                  label="Business name"
                  required
                  autoComplete="organization"
                  value={values.businessName}
                  error={errors.business_name}
                  onChange={(value) => setField("businessName", value)}
                />
                <Field
                  id={FIELD_IDS.website}
                  label="Business website"
                  required
                  autoComplete="url"
                  inputMode="url"
                  placeholder="https://yoursaas.com"
                  value={values.website}
                  error={errors.website}
                  onChange={(value) => setField("website", value)}
                />
                <Field
                  id={FIELD_IDS.contact_name}
                  label="Your name"
                  required
                  autoComplete="name"
                  value={values.contactName}
                  error={errors.contact_name}
                  onChange={(value) => setField("contactName", value)}
                />
                <Field
                  id={FIELD_IDS.email}
                  label="Email"
                  required
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={values.email}
                  error={errors.email}
                  onChange={(value) => setField("email", value)}
                />
                <Field
                  id={FIELD_IDS.phone}
                  label="Phone"
                  required
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  value={values.phone}
                  error={errors.phone}
                  onChange={(value) => setField("phone", value)}
                />
                <Field
                  id={FIELD_IDS.affiliate_link}
                  label="Affiliate signup link"
                  autoComplete="url"
                  inputMode="url"
                  placeholder="https://"
                  value={values.affiliateLink}
                  error={errors.affiliate_link}
                  onChange={(value) => setField("affiliateLink", value)}
                />

                <div className="space-y-2">
                  <Label htmlFor={FIELD_IDS.logo}>
                    Logo <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id={FIELD_IDS.logo}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg"
                    aria-invalid={errors.logo ? true : undefined}
                    aria-describedby={errors.logo ? "saas-partner-logo-error" : "saas-partner-logo-hint"}
                    className="min-h-11 cursor-pointer py-2"
                    onChange={(event) => {
                      void onLogo(event.target.files?.[0] || null);
                    }}
                  />
                  <p id="saas-partner-logo-hint" className="text-xs leading-5 text-muted-foreground">
                    PNG, JPG, WEBP, or SVG. 2 MB maximum.
                  </p>
                  {preview && (
                    <img src={preview} alt="Logo preview" className="mt-2 h-16 w-16 rounded-md border border-border object-contain" />
                  )}
                  {errors.logo && (
                    <p id="saas-partner-logo-error" className="text-sm text-destructive">
                      {errors.logo}
                    </p>
                  )}
                </div>

                <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
                  <Label htmlFor="saas-partner-company-url">Company URL</Label>
                  <Input
                    id="saas-partner-company-url"
                    name="company_url"
                    tabIndex={-1}
                    autoComplete="off"
                    value={values.companyUrl}
                    onChange={(event) => setField("companyUrl", event.target.value)}
                  />
                  <Label htmlFor={FIELD_IDS.started_at}>Form opened</Label>
                  <Input
                    id={FIELD_IDS.started_at}
                    name="started_at"
                    tabIndex={-1}
                    autoComplete="off"
                    value={startedAt}
                    onChange={(event) => setStartedAt(event.target.value)}
                  />
                </div>

                {formError && (
                  <p
                    ref={errorRef}
                    id="saas-partner-error"
                    data-testid="saas-partner-error"
                    role="alert"
                    tabIndex={-1}
                    className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
                  >
                    {formError}
                  </p>
                )}

                <Button type="submit" size="lg" className="min-h-11 w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                  {submitting ? "Sending" : "Join the waitlist"}
                </Button>
              </form>
            )}
          </div>
        </section>
      </div>
    </MarketingLayout>
  );
}

function Field({
  id,
  label,
  required,
  value,
  error,
  onChange,
  type = "text",
  autoComplete,
  inputMode,
  placeholder,
}: {
  id: string;
  label: string;
  required?: boolean;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  inputMode?: "text" | "email" | "tel" | "url";
  placeholder?: string;
}) {
  const errorId = `${id}-error`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required ? <RequiredMark /> : <span className="font-normal text-muted-foreground"> (optional)</span>}
      </Label>
      <Input
        id={id}
        name={id}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        value={value}
        maxLength={label === "Email" ? 320 : 500}
        className="min-h-11"
        onChange={(event) => onChange(event.target.value)}
      />
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
