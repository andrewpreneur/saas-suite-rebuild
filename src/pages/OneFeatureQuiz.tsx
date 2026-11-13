import { useEffect, useRef, useState, type FormEvent } from "react";
import Footer from "@/components/Footer";
import PageSEO from "@/components/PageSEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WhiteGoogleButton } from "@/components/auth/WhiteGoogleButton";
import { TextUsLink } from "@/components/TextUsLink";
import { supabase } from "@/integrations/supabase/client";
import { signInWithStoreProvider } from "@/lib/nativeOAuth";

const QUOTES = [
  ["Ben", "Andrew always follows through with what he says he's going to do. He's taken really good care of us."],
  ["Brentney", "SaaSSuite.ai is AMAZING. I was so confused, I didn't know how to support my customers — now I have a clear plan and I can move forward."],
  ["Rob", "SaaSSuite is Amazing. Shoutout to Andrew, love what he's doing. Highly recommend!"],
  ["Jess", "You're so helpful, you're on top of everything for us. Thank you so much!"],
  ["Lee", "Andrew's one of the kindest humans you would meet. He put together a plan for me that was highly effective, comprehensive, and accessible."],
] as const;

const FAQ = [
  ["What exactly do I get?", "The full kit: the 100% brandless AI Studio sales video, the Menu Link Removal Snapshot, the 20-minute setup training, our high converting sales page, 1 ad creative template, and a free SaaSSuite account. All of it unlocks when you sign in."],
  ["Is it really free? Do I need a card?", "Yes, it's free, and no, you don't need a card. Sign in with Google (or get a sign-in link by email) and the full kit unlocks. There's nothing to pay and nothing to cancel."],
  ["Why sign in with Google?", "It's the fastest way to create your free SaaSSuite account: one tap, no password. Prefer email? Use Or continue with email and we'll send you a sign-in link."],
  ["Do I need a GoHighLevel account?", "You'll need one to launch, because the snapshot installs into GoHighLevel. GoHighLevel is a separate subscription billed by HighLevel. After you sign in, the next step shows you how to sign up through our link. New GoHighLevel signups through our link get SaaSSuite Advanced free for life."],
  ["What's the one feature?", "You sell access to AI Studio, HighLevel's AI website and page builder, under your own brand, and the snapshot hides everything else."],
  ["Will my customers know it's GoHighLevel?", "The sales video doesn't name GoHighLevel, and the snapshot strips the menu down to your one feature. Use your own domain and branding for a fully white-labeled experience."],
  ["Do I need to code, design or be on camera?", "No. The sales video is already made. The snapshot is a one-click import. The training walks you through the sales page step by step."],
  ["What will it cost to run?", "Plan for your GoHighLevel subscription, any AI usage charges HighLevel bills for AI Studio, and a small ad budget. Those are paid to HighLevel and the ad platforms, not to us."],
  ["Will this make me money?", "We can't promise that, and anyone who does is guessing. You get a clear offer, the assets and a plan. Results depend on your work, your market and your ads."],
  ["Can you set it up for me?", "Yes. After you sign in you can request a done-for-you setup inside your GoHighLevel account. No calls needed."],
  ["Is this made by HighLevel?", "No. SaaSSuite is independent and not affiliated with HighLevel Inc. We are a HighLevel affiliate."],
  ["What's SaaSSuite?", "SaaSSuite is our onboarding, education and support app for GoHighLevel agencies, used by 1,200+ agencies. Your SaaSSuite account is free, and new GoHighLevel signups through our link get Advanced free for life."],
] as const;

