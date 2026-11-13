import { useEffect, useRef, useState, type RefObject } from "react";
import type { CountryCode } from "libphonenumber-js";
import Footer from "@/components/Footer";
import { FunnelSuccessLinktree } from "@/components/funnel/FunnelSuccessLinktree";
import PageSEO from "@/components/PageSEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type AgentDraft,
  type AgentStep,
  agentsSessionId,
  emailLooksValid,
  postAgentKeepalive,
  readAgentDraft,
  readAgentQueue,
  suggestEmail,
  toAgentPhone,
  writeAgentDraft,
  writeAgentQueue,
} from "@/lib/agentsApply";
import { AGENTS_SMS_CONSENT_TEXT, rememberPaidSocial, trainingGhlHref } from "@/lib/funnelContracts";
import { saveFunnelStep, visitContext } from "@/lib/funnelApplyClient";
import { trackingPixelsAllowed } from "@/utils/trackingConsent";

const PLANS = [
  { value: "starter", label: "Starter" },
  { value: "unlimited", label: "Unlimited" },
  { value: "saas_pro", label: "SaaS Pro" },
  { value: "other", label: "Other / not sure" },
] as const;

const COUNTS = [
  { value: "0", label: "0" },
  { value: "1-5", label: "1–5" },
  { value: "6-20", label: "6–20" },
  { value: "21+", label: "21+" },
] as const;

const COUNTRIES: { iso: CountryCode; label: string }[] = [
  { iso: "US", label: "United States +1" },
  { iso: "CA", label: "Canada +1" },
  { iso: "GB", label: "United Kingdom +44" },
  { iso: "AU", label: "Australia +61" },
  { iso: "NZ", label: "New Zealand +64" },
  { iso: "IE", label: "Ireland +353" },
];

const FAQ = [
  ["What is SaaSSuite Agents?", "AI agents that work inside your GoHighLevel account. You tell them what you need, and they build funnels, automations and snapshots, handle support requests and deliver agency services, then QA the work and hand it back."],
  ["Is this open to everyone yet?", "Not yet. It's a private beta and we're letting agencies in by application. Applying doesn't sign you up for anything."],
  ["Do I need GoHighLevel?", "Agents work inside your GoHighLevel account. If you don't have one yet, apply anyway. We'll show you how to get set up."],
  ["What does it cost?", "Applying is free, and SaaSSuite is Free with Your GoHighLevel Account. Agents run on credits. Free trial: 10 credits, enough for about 1–2 GoHighLevel tasks. Paid: $297 for 300 credits, used up to 150 credits a week. Need more? You can buy additional usage any time."],
  ["Is it safe to let agents into my account?", "You decide which sub-accounts they can work in, client requests stay off until you turn them on, and every action is logged so you can review it."],
  ["Do agents ever make mistakes?", "They can. That's why every job is tested and logged before it comes back to you, and why you review the result. It's a beta, and your feedback shapes what ships."],
  ["Do I have to get on a call?", "No. You apply here and hear back from our team within 48 hours. No calls or demos needed."],
  ["How fast will I hear back?", "Within 48 hours. Andrew reviews every application himself."],
] as const;

const TILES = [
  ["Funnels & sites", "Build a 3-step webinar funnel for my dentist client. Pages, forms and domain settings, built and tested."],
  ["Automations", "Workflows, triggers, pipelines and follow-ups, wired up and run through a test contact before they're handed back."],
  ["Snapshots", "Package an account as a snapshot, or load one into a new sub-account and set it up."],
  ["Support, 24/7", "When you turn it on, agents pick up your clients' requests and work on them inside your account, even at 2 AM."],
  ["Agency services", "The jobs you sell to clients: onboarding a new sub-account, fixing a broken calendar, adding a campaign."],
] as const;

const EXAMPLES = [
  "The chat prompt and the agent's plan.",
  "The finished funnel in HighLevel.",
  "A workflow with the test-contact run.",
  "The activity log, each step marked QA passed.",
  "A client request and the handled reply.",
];

