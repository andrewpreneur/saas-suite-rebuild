import { useEffect, useRef, useState } from "react";
import Footer from "@/components/Footer";
import { FunnelSuccessLinktree } from "@/components/funnel/FunnelSuccessLinktree";
import PageSEO from "@/components/PageSEO";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { WhiteGoogleButton } from "@/components/auth/WhiteGoogleButton";
import { supabase } from "@/integrations/supabase/client";
import { detectMetaInAppBrowser, WORK_WITH_US_EMAIL_CONSENT_TEXT, WWU_SIGNUP_SOURCE, wwuPreviewHost } from "@/lib/funnelContracts";
import { trackingPixelsAllowed } from "@/utils/trackingConsent";
import {
  markWwuStarted,
  postWorkWithUs,
  readWwuContext,
  readWwuQueue,
  requestWwuMagic,
  rotateWwuSession,
  stashWwuContext,
  writeWwuQueue,
  WWU_SESSION_KEY,
  wwuSessionId,
  wwuStartedFor,
  type WwuResult,
} from "@/lib/workWithUsApply";

type ModalStep = "has_highlevel" | "account_count" | "path" | "end" | "already";

const PLANS = [
  { value: "starter", label: "Starter" },
  { value: "unlimited", label: "Unlimited" },
  { value: "saas_pro", label: "SaaS Pro / Agency Pro" },
  { value: "not_sure", label: "Not sure" },
] as const;

const COUNTS = [
  { value: "0", label: "None yet" },
  { value: "1-5", label: "1–5" },
  { value: "6-20", label: "6–20" },
  { value: "21-50", label: "21–50" },
  { value: "51+", label: "51+" },
] as const;

const PATHS = [
  { value: "first_clients", label: "Land my first clients", line: "An offer, funnel and system that books clients." },
  { value: "industry_product", label: "Build a product for my industry", line: "A white-label SaaS product in HighLevel that owns a niche." },
  { value: "fix_ghl", label: "Fix my existing GHL", line: "Clean up and rebuild what's broken or half-finished." },
  { value: "other", label: "Something else", line: "Tell us in a sentence or two." },
] as const;

const FAQ = [
  ["Who is this for?", "Agency owners building on HighLevel: people who want their first clients, people turning a niche into a SaaS product, and people whose GHL setup needs fixing."],
  ["Do I need HighLevel already?", "No. Apply anyway and tell us where you are. We'll factor setup into your plan."],
  ["What does it cost?", "Packages start at $2,500. Your package depends on what you need built."],
  ["Do I need to get on a call?", "No. Not to apply, and not during the partnership. We work async by default."],
  ["How does the partnership work without calls?", "You get written updates and finished work to review in your account, on your own time. You never have to clear your calendar for us."],
  ["What's the GHL audit?", "Every engagement starts with our team and Andrew looking at your HighLevel setup to find what's working, what's broken and what to build first. We'll share how it works for your account when we reply."],
  ["How long is the partnership, and what does \"toward an exit\" mean?", "6–12 months, depending on your package and goals. We systemize and document the agency so it runs without you, which is what makes an agency sellable. We don't promise a sale, a buyer or a price."],
  ["Why do I sign in with Google?", "It fills in your name and email so the application takes 90 seconds, and it confirms the email is really yours. It doesn't create a SaaSSuite account, we don't post anything, and we never see your Google password."],
  ["How fast will I hear back?", "Within 48 hours. Andrew reviews every application himself."],
] as const;

function track(name: string, params?: Record<string, string>) {
  try {
    const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
    if (typeof fbq === "function" && trackingPixelsAllowed()) fbq("trackCustom", name, params || {});
  } catch {
    /* ignore */
  }
}

function withGoogleReturn() {
  const params = new URLSearchParams(window.location.search);
  params.set("google", "1");
  params.delete("auth");
  params.delete("error");
  params.delete("error_description");
  const search = params.toString();
  return `${window.location.origin}/work-with-us?${search}`;
}

function dropOAuthParams() {
  const params = new URLSearchParams(window.location.search);
  ["google", "magic", "s", "code", "error", "error_code", "error_description"].forEach((key) => params.delete(key));
  const search = params.toString();
  window.history.replaceState({}, "", search ? `/work-with-us?${search}` : "/work-with-us");
}

