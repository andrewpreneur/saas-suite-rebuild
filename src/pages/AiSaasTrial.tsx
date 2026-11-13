import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageSEO from "@/components/PageSEO";
import StripeEmbeddedCheckout, { prefetchEmbeddedStripe } from "@/components/StripeEmbeddedCheckout";
import { SAAS_DISCOUNT_CODE } from "@/components/one-feature/shared";
import PlanFeatureLabel from "@/components/pricing/PlanFeatureLabel";
import { SAME_DAY_WL_SUPPORT } from "@/constants/pricingPlans";

const TRIAL_SOURCE = "aisaas_code_14day";

export default function AiSaasTrial() {
  const [params] = useSearchParams();
  const [code, setCode] = useState((params.get("code") || "").toUpperCase());
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const normalized = email.trim().toLowerCase();

  const start = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().toUpperCase() !== SAAS_DISCOUNT_CODE) return setError("That code isn't valid.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return setError("Enter a valid email.");
    setError("");
    setOpen(true);
  };

  return (
    <main className="webinar-2-hero min-h-screen px-4 py-10 text-center sm:py-16">
      <PageSEO
        title="Your 14-Day Free Trial Is Unlocked | SaaSSuite"
        description="Enter code AISAAS to start the SaaSSuite $97/month plan free for 14 days. Cancel before the trial ends to avoid a charge."
        path="/aisaas"
      />
      <img src="/assets/saassuite-logo.png" alt="SaaSSuite" width={48} height={48} className="mx-auto mb-4 h-12 w-12 object-contain" />
      <h1 className="mx-auto max-w-2xl text-3xl font-bold sm:text-5xl">Your 14-Day Free Trial Is Unlocked</h1>
      <p className="mx-auto mt-3 max-w-xl text-muted-foreground">Enter code <strong className="text-foreground">{SAAS_DISCOUNT_CODE}</strong> to start the SaaSSuite $97/month plan free for 14 days.</p>
      <ul className="mx-auto mt-6 grid max-w-md gap-2 text-left text-sm">
        {["14 days free, then $97/month", "Cancel any time before the trial ends", "Our team helps you get set up", SAME_DAY_WL_SUPPORT].map((t) => (
          <li key={t} className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-primary" /><PlanFeatureLabel feature={t} /></li>
        ))}
      </ul>
      <form onSubmit={start} className="mx-auto mt-8 grid max-w-md gap-3 rounded-xl border border-border bg-card p-6 shadow-lg">
        <Input aria-label="Code" placeholder="Code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        <Input aria-label="Email" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          type="submit"
          size="lg"
          onPointerDown={() => { void prefetchEmbeddedStripe(); }}
          onMouseEnter={() => { void prefetchEmbeddedStripe(); }}
        >Start My Free Trial</Button>
      </form>
      <StripeEmbeddedCheckout plan="advanced" trialSource={TRIAL_SOURCE} email={normalized} open={open} onOpenChange={setOpen} />
    </main>
  );
}