function withParams(path: string, extra: Record<string, string>) {
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  params.delete("auth");
  params.delete("error");
  params.delete("error_description");
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

function utmFromLocation() {
  const utm: Record<string, string> = {};
  new URLSearchParams(window.location.search).forEach((value, name) => {
    if (name.startsWith("utm_") || name === "fbclid") utm[name] = value;
  });
  return utm;
}

const OneFeatureQuiz = () => {
  const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const [notice, setNotice] = useState(params.get("auth") === "cancelled" ? "Google sign-in didn't finish. Try again or continue with email." : params.get("auth") === "expired" ? "That link expired. We've sent a fresh one." : "");
  const [emailOpen, setEmailOpen] = useState(params.get("auth") === "expired");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<{ name: string; email: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [sticky, setSticky] = useState(false);
  const heroCta = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = heroCta.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setSticky(!entry.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("auth") !== "expired") return;
    let storedEmail = "";
    let storedName = "";
    try {
      storedEmail = localStorage.getItem("oft_quiz_email") || "";
      storedName = localStorage.getItem("oft_quiz_name") || "";
      if (!storedEmail || sessionStorage.getItem("oft_expired_resent") === storedEmail) return;
      sessionStorage.setItem("oft_expired_resent", storedEmail);
    } catch {
      return;
    }
    void supabase.auth.signInWithOtp({
      email: storedEmail,
      options: {
        emailRedirectTo: `${window.location.origin}${withParams("/onefeaturetraining-success", { src: "quiz", via: "email" })}`,
        shouldCreateUser: true,
        data: { full_name: storedName },
      },
    });
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const startGoogle = async (label = "Try for Free") => {
    void label;
    setGoogleBusy(true);
    setError("");
    const message = await signInWithStoreProvider("google", withParams("/onefeaturetraining-success", { src: "quiz", via: "google" }), () => setGoogleBusy(false));
    if (message) {
      setGoogleBusy(false);
      setNotice("Google sign-in didn't finish. Try again or continue with email.");
    }
  };

  const sendLink = async (event?: FormEvent) => {
    event?.preventDefault();
    const clean = email.trim().toLowerCase();
    const name = firstName.trim();
    if (!name) {
      setError("Enter your name");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setError("Enter a valid email");
      return;
    }
    setBusy(true);
    setError("");
    try {
      localStorage.setItem("oft_quiz_email", clean);
      localStorage.setItem("oft_quiz_name", name);
    } catch {
      /* ignore */
    }
    const { error: leadError } = await supabase.functions.invoke("one-feature-lead", {
      body: { action: "create", name, email: clean, phone: "", page: "onefeaturetraining-quiz", form: "quiz_email", via: "email", utm: utmFromLocation() },
    });
    if (leadError) {
      setBusy(false);
      setError("We couldn't save that. Try again.");
      return;
    }
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: clean,
      options: {
        emailRedirectTo: `${window.location.origin}${withParams("/onefeaturetraining-success", { src: "quiz", via: "email" })}`,
        shouldCreateUser: true,
        data: { full_name: name },
      },
    });
    setBusy(false);
    if (otpError) {
      setError(otpError.message || "Could not send the link");
      return;
    }
    setSent({ name, email: clean });
    setCooldown(60);
  };

  const cta = (label = "Try for Free") => (
    <div className="space-y-2">
      <Button type="button" disabled={googleBusy} className="webinar-2-cta h-12 w-full rounded-xl text-base font-bold" onClick={() => { void startGoogle(label); }}>
        {googleBusy ? "Connecting to Google…" : label}
      </Button>
      <WhiteGoogleButton label={googleBusy ? "Connecting to Google…" : "Sign in with Google"} disabled={googleBusy} onClick={() => { void startGoogle(label); }} />
      <button type="button" className="mx-auto block text-sm font-semibold underline webinar-2-accent" onClick={() => setEmailOpen(true)}>
        Or continue with email
      </button>
      <p className="text-center text-xs text-muted-foreground">Full kit free · No card required</p>
      {emailOpen && !sent && (
        <form className="space-y-2 pt-2" noValidate onSubmit={(event) => { void sendLink(event); }}>
          <Input aria-label="First name" placeholder="First name" value={firstName} onChange={(event) => setFirstName(event.target.value)} className="h-12" />
          <Input aria-label="Email" type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-12" />
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy} className="webinar-2-cta h-12 w-full rounded-xl text-base font-bold">{busy ? "Sending…" : "Continue →"}</Button>
          <p className="text-xs text-muted-foreground">We'll email you a secure sign-in link. No password, no card.</p>
        </form>
      )}
      {sent && (
        <div className="space-y-2 pt-2 text-sm">
          <p className="font-bold">Check your inbox, {sent.name}.</p>
          <p>We sent a sign-in link to {sent.email}. Tap it to open your full kit.</p>
          <button type="button" className="font-semibold underline webinar-2-accent disabled:opacity-50" disabled={cooldown > 0 || busy} onClick={() => { void sendLink(); }}>
            {cooldown > 0 ? `Resend link in ${cooldown}s` : "Resend link"}
          </button>
          <button type="button" className="block font-semibold underline webinar-2-accent" onClick={() => { setSent(null); setEmailOpen(true); }}>
            Wrong email? Change it
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <PageSEO title="The GoHighLevel One Feature Kit · Try It Free" description="Stop trying to sell all of GoHighLevel. Get the brandless sales video, snapshot and setup to sell one feature as your own AI software. Free with your GoHighLevel account." path="/onefeaturetraining-quiz" noindex />
      <div className="min-h-screen bg-background text-foreground">
        <main className="webinar-2-hero mx-auto max-w-3xl px-4 pb-28 pt-6 text-center sm:px-6">
          <img src="/assets/saassuite-logo.png" alt="SaaSSuite" width={48} height={48} decoding="async" fetchPriority="low" className="mx-auto h-10 w-10 object-contain sm:h-12 sm:w-12" />
          <p className="webinar-2-attention mx-auto mt-4 inline-flex max-w-xl px-4 py-2 text-center text-xs font-bold uppercase leading-snug">FOR GOHIGHLEVEL USERS ● AND PEOPLE WHO WANT AN ONLINE INCOME WITHOUT A PRODUCT ● TRY IT FREE</p>
          <p className="mt-4 text-base">Got questions? <TextUsLink /></p>
          {notice && <p role="status" className="glass-card mx-auto max-w-xl rounded-2xl px-4 py-3 text-left text-sm shadow-sm">{notice}</p>}
          <section className="mx-auto mt-8 max-w-xl space-y-5">
            <div className="space-y-4">
              <h1 aria-label="Stop Trying To Sell All Of GoHighLevel. Sell One Feature As Your Own AI Software." className="text-[32px] font-extrabold leading-tight text-foreground sm:text-[40px] md:text-[46px]">Stop Trying To Sell All Of GoHighLevel. Sell <span className="webinar-2-accent">One Feature</span> As <span className="webinar-2-accent">Your Own AI Software</span>.</h1>
              <p className="text-base">Get the white-label sales video, one offer, and the snapshot that hides every other feature, free with your GoHighLevel account.</p>
              <ul className="space-y-1 text-left text-base">
                <li>✓ 100% Brandless AI Studio Sales Video</li>
                <li>✓ Free SaaSSuite Account. Advanced free for life when you sign up for GoHighLevel through our link</li>
                <li>✓ Menu Link Removal Snapshot</li>
                <li>✓ 20 Minute Setup Training</li>
                <li>✓ Our High Converting Sales Page · <a href="https://lynkific.com/vibe" target="_blank" rel="noopener noreferrer">Preview</a></li>
                <li>✓ 1 Ad Creative Template to Get Started</li>
              </ul>
              <p className="text-base font-semibold">Trusted by 1,200+ Agencies</p>
            </div>
            <div ref={heroCta} className="glass-card space-y-3 rounded-2xl p-5 text-left shadow-sm">
              <h2 className="text-center text-xl font-extrabold">THE <span className="webinar-2-accent">ONE FEATURE</span> KIT</h2>
              <p className="text-base">Get the full kit free. Sign in and everything unlocks right away. No card, ever.</p>
              {cta()}
              <p className="text-xs text-muted-foreground">By continuing you agree to our Terms and Privacy Policy and to receive emails from SaaSSuite. Unsubscribe anytime.</p>
            </div>
          </section>
          <p className="mx-auto mt-16 max-w-xl text-center text-xs font-bold tracking-wide text-muted-foreground">BRANDLESS SALES VIDEO · SAASSUITE ACCOUNT · MENU LINK SNAPSHOT · 20-MINUTE SETUP · HIGH CONVERTING SALES PAGE · 1 AD TEMPLATE · FREE</p>
          <section className="mx-auto mt-16 max-w-xl space-y-4 text-left text-base">
            <h2 className="text-center text-2xl font-extrabold sm:text-3xl">GoHighLevel can do a hundred things. That's exactly the problem.</h2>
            <p>Let me guess...</p>
            <p>You signed up for GoHighLevel (or you keep watching people talk about it). You open the left-hand menu and there are twenty-plus things in it. Funnels, workflows, conversations, reputation, memberships, AI this, AI that.</p>
            <p>Everyone online tells you to start a SaaS, white-label everything, go sell it to local businesses. So you try to learn all of it. Then you try to explain all of it to a prospect. And their eyes glaze over before you get to the third feature.</p>
            <p>Or maybe you're not on GHL yet. You just want an online income. But you don't want to create a course, you don't want clients messaging you at 9pm, and you don't want to do the fulfilment yourself.</p>
            <p>You've probably already tried some of this: hours of YouTube tutorials, a snapshot you bought and never installed, a full-service agency that turned into a job you can't switch off, a pitch for the whole platform that nobody bought.</p>
            <p>And somewhere in the background there's a sentence you never say out loud: "I'm paying for GoHighLevel every month and I still don't know what to sell."</p>
          </section>
          <section className="mx-auto mt-16 max-w-xl space-y-4 text-left text-base">
            <h2 className="text-center text-2xl font-extrabold sm:text-3xl">That's why we built the One Feature Kit.</h2>
            <p>Not another 40-hour course. Not another snapshot you'll never open. Not another sell-the-whole-platform pitch.</p>
            <p>It's the One Feature Strategy, packaged: sell GoHighLevel, but only one feature. One thing your customer understands in ten seconds, sold as your own branded software.</p>
            <ul className="space-y-1 text-base">
              <li>✕ No product to create from scratch</li>
              <li>✕ No clients to manage or meetings to sit through</li>
              <li>✕ No fulfilment: the software does the work</li>
              <li>✕ No coding, no complicated setup</li>
              <li>✕ No explaining 20 menu items to a confused customer</li>
            </ul>
          </section>
          <section className="mx-auto mt-16 max-w-xl space-y-4 text-left text-base">
            <p className="text-center text-xs font-bold uppercase webinar-2-accent">How it works</p>
            <h2 className="text-center text-2xl font-extrabold sm:text-3xl">Four moves. One feature. Your brand on it.</h2>
            <ol className="list-decimal space-y-2 pl-5 text-base">
              <li>Take the offer. The one GHL feature to sell, who to sell it to, what to name it and what to charge, already decided for you.</li>
              <li>Install the snapshot. One import hides every menu link except the one feature.</li>
              <li>Plug in the video. Drop the white-label sales video onto your sales page.</li>
              <li>Follow the 20-minute setup. Watch the setup training, put the sales page live, and use the ad template.</li>
            </ol>
          </section>
          <section className="mx-auto mt-16 max-w-xl space-y-4 text-left text-base">
            <p className="text-center text-xs font-bold uppercase webinar-2-accent">What's inside</p>
            <h2 className="text-center text-2xl font-extrabold sm:text-3xl">Everything in the One Feature Kit</h2>
            <p>This is the full kit, all of it free. It unlocks the moment you sign in.</p>
            <ul className="glass-card space-y-3 rounded-2xl p-4 text-base shadow-sm">
              <li><b>100% Brandless AI Studio Sales Video.</b> It does not mention GoHighLevel.</li>
              <li><b>A free SaaSSuite account.</b> New to GoHighLevel? Sign up through our link and SaaSSuite Advanced is free for life.</li>
              <li><b>Menu Link Removal Snapshot.</b> The menu your customer sees is the one feature.</li>
              <li><b>20-minute setup training.</b> A walkthrough of the setup.</li>
              <li><b>Our high converting sales page.</b> <a href="https://lynkific.com/vibe" target="_blank" rel="noopener noreferrer">Preview</a></li>
              <li><b>1 ad creative template.</b> So you can start promoting the offer.</li>
            </ul>
            {cta()}
          </section>
          <section className="mx-auto mt-16 grid max-w-xl gap-4 text-left sm:grid-cols-2">
            <div className="glass-card rounded-2xl p-4 shadow-sm">
              <h2 className="font-extrabold">This is for you if…</h2>
              <ul className="mt-2 space-y-1 text-base"><li>You want an online income but don't want to create a product</li><li>You don't want to handle clients or do fulfilment</li><li>You already pay for GHL and feel lost in it</li><li>You'd rather sell one clear thing than the whole platform</li></ul>
            </div>
            <div className="glass-card rounded-2xl p-4 shadow-sm">
              <h2 className="font-extrabold">This is NOT for you if…</h2>
              <ul className="mt-2 space-y-1 text-base"><li>You want a get rich quick button (there isn't one)</li><li>You won't watch the 20-minute setup training</li><li>You want to sell every GHL feature to local businesses</li><li>You're not willing to run GoHighLevel and a small ad test</li></ul>
            </div>
          </section>
          <section className="mx-auto mt-16 max-w-xl text-left">
            <p className="text-center text-xs font-bold uppercase webinar-2-accent">SaaSSuite customers</p>
            <h2 className="mt-2 text-center text-2xl font-extrabold sm:text-3xl">Real words from real customers</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {QUOTES.map(([name, quote]) => (
                <blockquote key={name} className="glass-card rounded-2xl p-4 text-left text-base shadow-sm">
                  <p className="text-gold" aria-hidden="true">★★★★★</p>
                  <p className="mt-2">“{quote}” <b>{name}</b></p>
                </blockquote>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Published on saassuite.ai. These are about Andrew and SaaSSuite.</p>
          </section>
          <section className="mx-auto mt-16 max-w-xl space-y-4 text-left text-base">
            <h2 className="text-center text-2xl font-extrabold sm:text-3xl">Hi, I'm Andrew George.</h2>
            <p>I run SaaSSuite, the onboarding, education and support app for GoHighLevel agencies. My whole job is helping GHL users stop feeling lost and start selling something their customers keep paying for.</p>
            <p>The One Feature Strategy came from watching people try to sell everything GHL does and end up selling nothing. Sell one feature. Make it look like your own software. Onboard customers properly so they stay. This kit is that strategy, and you can try it free.</p>
          </section>
          <section className="mx-auto mt-16 max-w-xl text-left">
            <p className="text-center text-xs font-bold uppercase webinar-2-accent">Everything you get today</p>
            <ul className="glass-card mt-4 overflow-hidden rounded-2xl text-base shadow-sm">
              {["100% Brandless AI Studio Sales Video", "Free SaaSSuite account", "Menu Link Removal Snapshot", "20-minute setup training", "High converting sales page", "1 ad creative template"].map((item) => (
                <li key={item} className="flex justify-between gap-3 border-b border-border/70 px-4 py-3"><span>{item}</span><span>Included</span></li>
              ))}
              <li className="flex justify-between gap-3 px-4 py-3 font-extrabold"><span>Today</span><span className="webinar-2-accent">Free</span></li>
            </ul>
            <div className="mt-5">{cta("Yes! Try It for Free")}</div>
          </section>
          <section className="mx-auto mt-16 max-w-xl space-y-4 text-left text-base">
            <h2 className="text-center text-2xl font-extrabold sm:text-3xl">Why is this free?</h2>
            <p>Honestly: we'd rather you see how simple this is first. Most people who launch a one-feature app end up wanting SaaSSuite to onboard and support their customers, and if you're new to GoHighLevel and sign up through our link, SaaSSuite Advanced is free for life. If you sign up for GoHighLevel through our link, HighLevel may pay us as an affiliate at no extra cost to you. That's how we keep this free.</p>
          </section>
          <section className="mx-auto mt-16 max-w-xl space-y-3 text-left">
            <p className="text-center text-xs font-bold uppercase webinar-2-accent">Questions</p>
            <h2 className="text-center text-2xl font-extrabold sm:text-3xl">Frequently asked questions</h2>
            {FAQ.map(([question, answer]) => (
              <details key={question} className="glass-card rounded-2xl px-4 py-3 shadow-sm">
                <summary className="cursor-pointer font-bold">{question}</summary>
                <p className="mt-2 text-base text-muted-foreground">{answer}</p>
              </details>
            ))}
          </section>
          <section className="mx-auto mt-16 max-w-xl space-y-4 text-center">
            <h2 className="text-2xl font-extrabold sm:text-3xl">Sell one feature. Make it yours. Start free.</h2>
            {cta()}
          </section>
          <p className="text-xs text-muted-foreground">Affiliate disclosure: we are a HighLevel affiliate and may earn a commission if you sign up to HighLevel through our link, at no extra cost to you. Not affiliated with HighLevel Inc. Results are not guaranteed. Sign in with Google does not imply a Google endorsement.</p>
        </main>
        {sticky && (
          <div className="fixed inset-x-0 bottom-16 z-40 px-4 md:hidden">
            <Button type="button" className="webinar-2-cta h-12 w-full rounded-xl text-base font-bold" disabled={googleBusy} onClick={() => { void startGoogle(); }}>
              {googleBusy ? "Connecting to Google…" : "Try for Free"}
            </Button>
          </div>
        )}
        <Footer minimal />
      </div>
    </>
  );
};

export default OneFeatureQuiz;
