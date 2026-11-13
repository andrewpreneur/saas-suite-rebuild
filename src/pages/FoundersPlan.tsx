import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Building2,
  Calendar,
  Code,
  CreditCard,
  Crown,
  Flame,
  Handshake,
  Headset,
  Kanban,
  Layers,
  LifeBuoy,
  Mail,
  Map,
  Rocket,
  Sparkles,
  Ticket,
  Video,
} from "lucide-react";
import Footer from "@/components/Footer";
import PageSEO from "@/components/PageSEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { foundersPlanSessionId, saveFunnelStep, visitContext } from "@/lib/funnelApplyClient";
import {
  FOUNDERS_PLAN_SMS_CONSENT_TEXT,
  FOUNDERS_PLAN_TEXT_US_HREF,
  FOUNDERS_PLAN_TEXT_US_LABEL,
  toE164,
} from "@/lib/funnelContracts";
import { trackingPixelsAllowed } from "@/utils/trackingConsent";

/** Meta copied from the public Founder plan page. That page publishes no keywords tag; these phrases are its title and description. */
const PAGE_TITLE = "HighLevel Founder Plan — Build Your Fortune with AI & Automation";
const PAGE_DESCRIPTION =
  "Become a HighLevel Founder. Access exclusive AI models, customizable AI employees, turnkey SaaS mode, unlimited usage rebilling, and industry snapshots.";
const OG_TITLE = "HighLevel Founder Plan — $497/mo Reimagined";
const OG_DESCRIPTION =
  "Everything inside the Founder $497 Plan: Advanced AI models, higher token ceilings, automated sub-accounts, 25 exclusive founder capabilities, and 14-day free trial.";
const PAGE_KEYWORDS =
  "HighLevel Founder Plan, exclusive AI models, customizable AI employees, turnkey SaaS mode, unlimited usage rebilling, industry snapshots";
const OG_IMAGE =
  "https://vibe.filesafe.space/1792527757463438006/attachments/762fad3c-e90d-4091-9d86-f42ce07cf854.png";

const FEATURES: { title: string; body: string; badge?: string; icon: typeof Sparkles }[] = [
  { title: "HighLevel Industries", icon: Building2, body: "Turn on HighLevel Industries for specific sub-accounts to activate niche-specific features like Reservations, Menu Creator, and Order Management for Restaurants; Job Creation, Field Management, and geo-optimized Job Routing for Home Services; and more!" },
  { title: "Custom Navs", icon: Layers, body: "Take control of the main left-hand navigation and create unique experiences for your clients. Re-order items, create groups, set defaults, and more." },
  { title: "Events", icon: Calendar, body: "Create, promote, and manage your events from start to finish. Share event details, sell tickets, collect registrations, check people in by scanning ticket QR Codes with our mobile app, and keep attendees informed so every event runs smoothly." },
  { title: "Workflow Maps", icon: Map, body: "View, manage, and troubleshoot your workflows from a 3D, birds-eye view. Search by users, tags, triggers, and actions, and visually see how workflows interconnect. See it to believe it!" },
  { title: "Project Management", icon: Kanban, body: "Plan, assign, and track work in one place. Organize projects into tasks and boards, set owners and due dates, and keep your team on the same page from kickoff to completion." },
  { title: "SaaS Mode", icon: Layers, body: "Pick which features to include in each plan. When someone signs up, the system automatically creates their account, maps permissions, sends login credentials, and monitors billing — all on autopilot." },
  { title: "User Reports", icon: BarChart3, body: "See how each team member is performing, from calls and messages to appointments and deals closed, all in one dashboard." },
  { title: "Rebilling With Markup", icon: BarChart3, body: "Don't just pass usage costs on to your clients, mark them up to generate profits when your customers send emails, validate emails, make phone calls, send text messages, use AI, and more!" },
  { title: "Advanced API access", icon: Code, body: "Connect your CRM to any tool you use with full API access, so you can build custom integrations and automate your own way." },
  { title: "Ticketing", icon: LifeBuoy, body: "Manage customer support requests in one place. Each message becomes a ticket you can assign, prioritize, and track from open to resolved, so nothing slips through the cracks and customers get faster answers." },
  { title: "Meeting Rooms", icon: Video, body: "Host video meetings right from your CRM. Create shareable rooms for client calls, demos, and team check-ins, with no extra software to buy or manage." },
  { title: "Loyalty & Rewards", icon: Sparkles, body: "Build custom loyalty programs to drive repeat business and keep customers coming back for more. Works with online products and in-store checkins as well." },
  { title: "A2P Console", icon: LifeBuoy, body: "Monitor and manage A2P campaign completion for all your clients in one centralized location, ensuring your clients get up and running with compliant SMS marketing as quickly as possible." },
  { title: "Custom Onboarding", icon: Rocket, badge: "Coming Soon", body: "Build custom Launchpads to onboard new clients into their sub-accounts and guide them through the tasks and features you want in the order you want them." },
  { title: "Email Health Console", icon: Mail, badge: "Coming Soon", body: "Monitor the overall health of your clients' email campaigns from one centralized hub. Keep track of deliverability, bounces, spam complaints, and sender reputation in one place, so you can catch problems early and keep your messages landing in the inbox." },
];

