import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Package, Sparkles, GraduationCap, Users, Check } from "lucide-react";
import MarketingLayout from "@/components/MarketingLayout";
import { Button } from "@/components/ui/button";
import { appendTrackingParams } from "@/utils/preserveParams";
import { useAffiliateTracking } from "@/hooks/useAffiliateTracking";

/**
 * Lean squeeze page for the free community.
 *
 * Every CTA appends `next=/app/community` — signup reads that param, skips
 * onboarding entirely and drops the new member straight into the hub with a
 * short interactive walkthrough.
 */
const SIGNUP_PATH = "/signup?next=%2Fapp%2Fcommunity";

const PERKS = [
  {
    icon: Package,
    title: "Snapshot Vault",
    body: "Done-for-you HighLevel snapshots you can install in a couple of clicks.",
  },
  {
    icon: Sparkles,
    title: "Prompts & AI skills",
    body: "Copy-paste prompt libraries and agent skills built for agency work.",
  },
  {
    icon: GraduationCap,
    title: "Academy courses",
    body: "Short GHL lessons and a tech library that stays current.",
  },
  {
    icon: Users,
    title: "The community",
    body: "Post questions, share wins, and message our team directly.",
  },
];

const CommunityLanding = () => {
  useAffiliateTracking("community");
  const signupHref = appendTrackingParams(SIGNUP_PATH);

  return (
    <MarketingLayout minimalHeader>
      <Helmet>
        <title>Free SaaSSuite Community — Snapshots, Prompts & Courses</title>
        <meta
          name="description"
          content="Join the free SaaSSuite community for HighLevel agency owners: done-for-you snapshots, prompt libraries, AI skills and short courses. Free to join."
        />
        <link rel="canonical" href="https://saassuite.ai/community" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Free SaaSSuite Community — Snapshots, Prompts & Courses" />
        <meta
          property="og:description"
          content="Snapshots, prompts, AI skills and courses for HighLevel agency owners. Free to join."
        />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>

      <section className="mx-auto max-w-3xl px-6 py-16 md:py-24">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            Free to join
          </span>
          <h1 className="mt-6 text-3xl font-bold leading-tight text-gray-900 md:text-5xl">
            Snapshots, prompts and courses for HighLevel agency owners
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-gray-600 md:text-lg">
            Get instant access to the SaaSSuite community — the vault, the Academy and our team. No
            setup, no install, no card.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3">
            <Button asChild size="lg" className="w-full min-h-[48px] sm:w-auto sm:px-10">
              <a href={signupHref}>Join the free community</a>
            </Button>
            <p className="text-xs text-gray-500">
              Already a member?{" "}
              <Link
                to={appendTrackingParams("/login?next=%2Fapp%2Fcommunity")}
                className="font-medium text-gray-900 underline underline-offset-2"
              >
                Log in
              </Link>
            </p>
          </div>
        </div>

        <ul className="mt-14 grid gap-4 sm:grid-cols-2">
          {PERKS.map((perk) => {
            const Icon = perk.icon;
            return (
              <li
                key={perk.title}
                className="rounded-xl border border-gray-200 bg-white p-5 transition-colors hover:border-gray-300"
              >
                <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                <h2 className="mt-3 text-base font-semibold text-gray-900">{perk.title}</h2>
                <p className="mt-1 text-sm text-gray-600">{perk.body}</p>
              </li>
            );
          })}
        </ul>

        <div className="mt-12 rounded-xl bg-gray-50 p-6 text-center">
          <p className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-gray-600">
            {["Free forever", "New drops weekly", "Straight in — no onboarding"].map((item) => (
              <span key={item} className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-primary" aria-hidden="true" />
                {item}
              </span>
            ))}
          </p>
          <Button asChild size="lg" className="mt-6 w-full min-h-[48px] sm:w-auto sm:px-10">
            <a href={signupHref}>Create my free account</a>
          </Button>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default CommunityLanding;
