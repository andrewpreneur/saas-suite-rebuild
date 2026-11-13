import { ArrowRight, CheckCircle, CreditCard, MessageSquare, ShieldCheck } from "lucide-react";
import Footer from "@/components/Footer";
import PageSEO from "@/components/PageSEO";
import TestimonialsCarousel from "@/components/TestimonialsCarousel";
import VideoTestimonialsSection from "@/components/VideoTestimonialsSection";
import saassuiteLogo from "@/assets/saassuitelogo-dark.png";
import SnapMeButton from "@/components/SnapMeButton";
import { BLACK_FRIDAY_TEXT_US_HREF, SNAPME_BUTTONS } from "@/lib/funnelContracts";
import { SAME_DAY_WL_SUPPORT } from "@/constants/pricingPlans";
import { trackingPixelsAllowed } from "@/utils/trackingConsent";

/**
 * Stripe checkout (with financing) for the $1,997 annual deal. Empty until Andrew creates the price;
 * while empty every CTA texts the Founders number so the team can send the link and financing options.
 */
const CHECKOUT_URL = "";

const INCLUDED = [
  "Unlimited human + AI chat support for a full year",
  "24/7 AI and human support for your team",
  "White-labeled support for your customers",
  "Live chat, ticket, email, and Zoom support",
  "Dedicated Slack channel and priority escalation",
  "Unlimited users and sub-accounts",
  "Three custom onboarding experiences",
  "SaaS health and onboarding tracking",
  SAME_DAY_WL_SUPPORT,
];

function track(placement: string) {
  try {
    const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
    if (typeof fbq === "function" && trackingPixelsAllowed()) {
      fbq("track", CHECKOUT_URL ? "InitiateCheckout" : "Contact", {
        content_name: "black_friday_annual",
        content_category: placement,
        value: 1997,
        currency: "USD",
      });
    }
  } catch {
    /* ignore */
  }
}

function ClaimButton({ placement }: { placement: string }) {
  const Icon = CHECKOUT_URL ? CreditCard : MessageSquare;
  // Checkout wins once the Stripe link is set; until then the SnapMe text button (if set) replaces ours.
  return (
    <SnapMeButton slug={CHECKOUT_URL ? "" : SNAPME_BUTTONS.blackFriday}>
      <a
        href={CHECKOUT_URL || BLACK_FRIDAY_TEXT_US_HREF}
        onClick={() => track(placement)}
        className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-violet-700 via-violet-600 to-violet-400 px-6 py-5 text-xl font-bold text-white shadow-[0_18px_40px_-12px_rgba(124,58,237,0.65)] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-600 sm:text-2xl"
      >
        <Icon className="h-6 w-6 shrink-0" aria-hidden="true" />
        {CHECKOUT_URL ? "Claim the Black Friday Deal" : "Text Us to Claim the Deal"}
        <ArrowRight
          className="h-6 w-6 shrink-0 transition-transform group-hover:translate-x-1"
          aria-hidden="true"
        />
      </a>
    </SnapMeButton>
  );
}

const BlackFriday = () => (
  <>
    <PageSEO
      title="Black Friday — SaaSSuite for a Year"
      description="Black Friday only: a full year of unlimited human + AI chat support for $1,997 instead of $3,997. Financing available."
      path="/black-friday"
      noindex
    />
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-10 flex justify-center border-b border-slate-100 bg-white/90 py-4 backdrop-blur">
        <div className="flex items-center gap-2">
          <img src={saassuiteLogo} alt="" className="h-9 w-9" width={36} height={36} />
          <span className="text-2xl font-extrabold tracking-tight">SaaSSuite</span>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col items-center px-4 pb-16 pt-10 text-center sm:px-6">
        <span className="rounded-full bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white">
          Black Friday · Exclusive yearly deal
        </span>
        <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
          A Full Year of{" "}
          <span className="bg-gradient-to-r from-sky-400 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
            Unlimited Human + AI Support
          </span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-700 sm:text-xl">
          Your customers get answers around the clock, under your brand, while we handle the support
          for you.
        </p>

        <div className="mt-8 w-full rounded-3xl border border-slate-200 bg-slate-50 px-6 py-8">
          <p className="text-lg text-slate-500">
            Normally <span className="font-semibold line-through">$3,997</span> for the year
          </p>
          <p className="mt-1 text-6xl font-extrabold tracking-tight">
            $1,997<span className="text-2xl font-semibold text-slate-500">/year</span>
          </p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-yellow-200 px-3 py-1 font-semibold">
            <CreditCard className="h-4 w-4" aria-hidden="true" />
            Financing available
          </p>
          <ul
            className="mx-auto mt-8 max-w-md space-y-3 text-left"
            aria-label="Included with the Black Friday deal"
          >
            {INCLUDED.map((item) => (
              <li key={item} className="flex gap-3">
                <CheckCircle
                  className="mt-0.5 h-5 w-5 flex-none text-emerald-600"
                  aria-hidden="true"
                />
                <span className="font-medium leading-6">{item}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <ClaimButton placement="hero" />
          </div>
          <p className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-500">
            <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            {CHECKOUT_URL
              ? "Secure Stripe checkout"
              : "Text us and we'll send your checkout and financing options."}
          </p>
        </div>
      </main>

      <section className="bg-slate-50 py-16" aria-label="Results from members">
        <VideoTestimonialsSection />
        <TestimonialsCarousel />
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <p className="text-lg text-slate-600">
          Black Friday only: $1,997 for the year instead of $3,997.
        </p>
        <div className="mt-4">
          <ClaimButton placement="footer" />
        </div>
      </section>

      <div className="bg-black px-6 py-10 text-sm italic text-slate-300">
        <p className="mx-auto max-w-3xl">
          Disclaimer: This site is not a part of the Facebook website or Facebook Inc. Additionally,
          this site is NOT endorsed by Facebook in any way. FACEBOOK is a trademark of FACEBOOK,
          Inc.
        </p>
      </div>
      <Footer minimal />
    </div>
  </>
);

export default BlackFriday;