const PERKS: { title: string; body: string; icon: typeof Sparkles }[] = [
  { title: "Payment Commissions", icon: CreditCard, body: "Founders will be eligible to receive commissions from payments made using the new native payment provider." },
  { title: "AdFuel Program", icon: Flame, body: "HighLevel Founders will be eligible to receive free ads promoting the Founder's business in their local market." },
  { title: "Headquarter Hangouts", icon: Building2, body: "Join us at our Dallas and Dubai headquarters for exclusive Founder meetups, trainings, hackathons and more!" },
  { title: "HighLevel Partner Network", icon: Handshake, body: "As a Founder, you'll have the opportunity to join the HighLevel Partner Network and generate revenue by supporting other HighLevelers." },
  { title: "Discounted Event Tickets", icon: Ticket, body: "Founders will have access to special rates for future HighLevel events, including our annual LevelUp Summit in Dallas." },
  { title: "The Founders Club", icon: Crown, body: "Every Founder has access to The Founders Club, an exclusive online community where we host weekly live streams, masterminds, challenges, contests, and more!" },
  { title: "Founder Support Plan", icon: Headset, body: "A new tier of dedicated support exclusive to Founders, dedicated to Founder success." },
];

const FAQS = [
  { q: "Who is the HighLevel Founder Plan designed for?", a: "The Founder Plan is built for agencies, entrepreneurs and business owners ready to take their businesses further. Whether you're growing an agency, expanding your services or building a SaaS business, the Founder Plan gives you more tools, flexibility and opportunities to build, run and grow your business." },
  { q: "Will existing $497 Agency Pro customers automatically transition to the Founder Plan?", a: "Yes! If you're already on the $497 Agency Pro plan, you'll automatically transition to the new Founder Plan. You'll keep the features you already love while gaining access to even more tools and opportunities as they become available." },
  { q: "Do I need the Founder Plan to access HighLevel's new industry-specific solutions?", a: "Yes. HighLevel's new industry-specific solutions are exclusive to the Founder Plan, giving you access to specialized tools designed to help you better serve businesses in industries like home services, restaurants and business coaching." },
  { q: "Can I use the Founder Plan to create new revenue streams?", a: "Absolutely! The Founder Plan gives you more ways to turn your expertise into revenue. With unlimited rebilling and reselling markup, white-labeling and industry-specific solutions, you can expand your services, create new offerings and build a business that grows with you." },
  { q: "Are all Founder Plan features available immediately?", a: "Some features are available now, with even more on the way! We're continuing to roll out new tools and capabilities to help you expand your services, create new revenue opportunities and grow your business." },
];

const PRICE_LINES = [
  "Everything in Unlimited Plan and...",
  "Exclusive FOUNDER feature set",
  "Rebilling with markup",
  "Founders Club Access",
  "HL Partner Network Access",
  "The Most Free AI",
];

type Phase = "optin" | "done";

function readDone(): { name: string; email: string } | null {
  try {
    const raw = localStorage.getItem("founders_plan_draft");
    const session = localStorage.getItem("founders_plan_session");
    if (!raw || !session) return null;
    const parsed = JSON.parse(raw) as { session?: string; name?: string; email?: string; step?: string };
    if (parsed.session !== session || parsed.step !== "done") return null;
    if (typeof parsed.name !== "string" || typeof parsed.email !== "string") return null;
    return { name: parsed.name, email: parsed.email };
  } catch {
    return null;
  }
}

