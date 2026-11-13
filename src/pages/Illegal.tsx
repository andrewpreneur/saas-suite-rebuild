import MarketingLayout from "@/components/MarketingLayout";
import PageSEO from "@/components/PageSEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, MessageSquare, PhoneCall, Headphones, GraduationCap, Star, Quote } from "lucide-react";
import { navigateWithParams } from "@/utils/preserveParams";
import BumpCheckoutFlow from "@/components/bump/BumpCheckoutFlow";
import PlanFeatureLabel from "@/components/pricing/PlanFeatureLabel";
import { SAME_DAY_WL_SUPPORT } from "@/constants/pricingPlans";
import { useEffect, useState } from "react";

/** Free-account signup flow (same destination as our other paid-traffic pages). */
const SIGNUP_HREF = "/signup";
/** Text-us fallback CTA — opens the SMS composer with our intake message prefilled. */
const SMS_HREF = "sms:+13372270501?&body=" + encodeURIComponent("Hey Andrew- tell me more about SaaSSuite. I run a GHL agency/saas with this many subaccounts: ");

const blurIn = (delay: number) => ({
  animation: `fadeInFromBlur 0.7s ease-out ${delay}s forwards`,
  opacity: 0,
});

const FEATURES = [
  {
    icon: PhoneCall,
    title: "Voice AI that actually calls",
    body: "Every new client gets onboarded instantly — a real voice call that welcomes them, walks them through setup, and answers their first questions. No staff, no scheduling.",
    accent: "from-violet-500/15 via-violet-500/5 text-violet-600",
  },
  {
    icon: Headphones,
    title: "24/7 human + AI chat support",
    body: "Under your brand, in your voice. AI handles the volume, real humans step in on the hard ones. Your clients never know it isn't your team.",
    accent: "from-emerald-500/15 via-emerald-500/5 text-emerald-600",
  },
  {
    icon: GraduationCap,
    title: "White-label academy + health scores",
    body: "A branded training portal your clients actually use, plus health scores that flag the accounts about to churn — before they cancel.",
    accent: "from-fuchsia-500/15 via-fuchsia-500/5 text-fuchsia-600",
  },
];

const TESTIMONIALS = [
  {
    name: "Mark",
    quote:
      "I stopped paying $1,000/month for agency support. I pay 1/10th of that for an AI + human team that knows my business and HighLevel better than anyone.",
  },
  {
    name: "Melissa",
    quote:
      "I've tried every single big provider. SaaSSuite is the only option that actually supports my business growth and it's less than 1/10th of the cost.",
  },
];

interface CtaPairProps {
  startLabel: string;
  textLabel: string;
}

/** Primary + secondary CTA stack. Each button carries a distinct aria-label
 *  so SiteTracker records which CTA on the page was clicked. */
const CtaPair = ({ startLabel, textLabel }: CtaPairProps) => (
  <div className="flex w-full flex-col items-center gap-3">
    <Button
      asChild
      size="lg"
      className="h-14 w-full max-w-sm rounded-full bg-gradient-to-r from-violet-600 to-emerald-500 px-8 text-base font-semibold text-white shadow-lg transition-transform hover:-translate-y-0.5 hover:from-violet-700 hover:to-emerald-600"
    >
      <a href={navigateWithParams(SIGNUP_HREF)} aria-label={startLabel} data-track-click>
        Start free — takes 2 minutes <ArrowRight className="ml-2 h-4 w-4" />
      </a>
    </Button>
    <Button
      asChild
      size="lg"
      variant="outline"
      className="h-14 w-full max-w-sm rounded-full border-2 px-8 text-base font-semibold"
    >
      <a href={SMS_HREF} aria-label={textLabel} data-track-click>
        <MessageSquare className="mr-2 h-4 w-4" aria-hidden="true" />
        Text us instead
      </a>
    </Button>
  </div>
);

