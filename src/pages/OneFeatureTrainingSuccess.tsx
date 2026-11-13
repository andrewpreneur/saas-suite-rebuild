import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Footer from "@/components/Footer";
import PageSEO from "@/components/PageSEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WhiteGoogleButton } from "@/components/auth/WhiteGoogleButton";
import { TrainingVideo } from "@/components/one-feature/shared";
import { TextUsLink } from "@/components/TextUsLink";
import { paidSocialActive, rememberPaidSocial, trainingGhlHref } from "@/lib/funnelContracts";
import {
  KIT_HOME_PATH,
  armKitHomeReturn,
  clearKitReturn,
  kitHomeWithAttribution,
  shouldArmKitReturn,
  successAuthErrorPath,
  trainingSuccessAuthPath,
} from "@/lib/kitReturn";
import {
  BRIDGE_BODY,
  BRIDGE_MEANTIME,
  BRIDGE_TITLE,
  GOOGLE_CTA,
  NEXT_STEPS,
  OPEN_KIT_CTA,
  successSub,
} from "@/lib/trainingSuccessCopy";
import { signInWithStoreProvider } from "@/lib/nativeOAuth";
import { supabase } from "@/integrations/supabase/client";
import { trackingPixelsAllowed } from "@/utils/trackingConsent";

type QuizStep = "ghl" | "plan" | "intent" | "done";

const KIT: { label: string; action: string; href?: string }[] = [
  { label: "100% Brandless AI Studio Sales Video", action: "Open →" },
  { label: "20-minute setup training", action: "Watch →" },
  { label: "Menu Link Removal Snapshot", action: "Get link →" },
  { label: "High converting sales page", action: "Preview →", href: "https://lynkific.com/vibe" },
  { label: "1 ad creative template", action: "Download →" },
  { label: "Your free SaaSSuite account", action: "Open SaaSSuite →", href: KIT_HOME_PATH },
];

function track(name: string, params?: Record<string, string>) {
  try {
    const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
    if (typeof fbq === "function" && trackingPixelsAllowed()) fbq("trackCustom", name, params || {});
  } catch {
    /* ignore */
  }
}

