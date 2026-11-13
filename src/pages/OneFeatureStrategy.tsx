import { useEffect, useRef, useState } from "react";
import Footer from "@/components/Footer";
import PageSEO from "@/components/PageSEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, ArrowRight, Users } from "lucide-react";
import { TrainingVideo, fireConfirmedLead, leadTracking, useGoTo } from "@/components/one-feature/shared";
import BonusOptIn, { type BonusLead } from "@/components/one-feature/BonusOptIn";
import { OUTCOME_HEADLINE_A, paidSocialActive, rememberPaidSocial, trainingGhlHref } from "@/lib/funnelContracts";
import StripeEmbeddedCheckout, { prefetchEmbeddedStripe } from "@/components/StripeEmbeddedCheckout";
import { oneFeatureDestination, ONE_FEATURE_TRIAL_SOURCE, ONE_FEATURE_TRIAL_REDIRECT, type OneFeaturePlan } from "@/lib/oneFeatureFlow";
import PlanFeatureLabel from "@/components/pricing/PlanFeatureLabel";
import { SAME_DAY_WL_SUPPORT } from "@/constants/pricingPlans";
import { supabase } from "@/integrations/supabase/client";
import { trackingPixelsAllowed } from "@/utils/trackingConsent";
import { preloadTrainingSuccess } from "@/lib/trainingSuccessNav";
import { TextUsLink } from "@/components/TextUsLink";

type Step = "bonuses" | "account" | "plan" | "destination" | "setup";

function trackOft(name: string, params?: Record<string, string>) {
  try {
    const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
    if (typeof fbq === "function" && trackingPixelsAllowed()) fbq("trackCustom", name, params || {});
  } catch {
    /* ignore */
  }
}