const WorkWithUs = () => {
  const detected = typeof navigator === "undefined"
    ? null
    : detectMetaInAppBrowser({
        userAgent: navigator.userAgent,
        search: window.location.search,
        referrer: document.referrer,
        preview: wwuPreviewHost(window.location.hostname),
      });
  const [iabFallback, setIabFallback] = useState(() => {
    try { return sessionStorage.getItem("wwu_iab_fallback") === "1"; } catch { return false; }
  });
  const inApp = Boolean(detected) || iabFallback;
  const iabLabel = iabFallback && !detected ? "fallback_after_google_error" : detected || "";
  const [notice, setNotice] = useState("");
  const [googleBusy, setGoogleBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [banner, setBanner] = useState(false);
  const [step, setStep] = useState<ModalStep>("has_highlevel");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [manualName, setManualName] = useState("");
  const [needsName, setNeedsName] = useState(false);
  const [hasGhl, setHasGhl] = useState<boolean | null>(null);
  const [plan, setPlan] = useState("");
  const [showPlans, setShowPlans] = useState(false);
  const [count, setCount] = useState("");
  const [path, setPath] = useState("");
  const [pathOther, setPathOther] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [already, setAlready] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sessionLive, setSessionLive] = useState(false);
  const [sticky, setSticky] = useState(false);
  const [magicEmail, setMagicEmail] = useState("");
  const [inbox, setInbox] = useState("");
  const [magicBusy, setMagicBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resent, setResent] = useState(false);
  const [hint, setHint] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [via, setVia] = useState<"google" | "magic_link">("google");
  const heroRef = useRef<HTMLDivElement | null>(null);
  const finalRef = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const started = useRef(false);

  const firstName = (name || "there").split(" ")[0];
  const stepNo = step === "account_count" ? 2 : step === "path" || step === "end" || step === "already" ? 3 : 1;
  const pathLabel = PATHS.find((item) => item.value === path)?.label || "your path";

  const rememberQueue = (body: Record<string, unknown>) => {
    const queue = readWwuQueue();
    queue.push(body);
    writeWwuQueue(queue);
  };

  const applyStep = (next: ModalStep, result: WwuResult) => {
    if (result.name) setName(result.name);
    if (result.email) setEmail(result.email);
    const answers = result.answers;
    if (typeof answers?.has_highlevel === "boolean") setHasGhl(answers.has_highlevel);
    if (typeof answers?.ghl_plan === "string") setPlan(answers.ghl_plan);
    if (typeof answers?.account_count === "string") setCount(answers.account_count);
    if (typeof answers?.path === "string" || result.path) setPath(answers?.path || result.path || "");
    if (typeof answers?.path_other === "string") setPathOther(answers.path_other);
    if (result.already_applied || result.next_step === "submitted") {
      setAlready(Boolean(result.already_applied));
      setSubmitted(true);
      setStep(result.already_applied ? "already" : "end");
      return;
    }
    const map: Record<string, ModalStep> = { has_highlevel: "has_highlevel", account_count: "account_count", path: "path" };
    setStep(map[result.next_step || ""] || next);
  };

  const syncSignIn = async (userEmail: string, viaStep: "google" | "email_verified") => {
    const result = await postWorkWithUs({
      session_id: wwuSessionId(),
      step: viaStep,
      context: { ...readWwuContext(), in_app_browser: iabLabel },
    });
    if (result.ok) markWwuStarted(result.email || userEmail);
    return result;
  };

  useEffect(() => {
    if (inApp) track("wwu_inapp_hint_shown");
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const description = `${params.get("error_description") || ""} ${hash.get("error_description") || ""}`.toLowerCase();
    const code = `${params.get("error") || ""} ${hash.get("error") || ""} ${params.get("error_code") || ""} ${hash.get("error_code") || ""}`.toLowerCase();
    const disallowed = description.includes("disallowed_useragent") || code.includes("disallowed_useragent");
    const expired = params.get("magic") === "1" && (code.includes("otp_expired") || description.includes("expired"));
    if (disallowed || expired) {
      try { sessionStorage.setItem("wwu_iab_fallback", "1"); } catch { /* ignore */ }
      setIabFallback(true);
    }
    if (expired) {
      try {
        const saved = localStorage.getItem("wwu_magic_email") || "";
        if (saved) setMagicEmail(saved);
      } catch { /* ignore */ }
      setNotice("That link expired or was already used. Enter your email to get a new one.");
      return;
    }
    const cancelledCopy = inApp || disallowed
      ? "Google sign-in didn't finish. Tap Continue with Google to try again, or apply with your email below."
      : "Google sign-in didn't finish. Tap Continue with Google to try again.";
    if (params.get("auth") === "cancelled") setNotice(cancelledCopy);
    if (params.get("error") || hash.get("error")) {
      const next = new URLSearchParams(params);
      ["error", "error_code", "error_description", "code", "google"].forEach((key) => next.delete(key));
      next.set("auth", "cancelled");
      window.history.replaceState({}, "", `/work-with-us?${next.toString()}`);
      setNotice(cancelledCopy);
      track("wwu_google_cancelled");
    }
  }, [inApp]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (cancelled || !user?.email) return;
      setSessionLive(true);
      const meta = user.user_metadata ?? {};
      const given = [meta.given_name, meta.family_name].filter((part) => typeof part === "string").join(" ");
      const google = typeof meta.full_name === "string" ? meta.full_name : typeof meta.name === "string" ? meta.name : given;
      setName(google);
      setEmail(user.email);
      setNeedsName(!google);
      const params = new URLSearchParams(window.location.search);
      const fromGoogle = params.get("google") === "1";
      const fromMagic = params.get("magic") === "1";
      if (fromMagic) {
        setVia("magic_link");
        const linked = params.get("s") || "";
        if (linked.length >= 8) {
          try { localStorage.setItem(WWU_SESSION_KEY, linked); } catch { /* ignore */ }
        }
      }
      if (!fromGoogle && !fromMagic && !wwuStartedFor(user.email)) return;
      const result = await syncSignIn(user.email, fromMagic ? "email_verified" : "google");
      if (cancelled) return;
      if (fromGoogle || fromMagic) {
        dropOAuthParams();
        track("wwu_signed_in", { via: fromMagic ? "magic_link" : "google" });
      }
      if (!result.ok) {
        setError(result.error || "Could not save");
        if (fromGoogle || fromMagic) setOpen(true);
        return;
      }
      applyStep("has_highlevel", result);
      if (fromGoogle || fromMagic) setOpen(true);
      else if (!result.already_applied && result.next_step !== "submitted") setBanner(true);
    })();
    return () => {
      cancelled = true;
    };
    // Resume once on load. manualName is sent only on the final submit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inApp]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    const flush = () => {
      const queue = readWwuQueue();
      if (queue.length === 0) return;
      writeWwuQueue([]);
      for (const body of queue) void postWorkWithUs(body, true);
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, []);

  useEffect(() => {
    const nodes = [heroRef.current, finalRef.current].filter(Boolean) as Element[];
    if (nodes.length === 0) return;
    const visible = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      }
      setSticky(visible.size === 0 && !open && !submitted);
    });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [open, submitted]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step, open]);

  const startGoogle = async (forceSwitch = false) => {
    if (googleBusy || started.current) return;
    track("wwu_cta_click", { iab: iabLabel || "none" });
    if (!forceSwitch && sessionLive && !submitted) {
      setGoogleBusy(true);
      setError("");
      const result = await syncSignIn(email, via === "magic_link" ? "email_verified" : "google");
      setGoogleBusy(false);
      if (!result.ok) {
        setError(result.error || "Could not save");
        return;
      }
      applyStep("has_highlevel", result);
      setBanner(false);
      setOpen(true);
      return;
    }
    started.current = true;
    setGoogleBusy(true);
    setError("");
    stashWwuContext();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: withGoogleReturn(), queryParams: { prompt: "select_account" } },
    });
    if (oauthError) {
      started.current = false;
      setGoogleBusy(false);
      setNotice("Google sign-in didn't finish. Tap Continue with Google to try again.");
    }
  };

  const switchAccount = async () => {
    await supabase.auth.signOut();
    rotateWwuSession();
    setSessionLive(false);
    setName("");
    setEmail("");
    setSubmitted(false);
    setAlready(false);
    setOpen(false);
    started.current = false;
    if (via === "magic_link" || inApp) {
      setInbox("");
      setVia("google");
      return;
    }
    await startGoogle(true);
  };

  const savePartial = (nextStep: ModalStep, patch: Record<string, unknown>, serverStep: string) => {
    setError("");
    setStep(nextStep);
    const body = { session_id: wwuSessionId(), step: serverStep, answers_patch: patch, context: readWwuContext() };
    void postWorkWithUs(body).then((result) => {
      if (result.error === "Sign in required") setError("Your Google sign-in timed out. Continue with Google to pick up where you left off.");
      else if (!result.ok) rememberQueue(body);
    });
  };

  const pickGhl = (answer: boolean) => {
    setHasGhl(answer);
    if (answer) {
      setShowPlans(true);
      return;
    }
    setPlan("");
    setShowPlans(false);
    track("wwu_step_has_ghl", { value: "no" });
    savePartial("account_count", { has_highlevel: false, ghl_plan: null }, "has_highlevel");
  };

  const pickPlan = (value: string) => {
    setPlan(value);
    track("wwu_step_has_ghl", { value: "yes", plan: value });
    savePartial("account_count", { has_highlevel: true, ghl_plan: value }, "has_highlevel");
  };

  const skipPlan = () => {
    setPlan("");
    track("wwu_step_has_ghl", { value: "yes" });
    savePartial("account_count", { has_highlevel: true, ghl_plan: null }, "has_highlevel");
  };

  const pickCount = (value: string) => {
    setCount(value);
    track("wwu_step_accounts", { range: value });
    savePartial("path", { account_count: value }, "account_count");
  };

  const pickPath = (value: string) => {
    setPath(value);
    if (value !== "other") setPathOther("");
    track("wwu_step_path", { path: value });
    const patch: Record<string, unknown> = { path: value };
    if (value !== "other") patch.path_other = null;
    const body = { session_id: wwuSessionId(), step: "path", answers_patch: patch, context: readWwuContext() };
    void postWorkWithUs(body).then((result) => {
      if (!result.ok) rememberQueue(body);
    });
  };

  const submit = async () => {
    if (busy) return;
    if (!path) {
      setError("Pick one to continue.");
      return;
    }
    if (path === "other" && pathOther.trim().length < 10) {
      setError("Tell us a bit more (at least 10 characters).");
      return;
    }
    if (needsName && manualName.trim().length < 2) {
      setError("Enter your name");
      return;
    }
    setBusy(true);
    setError("");
    const eventId = `wwu_${wwuSessionId()}`;
    const timeout = new Promise<WwuResult>((resolve) => {
      window.setTimeout(() => resolve({ ok: false, error: "timeout" }), 10000);
    });
    const result = await Promise.race([
      postWorkWithUs({
        session_id: wwuSessionId(),
        step: "submitted",
        name: needsName ? manualName.trim() : undefined,
        answers_patch: { path, path_other: path === "other" ? pathOther.trim() : null, submitted_at: new Date().toISOString() },
        context: readWwuContext(),
        meta: { event_id: eventId, fbp: readWwuContext().fbp || "", fbc: readWwuContext().fbc || "" },
      }),
      timeout,
    ]);
    setBusy(false);
    if (!result.ok) {
      setError(result.error === "Sign in required"
        ? "Your Google sign-in timed out. Continue with Google to pick up where you left off."
        : "That didn't go through. Check your connection and tap Submit again.");
      return;
    }
    try {
      const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
      if (typeof fbq === "function" && trackingPixelsAllowed()) {
        fbq("track", "Lead", { content_name: "work_with_us_apply" }, { eventID: result.event_id || (result.lead_id ? `wwu_${result.lead_id}` : eventId) });
      }
    } catch {
      /* ignore */
    }
    setSubmitted(true);
    setStep("end");
  };

  const sendMagic = async (address = magicEmail) => {
    const clean = address.trim().toLowerCase();
    if (!clean) {
      setError("Enter your email to continue.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setError("That email doesn't look right. Check for typos.");
      return;
    }
    if (/gmial\.com|gmal\.com|gnail\.com/i.test(clean)) setHint(clean.replace(/gmial\.com|gmal\.com|gnail\.com/i, "gmail.com"));
    if (magicBusy || cooldown > 0) return;
    setMagicBusy(true);
    setError("");
    const ctx = { ...stashWwuContext(), in_app_browser: iabLabel };
    try {
      localStorage.setItem("wwu_magic_email", clean);
    } catch {
      /* ignore */
    }
    const saved = await requestWwuMagic({
      session_id: wwuSessionId(),
      email: clean,
      context: ctx,
      company_website: honeypot,
    });
    if (!saved.ok) {
      setMagicBusy(false);
      setError(saved.error || "That didn't go through. Check your connection and try again.");
      return;
    }
    if (!saved.ignored) {
      const params = new URLSearchParams(window.location.search);
      params.set("magic", "1");
      params.set("s", wwuSessionId());
      params.delete("google");
      params.delete("error");
      params.delete("iab");
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: clean,
        options: {
          emailRedirectTo: `${window.location.origin}/work-with-us?${params.toString()}`,
          shouldCreateUser: true,
          data: { ss_lead_only: "true", signup_source: WWU_SIGNUP_SOURCE },
        },
      });
      if (otpError) {
        setMagicBusy(false);
        setError("That didn't go through. Check your connection and try again.");
        return;
      }
    }
    setMagicBusy(false);
    track("wwu_magic_requested");
    setMagicEmail(clean);
    if (inbox) setResent(true);
    setInbox(clean);
    setCooldown(30);
  };

  const label = submitted
    ? "✓ Application received"
    : banner
      ? "Finish your application →"
      : sessionLive
        ? `Continue as ${firstName}`
        : googleBusy
          ? "Connecting to Google…"
          : "Continue with Google";

  return (
    <>
      <PageSEO
        title="Work With SaaSSuite | Specialized HighLevel Builds & Strategy"
        ogTitle="Specialized HighLevel Builds & Strategy"
        description="The GHL developers and strategists behind SaaSSuite. A 6–12 month build with you, async with no calls. Packages start at $2,500. Apply."
        path="/work-with-us"
        noindex
      />
      <div className="min-h-screen bg-background text-foreground">
        <main className="webinar-2-hero mx-auto max-w-3xl px-4 pb-28 pt-6 text-center sm:px-6">
          <img src="/assets/saassuite-logo.png" alt="SaaSSuite" width={48} height={48} decoding="async" fetchPriority="low" className="mx-auto mb-3 h-10 w-10 object-contain sm:h-12 sm:w-12" />
          <p className="webinar-2-attention mx-auto mb-4 inline-flex px-4 py-1.5 text-xs font-bold uppercase tracking-wide">Applications open</p>
          <div className="mx-auto max-w-xl space-y-4">
              <p className="text-xs font-bold uppercase tracking-wide webinar-2-accent">Work with the SaaSSuite team</p>
              <h1 aria-label="Specialized HighLevel Builds & Strategy." className="text-[32px] font-extrabold leading-tight text-foreground sm:text-[40px] md:text-[46px]">Specialized <span className="webinar-2-accent">HighLevel</span> Builds & <span className="webinar-2-accent">Strategy</span>.</h1>
              <p className="text-base">The GHL developers and strategists behind SaaSSuite. We start with a GHL audit, build what your agency actually needs, and stay on as your partner for 6–12 months, building it toward an exit. Async by default. No calls.</p>
              {notice && <p role="status" className="glass-card rounded-2xl px-3 py-2 text-left text-sm shadow-sm">{notice}</p>}
              {inApp && !sessionLive && !submitted && <p className="glass-card rounded-2xl px-3 py-2 text-left text-sm shadow-sm">Opening from Facebook or Instagram? Google sign-in can get blocked inside the app, so you can apply with your email instead.</p>}
              <div ref={heroRef} id="wwu-apply" className="glass-card space-y-3 rounded-2xl p-5 text-left shadow-sm">
                {inApp && !sessionLive && !submitted ? (
                  inbox ? (
                    <div className="space-y-2">
                      <h2 className="text-lg font-extrabold">Check your inbox</h2>
                      <p className="text-sm">We sent a link to {inbox}. Tap it to continue your application. It opens in your browser and takes about 90 seconds.</p>
                      <button type="button" className="text-sm font-semibold underline webinar-2-accent disabled:opacity-50" disabled={cooldown > 0 || magicBusy} onClick={() => { void sendMagic(inbox); }}>{cooldown > 0 ? `Resend link in ${cooldown}s` : resent ? "Sent again" : "Resend link"}</button>
                      <p className="text-xs text-muted-foreground">Can't find it? Check spam or Promotions. The link works once and expires in 1 hour.</p>
                      <button type="button" className="block text-sm font-semibold underline webinar-2-accent" onClick={() => setInbox("")}>Wrong email? Change it</button>
                    </div>
                  ) : (
                    <form className="space-y-2" noValidate onSubmit={(event) => { event.preventDefault(); void sendMagic(); }}>
                      <label className="block text-sm font-semibold" htmlFor="wwu-magic-email">Your email
                        <input id="wwu-magic-email" type="email" inputMode="email" autoComplete="email" placeholder="you@agency.com" value={magicEmail} onChange={(event) => setMagicEmail(event.target.value)} className="mt-1 h-12 w-full rounded-xl border border-input bg-card px-3" />
                      </label>
                      <input className="absolute -left-[9999px] h-0 w-0" tabIndex={-1} autoComplete="off" aria-hidden="true" value={honeypot} onChange={(event) => setHoneypot(event.target.value)} />
                      {hint && <button type="button" className="text-sm font-semibold underline webinar-2-accent" onClick={() => { setMagicEmail(hint); setHint(""); }}>Did you mean {hint}?</button>}
                      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                      <Button type="submit" disabled={magicBusy} className="webinar-2-cta h-12 w-full rounded-xl text-base font-bold">{magicBusy ? "Sending…" : "Email Me My Application Link →"}</Button>
                      <p className="text-center text-xs text-muted-foreground">or</p>
                      <WhiteGoogleButton label={googleBusy ? "Connecting to Google…" : "Continue with Google"} disabled={googleBusy} onClick={() => { void startGoogle(); }} />
                      <p className="text-xs text-muted-foreground">By continuing, you agree SaaSSuite may email you about your application.</p>
                    </form>
                  )
                ) : (
                <WhiteGoogleButton label={label} disabled={googleBusy || submitted} onClick={() => { if (submitted) { setStep("end"); setOpen(true); return; } void startGoogle(); }} />
                )}
                {sessionLive && !submitted && (
                  <button type="button" className="text-sm font-semibold underline webinar-2-accent" onClick={() => { void switchAccount(); }}>Use a different Google account</button>
                )}
                <p className="text-sm font-semibold">Apply in about 90 seconds · No call needed</p>
                <p className="text-xs text-muted-foreground">We only use Google to fill in your name and email. Nothing is posted, and no password is needed.</p>
              </div>
              <p className="text-base font-semibold">★ Trusted by 1,200+ agencies</p>
              <p className="text-base font-extrabold">Packages start at $2,500</p>
            </div>
            <aside className="glass-card mx-auto mt-8 max-w-xl rounded-2xl p-5 text-center shadow-sm">
              <img src="/assets/andrew-george-192.webp" alt="Andrew George" width={96} height={96} decoding="async" fetchPriority="low" loading="lazy" className="mx-auto h-24 w-24 rounded-full object-cover" />
              <p className="mt-3 text-lg font-extrabold">Andrew George</p>
              <p className="text-base text-muted-foreground">Founder, SaaSSuite</p>
              <p className="mt-2 text-base font-semibold">10+ SaaSpreneur Gold agencies in under 10 months</p>
              <ul className="mt-3 space-y-1 text-left text-base">
                <li>✓ A GHL audit by our team + Andrew</li>
                <li>✓ A build plan: first clients, an industry product, or fixing what's broken</li>
                <li>✓ The best GHL developers + strategy in one team</li>
              </ul>
            </aside>

          {banner && !open && !submitted && (
            <p className="glass-card mx-auto mt-8 max-w-xl rounded-2xl px-4 py-3 text-left text-sm shadow-sm">Your application is saved. <button type="button" className="font-bold underline webinar-2-accent" onClick={() => setOpen(true)}>Finish applying →</button></p>
          )}

          <section className="mx-auto mt-16 max-w-xl space-y-4 text-left">
            <h2 className="text-center text-2xl font-extrabold sm:text-3xl">Wherever your agency is, we start there.</h2>
            <div className="grid gap-3">
              <article className="glass-card rounded-2xl p-4 shadow-sm"><h3 className="font-extrabold">Land your first clients</h3><p className="mt-1 text-base text-muted-foreground">You have HighLevel (or you're about to) and need an offer, a funnel and a system that books real clients, not another course.</p></article>
              <article className="glass-card rounded-2xl p-4 shadow-sm"><h3 className="font-extrabold">Build a product that owns an industry</h3><p className="mt-1 text-base text-muted-foreground">Turn what you know about one niche into a white-label SaaS product in HighLevel: snapshots, automations and onboarding, packaged to sell.</p></article>
              <article className="glass-card rounded-2xl p-4 shadow-sm"><h3 className="font-extrabold">Fix the GHL you already have</h3><p className="mt-1 text-base text-muted-foreground">Broken workflows, messy sub-accounts, half-finished snapshots. We find what's costing you and rebuild it properly.</p></article>
            </div>
            <p className="text-base text-muted-foreground">No HighLevel yet? You can still apply. Something else in mind? Tell us in the application.</p>
          </section>

          <section className="mx-auto mt-16 max-w-xl space-y-3 text-left">
            <h2 className="text-center text-2xl font-extrabold sm:text-3xl">The best GHL developers and the strategy to go with them.</h2>
            <ul className="space-y-1 text-base">
              <li>✓ Specialists, not generalists. HighLevel is all we build in. We built SaaSSuite on it.</li>
              <li>✓ Developers and strategists on one team. You don't have to translate a plan for a freelancer. The people who plan it build it.</li>
              <li>✓ Proven with agencies like yours. 10+ SaaSpreneur Gold agencies in under 10 months.</li>
              <li>✓ Async by default. No calls. No weekly status calls, and nothing to put on your calendar. You get written updates and finished work to review in your account, on your own time.</li>
            </ul>
            <p className="text-base">★ SaaSSuite is trusted by 1,200+ agencies.</p>
          </section>

          <section className="mx-auto mt-16 max-w-xl space-y-4 text-left">
            <h2 className="text-center text-2xl font-extrabold sm:text-3xl">We don't build and disappear.</h2>
            <p className="text-base text-muted-foreground">Freelancers build a funnel and vanish. We stay for 6–12 months and build your agency so it can run, and sell, without you holding it together. All of it async: you never have to clear your calendar for us.</p>
            <ol className="list-decimal space-y-2 pl-5 text-base">
              <li><span className="font-bold">Month 1 · Audit.</span> A GHL audit by our team and Andrew to find what's working, what's broken and what to build first.</li>
              <li><span className="font-bold">Months 2–3 · Build.</span> Your offer, product and systems built inside HighLevel.</li>
              <li><span className="font-bold">Months 4–8 · Scale.</span> Clients, automations and team.</li>
              <li><span className="font-bold">Months 9–12 · Exit-ready.</span> Systemized and documented so the agency can run without you.</li>
            </ol>
            <p className="text-xs text-muted-foreground">Timelines are typical, not guaranteed. Every agency moves at its own pace. We don't promise a sale, a price or a valuation.</p>
          </section>

          <section className="mx-auto mt-16 max-w-xl space-y-3 text-left">
            <h2 className="text-center text-2xl font-extrabold sm:text-3xl">Apply in about 90 seconds. No call.</h2>
            <ol className="list-decimal space-y-1 pl-5 text-base">
              <li><span className="font-bold">Continue with Google.</span> It fills in your name and email for you.</li>
              <li><span className="font-bold">Answer 3 quick questions.</span> Your HighLevel setup, your accounts, and what you want built.</li>
              <li><span className="font-bold">Andrew reviews it.</span> You'll hear back from our team within 48 hours.</li>
            </ol>
            <p className="text-base text-muted-foreground">No sales call. No calendar link. Everything comes by email.</p>
          </section>

          <section className="glass-card mx-auto mt-16 max-w-xl rounded-2xl p-5 text-left shadow-sm">
            <h2 className="text-center text-2xl font-extrabold sm:text-3xl">Packages start at $2,500.</h2>
            <p className="mt-2 text-base">Every engagement starts with a GHL audit by our team and Andrew. From there we match you to the right package for where you are: first clients, an industry product, or fixing your current setup. The partnership runs 6–12 months, async by default.</p>
            <p className="mt-2 text-xs text-muted-foreground">"Starts at" means the smallest package. Your package depends on scope.</p>
          </section>

          <section className="mx-auto mt-16 max-w-xl space-y-3 text-left">
            <h2 className="text-center text-2xl font-extrabold sm:text-3xl">Questions</h2>
            {FAQ.map(([question, answer]) => (
              <details key={question} className="glass-card rounded-2xl px-4 py-3 shadow-sm">
                <summary className="cursor-pointer font-bold">{question}</summary>
                <p className="mt-2 text-base text-muted-foreground">{answer}{inApp && question.startsWith("Why do I sign in") ? " In the Facebook or Instagram app you can apply with your email instead. We'll send you a one-time link." : ""}</p>
              </details>
            ))}
          </section>

          <section ref={finalRef} className="mx-auto mt-16 max-w-xl space-y-3 text-center">
            <h2 className="text-2xl font-extrabold sm:text-3xl">Let's build the agency you actually want.</h2>
            <p className="text-base">Apply in about 90 seconds. Packages start at $2,500.</p>
            {inApp && !sessionLive && !submitted ? (
              <Button type="button" className="webinar-2-cta mx-auto h-12 w-full max-w-[410px] rounded-xl text-base font-bold" onClick={() => { document.getElementById("wwu-apply")?.scrollIntoView({ behavior: "smooth", block: "center" }); document.getElementById("wwu-magic-email")?.focus(); }}>Apply with Email →</Button>
            ) : (
              <div className="mx-auto max-w-[410px]">
                <WhiteGoogleButton label={label} disabled={googleBusy || submitted} onClick={() => { if (submitted) { setStep("end"); setOpen(true); return; } void startGoogle(); }} />
              </div>
            )}
            {submitted && <button type="button" className="text-sm font-semibold underline webinar-2-accent" onClick={() => { setStep("end"); setOpen(true); }}>See packages info</button>}
          </section>
          <p className="mt-8 text-center text-xs text-muted-foreground">Timelines are typical, not promised.</p>
        </main>
        {sticky && (
          <div className="fixed inset-x-0 bottom-16 z-40 px-4 md:hidden">
            {inApp && !sessionLive ? (
              <Button type="button" className="webinar-2-cta h-12 w-full rounded-xl text-base font-bold" onClick={() => document.getElementById("wwu-apply")?.scrollIntoView({ behavior: "smooth" })}>Apply with Email →</Button>
            ) : (
              <WhiteGoogleButton label={googleBusy ? "Connecting to Google…" : "Continue with Google"} disabled={googleBusy} onClick={() => { void startGoogle(); }} />
            )}
          </div>
        )}
        <Footer minimal />
      </div>

      <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next && !submitted) setBanner(true); }}>
        <DialogContent className="max-h-[100dvh] max-w-[520px] overflow-y-auto sm:max-w-[520px]">
          <DialogTitle>Apply to work with us</DialogTitle>
          <p className="text-xs font-semibold text-muted-foreground">Step {stepNo} of 3</p>
          {step === "has_highlevel" ? (
            <div className="space-y-2 rounded-md bg-muted px-3 py-2 text-sm" aria-readonly="true">
              {needsName ? (
                <label className="block font-semibold">Your name
                  <input className="mt-1 h-12 w-full rounded-xl border border-input bg-card px-3" value={manualName} maxLength={80} onChange={(event) => setManualName(event.target.value)} />
                </label>
              ) : (
                <p><span aria-hidden="true">🔒 </span>{name || "Name from Google"} <span className="text-xs text-muted-foreground">{via === "magic_link" ? "verified" : "from Google"}</span></p>
              )}
              <p><span aria-hidden="true">🔒 </span>{email} <span className="text-xs text-muted-foreground">{via === "magic_link" ? "verified" : "from Google"}</span></p>
            </div>
          ) : (
            <p className="text-sm">Applying as {name || manualName || "you"} · {email} 🔒</p>
          )}
          <button type="button" className="text-sm font-semibold underline webinar-2-accent" onClick={() => { void switchAccount(); }}>{via === "magic_link" ? "Not you? Use a different email" : "Not you? Switch Google account"}</button>
          {error && step !== "path" && <p role="alert" aria-live="polite" className="text-sm text-destructive">{error}</p>}

          {step === "has_highlevel" && (
            <div className="space-y-3">
              <h3 ref={headingRef} tabIndex={-1} className="text-base font-extrabold outline-none">Do you have a HighLevel account?</h3>
              <p className="text-sm text-muted-foreground">Either answer is fine. Applicants without HighLevel are welcome. This tells us where to start.</p>
              <Button type="button" variant="outline" className="one-feature-choice h-12 w-full border-2 font-bold" onClick={() => pickGhl(true)}>Yes, I have HighLevel</Button>
              <Button type="button" variant="outline" className="one-feature-choice h-12 w-full border-2 font-bold" onClick={() => pickGhl(false)}>Not yet</Button>
              {showPlans && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Which plan are you on? (optional)</p>
                  <div className="grid grid-cols-2 gap-2">
                    {PLANS.map((item) => (
                      <Button key={item.value} type="button" variant="outline" className="one-feature-choice h-12 border-2 font-bold" onClick={() => pickPlan(item.value)}>{item.label}</Button>
                    ))}
                  </div>
                  <button type="button" className="text-sm font-semibold webinar-2-accent" onClick={skipPlan}>Skip →</button>
                </div>
              )}
            </div>
          )}

          {step === "account_count" && (
            <div className="space-y-3">
              <button type="button" className="text-sm font-semibold webinar-2-accent" onClick={() => setStep("has_highlevel")}>← Back</button>
              <h3 ref={headingRef} tabIndex={-1} className="text-base font-extrabold outline-none">{hasGhl === false ? "How many clients or businesses do you work with today?" : "How many sub-accounts are in your HighLevel?"}</h3>
              <p className="text-sm text-muted-foreground">Rough is fine.</p>
              {COUNTS.map((item) => (
                <Button key={item.value} type="button" variant="outline" className="one-feature-choice h-12 w-full border-2 font-bold" onClick={() => pickCount(item.value)}>{item.label}</Button>
              ))}
            </div>
          )}

          {(step === "path") && (
            <div className="space-y-3">
              <button type="button" className="text-sm font-semibold webinar-2-accent" onClick={() => setStep("account_count")}>← Back</button>
              <h3 ref={headingRef} tabIndex={-1} className="text-base font-extrabold outline-none">What do you want us to help you build?</h3>
              {PATHS.map((item) => (
                <Button key={item.value} type="button" variant="outline" aria-pressed={path === item.value} className="one-feature-choice h-auto min-h-12 w-full border-2 py-2 text-left font-bold" onClick={() => pickPath(item.value)}>
                  <span className="block">{item.label}</span>
                  <span className="block text-xs font-normal">{item.line}</span>
                </Button>
              ))}
              {path === "other" && (
                <label className="block text-sm font-semibold">What do you have in mind?
                  <Textarea className="mt-1" maxLength={500} value={pathOther} placeholder="e.g. Migrate 40 clients from another CRM into HighLevel and automate onboarding" onChange={(event) => setPathOther(event.target.value)} />
                  {pathOther.length >= 400 && <span className="text-xs text-muted-foreground">{pathOther.length}/500</span>}
                </label>
              )}
              {error && <p role="alert" aria-live="polite" className="text-sm text-destructive">{error}</p>}
              <Button type="button" className="webinar-2-cta h-12 w-full rounded-xl text-base font-bold" disabled={busy || !path} onClick={() => { void submit(); }}>{busy ? "Submitting…" : "Submit My Application →"}</Button>
              <p className="text-xs text-muted-foreground">{WORK_WITH_US_EMAIL_CONSENT_TEXT}</p>
            </div>
          )}

          {(step === "end" || step === "already") && (
            <div className="space-y-3">
              <h3 className="text-xl font-extrabold">{already || step === "already" ? "You've already applied 👍" : `Application received, ${firstName}.`}</h3>
              <p className="text-sm">{already || step === "already" ? `We have your application for ${email}. You'll hear back within 48 hours of applying.` : "Thanks. Andrew reviews every application himself, and you'll hear back from our team within 48 hours."}</p>
              <div className="glass-card rounded-2xl p-4 text-sm shadow-sm">
                <p className="font-extrabold">Packages start at $2,500</p>
                <ul className="mt-2 space-y-1">
                  <li>✓ A GHL audit by our team + Andrew to find what's working, what's broken and what to build first.</li>
                  <li>✓ A build plan for your path: {pathLabel}.</li>
                  <li>✓ A 6–12 month agency partner, building your agency toward an exit: Audit → Build → Scale → Exit-ready.</li>
                  <li>✓ Async by default. No calls. Written updates and finished work, on your own time.</li>
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">Your package depends on scope.</p>
              </div>
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                <li>Andrew reviews your application.</li>
                <li>You hear back from our team within 48 hours.</li>
                <li>If it's a fit, we'll share how your GHL audit works and what we need from you.</li>
              </ol>
              {hasGhl === false && <p className="text-sm">No HighLevel yet? That's fine. We'll factor setup into your plan.</p>}
              <p className="text-sm">No call to book. Nothing else to do right now.</p>
              <FunnelSuccessLinktree />
              <Button type="button" className="webinar-2-cta h-12 w-full rounded-xl text-base font-bold" onClick={() => setOpen(false)}>Done</Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Saved as you go. No call needed.</p>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WorkWithUs;
