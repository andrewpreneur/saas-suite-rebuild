import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Footer from "@/components/Footer";
import { FunnelSuccessLinktree } from "@/components/funnel/FunnelSuccessLinktree";
import PageSEO from "@/components/PageSEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { highlevelersSessionId, saveFunnelStep, visitContext } from "@/lib/funnelApplyClient";
import { paidSocialActive, rememberPaidSocial, trainingGhlHref } from "@/lib/funnelContracts";
import { trackingPixelsAllowed } from "@/utils/trackingConsent";

type Funnel = "highlevelers" | "highlevelers_upgrade";
type Step = "optin" | "status" | "plan" | "thanks" | "claimed";
type Status = "none" | "new" | "has_it" | "";
type Plan = "starter" | "unlimited" | "saas_pro" | "not_sure" | "none" | "";

const PLANS = [
  { value: "starter", label: "Starter" },
  { value: "unlimited", label: "Unlimited" },
  { value: "saas_pro", label: "Agency Pro (SaaS)" },
  { value: "not_sure", label: "Not sure" },
] as const;

const STEPS = new Set<Step>(["optin", "status", "plan", "thanks", "claimed"]);
const STATUSES = new Set<Status>(["none", "new", "has_it", ""]);
const PLAN_VALUES = new Set<Plan>(["starter", "unlimited", "saas_pro", "not_sure", "none", ""]);

function readDraft(funnel: Funnel): { name: string; email: string; status: Status; plan: Plan; step: Step } | null {
  try {
    const raw = localStorage.getItem(`hl_apply_draft:${funnel}`);
    const session = localStorage.getItem("hl_apply_session");
    if (!raw || !session) return null;
    const parsed = JSON.parse(raw) as { session?: string; name?: string; email?: string; status?: string; plan?: string; step?: string };
    if (parsed.session !== session || !STEPS.has(parsed.step as Step)) return null;
    return {
      name: typeof parsed.name === "string" ? parsed.name : "",
      email: typeof parsed.email === "string" ? parsed.email : "",
      status: STATUSES.has(parsed.status as Status) ? (parsed.status as Status) : "",
      plan: PLAN_VALUES.has(parsed.plan as Plan) ? (parsed.plan as Plan) : "",
      step: parsed.step as Step,
    };
  } catch {
    return null;
  }
}

function track(name: string, params?: Record<string, string>) {
  try {
    const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
    if (typeof fbq === "function" && trackingPixelsAllowed()) fbq("trackCustom", name, params || {});
  } catch {
    /* ignore */
  }
}

function visitMeta() {
  const cookie = (name: string) => {
    try {
      return document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))?.[1] ?? "";
    } catch {
      return "";
    }
  };
  let fbclid = "";
  try {
    fbclid = new URLSearchParams(window.location.search).get("fbclid") || "";
  } catch {
    /* ignore */
  }
  return { fbp: cookie("_fbp"), fbc: cookie("_fbc"), fbclid };
}

function lead(eventId: string, contentName: string) {
  if (!eventId.startsWith("lead_")) return;
  try {
    const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
    if (typeof fbq === "function" && trackingPixelsAllowed()) {
      fbq("track", "Lead", { content_name: contentName }, { eventID: eventId });
    }
  } catch {
    /* ignore */
  }
}