function flow(has: boolean | null): AgentStep[] {
  if (has === false) return ["email", "has_highlevel", "sub_account_count", "phone"];
  return ["email", "has_highlevel", "ghl_plan", "sub_account_count", "phone"];
}

function trackCustom(name: string, params?: Record<string, string>) {
  try {
    const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
    if (typeof fbq === "function" && trackingPixelsAllowed()) fbq("trackCustom", name, params || {});
  } catch {
    /* ignore */
  }
}

function leadMeta() {
  const cookie = (name: string) => document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))?.[1] ?? null;
  let fbclid: string | null = null;
  try {
    fbclid = new URLSearchParams(window.location.search).get("fbclid");
  } catch {
    /* ignore */
  }
  return { fbp: cookie("_fbp"), fbc: cookie("_fbc"), fbclid };
}

function fireLead(eventId: string) {
  if (!eventId.startsWith("lead_")) return;
  try {
    const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
    if (typeof fbq === "function" && trackingPixelsAllowed()) {
      fbq("track", "Lead", { content_name: "agents_beta_apply" }, { eventID: eventId });
    }
  } catch {
    /* ignore */
  }
}

const emptyDraft = (): AgentDraft => ({
  email: "",
  hasHighlevel: null,
  plan: "",
  count: "",
  phone: "",
  country: "US",
  step: "email",
  submitted: false,
  already: false,
});

