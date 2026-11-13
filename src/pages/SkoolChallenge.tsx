import { ArrowRight, Check, Users } from "lucide-react";
import Footer from "@/components/Footer";
import PageSEO from "@/components/PageSEO";
import TestimonialsCarousel from "@/components/TestimonialsCarousel";
import VideoTestimonialsSection from "@/components/VideoTestimonialsSection";
import saassuiteLogo from "@/assets/saassuitelogo-dark.png";
import SnapMeButton from "@/components/SnapMeButton";
import {
  SKOOL_CHALLENGE_HREF,
  SKOOL_CHALLENGE_URL,
  SKOOL_SNAPME_BUTTON,
} from "@/lib/funnelContracts";
import { trackingPixelsAllowed } from "@/utils/trackingConsent";

/** VSL for the Skool challenge. Swap for Andrew's embed when it is ready; until then the homepage hero video plays. */
const VSL_POSTER =
  "https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/69ce0b2e66c8fcfd16f88de4.gif";
const VSL_SRC =
  "https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/6a1251673c3aed7c639fbc38.mp4";

/** The challenge days follow the One Feature promise: which feature, who buys it, how to set it up, how to sell it. */
const DAYS = [
  {
    day: "Day 1",
    title: "Pick your one feature",
    body: "Choose the one AI tool you'll sell and the businesses that will pay for it.",
  },
  {
    day: "Day 2",
    title: "Set it up under your brand",
    body: "Give us access and we set it up for you, so your clients never have to learn GHL.",
  },
  {
    day: "Day 3",
    title: "Sell it",
    body: "What to charge, and our white label sales video strategy to close your first clients.",
  },
];

/** From the Second Brain ("SaaS and AI Mastery community", Oct 30, 2026). */
const INSIDE = [
  "Full GHL agency audit",
  "Private coaching",
  "Beta access to new GHL tools",
  "Early access to new GHL features",
  "Full GHL beginner's course",
  "AI skills and prompts",
  "Affiliate program",
  "Global events",
];

const CTA_LABEL = SKOOL_CHALLENGE_URL
  ? "Join the Free Challenge on Skool"
  : "Text Us to Join the Challenge";

function trackJoin(placement: string) {
  try {
    const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
    if (typeof fbq === "function" && trackingPixelsAllowed()) {
      fbq("track", "Contact", {
        content_name: "skool_challenge_join",
        content_category: placement,
      });
    }
  } catch {
    /* ignore */
  }
}

function JoinButton({ placement }: { placement: string }) {
  const external = SKOOL_CHALLENGE_URL !== "";
  // Until the Skool link exists, the SnapMe text button replaces ours.
  return (
    <SnapMeButton slug={external ? "" : SKOOL_SNAPME_BUTTON}>
      <a
        href={SKOOL_CHALLENGE_HREF}
        onClick={() => trackJoin(placement)}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-violet-700 via-violet-600 to-violet-400 px-6 py-5 text-xl font-bold text-white shadow-[0_18px_40px_-12px_rgba(124,58,237,0.65)] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-600 sm:text-2xl"
      >
        <Users className="h-6 w-6 shrink-0" aria-hidden="true" />
        {CTA_LABEL}
        <ArrowRight
          className="h-6 w-6 shrink-0 transition-transform group-hover:translate-x-1"
          aria-hidden="true"
        />
      </a>
    </SnapMeButton>
  );
}

const SkoolChallenge = () => (
  <>
    <PageSEO
      title="One Feature Away Challenge on Skool — SaaSSuite"
      description="A free 3-day challenge inside our Skool community: sell one AI tool to businesses without learning GoHighLevel. We set it up for you."
      path="/skool-challenge"
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
          Free 3-day challenge · inside our Skool community
        </span>
        <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
          <span className="bg-gradient-to-r from-sky-400 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
            Sell One AI Tool
          </span>{" "}
          in 3 Days, With Us on Skool
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-700 sm:text-xl">
          Join the One Feature Away challenge in the{" "}
          <mark className="rounded bg-yellow-200 px-1 font-semibold text-slate-900">
            SaaS and AI Mastery
          </mark>{" "}
          community. One short lesson and one task a day, and we set the feature up for you.
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

        <div className="mt-8 w-full">
          <JoinButton placement="hero" />
        </div>
      </main>

      <section className="bg-slate-50 px-4 py-16 sm:px-6" aria-labelledby="skool-days">
        <h2
          id="skool-days"
          className="text-center text-4xl font-extrabold tracking-tight sm:text-5xl"
        >
          What Happens in the 3 Days
        </h2>
        <ol className="mx-auto mt-10 grid max-w-4xl gap-5 sm:grid-cols-3">
          {DAYS.map((d) => (
            <li
              key={d.day}
              className="rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm"
            >
              <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-bold text-violet-700">
                {d.day}
              </span>
              <h3 className="mt-4 text-2xl font-extrabold tracking-tight">{d.title}</h3>
              <p className="mt-2 text-base leading-relaxed text-slate-600">{d.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6" aria-labelledby="skool-inside">
        <h2
          id="skool-inside"
          className="text-center text-4xl font-extrabold tracking-tight sm:text-5xl"
        >
          Inside the Community
        </h2>
        <ul className="mx-auto mt-8 grid gap-3 sm:grid-cols-2">
          {INSIDE.map((item) => (
            <li
              key={item}
              className="flex items-center gap-3 rounded-2xl bg-slate-50 px-5 py-4 text-left text-lg font-semibold"
            >
              <Check className="h-6 w-6 shrink-0 text-emerald-600" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-slate-50 py-16" aria-label="Results from members">
        <h2 className="px-4 text-center text-4xl font-extrabold tracking-tight sm:text-5xl">
          Results from Members
        </h2>
        <VideoTestimonialsSection />
        <TestimonialsCarousel />
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <p className="text-lg text-slate-600">The challenge is free. Join us on Skool.</p>
        <div className="mt-4">
          <JoinButton placement="footer" />
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

export default SkoolChallenge;