const HighLevelers = ({ funnel }: { funnel: Funnel }) => {
  const upgrade = funnel === "highlevelers_upgrade";
  const sessionId = useRef(highlevelersSessionId());
  const formRef = useRef<HTMLElement | null>(null);
  const finalRef = useRef<HTMLElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const stepRef = useRef<HTMLDivElement | null>(null);
  const [draft] = useState(() => readDraft(funnel));
  const [name, setName] = useState(draft?.name || "");
  const [email, setEmail] = useState(draft?.email || "");
  const [status, setStatus] = useState<Status>(draft?.status || "");
  const [plan, setPlan] = useState<Plan>(draft?.plan || "");
  const [step, setStep] = useState<Step>(draft?.step || "optin");
  const [claimedSignup, setClaimedSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sticky, setSticky] = useState(false);
  const [hint, setHint] = useState("");

  const first = name.trim().split(" ")[0] || "there";
  const search = typeof window === "undefined" ? "" : window.location.search;
  const sister = `${upgrade ? "/highlevelers" : "/highlevelers-upgrade"}${search}`;
  const contentName = upgrade ? "highlevelers_upgrade_optin" : "highlevelers_optin";

  useEffect(() => {
    rememberPaidSocial(window.location.search);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(`hl_apply_draft:${funnel}`, JSON.stringify({
        session: sessionId.current,
        name,
        email,
        status,
        plan,
        step,
      }));
    } catch {
      /* ignore */
    }
  }, [funnel, name, email, status, plan, step]);

  useEffect(() => {
    if (step === "optin") return;
    stepRef.current?.focus();
  }, [step]);

  useEffect(() => {
    const nodes = [formRef.current, finalRef.current].filter(Boolean) as Element[];
    if (nodes.length === 0) return;
    const visible = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      }
      setSticky(visible.size === 0 && step === "optin");
    });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [step]);

  const save = (body: Record<string, unknown>) => {
    const visit = visitContext();
    return saveFunnelStep({
      funnel,
      session_key: sessionId.current,
      session_id: sessionId.current,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      landing_url: visit.landing_url,
      utm: visit.utm,
      meta: visitMeta(),
      ...body,
    });
  };

  const submitOptin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    if (cleanName.length < 1 || cleanName.length > 60) {
      setError("Enter your first name");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Enter a valid email");
      return;
    }
    if (/gmial\.com|gmal\.com|gnail\.com/i.test(cleanEmail)) setHint(cleanEmail.replace(/gmial\.com|gmal\.com|gnail\.com/i, "gmail.com"));
    setBusy(true);
    setError("");
    const timeout = new Promise<{ ok: false; error: string }>((resolve) => {
      window.setTimeout(() => resolve({ ok: false, error: "timeout" }), 10000);
    });
    const result = await Promise.race([
      save({
        step: "optin",
        answers: { name: cleanName, email: cleanEmail, page: funnel },
      }),
      timeout,
    ]);
    setBusy(false);
    if (!result.ok) {
      setError("That didn't go through. Check your connection and tap the button again.");
      return;
    }
    if (result.already_claimed) {
      track("hl_already_claimed");
      setClaimedSignup(result.path === "signup");
      if (result.first_name) setName((current) => current.trim() || result.first_name || current);
      setStep("claimed");
      return;
    }
    if (result.created === true && result.event_id) lead(result.event_id, contentName);
    setStep(upgrade ? "plan" : "status");
  };

  const pickStatus = (value: Status) => {
    setStatus(value);
    track("hl_step_status", { value });
    const path = value === "has_it" ? "upgrade" : "signup";
    if (value === "has_it") {
      setStep("plan");
      void save({ step: "ghl_status", answers: { ghl_status: value, path, ghl_plan: null } });
      return;
    }
    setStep("thanks");
    void save({ step: "done", final: true, answers: { ghl_status: value, path, ghl_plan: null } });
  };

  const pickPlan = (value: Plan) => {
    setPlan(value);
    track("hl_step_plan", { plan: value });
    const signupPath = value === "none" || status === "none" || status === "new";
    setStep("thanks");
    void save({
      step: "done",
      final: true,
      answers: {
        ghl_plan: value,
        path: signupPath && (upgrade ? value === "none" : status !== "has_it") ? "signup" : "upgrade",
        ...(status ? { ghl_status: status } : {}),
      },
    });
  };

  const logGhl = (variant: "fb" | "default") => {
    track("hl_ghl_click", { variant });
    void save({
      step: "done",
      final: true,
      answers: { ghl_link_clicked_at: new Date().toISOString(), ghl_link_variant: variant },
    });
  };

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => nameRef.current?.focus(), 250);
  };

  const trial = trainingGhlHref(typeof window === "undefined" ? "" : window.location.search);
  const trialVariant = paidSocialActive(typeof window === "undefined" ? "" : window.location.search) ? "fb" : "default";
  const showTrial = step === "thanks" && ((upgrade && plan === "none") || (!upgrade && status !== "has_it"));
  const justOpened = !upgrade && status === "new";
  const button = upgrade ? "Get My Free Install →" : "Claim My Free Install →";

  return (
    <>
      <PageSEO
        title={upgrade ? "Free SaaS System Install When You Upgrade HighLevel" : "Free SaaS Install for New HighLevel Accounts | SaaSSuite"}
        ogTitle="Let Us Install Our SaaS System in Your Agency For Free"
        description={upgrade
          ? "Burned by GHL experts before? Upgrade or get set up with SaaSSuite and our team installs the full system in your account within 7 days. Free."
          : "Sign up for GoHighLevel through SaaSSuite and our team installs your white-label SaaS product in your account within 7 days. Free. Claim your install."}
        path={upgrade ? "/highlevelers-upgrade" : "/highlevelers"}
        image={upgrade ? "/creatives/D/og-burned-before-1200x630.png" : "/creatives/D/og-start-right-1200x630.png"}
        noindex
      />
      <div className="min-h-screen bg-background text-foreground">
        <main className="webinar-2-hero mx-auto max-w-3xl px-4 pb-28 pt-6 text-center sm:px-6">
          <img src="/assets/saassuite-logo.png" alt="SaaSSuite" width={48} height={48} decoding="async" fetchPriority="low" className="mx-auto mb-3 h-10 w-10 object-contain sm:h-12 sm:w-12" />
          <p className="webinar-2-attention mx-auto mb-4 inline-flex px-4 py-1.5 text-xs font-bold uppercase tracking-wide">{upgrade ? "Free on upgrade" : "New to HighLevel?"}</p>
          <div className="mx-auto max-w-xl space-y-4">
              <p className="text-xs font-bold uppercase tracking-wide webinar-2-accent">{upgrade ? "Burned by GHL \"experts\" before?" : "Free with Your GoHighLevel Account"}</p>
              <h1 aria-label="Let Us Install Our SaaS System in Your Agency For Free" className="text-[32px] font-extrabold leading-tight text-foreground sm:text-[40px] md:text-[46px]">Let Us Install Our <span className="webinar-2-accent">SaaS System</span> in Your Agency <span className="webinar-2-accent">For Free</span></h1>
              <p className="text-base">{upgrade
                ? "Upgrade or get set up with us, and our team comes into your account and installs the full system. Done in 7 days."
                : "We'll build your white-label SaaS product in GHL for free when you sign up. Our team comes into your account and has the full system in place within 7 days."}</p>
          </div>
            <section ref={formRef} className="glass-card mx-auto mt-8 max-w-xl rounded-2xl p-5 text-left shadow-sm">
              <div ref={stepRef} tabIndex={-1} className="outline-none">
              {step === "optin" && (
                <form className="space-y-3" noValidate onSubmit={(event) => { void submitOptin(event); }}>
                  <p className="text-sm font-extrabold">{upgrade ? "Get the free install" : "Claim your free install"} <span className="font-semibold text-muted-foreground">Step 1 of 2</span></p>
                  <label className="block text-sm font-semibold" htmlFor="hl-name">First name
                    <Input ref={nameRef} id="hl-name" autoComplete="given-name" placeholder="Jordan" value={name} maxLength={60} onChange={(event) => setName(event.target.value)} className="mt-1 h-12" />
                  </label>
                  <label className="block text-sm font-semibold" htmlFor="hl-email">Best email
                    <Input id="hl-email" type="email" inputMode="email" autoComplete="email" placeholder={upgrade ? "you@agency.com" : "you@email.com"} value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 h-12" />
                  </label>
                  <p className="text-xs text-muted-foreground">{upgrade ? "Use the email on your HighLevel account." : "Use the email you'll sign up to HighLevel with."}</p>
                  {hint && <button type="button" className="text-sm font-semibold underline webinar-2-accent" onClick={() => { setEmail(hint); setHint(""); }}>Did you mean {hint}?</button>}
                  {error && <p role="alert" aria-live="polite" className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" disabled={busy} className="webinar-2-cta h-12 w-full rounded-xl text-base font-bold">{busy ? "Saving…" : button}</Button>
                  <p className="text-xs text-muted-foreground">Takes 20 seconds. No card.</p>
                </form>
              )}
              {step === "status" && (
                <div className="space-y-3">
                  <button type="button" className="text-sm font-semibold webinar-2-accent" onClick={() => setStep("optin")}>← Back</button>
                  <h2 className="text-base font-extrabold">Do you have GoHighLevel yet?</h2>
                  <p className="text-base text-muted-foreground">Step 2 of 2. Either way, you're in. This just tells us what to send you next.</p>
                  <Button type="button" variant="outline" className="one-feature-choice h-12 w-full border-2 font-bold" onClick={() => pickStatus("none")}>Not yet</Button>
                  <Button type="button" variant="outline" className="one-feature-choice h-12 w-full border-2 font-bold" onClick={() => pickStatus("new")}>I just opened one</Button>
                  <Button type="button" variant="outline" className="one-feature-choice h-12 w-full border-2 font-bold" onClick={() => pickStatus("has_it")}>Yes, I've had it a while</Button>
                </div>
              )}
              {step === "plan" && (
                <div className="space-y-3">
                  <button type="button" className="text-sm font-semibold webinar-2-accent" onClick={() => setStep(upgrade ? "optin" : "status")}>← Back</button>
                  <h2 className="text-base font-extrabold">{upgrade ? "Which HighLevel plan are you on right now?" : "Which HighLevel plan are you on?"}</h2>
                  <p className="text-base text-muted-foreground">{upgrade ? "Step 2 of 2. This tells us which upgrade steps to send you." : "Step 3 of 3."}</p>
                  {PLANS.map((item) => (
                    <Button key={item.value} type="button" variant="outline" className="one-feature-choice h-12 w-full border-2 font-bold" onClick={() => pickPlan(item.value)}>{item.label}</Button>
                  ))}
                  {upgrade && <button type="button" className="text-sm font-semibold underline webinar-2-accent" onClick={() => pickPlan("none")}>I don't have HighLevel yet</button>}
                </div>
              )}
              {(step === "thanks" || step === "claimed") && (
                <>
                  <Thanks
                    claimed={step === "claimed"}
                    first={first}
                    email={email}
                    upgrade={upgrade}
                    showTrial={showTrial || (step === "claimed" && claimedSignup)}
                    justOpened={justOpened}
                    trial={trial}
                    onGhl={() => logGhl(trialVariant)}
                  />
                  <FunnelSuccessLinktree />
                </>
              )}
              </div>
            </section>
          <p className="mt-6 text-base font-semibold">★ Trusted by 1,200+ agencies{upgrade ? " · Free with Your GoHighLevel Account" : ""}</p>

          {upgrade ? <UpgradeBody sister={sister} /> : <SignupBody sister={sister} />}

          <section ref={finalRef} className="mx-auto mt-16 max-w-xl space-y-3 text-center">
            <h2 className="text-2xl font-extrabold sm:text-3xl">{upgrade ? "Let's get it installed properly this time." : "Skip the blank account."}</h2>
            <p className="text-base">Claim your free install. Takes 20 seconds.</p>
            {step === "optin" && <Button type="button" className="webinar-2-cta mx-auto h-12 w-full max-w-[410px] rounded-xl text-base font-bold" onClick={scrollToForm}>{button}</Button>}
          </section>
        </main>
        {sticky && (
          <div className="fixed inset-x-0 bottom-16 z-40 px-4 md:hidden">
            <Button type="button" className="webinar-2-cta h-12 w-full rounded-xl text-base font-bold" onClick={scrollToForm}>{button}</Button>
          </div>
        )}
        <Footer minimal />
        <p className="mx-auto max-w-4xl px-6 pb-8 text-center text-xs text-muted-foreground">
          Your results depend on your market and how you sell. Affiliate disclosure: we are a HighLevel affiliate and may earn a commission if you sign up to HighLevel through our link, at no extra cost to you.
        </p>
      </div>
    </>
  );
};

function TrialButton({ trial, onGhl }: { trial: string; onGhl: () => void }) {
  return (
    <Button asChild className="webinar-2-cta h-12 w-full rounded-xl text-base font-bold">
      <a href={trial} target="_blank" rel="noopener noreferrer" onClick={onGhl}>Start My Free GoHighLevel Trial →</a>
    </Button>
  );
}

function Thanks({
  claimed, first, email, upgrade, showTrial, justOpened, trial, onGhl,
}: {
  claimed: boolean;
  first: string;
  email: string;
  upgrade: boolean;
  showTrial: boolean;
  justOpened: boolean;
  trial: string;
  onGhl: () => void;
}) {
  if (claimed) {
    return (
      <div className="space-y-3">
        <h2 className="text-center text-2xl font-extrabold sm:text-3xl">You've already claimed your install 👍</h2>
        <p className="text-base">We have you down as {email}. Our team will reach out with your next step.</p>
        {showTrial && <TrialButton trial={trial} onGhl={onGhl} />}
      </div>
    );
  }
  if (showTrial) {
    return (
      <div className="space-y-3">
        <h2 className="text-center text-2xl font-extrabold sm:text-3xl">You're in, {first}. 🎉</h2>
        {justOpened && <p className="text-base">If you already signed up through our link, skip step 1. We'll match your account by email.</p>}
        <ol className="list-decimal space-y-2 pl-5 text-base">
          <li>Start your GoHighLevel account through our link. Use {email} so we can match it to you.</li>
          <li>Give our team access. Our team reviews every request and reaches out with your next step.</li>
          <li>We install the system within 7 days. You'll get a heads-up when it's live.</li>
        </ol>
        <TrialButton trial={trial} onGhl={onGhl} />
        <p className="text-xs text-muted-foreground">Nothing else to do right now.</p>
      </div>
    );
  }
  if (upgrade) {
    return (
      <div className="space-y-3">
        <h2 className="text-center text-2xl font-extrabold sm:text-3xl">You're in, {first}. Here's what happens next.</h2>
        <ol className="list-decimal space-y-2 pl-5 text-base">
          <li>Our team reviews every request and reaches out with your next step. We have you as {email}.</li>
          <li>Upgrade or get set up with us, and give our team access. You can remove access whenever you want.</li>
          <li>We install the full system within 7 days. You'll get a heads-up when it's live.</li>
        </ol>
        <p className="text-xs text-muted-foreground">Nothing else to do right now.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <h2 className="text-center text-2xl font-extrabold sm:text-3xl">Got it, {first}. You're on the upgrade path.</h2>
      <p className="text-base">For existing accounts, the free install comes with upgrading or getting set up with us. Which HighLevel plan you need depends on your setup. We'll confirm what fits your account when our team reaches out.</p>
      <ol className="list-decimal space-y-2 pl-5 text-base">
        <li>Our team reviews every request and reaches out with your next step. We have you as {email}.</li>
        <li>Upgrade or get set up with us, and give our team access.</li>
        <li>We install the full system within 7 days.</li>
      </ol>
    </div>
  );
}

function SignupBody({ sister }: { sister: string }) {
  return (
    <>
      <section className="mx-auto mt-16 max-w-xl space-y-4 text-left">
        <h2 className="text-center text-2xl font-extrabold sm:text-3xl">Starting HighLevel from zero is the hard part.</h2>
        <ul className="list-disc space-y-1 pl-5 text-base text-muted-foreground">
          <li>You log in and there's nothing: no funnels, no automations, no product to show anyone.</li>
          <li>Snapshots, pricing, onboarding, white-label settings: every tutorial assumes you already know the other ten.</li>
          <li>Weeks go by setting up, and you still don't have anything to sell.</li>
        </ul>
        <p className="text-base">So skip that part. Sign up through us and we build it for you.</p>
      </section>
      <section className="mx-auto mt-16 max-w-xl text-left">
        <h2 className="text-center text-2xl font-extrabold sm:text-3xl">Your white-label SaaS product, built inside your account.</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <article className="glass-card rounded-2xl p-4 shadow-sm"><h3 className="font-extrabold">Your branded SaaS product</h3><p className="mt-1 text-base text-muted-foreground">White-label setup under your brand, so clients see your name, not ours or HighLevel's.</p></article>
          <article className="glass-card rounded-2xl p-4 shadow-sm"><h3 className="font-extrabold">SaaS funnels</h3><p className="mt-1 text-base text-muted-foreground">The pages and funnels you use to sell it, installed and tested.</p></article>
          <article className="glass-card rounded-2xl p-4 shadow-sm"><h3 className="font-extrabold">Automations</h3><p className="mt-1 text-base text-muted-foreground">The follow-ups and workflows that run it, live in your account.</p></article>
          <article className="glass-card rounded-2xl p-4 shadow-sm"><h3 className="font-extrabold">Client onboarding</h3><p className="mt-1 text-base text-muted-foreground">What happens when someone buys, set up so new clients aren't waiting on you.</p></article>
        </div>
        <p className="mt-3 text-base text-muted-foreground">What's installed typically includes the above. We confirm the exact setup for your account when our team reaches out.</p>
        <p className="mt-3 text-xs font-extrabold uppercase webinar-2-accent">Example</p>
      </section>
      <section className="mx-auto mt-16 max-w-xl space-y-4 text-left">
        <h2 className="text-center text-2xl font-extrabold sm:text-3xl">Full system in 7 days.</h2>
        <p className="text-base">From access to live in 7 days. We set it up, test it, and let you know when it's ready.</p>
        <p className="text-xs text-muted-foreground">The 7 days start when we have access to your account.</p>
      </section>
      <section className="mx-auto mt-16 max-w-xl space-y-4 text-left">
        <h2 className="text-center text-2xl font-extrabold sm:text-3xl">Three steps. Two are ours.</h2>
        <ol className="list-decimal space-y-1 pl-5 text-base">
          <li>Claim your install here, and sign up for GoHighLevel through our link. Our team reaches out with your next step.</li>
          <li>Give our team access to your account. You can remove it whenever you want.</li>
          <li>We install the system. Full setup within 7 days.</li>
        </ol>
      </section>
      <section className="mx-auto mt-16 max-w-xl space-y-4 text-left">
        <h2 className="text-center text-2xl font-extrabold sm:text-3xl">What a free install will and won't do.</h2>
        <ul className="space-y-1 text-base">
          <li>✓ It takes setup off your plate. No more weeks of tutorials before you have something to sell.</li>
          <li>✓ It's a real system, not a half-built snapshot. The same one we use ourselves. If you've heard stories about people getting burned by half-finished GHL setups, this is the opposite: it's in your account and you can see every piece.</li>
          <li>✗ It won't find clients for you. Real growth still takes work: showing your product to people and selling it.</li>
        </ul>
      </section>
      <section className="mx-auto mt-16 max-w-xl space-y-4 text-left">
        <h2 className="text-center text-2xl font-extrabold sm:text-3xl">Questions</h2>
        <details className="glass-card rounded-2xl px-4 py-3 text-left shadow-sm"><summary className="cursor-pointer font-bold">Is it really free?</summary><p className="mt-2 text-base text-muted-foreground">Yes. The install costs nothing. It comes with signing up for GoHighLevel through our link, and SaaSSuite is Free with Your GoHighLevel Account. GoHighLevel itself is a separate subscription billed by HighLevel.</p></details>
        <details className="glass-card rounded-2xl px-4 py-3 text-left shadow-sm"><summary className="cursor-pointer font-bold">Why would you do this for free?</summary><p className="mt-2 text-base text-muted-foreground">We're a HighLevel affiliate, so we may earn a commission when you sign up through our link, at no extra cost to you. That only works out if you stay, so a half-built account helps nobody.</p></details>
        <details className="glass-card rounded-2xl px-4 py-3 text-left shadow-sm"><summary className="cursor-pointer font-bold">I've never used HighLevel. Is this for me?</summary><p className="mt-2 text-base text-muted-foreground">That's exactly who it's for. You don't need to know snapshots or workflows; that's the part we do.</p></details>
        <details className="glass-card rounded-2xl px-4 py-3 text-left shadow-sm"><summary className="cursor-pointer font-bold">What exactly do you install?</summary><p className="mt-2 text-base text-muted-foreground">It typically includes branding and white-label setup, SaaS funnels, automations and client onboarding. We confirm the exact setup for your account when our team reaches out.</p></details>
        <details className="glass-card rounded-2xl px-4 py-3 text-left shadow-sm"><summary className="cursor-pointer font-bold">Which HighLevel plan do I need?</summary><p className="mt-2 text-base text-muted-foreground">Which HighLevel plan you need depends on your setup. We'll confirm what fits your account when our team reaches out.</p></details>
        <details className="glass-card rounded-2xl px-4 py-3 text-left shadow-sm"><summary className="cursor-pointer font-bold">How long does it take?</summary><p className="mt-2 text-base text-muted-foreground">The full system is in place within 7 days of us getting access to your account.</p></details>
        <details className="glass-card rounded-2xl px-4 py-3 text-left shadow-sm"><summary className="cursor-pointer font-bold">How do you get into my account?</summary><p className="mt-2 text-base text-muted-foreground">You give our team access to your HighLevel account, and you can remove it whenever you want. Our team walks you through it when they reach out.</p></details>
        <details className="glass-card rounded-2xl px-4 py-3 text-left shadow-sm"><summary className="cursor-pointer font-bold">Will this make me money?</summary><p className="mt-2 text-base text-muted-foreground">No one can promise that. We install the system; your results depend on your market and how you sell it.</p></details>
        <details className="glass-card rounded-2xl px-4 py-3 text-left shadow-sm"><summary className="cursor-pointer font-bold">I already have HighLevel. Can I still get this?</summary><p className="mt-2 text-base text-muted-foreground">Yes. For existing accounts it comes with upgrading or getting set up with us. <Link to={sister} onClick={() => track("hl_crosslink", { to: "upgrade" })}>See the upgrade offer</Link>.</p></details>
      </section>
    </>
  );
}

function UpgradeBody({ sister }: { sister: string }) {
  return (
    <>
      <section className="mx-auto mt-16 max-w-xl space-y-4 text-left">
        <h2 className="text-center text-2xl font-extrabold sm:text-3xl">If you've been burned before, we get it.</h2>
        <ul className="list-disc space-y-1 pl-5 text-base text-muted-foreground">
          <li>You paid for a snapshot that never got installed, or got installed half-way.</li>
          <li>The done-for-you build went quiet after the invoice cleared.</li>
          <li>You're paying for HighLevel every month and still don't have a product you'd show a client.</li>
        </ul>
        <p className="text-base">This time, you don't pay for the build. We come into your account and install the whole thing, and you watch it go in.</p>
      </section>
      <section className="mx-auto mt-16 max-w-xl text-left">
        <h2 className="text-center text-2xl font-extrabold sm:text-3xl">What changes in 7 days.</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <article className="glass-card rounded-2xl p-4 shadow-sm"><h3 className="font-extrabold">Before</h3><ul className="mt-2 space-y-1 text-base text-muted-foreground"><li>Empty pipelines</li><li>A half-built snapshot</li><li>No client onboarding</li><li>Your logo nowhere</li></ul></article>
          <article className="glass-card rounded-2xl p-4 shadow-sm"><h3 className="font-extrabold">Day 7, done for you</h3><ul className="mt-2 space-y-1 text-base"><li>SaaS funnels installed</li><li>Automations live</li><li>Client onboarding</li><li>White-label setup</li></ul><p className="mt-2 text-xs font-extrabold uppercase webinar-2-accent">Example</p></article>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">The 7 days start when we have access to your account.</p>
      </section>
      <section className="mx-auto mt-16 max-w-xl space-y-4 text-left">
        <h2 className="text-center text-2xl font-extrabold sm:text-3xl">The full system, not a starter kit.</h2>
        <ul className="space-y-1 text-base">
          <li>White-label setup so clients see your name.</li>
          <li>SaaS funnels, installed and tested.</li>
          <li>Automations, live in your account.</li>
          <li>Client onboarding, so new clients aren't waiting on you.</li>
        </ul>
        <p className="text-base text-muted-foreground">What's installed typically includes the above. We confirm the exact setup for your account when our team reaches out.</p>
      </section>
      <section className="mx-auto mt-16 max-w-xl space-y-4 text-left">
        <h2 className="text-center text-2xl font-extrabold sm:text-3xl">Three steps. Two are ours.</h2>
        <ol className="list-decimal space-y-1 pl-5 text-base">
          <li>Claim your install (the form above). Our team reaches out with your next step.</li>
          <li>Upgrade or get set up with us, and give our team access. Our team will walk you through it when they reach out.</li>
          <li>We install the full system. Done within 7 days.</li>
        </ol>
      </section>
      <section className="mx-auto mt-16 max-w-xl space-y-4 text-left">
        <h2 className="text-center text-2xl font-extrabold sm:text-3xl">Why this isn't another half-finished build.</h2>
        <ul className="space-y-1 text-base">
          <li>✓ You don't pay us for the install.</li>
          <li>✓ We only do well if you stay. We're a HighLevel affiliate, so a working account is the whole point.</li>
          <li>✓ It's your account the whole time. You can remove our access whenever you want.</li>
        </ul>
      </section>
      <section className="mx-auto mt-16 max-w-xl space-y-4 text-left">
        <h2 className="text-center text-2xl font-extrabold sm:text-3xl">Real growth, not another setup project.</h2>
        <ul className="space-y-1 text-base">
          <li>✓ It gets the setup out of the way, so you're not stuck rebuilding setup for the third time.</li>
          <li>✓ It gives you a finished product you can actually show clients, which is where real growth starts.</li>
          <li>✗ It won't sell for you. Real growth comes from putting the product in front of people. We just make sure the setup isn't what's holding you back.</li>
        </ul>
      </section>
      <section className="mx-auto mt-16 max-w-xl space-y-4 text-left">
        <h2 className="text-center text-2xl font-extrabold sm:text-3xl">Questions</h2>
        <details className="glass-card rounded-2xl px-4 py-3 text-left shadow-sm"><summary className="cursor-pointer font-bold">Is it really free?</summary><p className="mt-2 text-base text-muted-foreground">Yes. The install costs nothing. It comes with upgrading or getting set up with us, and SaaSSuite is Free with Your GoHighLevel Account. HighLevel bills your plan directly, as it does now.</p></details>
        <details className="glass-card rounded-2xl px-4 py-3 text-left shadow-sm"><summary className="cursor-pointer font-bold">What does "upgrade or get set up with us" mean?</summary><p className="mt-2 text-base text-muted-foreground">It depends on your account. Our team reviews your request and reaches out with the exact steps for your setup. Which HighLevel plan you need depends on your setup. We'll confirm what fits your account when our team reaches out.</p></details>
        <details className="glass-card rounded-2xl px-4 py-3 text-left shadow-sm"><summary className="cursor-pointer font-bold">Why would you do this for free?</summary><p className="mt-2 text-base text-muted-foreground">We're a HighLevel affiliate, so we may earn a commission when you're on HighLevel through us, at no extra cost to you. That only works if your account works, so we'd rather install it properly.</p></details>
        <details className="glass-card rounded-2xl px-4 py-3 text-left shadow-sm"><summary className="cursor-pointer font-bold">How do you get into my account?</summary><p className="mt-2 text-base text-muted-foreground">You give our team access, and you can remove it whenever you want. Our team walks you through it when they reach out.</p></details>
        <details className="glass-card rounded-2xl px-4 py-3 text-left shadow-sm"><summary className="cursor-pointer font-bold">How long does it take?</summary><p className="mt-2 text-base text-muted-foreground">The full system is in place within 7 days of us getting access.</p></details>
        <details className="glass-card rounded-2xl px-4 py-3 text-left shadow-sm"><summary className="cursor-pointer font-bold">I've been burned by "experts" before. Why trust you?</summary><p className="mt-2 text-base text-muted-foreground">Fair question. You don't pay for the install, it's your account the whole time, and you'll see everything go in. We're trusted by 1,200+ agencies.</p></details>
        <details className="glass-card rounded-2xl px-4 py-3 text-left shadow-sm"><summary className="cursor-pointer font-bold">Will this make me money?</summary><p className="mt-2 text-base text-muted-foreground">No one can promise that. We install the system; your results depend on your market and how you sell.</p></details>
        <details className="glass-card rounded-2xl px-4 py-3 text-left shadow-sm"><summary className="cursor-pointer font-bold">I don't have HighLevel yet.</summary><p className="mt-2 text-base text-muted-foreground">That works too: the install comes with signing up through us. <Link to={sister} onClick={() => track("hl_crosslink", { to: "signup" })}>See the signup offer</Link>.</p></details>
      </section>
    </>
  );
}

export default HighLevelers;