const AgentsApply = () => {
  const sessionId = useRef(agentsSessionId());
  const initial = useRef(readAgentDraft() || emptyDraft());
  const [draft, setDraft] = useState<AgentDraft>(initial.current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [showSticky, setShowSticky] = useState(false);
  const formRef = useRef<HTMLElement | null>(null);
  const finalRef = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const emailRef = useRef<HTMLInputElement | null>(null);
  const submitting = useRef(false);
  const viewed = useRef(false);

  const steps = flow(draft.hasHighlevel);
  const stepIndex = Math.max(0, steps.indexOf(draft.step === "thanks" ? "phone" : draft.step));
  const stepNo = draft.step === "thanks" ? steps.length : stepIndex + 1;

  const remember = (next: AgentDraft) => {
    setDraft(next);
    writeAgentDraft(next);
  };

  const answersFor = (source: AgentDraft, extra: Record<string, unknown> = {}) => {
    const answers: Record<string, unknown> = { email: source.email, ...extra };
    if (source.hasHighlevel !== null) {
      answers.has_highlevel = source.hasHighlevel;
      answers.has_ghl = source.hasHighlevel;
      answers.path = source.hasHighlevel ? "yes" : "no";
    }
    if (source.hasHighlevel === true && source.plan) answers.ghl_plan = source.plan;
    if (source.count) answers.sub_account_count = source.count;
    if (source.phone) answers.phone = source.phone;
    return answers;
  };

  const payload = (step: string, source: AgentDraft, final = false, meta?: Record<string, unknown>) => {
    const visit = visitContext();
    return {
      funnel: "agents",
      session_key: sessionId.current,
      session_id: sessionId.current,
      step,
      email: source.email,
      landing_url: visit.landing_url,
      utm: visit.utm,
      answers: answersFor(source),
      final,
      ...(meta ? { meta } : {}),
    };
  };

  const enqueue = (body: Record<string, unknown>) => {
    const queue = readAgentQueue();
    queue.push(body);
    writeAgentQueue(queue);
  };

  const flush = async () => {
    const queue = readAgentQueue();
    if (queue.length === 0) return;
    const left: Record<string, unknown>[] = [];
    for (const body of queue) {
      const result = await saveFunnelStep(body);
      if (!result.ok) left.push(body);
      else if (result.already_applied) {
        remember({ ...readAgentDraft() || draft, step: "thanks", submitted: true, already: true });
      }
    }
    writeAgentQueue(left);
  };

  useEffect(() => {
    rememberPaidSocial(window.location.search);
    if (!viewed.current) {
      viewed.current = true;
      try {
        const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
        if (typeof fbq === "function" && trackingPixelsAllowed()) fbq("track", "ViewContent", { content_name: "agents_beta_apply" });
      } catch {
        /* ignore */
      }
    }
    void flush();
    const onHide = () => {
      for (const body of readAgentQueue()) postAgentKeepalive(body);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void flush();
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // Resume and retry once on load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const form = formRef.current;
    const final = finalRef.current;
    if (!form) return;
    const visible = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      }
      setShowSticky(visible.size === 0 && draft.step !== "thanks");
    });
    observer.observe(form);
    if (final) observer.observe(final);
    return () => observer.disconnect();
  }, [draft.step]);

  useEffect(() => {
    if (draft.step === "email") emailRef.current?.focus();
    else headingRef.current?.focus();
  }, [draft.step]);

  const savePartial = (step: AgentStep, next: AgentDraft) => {
    remember(next);
    setError("");
    const body = payload(step, next);
    void saveFunnelStep(body).then((result) => {
      if (result.already_applied) {
        remember({ ...next, step: "thanks", submitted: true, already: true });
        trackCustom("agents_already_applied");
        return;
      }
      if (!result.ok) enqueue(body);
    });
  };

  const submitEmail = (event: React.FormEvent) => {
    event.preventDefault();
    const clean = draft.email.trim().toLowerCase();
    if (!clean) {
      setError("Enter your email to continue.");
      return;
    }
    if (!emailLooksValid(clean)) {
      setError("That email doesn't look right. Check for typos.");
      setSuggestion(suggestEmail(clean));
      return;
    }
    setSuggestion(suggestEmail(clean));
    const next = { ...draft, email: clean, step: "has_highlevel" as const };
    trackCustom("agents_step_email");
    savePartial("email", next);
  };

  const pickGhl = (answer: boolean) => {
    const next: AgentDraft = {
      ...draft,
      hasHighlevel: answer,
      plan: answer ? draft.plan : "",
      step: answer ? "ghl_plan" : "sub_account_count",
    };
    trackCustom("agents_step_has_ghl", { value: answer ? "yes" : "no" });
    savePartial("has_highlevel", next);
  };

  const pickPlan = (value: string) => {
    const next = { ...draft, hasHighlevel: true as const, plan: value, step: "sub_account_count" as const };
    trackCustom("agents_step_plan", { plan: value });
    savePartial("ghl_plan", next);
  };

  const pickCount = (value: string) => {
    const next = { ...draft, count: value, step: "phone" as const };
    trackCustom("agents_step_subaccounts", { range: value });
    savePartial("sub_account_count", next);
  };

  const submitPhone = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    const e164 = toAgentPhone(draft.phone, draft.country);
    if (!draft.phone.trim()) {
      setError("Enter your phone number to submit.");
      return;
    }
    if (!e164) {
      setError("Enter a valid phone number, including area code.");
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError("");
    const next = { ...draft, phone: e164 };
    remember(next);
    const meta = leadMeta();
    const body = {
      ...payload("submitted", next, true, meta),
      answers: {
        ...answersFor(next),
        phone: e164,
        submitted_at: new Date().toISOString(),
      },
    };
    const timeout = new Promise<{ ok: false; error: string; already_applied?: boolean }>((resolve) => {
      window.setTimeout(() => resolve({ ok: false, error: "timeout" }), 10000);
    });
    const result = await Promise.race([saveFunnelStep(body), timeout]);
    setBusy(false);
    submitting.current = false;
    if (!result.ok && !result.already_applied) {
      setError("That didn't go through. Check your connection and tap Submit again.");
      return;
    }
    if ("event_id" in result && result.event_id) fireLead(result.event_id);
    else if (result.already_applied) trackCustom("agents_already_applied");
    remember({ ...next, step: "thanks", submitted: true, already: Boolean(result.already_applied) });
  };

  const back = () => {
    const order = flow(draft.hasHighlevel);
    const index = order.indexOf(draft.step as AgentStep);
    const previous = order[Math.max(0, index - 1)] || "email";
    remember({ ...draft, step: previous });
    setError("");
  };

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      if (draft.step === "email") emailRef.current?.focus();
      else headingRef.current?.focus();
    }, 300);
  };

  return (
    <>
      <PageSEO
        title="SaaSSuite Agents Beta | Use Every GHL Feature Without Logging In"
        ogTitle="Use Every Feature of GHL Without Ever Logging In"
        description="Agents build your GoHighLevel funnels, automations, snapshots and support 24/7, QA-checked and logged. Apply to join the SaaSSuite Agents beta."
        path="/agents"
        noindex
      />
      <div className="min-h-screen bg-background text-foreground">
        <main className="webinar-2-hero mx-auto max-w-3xl px-4 pb-28 pt-6 text-center sm:px-6">
          <img src="/assets/saassuite-logo.png" alt="SaaSSuite" width={48} height={48} decoding="async" fetchPriority="low" className="mx-auto mb-3 h-10 w-10 object-contain sm:h-12 sm:w-12" />
          <p className="webinar-2-attention mx-auto mb-4 inline-flex px-4 py-1.5 text-xs font-bold uppercase tracking-wide">Agents · BETA</p>
          <div className="mx-auto max-w-xl space-y-4">
              <p className="text-xs font-bold uppercase tracking-wide webinar-2-accent">SaaSSuite Agents · Private beta</p>
              <h1 aria-label="Use Every Feature of GHL Without Ever Logging In" className="text-[32px] font-extrabold leading-tight text-foreground sm:text-[40px] md:text-[46px]">Use <span className="webinar-2-accent">Every Feature</span> of GHL <span className="webinar-2-accent">Without Ever Logging In</span></h1>
              <p className="text-base text-muted-foreground">
                Tell your agents what you need. They build the funnels, automations and snapshots, handle support and deliver agency work inside your GoHighLevel account, QA it, and hand it back to you. 24/7.
              </p>
              <p className="text-base font-semibold">★ Trusted by 1,200+ agencies · Free with Your GoHighLevel Account</p>
          </div>
            <section ref={formRef} id="agents-form" className="glass-card mx-auto mt-8 max-w-xl rounded-2xl p-5 text-left shadow-sm">
              {draft.step === "thanks" ? (
                <Thanks email={draft.email} already={draft.already} hasGhl={draft.hasHighlevel} />
              ) : (
                <>
                  <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-extrabold">Apply for the Agents beta</h2>
                    <p className="text-xs font-semibold text-muted-foreground">Step {stepNo} of {steps.length}</p>
                  </div>
                  <div className="mb-4 flex gap-1" aria-hidden="true">
                    {steps.map((item, index) => (
                      <span key={item} className={`h-1.5 flex-1 rounded-full ${index <= stepIndex ? "bg-[hsl(var(--webinar2-accent))]" : "bg-muted"}`} />
                    ))}
                  </div>
                  {draft.step !== "email" && (
                    <button type="button" className="mb-3 text-sm font-semibold webinar-2-accent" onClick={back}>
                      ← Back
                    </button>
                  )}
                  {draft.step === "email" && (
                    <form className="space-y-3" noValidate onSubmit={submitEmail}>
                      <label className="block text-sm font-semibold" htmlFor="agents-email">What's your best email?</label>
                      <Input
                        ref={emailRef}
                        id="agents-email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        placeholder="you@agency.com"
                        value={draft.email}
                        onChange={(event) => {
                          setDraft({ ...draft, email: event.target.value });
                          setSuggestion(suggestEmail(event.target.value));
                        }}
                        className="h-12"
                      />
                      <p className="text-xs text-muted-foreground">We'll use this if we need to reach you. You'll hear back within 48 hours.</p>
                      {suggestion && (
                        <button
                          type="button"
                          className="text-sm font-semibold webinar-2-accent"
                          onClick={() => {
                            setDraft({ ...draft, email: suggestion });
                            setSuggestion(null);
                            setError("");
                          }}
                        >
                          Did you mean {suggestion}?
                        </button>
                      )}
                      {error && <p role="alert" aria-live="polite" className="text-sm text-destructive">{error}</p>}
                      <Button type="submit" className="webinar-2-cta h-12 w-full rounded-xl text-base font-bold">Next →</Button>
                      <p className="text-center text-xs text-muted-foreground">Takes about 60 seconds. No call needed.</p>
                    </form>
                  )}
                  {draft.step === "has_highlevel" && (
                    <Choice
                      headingRef={headingRef}
                      title="Do you have GoHighLevel?"
                      helper="Either answer is fine. Agents run inside GoHighLevel, so this tells us where to start."
                      options={[{ value: "yes", label: "Yes, I have an account" }, { value: "no", label: "Not yet" }]}
                      onPick={(value) => pickGhl(value === "yes")}
                    />
                  )}
                  {draft.step === "ghl_plan" && (
                    <Choice
                      headingRef={headingRef}
                      title="Which GoHighLevel plan are you on?"
                      helper="Not sure? Pick Other / not sure. It won't count against you."
                      options={PLANS.map((item) => ({ value: item.value, label: item.label }))}
                      onPick={pickPlan}
                    />
                  )}
                  {draft.step === "sub_account_count" && (
                    <Choice
                      headingRef={headingRef}
                      title={draft.hasHighlevel === false ? "How many client accounts do you manage today?" : "How many sub-accounts do you run?"}
                      helper="Rough is fine."
                      options={COUNTS.map((item) => ({ value: item.value, label: item.label }))}
                      onPick={pickCount}
                    />
                  )}
                  {draft.step === "phone" && (
                    <form
                      className="space-y-3"
                      noValidate
                      onSubmit={(event) => {
                        void submitPhone(event);
                      }}
                    >
                      <h3 ref={headingRef} tabIndex={-1} className="text-base font-extrabold outline-none">What's the best number to text you?</h3>
                      <label className="block text-sm font-semibold" htmlFor="agents-country">Country</label>
                      <select
                        id="agents-country"
                        className="h-12 w-full rounded-xl border border-input bg-card px-3 text-base"
                        value={draft.country}
                        onChange={(event) => setDraft({ ...draft, country: event.target.value as CountryCode })}
                      >
                        {COUNTRIES.map((item) => (
                          <option key={item.iso} value={item.iso}>{item.label}</option>
                        ))}
                      </select>
                      <label className="block text-sm font-semibold" htmlFor="agents-phone">Phone</label>
                      <Input
                        id="agents-phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="(555) 555-5555"
                        value={draft.phone}
                        onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
                        onFocus={() => trackCustom("agents_step_phone_view")}
                        className="h-12"
                      />
                      <p className="text-xs text-muted-foreground">For beta updates by text only. We won't cold call you.</p>
                      {error && <p role="alert" aria-live="polite" className="text-sm text-destructive">{error}</p>}
                      <Button type="submit" disabled={busy} className="webinar-2-cta h-12 w-full rounded-xl text-base font-bold">
                        {busy ? "Submitting…" : "Submit My Application →"}
                      </Button>
                      <p className="text-xs text-muted-foreground">{AGENTS_SMS_CONSENT_TEXT}</p>
                    </form>
                  )}
                </>
              )}
            </section>

          <figure className="glass-card mx-auto mt-16 max-w-xl rounded-2xl p-5 text-left shadow-sm">
            <figcaption className="text-xs font-extrabold uppercase tracking-wide webinar-2-accent">Example of the agent workflow</figcaption>
            <p className="mt-2 text-base">Watch an agent build it: prompt → funnel → QA ✓</p>
            <p className="mt-2 text-base text-muted-foreground">Example. This is not a customer result.</p>
          </figure>

          <section className="mx-auto mt-16 max-w-xl space-y-4 text-left">
            <h2 className="text-center text-2xl font-extrabold sm:text-3xl">You already know what HighLevel can do. The clicking is the problem.</h2>
            <ul className="list-disc space-y-2 pl-5 text-base text-muted-foreground">
              <li>Every funnel, workflow and snapshot is dozens of screens, settings and tests.</li>
              <li>Client requests show up at night, on weekends and in the middle of your sales calls.</li>
              <li>So the features you're paying for sit unused, or you're the one stuck building them.</li>
            </ul>
            <p className="text-base">SaaSSuite Agents work inside your GoHighLevel account for you. You say what you need in plain English. They do the clicking.</p>
          </section>

          <section className="mx-auto mt-16 max-w-xl text-left">
            <h2 className="text-center text-2xl font-extrabold sm:text-3xl">One chat. Every part of GHL.</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {TILES.map(([title, copy]) => (
                <article key={title} className="glass-card rounded-2xl p-4 shadow-sm">
                  <h3 className="font-extrabold">{title}</h3>
                  <p className="mt-1 text-base text-muted-foreground">{copy}</p>
                </article>
              ))}
            </div>
            <p className="mt-4 text-base text-muted-foreground">Funnels, automations, snapshots and support first. More every week.</p>
          </section>

          <section className="mx-auto mt-16 max-w-xl text-left">
            <h2 className="text-center text-2xl font-extrabold sm:text-3xl">Don't take our word for it. Watch them work.</h2>
            <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
              {EXAMPLES.map((caption) => (
                <figure key={caption} className="glass-card w-56 shrink-0 rounded-2xl p-4 text-left shadow-sm">
                  <figcaption className="text-xs font-extrabold uppercase webinar-2-accent">Example</figcaption>
                  <p className="mt-2 text-base">{caption}</p>
                  <p className="mt-2 text-xs font-bold">QA ✓</p>
                </figure>
              ))}
            </div>
            <div className="glass-card mt-4 rounded-2xl p-4 shadow-sm">
              <h3 className="font-extrabold">Every job is checked before it comes back to you.</h3>
              <ul className="mt-2 space-y-1 text-base">
                <li>✓ Built: what changed, where</li>
                <li>✓ Tested: links clicked, forms submitted, workflows run on a test contact</li>
                <li>✓ Logged: every action, with a timestamp, for you to review</li>
              </ul>
            </div>
            <p className="mt-4 text-base font-semibold">Built and used inside 7–8 figure agencies.</p>
          </section>

          <section className="mx-auto mt-16 max-w-xl space-y-4 text-left">
            <h2 className="text-center text-2xl font-extrabold sm:text-3xl">How the beta works</h2>
            <ol className="list-decimal space-y-2 pl-5 text-base">
              <li><span className="font-bold">Apply.</span> About 60 seconds, right here.</li>
              <li><span className="font-bold">Andrew reviews it.</span> You'll hear back within 48 hours.</li>
              <li><span className="font-bold">Connect and ask.</span> Once you're in, connect your GoHighLevel account and tell your agents what to build.</li>
              <li><span className="font-bold">Review and approve.</span> You get the finished work, the QA checks and a full activity log.</li>
            </ol>
            <p className="text-base text-muted-foreground">No call. No demo meeting. Apply here and we take it from there.</p>
          </section>

          <section className="mx-auto mt-16 max-w-xl text-left">
            <h2 className="text-center text-2xl font-extrabold sm:text-3xl">Your account. Your rules.</h2>
            <ul className="mt-4 space-y-2 text-base">
              <li>✓ You choose what agents can touch. Start with one sub-account if you want.</li>
              <li>✓ Client requests are off until you turn them on. Flip "Allow agents to work from client requests" and they'll pick up 24/7 support for you.</li>
              <li>✓ Every action is logged. See what changed, when and why.</li>
            </ul>
          </section>

          <section className="mx-auto mt-16 max-w-xl space-y-3 text-left" aria-label="Questions">
            <h2 className="text-center text-2xl font-extrabold sm:text-3xl">Questions</h2>
            {FAQ.map(([question, answer]) => (
              <details key={question} className="glass-card rounded-2xl px-4 py-3 shadow-sm">
                <summary className="cursor-pointer font-bold">{question}</summary>
                <p className="mt-2 text-base text-muted-foreground">{answer}</p>
              </details>
            ))}
          </section>

          <section ref={finalRef} className="glass-card mx-auto mt-16 max-w-xl rounded-2xl p-6 text-center shadow-sm">
            <h2 className="text-2xl font-extrabold sm:text-3xl">Let your agents take it from here.</h2>
            <p className="mt-2 text-base text-muted-foreground">Apply for the beta. It takes about 60 seconds.</p>
            {draft.step !== "thanks" && (
              <Button type="button" className="webinar-2-cta mx-auto mt-4 h-12 w-full max-w-[410px] rounded-xl text-base font-bold" onClick={scrollToForm}>
                Apply for the Agents Beta →
              </Button>
            )}
          </section>
          <p className="mt-8 text-center text-xs text-muted-foreground">
            SaaSSuite Agents is in beta; features may change. Affiliate disclosure: we are a HighLevel affiliate and may earn a commission if you sign up to HighLevel through our link, at no extra cost to you.
          </p>
        </main>
        {showSticky && (
          <div className="fixed inset-x-0 bottom-16 z-40 px-4 md:hidden">
            <Button type="button" className="webinar-2-cta h-12 w-full rounded-xl text-base font-bold" onClick={scrollToForm}>
              Apply for the Agents Beta →
            </Button>
          </div>
        )}
        <Footer minimal />
      </div>
    </>
  );
};