const OneFeatureStrategy = ({ variant }: { variant: 3 | 4 | 5 }) => {
  const goTo = useGoTo();
  const openingRef = useRef(false);
  const [openingKit, setOpeningKit] = useState(false);
  useEffect(() => {
    rememberPaidSocial(window.location.search);
  }, []);
  useEffect(() => {
    if (variant === 5) void preloadTrainingSuccess();
  }, [variant]);
  const [step, setStep] = useState<Step>(variant === 3 ? "account" : "bonuses");
  const [plan, setPlan] = useState<OneFeaturePlan | null>(null);
  const [hasAccount, setHasAccount] = useState<boolean | null>(null);
  const [lead, setLead] = useState<BonusLead | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [checkoutEmail, setCheckoutEmail] = useState("");
  const destination = plan ? oneFeatureDestination(plan) : null;
  const [savedLead, setSavedLead] = useState<{ id: string; email: string } | null>(null);
  // Plan is stored on the lead row only (not sent to the webhook).
  const savePlan = (value: string) => {
    if (!savedLead) return;
    void supabase.functions.invoke("one-feature-lead", { body: { action: "plan", lead_id: savedLead.id, email: savedLead.email, plan: value } });
  };

  const utmFromLocation = () => Object.fromEntries([...new URLSearchParams(window.location.search)].filter(([key]) => key.startsWith("utm_") || key === "fbclid"));

  const saveEarly = async (details: BonusLead) => {
    setLead(details);
    setCheckoutEmail(details.email);
    setError("");
    setSaving(true);
    try {
      const { data, error: insertError } = await supabase.functions.invoke("one-feature-lead", { body: {
        action: "create", ...details, via: "form", page: `onefeaturetraining-${variant}`, form: "bonuses", utm: utmFromLocation(), meta: leadTracking(),
      } });
      if (insertError || !data?.lead_id) throw insertError || new Error("no lead");
      if (data.created === true && typeof data.event_id === "string") fireConfirmedLead(data.event_id, `onefeaturetraining-${variant}`);
      setSavedLead({ id: data.lead_id, email: details.email });
      setStep("account");
    } catch {
      setError("We couldn't save that. Check your details and try again.");
    } finally {
      setSaving(false);
    }
  };

  const pickAccount = async (answer: boolean) => {
    setHasAccount(answer);
    setError("");
    setSaving(true);
    try {
      if (savedLead) {
        const { error: updateError } = await supabase.functions.invoke("one-feature-lead", { body: {
          action: "highlevel", lead_id: savedLead.id, email: savedLead.email, has_highlevel: answer,
        } });
        if (updateError) throw updateError;
        if (!answer) {
          const { error: planError } = await supabase.functions.invoke("one-feature-lead", { body: {
            action: "plan", lead_id: savedLead.id, email: savedLead.email, plan: "none",
          } });
          if (planError) throw planError;
        }
      } else if (lead) {
        const { data, error: insertError } = await supabase.functions.invoke("one-feature-lead", { body: {
          ...lead, has_highlevel: answer, page: `onefeaturetraining-${variant}`, form: "bonuses", utm: utmFromLocation(), meta: leadTracking(),
        } });
        if (insertError) throw insertError;
        if (data?.created === true && typeof data.event_id === "string") fireConfirmedLead(data.event_id, `onefeaturetraining-${variant}`);
        if (data?.lead_id) setSavedLead({ id: data.lead_id, email: lead.email });
        setLead(null);
      }
    } catch {
      setError(variant === 5 ? "We couldn't save that. Tap your answer again to retry." : "We couldn't save your bonuses request. Please choose your answer again to retry.");
      setSaving(false);
      return;
    }
    setSaving(false);
    if (variant === 5) trackOft("oft_step_has_ghl", { value: answer ? "yes" : "no" });
    if (answer) setStep("plan");
    else { setPlan("none"); setStep("destination"); }
  };

  return (
    <>
      <PageSEO title={variant === 5 ? "Sell One GHL Feature as Your Own Software | Free Training" : "I sell ONE GHL Feature for $99/month | Free Training"} description={variant === 5 ? "Watch the free training, then we'll set up the one-feature system inside your GoHighLevel account for you. Free with your GoHighLevel account." : "Watch Andrew's free training, find your next step, and get help building your One-Feature SaaS."} path={`/onefeaturetraining-${variant}`} noindex={variant === 5} />
      <div className="min-h-screen bg-background">
        <main className="webinar-2-hero mx-auto max-w-5xl px-4 pb-10 pt-3 text-center sm:px-8 sm:pb-14 sm:pt-5">
          <img src="/assets/saassuite-logo.png" alt="SaaSSuite" width={48} height={48} decoding="async" fetchPriority="low" className="mx-auto mb-3 h-10 w-10 object-contain sm:h-12 sm:w-12" />
          <h1 aria-label={variant === 5 ? OUTCOME_HEADLINE_A : undefined} className="mx-auto mb-4 max-w-4xl text-[28px] font-extrabold leading-tight text-foreground sm:text-[40px] md:text-[46px]">
            {variant === 5 ? <>Sell <span className="webinar-2-accent">ONE GoHighLevel Feature</span> as Your Own Software, and <span className="webinar-2-accent">We'll Set It Up For You</span></> : <>I sell <span className="webinar-2-accent">ONE GHL Feature</span> for $99/month and <span className="webinar-2-accent">THIS is how...</span></>}
          </h1>
          <TrainingVideo captions={variant === 5} />
          {variant === 5 && (
            <p className="mt-4 flex items-center justify-center gap-2 text-[16px] font-semibold text-foreground sm:text-[18px]">
              <Users className="h-5 w-5 webinar-2-accent" aria-hidden="true" />
              <span>★ Trusted by 1,200+ agencies</span>
            </p>
          )}
           <div className="mx-auto mt-4 flex max-w-3xl items-center justify-center gap-3 text-left sm:mt-5 sm:gap-8">
             <p className="min-w-0 flex-1 text-lg font-extrabold leading-snug text-foreground sm:pl-[8%] sm:text-[26px]">
               {variant === 5 ? <>Watch the free training. Then sign up through SaaSSuite and our team installs this exact setup in your GoHighLevel account, free.</> : <>Signup/Upgrade and we will Implement this <span className="webinar-2-accent">EXACT setup FOR YOU</span> for <span className="webinar-2-accent">FREE</span></>}
             </p>
             <div className="mr-[4%] flex w-32 shrink-0 flex-col items-center sm:mr-[10%] sm:w-48">
               <p className="webinar-2-accent text-center text-[11px] font-bold uppercase leading-tight sm:text-sm">{variant === 5 ? "FREE BONUS" : <>$599 bonus<br />when you sign up</>}</p>
               <div className="mt-2 flex items-center gap-2">
                 <svg className="webinar-2-arrow h-7 w-9 shrink-0 sm:h-9 sm:w-14" viewBox="0 0 64 28" fill="none" aria-hidden="true">
                   <path d="M3 21c12 2 27-1 45-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                   <path d="m41 6 15 6-12 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                 </svg>
                 <div className="webinar-2-book flex h-20 w-16 shrink-0 flex-col items-center justify-center gap-1 sm:h-24 sm:w-20">
                   <img src="/assets/saassuite-logo.png" alt="" width={32} height={32} className="h-7 w-7 object-contain sm:h-9 sm:w-9" />
                   <span className="text-[10px] font-bold text-foreground sm:text-xs">SaaSSuite</span>
                   <span className="webinar-2-accent text-xs font-extrabold sm:text-sm">FREE</span>
                 </div>
               </div>
             </div>
           </div>
          <section className="mx-auto mt-5 max-w-xl sm:mt-7" aria-label="Your next step">
            {step === "bonuses" && variant === 5 && (
              <div className="webinar-2-hero rounded-2xl px-4 py-5 sm:px-6">
                <ul className="mb-4 space-y-1 text-left text-base">
                  <li>✓ The one-feature system installed for you inside your GoHighLevel account</li>
                  <li>✓ The brandless AI Studio sales video, ready to put on your page</li>
                  <li>✓ SaaSSuite: Free with Your GoHighLevel Account</li>
                </ul>
                <BonusOptIn busy={saving} heading="Tell us where to send your free setup" namePlaceholder="First name" emailPlaceholder="Best email" phonePlaceholder="Mobile (for setup updates)" button="Send Me the Free Setup →" onDone={(details) => { void saveEarly(details); }} />
                <p className="text-xs text-muted-foreground">No spam. We'll only use your number for setup updates. <TextUsLink variant="inline" icon={false} className="text-xs">Text us anytime</TextUsLink>.</p>
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              </div>
            )}
            {step === "bonuses" && variant !== 5 && (
              <BonusOptIn onDone={(details) => { setLead(details); setCheckoutEmail(details.email); setStep("account"); }} />
            )}
            {step === "account" && (
              <div className="space-y-3">
                {variant === 5 && lead && <p className="text-sm font-semibold">✓ Got it, {lead.name.split(" ")[0]}. Your free bonus is on the way.</p>}
                <h2 className="text-xl font-extrabold text-foreground sm:text-2xl">{variant === 5 ? "Do you already have a GoHighLevel account?" : "Do you have a GHL account?"}</h2>
                <div className="grid grid-cols-2 gap-3">
                  {[true, false].map((answer) => <Button key={String(answer)} variant="outline" disabled={saving} aria-pressed={hasAccount === answer} onClick={() => void pickAccount(answer)} className="one-feature-choice h-14 border-2 text-lg font-bold">{variant === 5 ? (answer ? "Yes, I have GHL" : "Not yet") : (answer ? "Yes" : "No")}</Button>)}
                </div>
                {saving && <p role="status" className="text-sm text-muted-foreground">{variant === 5 ? "Saving your answer…" : "Saving your bonuses request..."}</p>}
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              </div>
            )}
            {step === "plan" && (
              <div className="space-y-3">
                <h2 className="text-xl font-extrabold text-foreground sm:text-2xl">{variant === 5 ? "Which HighLevel plan are you on?" : "What HighLevel plan are you on?"}</h2>
                {variant === 5 && <p className="text-sm text-muted-foreground">Not sure? Pick your best guess. It only changes how we set things up.</p>}
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {(["97", "297", "497"] as const).map((value) => <Button key={value} variant="outline" aria-pressed={plan === value} onClick={() => { setPlan(value); savePlan(value); if (variant === 5) trackOft("oft_step_plan", { plan: value }); setStep(variant === 5 ? "setup" : "destination"); }} className="one-feature-choice h-auto min-h-16 flex-col gap-0 border-2 px-2 py-3 text-lg font-bold">${value}<span className="text-xs font-normal">/ month</span></Button>)}
                </div>
                <Button variant="ghost" onClick={() => setStep("account")}><ArrowLeft /> Back</Button>
              </div>
            )}
            {step === "setup" && (
              <div className="space-y-3 text-left">
                <h2 className="text-center text-xl font-extrabold text-foreground sm:text-2xl">You're in the right place. Let's set it up for you.</h2>
                <ol className="list-decimal space-y-1 pl-5 text-sm">
                  <li>Activate your free SaaSSuite account. No card needed.</li>
                  <li>Tell us about your GoHighLevel account on the next screen (about 2 minutes, all online).</li>
                  <li>Our team installs the one-feature system in your account and emails you when it's live.</li>
                </ol>
                <Button className="webinar-2-cta h-auto min-h-14 w-full whitespace-normal px-4 py-3 text-base font-bold sm:text-lg" disabled={openingKit} onClick={() => { if (openingRef.current) return; openingRef.current = true; setOpeningKit(true); trackOft("oft_dfy_request"); const lead = savedLead?.id ? `&lead=${encodeURIComponent(savedLead.id)}` : ""; goTo(`/onefeaturetraining-success?src=oft5${lead}`); }}>{openingKit ? "Opening your kit…" : "Activate SaaSSuite Free & Request My Setup →"}</Button>
                <p className="text-sm text-muted-foreground">Free with Your GoHighLevel Account. No card required. Advanced is free for new affiliate signups only.</p>
                <Button variant="ghost" onClick={() => setStep("plan")}><ArrowLeft /> Back</Button>
              </div>
            )}
            {step === "destination" && variant === 5 && plan === "none" && (
              <div className="space-y-3">
                <h2 className="text-xl font-extrabold text-foreground sm:text-2xl">Start your free GoHighLevel trial and we'll build it for you</h2>
                <p className="text-base text-muted-foreground">Sign up for GoHighLevel through our link and you get SaaSSuite Advanced free, plus our team installs the one-feature system in your new account. No card needed for SaaSSuite.</p>
                <Button asChild className="webinar-2-cta h-auto min-h-14 w-full whitespace-normal px-4 py-3 text-base font-bold sm:text-lg">
                  <a href={trainingGhlHref(window.location.search)} target="_blank" rel="noopener noreferrer" onClick={() => { trackOft("oft_ghl_click"); if (savedLead) void supabase.functions.invoke("one-feature-lead", { body: { action: "update", lead_id: savedLead.id, email: savedLead.email, ghl_signup_via_affiliate: paidSocialActive(window.location.search) } }); }}>Start My Free GoHighLevel Trial →</a>
                </Button>
                <p className="text-sm text-muted-foreground">SaaSSuite Advanced is free for new GoHighLevel signups through our link. Advanced is free for new affiliate signups only. GoHighLevel itself is billed by HighLevel. We're an independent HighLevel affiliate.</p>
                <Button variant="ghost" onClick={() => setStep("account")}><ArrowLeft /> Back</Button>
              </div>
            )}
            {step === "destination" && destination && variant !== 5 && (
              <div className="space-y-3">
                <h2 className="text-xl font-extrabold text-foreground sm:text-2xl">{plan === "none" ? "Start your free HighLevel trial" : "Your exclusive 14-day SaaSSuite trial: we set it up FOR you"}</h2>
                <p className="text-base text-muted-foreground">{plan === "none" ? "Sign up for a free GHL trial using our link, and our team will build this for you." : "You don't have to build a thing. 1) Start your free trial. 2) Book your success call. 3) Our team sets up this exact system for you."}</p>
                {destination.kind === "affiliate" ? (
                  <>
                    <Button asChild className="webinar-2-cta h-auto min-h-14 w-full whitespace-normal px-4 py-3 text-base font-bold sm:text-lg"><a href={destination.url}>Start My FREE GHL Trial<ArrowRight className="shrink-0" /></a></Button>
                  </>
                ) : (
                  <>
                    <Button className="webinar-2-cta h-auto min-h-14 w-full whitespace-normal px-4 py-3 text-base font-bold sm:text-lg" onPointerDown={() => { void prefetchEmbeddedStripe(); }} onMouseEnter={() => { void prefetchEmbeddedStripe(); }} onClick={() => { if (checkoutEmail) setCheckoutOpen(true); else setEmailOpen(true); }}>Start My Free Trial and Have Your Team Set It Up</Button>
                    <p className="text-sm text-muted-foreground">14 days free, then $97/month. Card required. Cancel before your trial ends to avoid a charge.</p>
                    <p className="text-sm text-foreground"><PlanFeatureLabel feature={SAME_DAY_WL_SUPPORT} /></p>
                  </>
                )}
                <Button variant="ghost" onClick={() => setStep(plan === "none" ? "account" : "plan")}><ArrowLeft /> Back</Button>
              </div>
            )}
          </section>
          {variant === 5 && (
            <section className="mx-auto mt-10 max-w-xl space-y-3 text-left text-base">
              <blockquote className="glass-card rounded-2xl p-4 shadow-sm"><p className="text-gold" aria-hidden="true">★★★★★</p><p className="mt-2">“SaaSSuite.ai is AMAZING. I was so confused, I didn't know how to support my customers — now I have a clear plan and I can move forward.” <b>Brentney</b></p></blockquote>
              <blockquote className="glass-card rounded-2xl p-4 shadow-sm"><p className="text-gold" aria-hidden="true">★★★★★</p><p className="mt-2">“Andrew always follows through with what he says he's going to do. He's taken really good care of us.” <b>Ben</b></p></blockquote>
              <blockquote className="glass-card rounded-2xl p-4 shadow-sm"><p className="text-gold" aria-hidden="true">★★★★★</p><p className="mt-2">“SaaSSuite is Amazing. Shoutout to Andrew, love what he's doing. Highly recommend!” <b>Rob</b></p></blockquote>
              <p className="text-xs text-muted-foreground">Affiliate disclosure: we are a HighLevel affiliate and may earn a commission if you sign up to HighLevel through our link, at no extra cost to you.</p>
            </section>
          )}
        </main>
        <Footer minimal />
      </div>
      {variant !== 5 && (
        <>
          <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
            <DialogContent className="max-w-md">
              <DialogTitle>Start your free trial, then we set it up for you</DialogTitle>
              <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); setCheckoutEmail(checkoutEmail.trim().toLowerCase()); setEmailOpen(false); setCheckoutOpen(true); }}>
                <Input aria-label="Trial email" type="email" autoComplete="email" required placeholder="Email" value={checkoutEmail} onChange={(event) => setCheckoutEmail(event.target.value)} className="h-12 text-base" />
                <Button type="submit" className="webinar-2-cta h-12 w-full font-bold" onPointerDown={() => { void prefetchEmbeddedStripe(); }} onMouseEnter={() => { void prefetchEmbeddedStripe(); }}>Continue to Secure Checkout</Button>
              </form>
            </DialogContent>
          </Dialog>
          <StripeEmbeddedCheckout plan="advanced" trialSource={ONE_FEATURE_TRIAL_SOURCE} email={checkoutEmail.trim().toLowerCase()} open={checkoutOpen} onOpenChange={setCheckoutOpen} suppressRedirect onComplete={() => { window.location.href = ONE_FEATURE_TRIAL_REDIRECT; }} />
        </>
      )}
    </>
  );
};

export default OneFeatureStrategy;