const OneFeatureTrainingSuccess = () => {
  const navigate = useNavigate();
  const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const src = params.get("src") || "";
  const via = params.get("via") || "";
  const [firstName, setFirstName] = useState("there");
  const [signedIn, setSignedIn] = useState(false);
  const [leadId, setLeadId] = useState("");
  const [email, setEmail] = useState("");
  const [hasGhl, setHasGhl] = useState<boolean | null>(null);
  const [intent, setIntent] = useState("");
  const [quizStep, setQuizStep] = useState<QuizStep>("ghl");
  const [saving, setSaving] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleError, setGoogleError] = useState("");
  const [emailOpen, setEmailOpen] = useState(false);
  const [magicName, setMagicName] = useState("");
  const [magicEmail, setMagicEmail] = useState("");
  const [magicSent, setMagicSent] = useState("");
  const [magicBusy, setMagicBusy] = useState(false);
  const [magicError, setMagicError] = useState("");
  const [error, setError] = useState("");
  const pending = useRef<Record<string, unknown>>({});

  useEffect(() => {
    rememberPaidSocial(window.location.search);
  }, []);

  useEffect(() => {
    const dest = successAuthErrorPath(window.location.search, window.location.hash);
    if (!dest) return;
    navigate(dest, { replace: true });
  }, [navigate]);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("oft_success_quiz");
      if (stored) {
        const parsed = JSON.parse(stored) as { hasGhl?: boolean | null; intent?: string; quizStep?: QuizStep };
        if (typeof parsed.hasGhl === "boolean") {
          setHasGhl(parsed.hasGhl);
          pending.current.has_highlevel = parsed.hasGhl;
          if (parsed.hasGhl === false) pending.current.plan = "none";
        }
        if (parsed.intent) {
          setIntent(parsed.intent);
          pending.current.intent = parsed.intent;
        }
        if (parsed.quizStep) setQuizStep(parsed.quizStep);
      }
      const storedName = localStorage.getItem("oft_quiz_name");
      if (storedName) setFirstName(storedName.split(" ")[0] || "there");
    } catch {
      /* ignore */
    }
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      const sessionEmail = user?.email?.trim().toLowerCase() || "";
      if (!sessionEmail) return;
      const current = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const authError = current.get("error") || hash.get("error") || current.get("error_code") || hash.get("error_code");
      // Full load, not a client route change. The lazy app route would paint the
      // empty fallback, and this handoff only happens once a session exists.
      if (!authError && current.get("go") === "kit" && src !== "quiz") {
        clearKitReturn();
        window.location.replace(kitHomeWithAttribution(window.location.search, src ? { src } : undefined));
        return;
      }
      setSignedIn(true);
      setEmail(sessionEmail);
      const meta = user?.user_metadata ?? {};
      const metaName = typeof meta.full_name === "string" ? meta.full_name : typeof meta.given_name === "string" ? meta.given_name : "";
      setFirstName((metaName || sessionEmail.split("@")[0] || "there").split(" ")[0]);
      try {
        const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
        if (typeof fbq === "function" && trackingPixelsAllowed()) fbq("track", "CompleteRegistration", {}, { eventID: `oft_reg_${sessionEmail}` });
      } catch {
        /* ignore */
      }
      if (src !== "quiz") return;
      const utm: Record<string, string> = {};
      new URLSearchParams(window.location.search).forEach((value, name) => {
        if (name.startsWith("utm_") || name === "fbclid") utm[name] = value;
      });
      const { data: saved } = await supabase.functions.invoke("one-feature-lead", {
        body: { action: "create", name: metaName || sessionEmail.split("@")[0], email: sessionEmail, phone: "", page: "onefeaturetraining-quiz", form: via === "email" ? "quiz_email" : "quiz_google", via: via || "google", utm },
      });
      if (saved?.lead_id) setLeadId(String(saved.lead_id));
    })();
  }, [src, via]);

  const startGoogle = async () => {
    setGoogleBusy(true);
    setGoogleError("");
    const returnPath = trainingSuccessAuthPath(src, "google", window.location.search);
    // Both return to this page. Non-quiz adds go=kit. The session key is one-shot only.
    if (shouldArmKitReturn(src)) armKitHomeReturn();
    const message = await signInWithStoreProvider("google", returnPath, () => setGoogleBusy(false));
    if (message) {
      setGoogleBusy(false);
      setGoogleError(message);
    }
  };

  const sendMagic = async (event?: FormEvent) => {
    event?.preventDefault();
    const clean = magicEmail.trim().toLowerCase();
    const name = magicName.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setMagicError("Enter a valid email");
      return;
    }
    setMagicBusy(true);
    setMagicError("");
    const returnPath = trainingSuccessAuthPath(src, "email", window.location.search);
    if (shouldArmKitReturn(src)) armKitHomeReturn();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: clean,
      options: {
        emailRedirectTo: `${window.location.origin}${returnPath}`,
        shouldCreateUser: true,
        data: { full_name: name || clean.split("@")[0] },
      },
    });
    setMagicBusy(false);
    if (otpError) {
      setMagicError(otpError.message || "Could not send the link");
      return;
    }
    setMagicSent(clean);
  };

  const remember = (next: { hasGhl?: boolean | null; intent?: string; quizStep?: QuizStep }) => {
    const snapshot = { hasGhl, intent, quizStep, ...next };
    try {
      sessionStorage.setItem("oft_success_quiz", JSON.stringify(snapshot));
    } catch {
      /* ignore */
    }
  };

  const saveAnswer = async (patch: Record<string, unknown>) => {
    pending.current = { ...pending.current, ...patch };
    if (!leadId || !email) return true;
    setSaving(true);
    setError("");
    const { error: saveError } = await supabase.functions.invoke("one-feature-lead", {
      body: { action: "update", lead_id: leadId, email, ...pending.current },
    });
    setSaving(false);
    if (saveError) {
      setError("That didn't save. Tap your answer again.");
      return false;
    }
    pending.current = {};
    return true;
  };

  useEffect(() => {
    if (!leadId || !email || Object.keys(pending.current).length === 0) return;
    void saveAnswer({});
  }, [leadId, email]);

  const headline = via === "google"
    ? `You're in, ${firstName}. 🎉`
    : via === "email"
      ? `You're in, ${firstName}.`
      : src === "oft5" || src === "oft4"
        ? `Done, ${firstName}. You're all set.`
        : "You're in. Here's your next step.";
  const sub = successSub(src, via);
  const kitHref = kitHomeWithAttribution(typeof window === "undefined" ? "" : window.location.search, {
    ...(src ? { src } : {}),
    ...(leadId ? { lead: leadId } : {}),
  });
  const showQuiz = src === "quiz";
  const ghlHref = trainingGhlHref(typeof window === "undefined" ? "" : window.location.search);
  const ghlViaMeta = paidSocialActive(typeof window === "undefined" ? "" : window.location.search);
  const result = !showQuiz || quizStep !== "done" ? null : hasGhl === false ? "none" : intent === "dfy" ? "dfy" : intent === "self" ? "self" : "explore";

  return (
    <>
      <PageSEO title="You're in | SaaSSuite One Feature Kit" description="Your One Feature Kit and the next setup step." path="/onefeaturetraining-success" noindex />
      <div className="min-h-screen bg-background">
        <main className="webinar-2-hero mx-auto max-w-3xl space-y-8 px-4 py-10 text-center sm:px-6">
          <img src="/assets/saassuite-logo.png" alt="SaaSSuite" width={48} height={48} decoding="async" fetchPriority="low" className="mx-auto h-10 w-10 object-contain sm:h-12 sm:w-12" />
          <header className="text-center">
            <h1 aria-label={headline} className="text-[32px] font-extrabold leading-tight text-foreground sm:text-[40px] md:text-[46px]">
              {via === "google" || via === "email" ? <>You're in, <span className="webinar-2-accent">{firstName}</span>{via === "google" ? ". 🎉" : "."}</> : src === "oft5" || src === "oft4" ? <>Done, <span className="webinar-2-accent">{firstName}</span>. You're all set.</> : <>You're in. Here's your <span className="webinar-2-accent">next step</span>.</>}
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">{sub}</p>
          </header>
          {showQuiz && quizStep !== "done" && (
            <section className="glass-card mx-auto max-w-xl space-y-3 rounded-2xl p-5 text-left shadow-sm">
              <p className="text-sm font-semibold">3 quick taps so we can point you to the right next step.</p>
              <p className="text-xs text-muted-foreground">{quizStep === "ghl" ? "1 of 3" : quizStep === "plan" ? "2 of 3" : "3 of 3"}</p>
              {quizStep === "ghl" && (
                <>
                  <h2 className="text-xl font-extrabold">Do you already have a GoHighLevel account?</h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button type="button" variant="outline" className="one-feature-choice h-12 border-2 font-bold" onClick={() => { void (async () => { if (!(await saveAnswer({ has_highlevel: true }))) return; setHasGhl(true); setQuizStep("plan"); remember({ hasGhl: true, quizStep: "plan" }); track("oft_step_has_ghl", { value: "yes" }); })(); }}>Yes, I have GHL</Button>
                    <Button type="button" variant="outline" className="one-feature-choice h-12 border-2 font-bold" onClick={() => { void (async () => { if (!(await saveAnswer({ has_highlevel: false, plan: "none" }))) return; setHasGhl(false); setQuizStep("intent"); remember({ hasGhl: false, quizStep: "intent" }); track("oft_step_has_ghl", { value: "no" }); })(); }}>Not yet</Button>
                  </div>
                </>
              )}
              {quizStep === "plan" && (
                <>
                  <h2 className="text-xl font-extrabold">Which HighLevel plan are you on?</h2>
                  <div className="grid gap-3">
                    {[["Starter", "97"], ["Unlimited", "297"], ["Agency Pro", "497"], ["Not sure", "not_sure"]].map(([label, value]) => (
                      <Button key={value} type="button" variant="outline" className="one-feature-choice h-12 border-2 font-bold" onClick={() => { void (async () => { if (!(await saveAnswer({ plan: value }))) return; setQuizStep("intent"); remember({ quizStep: "intent" }); track("oft_step_plan", { plan: value }); })(); }}>{label}</Button>
                    ))}
                  </div>
                  <button type="button" className="text-sm font-semibold webinar-2-accent" onClick={() => setQuizStep("ghl")}>← Back</button>
                </>
              )}
              {quizStep === "intent" && (
                <>
                  <h2 className="text-xl font-extrabold">What do you want first?</h2>
                  <div className="grid gap-3">
                    {[["Set it up for me", "dfy"], ["I'll launch it myself", "self"], ["Just exploring the kit", "explore"]].map(([label, value]) => (
                      <Button key={value} type="button" variant="outline" className="one-feature-choice h-12 border-2 font-bold" onClick={() => { void (async () => { if (!(await saveAnswer({ intent: value }))) return; setIntent(value); setQuizStep("done"); remember({ intent: value, quizStep: "done" }); track("oft_step_intent", { intent: value }); })(); }}>{label}</Button>
                    ))}
                  </div>
                  <button type="button" className="text-sm font-semibold webinar-2-accent" onClick={() => setQuizStep(hasGhl === false ? "ghl" : "plan")}>← Back</button>
                </>
              )}
              {saving && <p role="status" className="text-sm text-muted-foreground">Saving…</p>}
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            </section>
          )}
          {result === "none" && (
            <section className="mx-auto max-w-xl space-y-3 text-left text-base">
              <h2 className="text-2xl font-extrabold">First step: get your GoHighLevel account</h2>
              <p>The snapshot installs into GoHighLevel, so you'll need an account to launch. Sign up through our link and you get SaaSSuite Advanced free for life. Then come back here and install your kit.</p>
              <Button asChild className="webinar-2-cta h-12 w-full rounded-xl text-base font-bold"><a href={ghlHref} target="_blank" rel="noopener noreferrer" onClick={() => { track("oft_ghl_click"); if (leadId && email) void supabase.functions.invoke("one-feature-lead", { body: { action: "update", lead_id: leadId, email, ghl_signup_via_affiliate: ghlViaMeta } }); }}>Start My Free GoHighLevel Trial →</a></Button>
            </section>
          )}
          {result === "dfy" && (
            <section className="mx-auto max-w-xl space-y-3 text-left text-base">
              <h2 className="text-2xl font-extrabold">We'll set it up in your account</h2>
              <p>Our team installs the one-feature system in your GoHighLevel account and emails you when it's live. No calls needed.</p>
            </section>
          )}
          {result === "self" && (
            <section className="mx-auto max-w-xl space-y-3 text-left text-base">
              <h2 className="text-2xl font-extrabold">You're ready to launch</h2>
              <p>Start with the 20-minute setup training, then import the snapshot.</p>
              <Button type="button" className="webinar-2-cta h-12 w-full rounded-xl text-base font-bold" onClick={() => document.getElementById("oft-kit")?.scrollIntoView({ behavior: "smooth" })}>Start the 20-Minute Setup →</Button>
            </section>
          )}
          {result === "explore" && (
            <section className="mx-auto max-w-xl space-y-3 text-left text-base">
              <h2 className="text-2xl font-extrabold">Have a look around</h2>
              <p>Everything's unlocked. Start with the brandless sales video. It's the heart of the kit.</p>
              <Button type="button" className="webinar-2-cta h-12 w-full rounded-xl text-base font-bold" onClick={() => document.getElementById("oft-kit")?.scrollIntoView({ behavior: "smooth" })}>Watch the Sales Video →</Button>
            </section>
          )}
          <section className="mx-auto max-w-xl space-y-3 text-left text-base" aria-labelledby="oft-bridge-title">
            <h2 id="oft-bridge-title" className="text-center text-2xl font-extrabold sm:text-3xl">{BRIDGE_TITLE}</h2>
            <p>{BRIDGE_BODY}</p>
            <p>{BRIDGE_MEANTIME}</p>
            {signedIn ? (
              <Button asChild className="webinar-2-cta h-auto min-h-12 w-full whitespace-normal rounded-xl px-4 py-3 text-base font-bold">
                <a href={kitHref}>{OPEN_KIT_CTA}</a>
              </Button>
            ) : (
              <div className="mx-auto max-w-sm space-y-2">
                <WhiteGoogleButton label={googleBusy ? "Connecting to Google…" : GOOGLE_CTA} disabled={googleBusy} onClick={() => { void startGoogle(); }} />
                <button type="button" className="mx-auto block text-sm font-semibold underline webinar-2-accent" onClick={() => setEmailOpen(true)}>
                  Or continue with email
                </button>
                {emailOpen && !magicSent && (
                  <form className="space-y-2 pt-2" noValidate onSubmit={(event) => { void sendMagic(event); }}>
                    <Input aria-label="First name" placeholder="First name" value={magicName} onChange={(event) => setMagicName(event.target.value)} className="h-12" />
                    <Input aria-label="Email" type="email" placeholder="Email" value={magicEmail} onChange={(event) => setMagicEmail(event.target.value)} className="h-12" />
                    {magicError && <p role="alert" className="text-sm text-destructive">{magicError}</p>}
                    <Button type="submit" disabled={magicBusy} className="webinar-2-cta h-12 w-full rounded-xl text-base font-bold">{magicBusy ? "Sending…" : "Continue →"}</Button>
                    <p className="text-xs text-muted-foreground">We'll email you a secure sign-in link. No password, no card.</p>
                  </form>
                )}
                {magicSent && (
                  <div className="space-y-2 pt-2 text-sm">
                    <p className="font-bold">Check your inbox.</p>
                    <p>We sent a sign-in link to {magicSent}. {src === "quiz" ? "Tap it to finish signing in. You'll come back here for 3 quick questions." : "Tap it to open your One Feature Kit."}</p>
                    <button type="button" className="font-semibold underline webinar-2-accent disabled:opacity-50" disabled={magicBusy} onClick={() => { void sendMagic(); }}>Resend link</button>
                  </div>
                )}
                {googleError && <p role="alert" className="text-center text-sm text-destructive">{googleError}</p>}
              </div>
            )}
          </section>
          <section id="oft-kit" className="mx-auto max-w-xl space-y-3 text-left">
            <h2 className="text-center text-2xl font-extrabold sm:text-3xl">Your One Feature Kit</h2>
            <ul className="mx-auto max-w-xl space-y-3 text-left text-base">
              {KIT.map((item) => {
                const href = item.href === KIT_HOME_PATH ? kitHref : (item.href || "");
                const external = href.startsWith("http");
                const internal = href.startsWith("/");
                return (
                  <li key={item.label} className="glass-card flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-base shadow-sm">
                    <span>{signedIn ? item.label : `Locked · ${item.label}`}</span>
                    {signedIn && external ? <a className="font-bold webinar-2-accent" href={href} target="_blank" rel="noopener noreferrer">{item.action}</a> : signedIn && internal ? <a className="font-bold webinar-2-accent" href={href}>{item.action}</a> : <span className="text-xs text-muted-foreground">{signedIn ? "Coming soon" : "Sign in to open"}</span>}
                  </li>
                );
              })}
            </ul>
          </section>
          <section className="mx-auto max-w-xl space-y-3 text-left text-base">
            <h2 className="text-2xl font-extrabold">What happens next</h2>
            <ol className="list-decimal space-y-1 pl-5 text-base">
              {NEXT_STEPS.map(([title, detail]) => (
                <li key={title}><b>{title}</b> {detail}</li>
              ))}
            </ol>
          </section>
          <section>
            <h3 className="text-xl font-extrabold">Watch the free training</h3>
            <TrainingVideo eager={false} />
          </section>
          <section className="mx-auto max-w-xl space-y-3 text-left text-base">
            <p className="text-center font-semibold">★ Trusted by 1,200+ agencies</p>
            <blockquote className="glass-card rounded-2xl p-4 shadow-sm"><p className="text-gold" aria-hidden="true">★★★★★</p><p className="mt-2">“SaaSSuite.ai is AMAZING. I was so confused, I didn't know how to support my customers — now I have a clear plan and I can move forward.” <b>Brentney</b></p></blockquote>
            <blockquote className="glass-card rounded-2xl p-4 shadow-sm"><p className="text-gold" aria-hidden="true">★★★★★</p><p className="mt-2">“You're so helpful, you're on top of everything for us. Thank you so much!” <b>Jess</b></p></blockquote>
          </section>
          <section>
            <p>Stuck on anything? Text us. A real person on the SaaSSuite team replies.</p>
            <TextUsLink />
          </section>
          <p className="text-xs text-muted-foreground">Affiliate disclosure: we are a HighLevel affiliate and may earn a commission if you sign up to HighLevel through our link, at no extra cost to you. Not affiliated with HighLevel Inc. Results are not guaranteed.</p>
        </main>
        <Footer minimal />
      </div>
    </>
  );
};

export default OneFeatureTrainingSuccess;
