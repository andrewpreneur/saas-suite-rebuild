import { useState, useEffect, useMemo } from "react";
import StripeEmbeddedCheckout from "@/components/StripeEmbeddedCheckout";
import { useMetaPixel } from "@/hooks/useMetaPixel";
import { Button } from "@/components/ui/button";
import { Menu, X, Check, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { REG_EMAIL_KEY, REG_CONTACT_KEY } from "@/utils/webinarRegistrationCapture";
import { isTestTraffic } from "@/utils/testTraffic";
import { hasOptedOutOfTracking, trackingPixelsAllowed } from "@/utils/trackingConsent";
import { useWebinarMetaGuard } from "@/hooks/useWebinarMetaGuard";
import { useLockInSteps, LockInProgressBar, LockInSteps } from "@/components/webinar/WebinarLockInSteps";
import PlanFeatureLabel from "@/components/pricing/PlanFeatureLabel";
import { SAME_DAY_WL_SUPPORT } from "@/constants/pricingPlans";

// ===================== SETTINGS (edit these) =====================
/** Advanced plan's normal monthly price (shown struck through). */
const ADVANCED_MONTHLY_PRICE = "$97";
// ================================================================

const PROOF = [
  {
    name: "Mark",
    quote: "I closed $25,000 in new clients in two weeks. He knows how to make deals people can't refuse, and has brought me numerous paying clients and saved multiple deals. Thanks a lot Andrew!",
  },
  {
    name: "Umar",
    quote: "My clients get answers in under a minute - nights, weekends, whenever. I used to BE the support desk. Now I just watch the tickets close themselves.",
  },
];

const WEBINARKIT_CONFIRMATION_WIDGET = `
              <style>@media (max-width: 1e+09px) {  #wk_element_5593219dd237183413d27d0e5acd74ac { width: 540px; max-width: 100%; min-height: 16px; padding: 0px; margin: 0px auto; border-style: none; background: rgba(0, 0, 0, 0); }  #wk_element_5593219dd237183413d27d0e5acd74ac_calendar { background: rgb(51, 94, 234); }  #wk_element_45f8e93c3ca45229d03dbfdfd50fb418 { width: 540px; max-width: 100%; min-height: 16px; padding: 0px 16px 16px; margin: 0px auto; border-style: none; background: rgba(0, 0, 0, 0); }  #wk_element_d1217a9bd4050e903e6ed0eb69757d18 { width: 100%; max-width: 100%; min-height: 0px; padding: 0px; margin: 0px; border-style: none; background: rgba(0, 0, 0, 0); font-family: HKGroteskPro, serif; font-size: 16px; line-height: 1.35; letter-spacing: 0px; }  #wk_element_d1217a9bd4050e903e6ed0eb69757d18 :not(:last-child) { margin-bottom: 0px; }  #wk_element_3faa4a3b321e808bea1bb2a1728b1a2b { width: 540px; max-width: 100%; min-height: 16px; padding: 0px; margin: 0px auto 16px; border-style: none; background: rgba(0, 0, 0, 0); }  #wk_element_ef686ab4d9d28244630f2a52414694f4 { max-width: 540px; min-height: 16px; padding: 16px; margin: 0px auto; border-style: solid; border-color: rgb(255, 255, 255); border-width: 0px; border-radius: 16px; background: rgb(255, 255, 255); }  #wk_element_c6dd61bac74fea356fdc37879dfce67d { width: 100%; max-width: 100%; min-height: 0px; padding: 0px; margin: 0px; border-style: none; background: rgba(0, 0, 0, 0); font-family: HKGroteskPro, serif; font-size: 16px; line-height: 1.5; letter-spacing: 0px; display: flex; }  #wk_element_c6dd61bac74fea356fdc37879dfce67d :not(:last-child) { margin-bottom: 0px; }  #wk_element_e8f171a2c4dca2835f2cf81ff6b3ccba { width: 540px; max-width: 100%; min-height: 16px; padding: 0px; margin: 0px auto; border-style: none; background: rgba(0, 0, 0, 0); }  #wk_element_3faa4a3b321e808bea1bb2a1728b1a2b_calendar { background: rgb(51, 94, 234); }}@media (max-width: 992px) {}@media (max-width: 768px) {}</style><div class="wk_root" style="width: 100%; z-index: 100000;"><div class="wk_ascend_tree wk_editor_hide_tooltips col-12 col-md my-auto shadow wk_column" id="wk_element_ef686ab4d9d28244630f2a52414694f4" data-custom-css-classes="shadow" data-wk-background-type="solid" data-wk-border-style="solid" data-wk-border-style-desktop="solid" data-wk-background-type-desktop="solid"> <div class="wk_editor_hide_tooltips wk_thank_you_timer" calendar="hide" data-classes="wk_thank_you_timer" data-wk-date-format-type="en-US" data-wk-days-label="days" data-wk-entering-label="Entering event watch room..." data-wk-expired-label="Sorry, this event session has ended!" data-wk-hours-label="hours" data-wk-minutes-label="minutes" data-wk-seconds-label="seconds" data-wk-starts-in-label="Webinar starts in:" data-wk-webinar-id="691759ac6ac8859d0246b656" id="wk_element_3faa4a3b321e808bea1bb2a1728b1a2b" timer_size="small" data-wk-border-style-desktop="default" data-wk-background-type-desktop="default"> <div class="wk_row_internal mx-0"> <div class="wk_timer px-0 col"> <div class="rounded-2 mx-auto shadow wk_calendar" style="max-width:170px; background: #fff; display: none"> <div class="wk_calendar_color" style="border-top-left-radius: .375rem; border-top-right-radius: .375rem" id="wk_element_3faa4a3b321e808bea1bb2a1728b1a2b_calendar"> <h5 class="text-center fw-bold py-2 text-uppercase text-white wk_calendar_month">November</h5> </div> <h1 class="text-center fw-bold mb-2 pb-2 wk_calendar_day">21</h1> </div> <h5 class="text-center mb-4 mt-5 wk_calendar_header" style="display:none"><i class="fa-clock fa-regular"></i><span class="wk_calendar_time"> 10:36 AM CST</span></h5> <h6 class="text-center fw-bold wk_timer_header">Webinar starts in:</h6> <div class="wk_row_internal mx-auto wk_timer_row"> <div class="px-0 col-3"> <h5 class="text-center mb-0 wk_timer_days">0</h5> <h6 class="text-center mb-0 wk_timer_days_label">days</h6> </div> <div class="px-0 col-3"> <h5 class="text-center mb-0 wk_timer_hours">0</h5> <h6 class="text-center mb-0 wk_timer_hours_label">hours</h6> </div> <div class="px-0 col-3"> <h5 class="text-center mb-0 wk_timer_minutes">0</h5> <h6 class="text-center mb-0 wk_timer_minutes_label">minutes</h6> </div> <div class="px-0 col-3"> <h5 class="text-center mb-0 wk_timer_seconds">0</h5> <h6 class="text-center mb-0 wk_timer_seconds_label">seconds</h6> </div> </div> </div> </div> </div> <div class="wk_thank_you_session_link" id="wk_element_e8f171a2c4dca2835f2cf81ff6b3ccba" data-classes="wk_thank_you_session_link" data-wk-webinar-id="691759ac6ac8859d0246b656" data-wk-background-type-desktop="default" data-wk-border-style-desktop="default"> <div class="wk_ascend_tree wk_row_internal mx-0"> <div class="text-center col mx-auto px-0 wk_ascend_tree"> <div class="wk_ascend_tree wk_editor_hide_tooltips wk_text" id="wk_element_c6dd61bac74fea356fdc37879dfce67d" data-wk-background-type-desktop="default" data-wk-border-style-desktop="default"> <div contenteditable="false" style="width: 100%; margin-top: auto; margin-bottom: auto;"> <h6><b>Your webinar session link:</b></h6> </div> </div> <div class="input-group input-group-lg mt-1"><input class="form-control wk_webinar_session_link" style="background-color: #f1f4f8; border-color: #f1f4f8;" readonly=""><button class="btn wk_copy_link_button" data-bs-container="body" data-bs-content="Link copied to clipboard!" data-bs-original-title="" data-bs-placement="top" data-bs-toggle="popover" style="color: inherit; background-color: rgba(80,102,144,.1)" type="button"><i class="fa-copy far" style="width: 19.125px"></i></button></div> </div> </div> </div> </div> </div>
              <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/intl-tel-input@19.5.6/build/css/intlTelInput.css"><link rel="stylesheet" href="https://viralmeetings.com/css/ewk_v5.css?cache=5"><script src="https://cdn.jsdelivr.net/npm/intl-tel-input@19.5.6/build/js/intlTelInput.min.js"></script><script src="https://cdn.jsdelivr.net/npm/luxon@3.4.4/build/global/luxon.min.js"></script><script src="https://viralmeetings.com/js/ewk_v7.js?v=6"></script>
            `;


const WebinarConfirmation = () => {
  useWebinarMetaGuard();
  useMetaPixel();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Uses the app's own checkout so access is granted automatically.
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const { session } = useUser();

  // Lead: fires ONLY for a genuine, freshly saved registration.
  // The event id comes from the registration row (reg_<id>) and the server
  // records the claim, so a refresh or bookmark can never fire it twice.
  useEffect(() => {
    if (hasOptedOutOfTracking()) return;
    // WebinarKit sends the registrant's email on the redirect URL, which is the
    // most reliable source (survives a different origin or cleared storage).
    // localStorage is the fallback for when it is not on the URL.
    let email: string | null = null;
    try {
      // Decoded by hand: URLSearchParams turns "+" into a space, which would
      // corrupt plus-addressed emails like name+tag@example.com.
      const raw = window.location.search
        .replace(/^\?/, "")
        .split("&")
        .find((pair) => pair.startsWith("email="))
        ?.slice("email=".length);
      const fromUrl = raw ? decodeURIComponent(raw) : "";
      email = (fromUrl || localStorage.getItem(REG_EMAIL_KEY) || "").trim().toLowerCase() || null;
    } catch {
      email = null;
    }
    if (!email) return;

    let cancelled = false;
    (async () => {
      // The capture request and WebinarKit redirect happen concurrently. On a
      // fast redirect the confirmation page can arrive before the row exists,
      // so retry briefly instead of permanently losing the browser Lead.
      for (let attempt = 0; attempt < 8 && !cancelled; attempt += 1) {
        try {
          const res = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webinar-register-capture`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
              body: JSON.stringify({ action: "claim", email, is_test: isTestTraffic() }),
            },
          );
          const out = await res.json();
          if (cancelled) return;
          if (out?.reason === "no_registration") {
            await new Promise((resolve) => window.setTimeout(resolve, 500));
            continue;
          }
          try {
            localStorage.removeItem(REG_EMAIL_KEY);
          } catch {
            /* ignore */
          }
          if (!out?.event_id) {
            console.log("[meta] Lead claim", out?.reason ?? "no_event_id");
            return;
          }
          if (!trackingPixelsAllowed()) return;
          const fbq = (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq;
          if (typeof fbq !== "function") {
            console.warn("[meta] fbq unavailable, no browser Lead sent");
            return;
          }
          fbq(
            "trackSingle",
            "745177780828109",
            "Lead",
            {
              content_name: "SaaSSuite Webinar Registration",
              content_category: "webinar",
            },
            { eventID: out.event_id },
          );
          console.log("[meta] Lead sent", out.event_id);
          return;
        } catch (e) {
          if (attempt === 7) console.warn("Lead pixel claim failed", e);
          else await new Promise((resolve) => window.setTimeout(resolve, 500));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);


  useEffect(() => {
    // Load vendor CSS
    const loadCSS = (href: string, id: string) => {
      if (!document.getElementById(id)) {
        const link = document.createElement('link');
        link.id = id;
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
        console.log(`Loaded CSS: ${id}`);
      }
    };

    // Load vendor JS
    const loadJS = (src: string, id: string, reload = false): Promise<void> => {
      return new Promise((resolve, reject) => {
        const existing = document.getElementById(id);
        if (existing && reload) existing.remove();
        else if (existing) {
          console.log(`Script already loaded: ${id}`);
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.id = id;
        script.src = src;
        script.onload = () => {
          console.log(`Loaded script: ${id}`);
          resolve();
        };
        script.onerror = () => {
          console.error(`Failed to load script: ${id}`);
          reject();
        };
        document.body.appendChild(script);
      });
    };

    // Load all vendor assets
    const loadVendorAssets = async () => {
      try {
        // Load CSS first
        loadCSS('https://cdn.jsdelivr.net/npm/intl-tel-input@19.5.6/build/css/intlTelInput.css', 'intl-tel-input-css');
        loadCSS('https://viralmeetings.com/css/ewk_v5.css?cache=5', 'ewk-css');

        // Load JS in sequence
        await loadJS('https://cdn.jsdelivr.net/npm/intl-tel-input@19.5.6/build/js/intlTelInput.min.js', 'intl-tel-input-js');
        await loadJS('https://cdn.jsdelivr.net/npm/luxon@3.4.4/build/global/luxon.min.js', 'luxon-js');
        // WebinarKit snapshots window.location.href when this script executes.
        // It was previously reused from /webinar during SPA navigation, so the
        // first confirmation render had no t/r values and stayed at 00:00 with
        // an empty link. Reload it here so it captures the confirmation URL.
        await loadJS(`https://viralmeetings.com/js/ewk_v7.js?v=7&confirmation=${Date.now()}`, 'ewk-js', true);
        await loadJS('https://viralmeetings.com/js/ewk_i.js?v=1', 'ewk-i-js');

        // The vendor only runs its setup once, at script load. When the script
        // was already on the page (client-side navigation, remount, cached
        // script tag) the countdown and session link stay empty unless we ask
        // it to wire the widget up again — so always (re)run it, with a couple
        // of retries in case the widget markup lands a tick later.
        const wire = () => {
          const fn = (window as unknown as { set_wk_elements?: () => void }).set_wk_elements;
          if (typeof fn === 'function') {
            fn();
            return true;
          }
          return false;
        };
        if (!wire()) {
          let tries = 0;
          const id = window.setInterval(() => {
            tries += 1;
            if (wire() || tries > 10) window.clearInterval(id);
          }, 400);
        } else {
          // Re-run shortly after: the widget's DOM is injected by React and the
          // first pass can land before the browser has painted it.
          window.setTimeout(wire, 800);
        }
      } catch (error) {
        console.error('Error loading vendor assets:', error);
      }
    };

    loadVendorAssets();
  }, []);


  // ---------- Registrant info ----------
  const { firstName, email } = useMemo(() => {
    let fn = "";
    let em = "";
    try {
      const p = new URLSearchParams(window.location.search);
      fn = (p.get("first_name") || "").trim();
      const raw = window.location.search.replace(/^\?/, "").split("&").find((x) => x.startsWith("email="))?.slice(6);
      em = raw ? decodeURIComponent(raw) : "";
      const saved = JSON.parse(localStorage.getItem(REG_CONTACT_KEY) || "{}");
      if (!fn && saved.first_name) fn = String(saved.first_name).trim();
      if (!em && saved.email) em = String(saved.email);
    } catch {
      /* ignore */
    }
    return { firstName: fn || "friend", email: em.trim().toLowerCase() };
  }, []);

  // ---------- Join link (read from the visible WebinarKit confirmation widget) ----------
  const [wkLink, setWkLink] = useState("");
  useEffect(() => {
    const id = window.setInterval(() => {
      const v = document.querySelector<HTMLInputElement>(".wk_webinar_session_link")?.value?.trim();
      if (v && /^https?:\/\//.test(v) && !v.startsWith(window.location.origin)) {
        setWkLink(v);
        window.clearInterval(id);
      }
    }, 500);
    const stop = window.setTimeout(() => window.clearInterval(id), 20000);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(stop);
    };
  }, []);
  const joinLink = wkLink;
  // Stop showing "Loading…" forever if WebinarKit never fills the link.
  const [linkTimedOut, setLinkTimedOut] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setLinkTimedOut(true), 8000);
    return () => window.clearTimeout(t);
  }, []);
  const lockIn = useLockInSteps(email, firstName);

  // ---------- In-app browser ----------
  const inAppBrowser = useMemo(() => /FBAN|FBAV|Instagram/i.test(navigator.userAgent || ""), []);
  const scrollToId = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const primaryBtn =
    "flex min-h-[52px] w-full items-center justify-center rounded-xl bg-[hsl(var(--webinar2-accent))] px-4 text-base font-bold text-[hsl(var(--webinar2-accent-foreground))] hover:opacity-90";
  const outlineBtn =
    "flex min-h-[52px] items-center justify-center rounded-xl border-2 border-[hsl(var(--webinar2-accent))] bg-card px-3 text-base font-semibold text-[hsl(var(--webinar2-accent))]";

  return (
    <>
      <SEO 
        title="SaaSSuite Webinar Registration"
        description="Learn how to onboard, educate, and retain customers in this live webinar training."
        image="/assets/webinar-social.png"
      />
      <div className="min-h-screen bg-muted/40">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <img src="/assets/saassuite-logo.png" alt="SaaSSuite Logo" className="h-8 w-auto" />
              <span className="text-xl font-bold text-foreground">
                SaaSSuite
              </span>
            </Link>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              <Link to="/login">
                <Button variant="ghost">Login</Button>
              </Link>
              {!session && (
                <Link to="/signup">
                  <Button className="bg-gradient-to-r from-primary to-primary-glow hover:opacity-90">
                    Get Started
                  </Button>
                </Link>
              )}
            </nav>

            {/* Mobile Menu Button */}
            <button className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <nav className="md:hidden mt-4 flex flex-col gap-4 pb-4">
              <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full">Login</Button>
              </Link>
              {!session && (
                <Link to="/signup" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full bg-gradient-to-r from-primary to-primary-glow hover:opacity-90">
                    Get Started
                  </Button>
                </Link>
              )}
            </nav>
          )}
        </div>
      </header>

      {/* SECTION 1 – Progress bar */}
      <LockInProgressBar done={lockIn.done} />

      <main className="mx-auto max-w-xl space-y-4 px-4 py-6 pb-32 text-base">
        {/* SECTION 2 – Confirmation */}
        <section id="confirm" className="rounded-2xl border border-border bg-card p-5 text-center">
          <h1 className="text-3xl font-extrabold text-foreground">You're in, {firstName}! 🎉</h1>
          <p className="mt-3 text-base text-muted-foreground">
            Your registered session details and personal join link are below.
          </p>
          <div
            className="mt-5 overflow-hidden rounded-xl text-left"
            dangerouslySetInnerHTML={{ __html: WEBINARKIT_CONFIRMATION_WIDGET }}
          />

          {inAppBrowser && (
            <div className="mt-4 rounded-xl border border-[hsl(var(--wc-warning))] bg-[hsl(var(--wc-warning)/0.15)] p-3 text-left text-base text-foreground">
              You're viewing this inside Facebook/Instagram. Tap ••• then 'Open in browser' so your calendar and link save properly.
            </div>
          )}
        </section>

        <LockInSteps done={lockIn.done} complete={lockIn.complete} onStartTrial={() => setCheckoutOpen(true)} />

        {/* SECTION 3 – Stay-to-the-end bonus */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Free bonus for live attendees</p>
          <h2 className="mt-2 text-xl font-bold text-foreground">
            🎁 Stay until the end and get the AI Studio White Label Sales Video
          </h2>
          <p className="mt-2 text-base text-muted-foreground">
            A one-minute graphic video that showcases AI Studio, ready to sell the feature to your clients under your brand. Only given to people who attend the full training.
          </p>
        </section>

        {/* SECTION 4 skipped: the /webinar-2 form already collects a phone number. */}

        {/* SECTION 5 – Registrant-only trial offer */}
        <section id="offer" className="scroll-mt-20 rounded-2xl border-2 border-[hsl(var(--webinar2-accent))] bg-card p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--webinar2-accent))]">Registrants only</p>
          <h2 className="mt-2 text-xl font-bold text-foreground">Follow along live with your own SaaSSuite account</h2>
          <p className="mt-3 flex items-baseline gap-3">
            <span className="text-lg text-muted-foreground line-through">{ADVANCED_MONTHLY_PRICE}/mo</span>
            <span className="text-3xl font-extrabold text-[hsl(var(--wc-success))]">14 days free</span>
          </p>
          <p className="mt-2 text-base text-muted-foreground">
            The full Advanced plan, free for 14 days. Only available from this page.
          </p>
          <ul className="mt-4 space-y-2">
            {[
              "Set up white-label onboarding for your clients before the training",
              "24/7 AI + human support, unlimited users and sub-accounts",
              SAME_DAY_WL_SUPPORT,
              "Build along with me live, in your own account",
            ].map((b) => (
              <li key={b} className="flex items-start gap-2 text-base text-foreground">
                <Check className="mt-1 h-5 w-5 shrink-0 text-[hsl(var(--wc-success))]" />
                <PlanFeatureLabel feature={b} />
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              lockIn.complete("free_trial");
              setCheckoutOpen(true);
            }}
            className={`${primaryBtn} mt-5`}
          >
            Start My 14-Day Free Trial
          </button>
          <p className="mt-3 text-sm text-muted-foreground">
            Cancel anytime before day 14 and you won't be charged. This offer is only available to registered attendees.
          </p>
        </section>

        {/* SECTION 6 – Proof */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-xl font-bold text-foreground">Trusted by 1,200+ HighLevel agencies</h2>
          <div className="mt-4 space-y-4">
            {PROOF.map((p) => (
              <div key={p.name} className="rounded-xl border border-border p-4">
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} className="h-5 w-5 fill-[hsl(var(--wc-star))] text-[hsl(var(--wc-star))]" />
                  ))}
                </div>
                <p className="mt-2 text-base text-foreground">"{p.quote}"</p>
                <p className="mt-2 text-base font-bold text-foreground">{p.name}</p>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 7 – Join link again */}
        <section className="rounded-2xl border border-border bg-card p-5 text-center">
          <h2 className="text-xl font-bold text-foreground">Save your link one more time</h2>
          <p className="mt-2 text-base text-muted-foreground">Keep your personal session link somewhere safe.</p>
          {joinLink ? (
            <a href={joinLink} className={`${primaryBtn} mt-4`}>Join the Webinar</a>
          ) : linkTimedOut ? (
            <p className="mt-4 rounded-xl bg-muted p-3 text-base text-foreground">
              Your personal join link is in the session details above and in your confirmation email.
            </p>
          ) : (
            <button type="button" disabled className={`${primaryBtn} mt-4 opacity-60`}>
              Loading your personal link…
            </button>
          )}
          <button type="button" onClick={() => scrollToId("confirm")} className={`${outlineBtn} mt-3 w-full`}>
            View Session Details
          </button>
        </section>

        
      </main>

      {/* STICKY BOTTOM BAR */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card px-4 pt-3"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-[hsl(var(--wc-danger))]">Not finished yet</div>
            <div className="truncate text-base font-bold text-foreground">{lockIn.done.length}/3 lock-in steps done</div>
          </div>
          <button type="button" className={`${primaryBtn} !w-auto shrink-0 px-5`} onClick={() => scrollToId("lock-in")}>
            Finish Steps
          </button>
        </div>
      </div>

      <Footer />
      <div className="h-24" />
      <StripeEmbeddedCheckout
        plan="advanced"
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        email={email || undefined}
        trialSource="webinar_registrant_14day"
      />
    </div>
    </>
  );
};

export default WebinarConfirmation;