function cookie(name: string) {
  try {
    return document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))?.[1] ?? "";
  } catch {
    return "";
  }
}

function leadMeta(sessionId: string) {
  let fbclid = "";
  try {
    fbclid = new URLSearchParams(window.location.search).get("fbclid") || "";
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
      fbq("track", "Lead", { content_name: "founders_plan_optin" }, { eventID: eventId });
    }
  } catch {
    /* ignore */
  }
}

function TextUsCta({ className }: { className: string }) {
  return (
    <a href={FOUNDERS_PLAN_TEXT_US_HREF} className={className}>
      {FOUNDERS_PLAN_TEXT_US_LABEL}
    </a>
  );
}

const FoundersPlan = () => {
  const sessionId = useRef(foundersPlanSessionId());
  const submitting = useRef(false);
  const [restored] = useState(readDone);
  const [name, setName] = useState(restored?.name || "");
  const [email, setEmail] = useState(restored?.email || "");
  const [phone, setPhone] = useState("");
  const [phase, setPhase] = useState<Phase>(restored ? "done" : "optin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const firstName = name.trim() || "there";

  useEffect(() => {
    try {
      localStorage.setItem("founders_plan_draft", JSON.stringify({
        session: sessionId.current,
        name,
        email,
        step: phase,
      }));
    } catch {
      /* ignore */
    }
  }, [name, email, phase]);

  const metaContext = () => {
    const visit = visitContext();
    const meta = leadMeta(sessionId.current);
    const now = new Date().toISOString();
    return {
      visit,
      meta,
      answersMeta: {
        utm_source: visit.utm.utm_source || "",
        utm_medium: visit.utm.utm_medium || "",
        utm_campaign: visit.utm.utm_campaign || "",
        utm_content: visit.utm.utm_content || "",
        utm_term: visit.utm.utm_term || "",
        fbclid: meta.fbclid || visit.utm.fbclid || "",
        fbp: meta.fbp,
        fbc: meta.fbc,
        landing_url: visit.landing_url,
        referrer: document.referrer.slice(0, 500),
        user_agent: navigator.userAgent.slice(0, 400),
        first_seen_at: now,
      },
    };
  };

  const save = (body: Record<string, unknown>) => {
    const { visit, meta, answersMeta } = metaContext();
    const incoming = (body.answers && typeof body.answers === "object" ? body.answers : {}) as Record<string, unknown>;
    return saveFunnelStep({
      funnel: "founders_plan",
      session_key: sessionId.current,
      session_id: sessionId.current,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      landing_url: visit.landing_url,
      utm: visit.utm,
      meta,
      ...body,
      answers: {
        page: "founders-plan",
        name: name.trim(),
        email: email.trim().toLowerCase(),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        _meta: answersMeta,
        ...incoming,
      },
    });
  };

  const rememberDone = (cleanName: string, cleanEmail: string) => {
    setName(cleanName);
    setEmail(cleanEmail);
    setPhase("done");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();
    if (cleanName.length < 1 || cleanName.length > 60) {
      setError("Enter your first name");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Enter a valid email");
      return;
    }
    if (!toE164(cleanPhone)) {
      setError("Enter a valid phone");
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError("");
    const timeout = new Promise<{ ok: false; error: string }>((resolve) => {
      window.setTimeout(() => resolve({ ok: false, error: "timeout" }), 10000);
    });
    const run = async () => {
      const optin = await save({
        step: "optin",
        name: cleanName,
        email: cleanEmail,
        answers: { name: cleanName, email: cleanEmail, phone: cleanPhone },
      });
      if (!optin.ok) return optin;
      if (optin.already_claimed) return optin;
      if (optin.created === true && optin.event_id) fireLead(optin.event_id);
      return save({
        step: "done",
        final: true,
        name: cleanName,
        email: cleanEmail,
        answers: { name: cleanName, email: cleanEmail, phone: cleanPhone },
      });
    };
    const result = await Promise.race([run(), timeout]);
    submitting.current = false;
    setBusy(false);
    if (!result.ok) {
      setError("That didn't go through. Check your connection and tap the button again.");
      return;
    }
    if (result.first_name) setName((current) => current.trim() || result.first_name || current);
    rememberDone(result.first_name || cleanName, cleanEmail);
  };

  return (
    <>
      <PageSEO
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        ogTitle={OG_TITLE}
        ogDescription={OG_DESCRIPTION}
        keywords={PAGE_KEYWORDS}
        image={OG_IMAGE}
        path="/founders-plan"
        noindex
      />
      <div className="min-h-screen bg-white text-slate-900">
        <section className="relative bg-[#06101f] text-white">
          <img
            src="/founders-plan/levelup-founder-hero.jpg"
            alt="Welcome to the Founder plan on the LevelUp stage"
            width={1600}
            height={2134}
            fetchPriority="high"
            decoding="async"
            className="h-[72vh] min-h-[520px] w-full object-cover object-[center_18%]"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-black/10 to-[#06101f]" />
          <img src="/assets/saassuite-logo.png" alt="SaaSSuite" width={40} height={40} className="absolute left-4 top-4 z-10 h-10 w-10 object-contain" />
          <div className="relative z-10 mx-auto -mt-28 max-w-3xl px-4 pb-16 text-center sm:-mt-36">
            <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-sky-400/40 bg-sky-950/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-sky-100 sm:text-sm">
              <Sparkles className="h-3.5 w-3.5 text-sky-300" aria-hidden="true" />
              Formerly the Agency Pro Plan - Now Supercharged
            </p>
            <h1 className="mt-6 text-[32px] font-extrabold leading-[1.15] tracking-tight sm:text-5xl">
              <span className="block">Ready to be a <span className="bg-gradient-to-r from-sky-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">FOUNDER</span></span>
              <span className="mt-1 block">in the biggest wave of opportunity the world has ever seen?</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base text-slate-200 sm:text-lg">
              Become a HighLevel Founder and build your fortune helping businesses implement automated solutions and scale with AI.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center">
              <TextUsCta className="inline-flex h-[52px] w-full items-center justify-center rounded-xl bg-blue-600 px-8 text-base font-semibold text-white shadow-lg shadow-blue-600/40 sm:w-auto" />
            </div>
          </div>
        </section>

        <section className="bg-gradient-to-b from-sky-50 to-white px-4 py-16">
          <article className="mx-auto max-w-md rounded-3xl bg-gradient-to-b from-blue-500 to-blue-700 p-6 text-center text-white shadow-xl">
            <p className="mx-auto inline-flex rounded-full bg-white/20 px-4 py-1 text-sm font-bold tracking-wide">🔥 FOUNDER 🔥</p>
            <p className="mt-4 text-5xl font-extrabold">$497<span className="text-lg font-semibold">/Month</span></p>
            <p className="mt-3 text-sm text-blue-50">Perfect for founders, agencies, consultants, and service providers looking to scale</p>
            <ul className="mt-6 divide-y divide-white/20 text-sm">
              {PRICE_LINES.map((line) => <li key={line} className="py-3">{line}</li>)}
            </ul>
            <TextUsCta className="mt-4 inline-flex h-[52px] w-full items-center justify-center rounded-xl bg-white text-base font-bold text-blue-700" />
          </article>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-16 text-center">
          <p className="mx-auto inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-blue-700">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Turn What's Possible into What's Profitable
          </p>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-5xl">What's all included in the Founder Plan?</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
            So much more than just a set of exclusive features (although it has that too!), the Founder plan provides all the tech, the training, and the community scale your business.
          </p>
          <div className="mt-8 rounded-2xl border border-slate-200 p-5 text-left shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xl font-extrabold">Exclusive features only available in the Founder plan</h3>
                <p className="mt-1 text-sm text-slate-500">Everything unlocked. $497/month.</p>
              </div>
              <TextUsCta className="inline-flex h-11 items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white" />
            </div>
            <div className="mt-6 space-y-4">
              {FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article key={feature.title} className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div>
                        <h4 className="flex flex-wrap items-center gap-2 text-lg font-bold">
                          {feature.title}
                          {feature.badge && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{feature.badge}</span>}
                        </h4>
                        <p className="mt-1 text-sm leading-relaxed text-slate-600">{feature.body}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-slate-50 px-4 py-16">
          <div className="mx-auto max-w-3xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-extrabold sm:text-3xl">Exclusive perks only available on the Founder Plan</h2>
                <p className="mt-1 text-sm text-slate-500">Additional benefits to becoming a Founder.</p>
              </div>
              <TextUsCta className="inline-flex h-11 items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white" />
            </div>
            <div className="mt-6 space-y-4">
              {PERKS.map((perk) => {
                const Icon = perk.icon;
                return (
                  <article key={perk.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div>
                        <h3 className="text-lg font-bold">{perk.title}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-slate-600">{perk.body}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-gradient-to-b from-sky-400 to-blue-700 px-4 py-16 text-white">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mx-auto inline-flex items-center gap-2 rounded-full bg-sky-950/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Frequently Asked Questions
            </p>
            <h2 className="mt-4 text-3xl font-extrabold sm:text-5xl">Everything you need to know about the Founder Plan</h2>
            <p className="mt-3 text-base text-sky-50">Have questions before jumping in? Check out the FAQs below!</p>
            <div className="mt-8 divide-y divide-white/10 overflow-hidden rounded-2xl border border-sky-300/30 bg-[#09172e] text-left shadow-2xl">
              {FAQS.map((item, index) => {
                const open = openFaq === index;
                return (
                  <div key={item.q} className="px-5 sm:px-7">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between py-5 text-left text-base font-bold sm:text-lg"
                      aria-expanded={open}
                      onClick={() => setOpenFaq(open ? null : index)}
                    >
                      {item.q}
                      <span className={`ml-4 text-slate-400 ${open ? "rotate-180" : ""}`} aria-hidden="true">⌄</span>
                    </button>
                    {open && <p className="pb-5 text-sm leading-relaxed text-slate-300">{item.a}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-xl px-4 py-16" id="bonuses">
          <h2 className="text-center text-2xl font-extrabold">Tell me where to send the bonuses.</h2>
          {phase === "optin" ? (
            <form className="mt-6 space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm" noValidate onSubmit={(event) => { void submit(event); }}>
              <label className="block text-sm font-semibold" htmlFor="fp-name">First name
                <Input id="fp-name" autoComplete="given-name" placeholder="Jordan" value={name} maxLength={60} onChange={(event) => setName(event.target.value)} className="mt-1 h-11 bg-card text-base" />
              </label>
              <label className="block text-sm font-semibold" htmlFor="fp-email">Email
                <Input id="fp-email" type="email" inputMode="email" autoComplete="email" placeholder="you@agency.com" value={email} maxLength={255} onChange={(event) => setEmail(event.target.value)} className="mt-1 h-11 bg-card text-base" />
              </label>
              <label className="block text-sm font-semibold" htmlFor="fp-phone">Phone
                <Input id="fp-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(337) 555-0100" value={phone} maxLength={30} onChange={(event) => setPhone(event.target.value)} className="mt-1 h-11 bg-card text-base" />
              </label>
              <p className="text-xs text-muted-foreground">{FOUNDERS_PLAN_SMS_CONSENT_TEXT}</p>
              {error && <p role="alert" aria-live="polite" className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={busy} className="h-[52px] w-full rounded-xl bg-blue-600 text-base font-bold text-white hover:bg-blue-500">{busy ? "Saving…" : "Send My Bonuses →"}</Button>
              <p className="text-center text-xs text-muted-foreground">Takes 20 seconds. No card.</p>
            </form>
          ) : (
            <div className="mt-6 space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm">
              <h3 className="text-center text-2xl font-extrabold">You're in, {firstName}.</h3>
              <p className="text-center text-base">Bonuses are on the way.</p>
              <TextUsCta className="inline-flex h-[52px] w-full items-center justify-center rounded-xl bg-blue-600 text-base font-bold text-white" />
            </div>
          )}
        </section>

        <Footer minimal />
        <p className="mx-auto max-w-4xl px-6 pb-8 text-center text-xs text-muted-foreground">
          Affiliate disclosure: we are a HighLevel affiliate and may earn a commission if you sign up to HighLevel through our link, at no extra cost to you.
        </p>
      </div>
    </>
  );
};

export default FoundersPlan;