const Illegal = () => {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [affiliateId, setAffiliateId] = useState<string | null>(null);

  // Keep FB/UTM attribution: affiliate ref comes from the URL or prior storage.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const amId = params.get("am_id");
    const ref = params.get("ref");
    if (amId) setAffiliateId(amId);
    else if (ref) {
      setAffiliateId(ref);
      localStorage.setItem("affiliate_ref", ref);
    } else {
      const stored =
        localStorage.getItem("affiliate_ref") ||
        localStorage.getItem("affiliate_id") ||
        sessionStorage.getItem("affiliate_id");
      if (stored) setAffiliateId(stored);
    }
  }, []);

  return (
    <MarketingLayout minimalHeader>
      <PageSEO
        title="Yeah… it feels illegal. | SaaSSuite for GHL Agencies"
        description="An AI + human team that onboards, supports, and retains your GoHighLevel clients while you sleep. $97/month, unlimited sub-accounts, no contracts."
        path="/illegal"
      />

      {/* HERO — text only, nothing heavy above the fold */}
      <section className="relative overflow-hidden px-5 pb-14 pt-12 sm:pt-16">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-violet-500/10 to-transparent"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-2xl text-center">
          <h1
            className="text-4xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-5xl md:text-6xl"
            style={blurIn(0)}
          >
            Yeah… it feels illegal.
          </h1>
          <p
            className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-gray-600 sm:text-xl"
            style={blurIn(0.15)}
          >
            An AI + human team that onboards, supports, and retains your GHL clients — while you
            sleep. <span className="font-semibold text-gray-900">$97/month.</span> Unlimited
            sub-accounts.
          </p>
          <div className="mt-8" style={blurIn(0.3)}>
            <CtaPair startLabel="illegal-hero-start-free" textLabel="illegal-hero-text-us" />
          </div>
          <p className="mt-4 text-sm text-gray-500">
            No card required. Cancel anytime.
          </p>
        </div>
      </section>

      {/* SECTION 2 — the tweet from the ad, as a quote card */}
      <section className="px-5 py-10">
        <div className="mx-auto max-w-xl">
          <Card className="relative overflow-hidden rounded-3xl border-2 border-gray-200 shadow-sm">
            <CardContent className="p-6 sm:p-8">
              <Quote className="h-7 w-7 text-violet-500" aria-hidden="true" />
              <blockquote className="mt-3 text-lg leading-relaxed text-gray-900 sm:text-xl">
                just watched a competitor's GHL agency onboard 12 clients overnight. zero staff. the
                AI even called them. a $97 tool. this feels illegal.
              </blockquote>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* SECTION 3 — three feature blocks */}
      <section className="px-5 py-10">
        <div className="mx-auto grid max-w-3xl gap-4 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body, accent }) => (
            <Card key={title} className="rounded-2xl border-gray-200">
              <CardContent className="p-6">
                <div
                  className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br to-transparent ${accent}`}
                >
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">{title}</h2>
                <p className="mt-2 text-[15px] leading-relaxed text-gray-600">{body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* SECTION 4 — testimonials */}
      <section className="px-5 py-10">
        <div className="mx-auto grid max-w-3xl gap-4 md:grid-cols-2">
          {TESTIMONIALS.map(({ name, quote }) => (
            <Card key={name} className="rounded-2xl border-gray-200 bg-gray-50/60">
              <CardContent className="p-6">
                <div className="flex gap-0.5" aria-label="5 out of 5 stars">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
                  ))}
                </div>
                <p className="mt-3 text-[15px] leading-relaxed text-gray-700">“{quote}”</p>
                <p className="mt-4 text-sm font-semibold text-gray-900">{name}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* SECTION 5 — pricing strip + repeated CTAs */}
      <section className="px-5 pb-16 pt-10">
        <div className="mx-auto max-w-xl rounded-3xl bg-gradient-to-br from-violet-600 to-emerald-500 p-1">
          <div className="rounded-[22px] bg-white px-6 py-10 text-center">
            <p className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
              $97<span className="text-xl font-bold text-gray-500">/month</span>
            </p>
            <p className="mx-auto mt-3 max-w-sm text-base text-gray-600">
              Unlimited sub-accounts. No contracts. Cancel anytime.
            </p>
            <p className="mx-auto mt-3 flex max-w-sm items-center justify-center text-sm font-medium text-gray-800">
              <PlanFeatureLabel feature={SAME_DAY_WL_SUPPORT} />
            </p>
            <div className="mt-8 flex w-full flex-col items-center gap-3">
              <Button
                size="lg"
                onClick={() => setCheckoutOpen(true)}
                aria-label="illegal-pricing-buy-97"
                data-track-click
                className="h-14 w-full max-w-sm rounded-full bg-gradient-to-r from-violet-600 to-emerald-500 px-8 text-base font-semibold text-white shadow-lg transition-transform hover:-translate-y-0.5 hover:from-violet-700 hover:to-emerald-600"
              >
                Get it now — $97/month <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-14 w-full max-w-sm rounded-full border-2 px-8 text-base font-semibold"
              >
                <a
                  href={navigateWithParams(SIGNUP_HREF)}
                  aria-label="illegal-pricing-start-free"
                  data-track-click
                >
                  Or start free — takes 2 minutes
                </a>
              </Button>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="h-12 w-full max-w-sm rounded-full text-base font-semibold"
              >
                <a href={SMS_HREF} aria-label="illegal-pricing-text-us" data-track-click>
                  <MessageSquare className="mr-2 h-4 w-4" aria-hidden="true" />
                  Text us instead
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>
      <BumpCheckoutFlow
        plan="advanced"
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        affiliateId={affiliateId}
      />
    </MarketingLayout>
  );
};

export default Illegal;