function Choice({
  title,
  helper,
  options,
  onPick,
  headingRef,
}: {
  title: string;
  helper: string;
  options: { value: string; label: string }[];
  onPick: (value: string) => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <div className="space-y-3">
      <h3 ref={headingRef} tabIndex={-1} className="text-base font-extrabold outline-none">{title}</h3>
      <p className="text-sm text-muted-foreground">{helper}</p>
      <div className="grid gap-3">
        {options.map((option) => (
          <Button key={option.value} type="button" variant="outline" className="one-feature-choice h-12 border-2 font-bold" onClick={() => onPick(option.value)}>
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function Thanks({ email, already, hasGhl }: { email: string; already: boolean; hasGhl: boolean | null }) {
  const trial = trainingGhlHref(typeof window === "undefined" ? "" : window.location.search);
  return (
    <div className="space-y-3">
      <p className="text-2xl webinar-2-accent" aria-hidden="true">✓</p>
      <h2 className="text-2xl font-extrabold">{already ? "You've already applied 👍" : "You're on the list. 🎉"}</h2>
      <p className="text-sm">
        {already
          ? `We have your application for ${email}. You'll hear back within 48 hours of applying.`
          : `Thanks. Your application for ${email} is in. Andrew reviews every application himself, and you'll hear back within 48 hours.`}
      </p>
      {!already && (
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Andrew reviews your application.</li>
          <li>You'll hear back from our team within 48 hours.</li>
          <li>You connect GoHighLevel and give your agents their first job.</li>
        </ol>
      )}
      <p className="text-sm">No call or meeting needed.</p>
      {hasGhl === false && (
        <>
          <p className="text-sm">Agents run inside GoHighLevel. Get your account ready so you're ready to start as soon as you're approved.</p>
          <Button asChild className="webinar-2-cta h-12 w-full rounded-xl text-base font-bold">
            <a href={trial} target="_blank" rel="noopener noreferrer" onClick={() => trackCustom("agents_ghl_click")}>
              Start My Free GoHighLevel Trial →
            </a>
          </Button>
          <p className="text-xs text-muted-foreground">
            Affiliate disclosure: we are a HighLevel affiliate and may earn a commission if you sign up to HighLevel through our link, at no extra cost to you.
          </p>
        </>
      )}
      <FunnelSuccessLinktree />
    </div>
  );
}

export default AgentsApply;
