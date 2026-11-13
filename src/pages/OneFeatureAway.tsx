import { ArrowRight, MessageSquare } from "lucide-react";
import Footer from "@/components/Footer";
import PageSEO from "@/components/PageSEO";
import TestimonialsCarousel from "@/components/TestimonialsCarousel";
import VideoTestimonialsSection from "@/components/VideoTestimonialsSection";
import saassuiteLogo from "@/assets/saassuitelogo-dark.png";
import SnapMeButton from "@/components/SnapMeButton";
import { ONE_FEATURE_AWAY_TEXT_US_HREF, SNAPME_BUTTONS } from "@/lib/funnelContracts";
import { trackingPixelsAllowed } from "@/utils/trackingConsent";

/** One Feature VSL "VIDEO 4" (16:9, 68 s), web-compressed copy of content-management `vsl4-169.mp4`. */
const VSL_POSTER = "/videos/one-feature-vsl4-poster.jpg";
const VSL_SRC = "/videos/one-feature-vsl4.mp4";

function trackTextUs(placement: string) {
  try {
    const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
    if (typeof fbq === "function" && trackingPixelsAllowed()) {
      fbq("track", "Contact", {
        content_name: "one_feature_away_text_us",
        content_category: placement,
      });
    }
  } catch {
    /* ignore */
  }
}

function TextUsButton({ placement }: { placement: string }) {
  return (
    <SnapMeButton slug={SNAPME_BUTTONS.oneFeatureAway}>
      <a
        href={ONE_FEATURE_AWAY_TEXT_US_HREF}
        onClick={() => trackTextUs(placement)}
        className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-violet-700 via-violet-600 to-violet-400 px-6 py-5 text-xl font-bold text-white shadow-[0_18px_40px_-12px_rgba(124,58,237,0.65)] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-600 sm:text-2xl"
      >
        <MessageSquare className="h-6 w-6 shrink-0" aria-hidden="true" />
        Text Us to Join the Challenge
        <ArrowRight
          className="h-6 w-6 shrink-0 transition-transform group-hover:translate-x-1"
          aria-hidden="true"
        />
      </a>
    </SnapMeButton>
  );
}

const OneFeatureAway = () => (
  <>
    <PageSEO
      title="One Feature Away Challenge — SaaSSuite"
      description="A free 3-day challenge: sell one AI tool to businesses without learning GoHighLevel. We set it up and support it for you."
      path="/one-feature-away"
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
        <span className="rounded-full bg-violet-50 px-4 py-1.5 text-sm font-semibold text-violet-700">
          Free 3-day challenge · One Feature Away
        </span>
        <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
          <span className="bg-gradient-to-r from-sky-400 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
            Sell One AI Tool
          </span>{" "}
          to Businesses Without Learning GHL
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-700 sm:text-xl">
          Learn how to collect{" "}
          <mark className="rounded bg-yellow-200 px-1 font-semibold text-slate-900">
            hundreds of sub-accounts
          </mark>{" "}
          in your industry and leverage SaaSSuite to fulfill and support them for you.
        </p>

        <div className="mt-8 w-full overflow-hidden rounded-3xl bg-slate-900 shadow-xl">
          <video
            className="aspect-video w-full"
            controls
            playsInline
            preload="metadata"
            poster={VSL_POSTER}
          >
            <source src={VSL_SRC} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>

        <p className="mt-8 text-lg text-slate-600">
          Text us and we'll send you the challenge training. We set everything up for you.
        </p>
        <div className="mt-4 w-full">
          <TextUsButton placement="hero" />
        </div>
      </main>

      <section className="bg-slate-50 py-16" aria-label="Results from members">
        <h2
          id="ofa-results"
          className="px-4 text-center text-4xl font-extrabold tracking-tight sm:text-5xl"
        >
          Results from Members
        </h2>
        <VideoTestimonialsSection />
        <TestimonialsCarousel />
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <p className="text-lg text-slate-600">Text us to join the challenge</p>
        <div className="mt-4">
          <TextUsButton placement="footer" />
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

export default OneFeatureAway;
