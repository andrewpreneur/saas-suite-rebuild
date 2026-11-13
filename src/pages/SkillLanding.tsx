import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bot,
  Check,
  ClipboardCopy,
  Code2,
  FileSearch,
  Globe,
  MessagesSquare,
  MousePointerClick,
  PenLine,
  Search,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import MarketingLayout from "@/components/MarketingLayout";
import { Button } from "@/components/ui/button";
import { appendTrackingParams } from "@/utils/preserveParams";
import { useAffiliateTracking } from "@/hooks/useAffiliateTracking";

/**
 * Squeeze page for a single Academy skill — the Master AI Studio SEO Prompt.
 *
 * Every CTA appends `next=/app/community/skills?skill=master-ai-studio-seo-prompt`
 * so signup skips onboarding, drops the new member straight into the Academy's
 * Skills section, and spotlights this exact skill card.
 */
const SIGNUP_PATH =
  "/signup?next=%2Fapp%2Fcommunity%2Fskills%3Fskill%3Dmaster-ai-studio-seo-prompt";
const LOGIN_PATH =
  "/login?next=%2Fapp%2Fcommunity%2Fskills%3Fskill%3Dmaster-ai-studio-seo-prompt";

const STEPS = [
  {
    icon: MousePointerClick,
    title: "Open the prompt",
    body: "One click takes you straight to the prompt — no digging, no download.",
    accent: "hsl(var(--pricing-accent))",
  },
  {
    icon: ClipboardCopy,
    title: "Copy & paste it into AI Studio",
    body: "Open AI Studio in HighLevel, paste the prompt, and it knows exactly what to do. Nothing to configure.",
    accent: "hsl(var(--heart))",
  },
  {
    icon: TrendingUp,
    title: "Watch your SEO improve",
    body: "AI Studio audits your whole site, fixes what's holding it back, and explains every change in plain English.",
    accent: "hsl(var(--success))",
  },
];

const WHAT_IT_DOES = [
  {
    icon: Search,
    title: "Audits your entire site",
    body: "It reads every page — headings, copy, tags, links — and finds everything that's keeping Google from ranking you.",
    accent: "hsl(var(--pricing-accent))",
  },
  {
    icon: PenLine,
    title: "Rewrites titles & descriptions",
    body: "Page titles, meta descriptions and headings get rewritten to match what your customers actually search for.",
    accent: "hsl(var(--heart))",
  },
  {
    icon: Bot,
    title: "Gets you into AI answers",
    body: "Sets your site up so ChatGPT, Claude, Perplexity and Google's AI Overviews can find, read and recommend you.",
    accent: "hsl(var(--webinar-accent))",
  },
  {
    icon: Globe,
    title: "Fixes crawlability",
    body: "Sitemap, robots.txt, canonical tags, redirects — the technical plumbing Google needs, done the right way.",
    accent: "hsl(var(--brand-purple))",
  },
  {
    icon: Code2,
    title: "Adds structured data",
    body: "Schema markup that helps Google show rich results — star ratings, FAQs and more — for your pages.",
    accent: "hsl(var(--offer))",
  },
  {
    icon: MessagesSquare,
    title: "Explains everything simply",
    body: "No jargon. Every change comes with what it did, why it matters for SEO, and how you can check it worked.",
    accent: "hsl(var(--success))",
  },
];

const INCLUDED = [
  "A phased plan: audit first, then fixes — AI Studio never runs ahead without your approval",
  "Never touches your design, checkout or customer data",
  "Won't invent facts — every claim about your business is traced back to your own site",
  "Works on HighLevel sites, funnels and any React app built in AI Studio",
];

const SkillLanding = () => {
  useAffiliateTracking("ai-studio-seo-prompt");
  const signupHref = appendTrackingParams(SIGNUP_PATH);
  const loginHref = appendTrackingParams(LOGIN_PATH);

  return (
    <MarketingLayout minimalHeader>
      <Helmet>
        <title>Master AI Studio SEO Prompt — Free from SaaSSuite</title>
        <meta
          name="description"
          content="Copy one prompt into AI Studio and it turns into a senior SEO engineer: full site audit, titles and meta descriptions rewritten, sitemap and structured data fixed, and your site made visible to Google and AI answer engines. Free community account."
        />
        <link rel="canonical" href="https://saassuite.ai/ai-studio-seo-prompt" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Master AI Studio SEO Prompt — Free from SaaSSuite" />
        <meta
          property="og:description"
          content="One copy-paste prompt turns AI Studio into a senior SEO engineer for your agency. Free with a community account."
        />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>

      {/* ===== Hero ===== */}
      <section
        className="relative overflow-hidden"
        style={{
          backgroundImage: "var(--brand-gradient)",
        }}
      >
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,white,transparent_45%),radial-gradient(circle_at_80%_70%,white,transparent_40%)]" />
        <div className="relative mx-auto max-w-6xl px-6 py-16 md:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Copy */}
            <div className="text-center lg:text-left">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Free prompt · copy &amp; paste
              </span>
              <h1 className="mt-6 text-4xl font-extrabold leading-tight text-white md:text-5xl">
                The Master AI&nbsp;Studio SEO Prompt
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-white/90 lg:mx-0">
                Paste one prompt into AI Studio and it turns into a{" "}
                <strong className="font-semibold text-white">
                  senior technical SEO engineer
                </strong>
                . It audits your whole site, fixes what's blocking you from ranking, and
                explains every change in plain English — starting the second you paste it.
              </p>
              <ul className="mx-auto mt-6 max-w-xl space-y-2 text-left text-sm text-white/85 lg:mx-0">
                {[
                  "Full SEO audit of every page — done in minutes, not weeks",
                  "Titles, meta descriptions and headings rewritten to rank",
                  "Gets your site read by Google AND AI answer engines",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-white" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-col items-center gap-3 lg:items-start">
                <Button
                  asChild
                  size="lg"
                  className="w-full min-h-[52px] bg-white px-8 text-base font-semibold text-[hsl(var(--pricing-accent))] hover:bg-white/90 sm:w-auto"
                >
                  <a href={signupHref}>
                    Get the free prompt
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </a>
                </Button>
                <p className="text-xs text-white/75">
                  Already a member?{" "}
                  <Link
                    to={loginHref}
                    className="font-semibold text-white underline underline-offset-2"
                  >
                    Log in
                  </Link>
                </p>
              </div>
            </div>

            {/* Prompt preview card */}
            <div className="relative mx-auto w-full max-w-md">
              <div className="rounded-2xl bg-white/10 p-2 shadow-2xl backdrop-blur">
                <div className="overflow-hidden rounded-xl bg-[hsl(var(--pricing-premium))] shadow-inner">
                  <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--heart))]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--offer))]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--success))]" />
                    <span className="ml-2 text-xs font-medium text-white/60">
                      AI Studio — new chat
                    </span>
                  </div>
                  <div className="space-y-3 px-4 py-5 font-mono text-[13px] leading-relaxed">
                    <p className="text-white/50">You pasted:</p>
                    <div className="rounded-lg border border-[hsl(var(--webinar-accent))]/40 bg-[hsl(var(--webinar-accent))]/10 p-3 text-white/90">
                      <p className="font-sans text-xs font-semibold uppercase tracking-wide text-[hsl(var(--webinar-accent-bright))]">
                        The Master SEO Prompt
                      </p>
                      <p className="mt-1">
                        "You are a senior technical SEO engineer. Your job is to make this
                        site fully crawlable and indexable by Google, Bing and AI answer
                        engines…"
                      </p>
                    </div>
                    <p className="text-white/50">AI Studio replies:</p>
                    <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-white/80">
                      <p>
                        ✓ Found <span className="text-[hsl(var(--offer))] font-semibold">14 pages</span> missing
                        meta descriptions
                      </p>
                      <p>
                        ✓ Sitemap, robots.txt &amp; canonical tags{" "}
                        <span className="text-[hsl(var(--success))] font-semibold">fixed</span>
                      </p>
                      <p>
                        ✓ Ready for Google + ChatGPT, Claude &amp; Perplexity{" "}
                        <span className="text-[hsl(var(--webinar-accent-bright))] font-semibold">
                          to read you
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-[hsl(var(--pricing-accent))] shadow-lg">
                That's the whole setup — paste &amp; go
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 3 steps ===== */}
      <section className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
            Three steps. About 30 seconds.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-gray-600">
            No SEO experience needed. If you can copy and paste, you can run this.
          </p>
        </div>
        <ul className="mt-10 grid gap-5 md:grid-cols-3">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <li
                key={step.title}
                className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: step.accent }}
                  >
                    {i + 1}
                  </span>
                  <Icon className="h-5 w-5" style={{ color: step.accent }} aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{step.body}</p>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ===== What the prompt does ===== */}
      <section className="bg-gray-50 py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--pricing-accent))]/30 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--pricing-accent))]">
              <Zap className="h-3.5 w-3.5" aria-hidden="true" />
              What the prompt actually does
            </span>
            <h2 className="mt-4 text-2xl font-bold text-gray-900 md:text-3xl">
              A full SEO department, from one prompt
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-gray-600">
              This isn't a list of tips. It's the exact brief a senior SEO engineer would
              follow — and AI Studio executes it on your site, phase by phase, with your
              approval at every step.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {WHAT_IT_DOES.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-2xl border border-gray-200 bg-white p-6 transition-colors hover:border-gray-300"
                >
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${item.accent} 10%, white)`,
                      color: item.accent,
                    }}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-semibold text-gray-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">{item.body}</p>
                </div>
              );
            })}
          </div>

          {/* Included / safety card */}
          <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 md:p-8">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <FileSearch className="h-5 w-5 text-[hsl(var(--pricing-accent))]" aria-hidden="true" />
              Built-in guardrails
            </h3>
            <ul className="mt-4 space-y-3">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-gray-700">
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--success))]"
                    aria-hidden="true"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ===== Final CTA ===== */}
      <section
        className="relative overflow-hidden"
        style={{ backgroundImage: "var(--brand-gradient)" }}
      >
        <div className="absolute inset-0 opacity-15 [background-image:radial-gradient(circle_at_70%_30%,white,transparent_50%)]" />
        <div className="relative mx-auto max-w-3xl px-6 py-16 text-center md:py-20">
          <h2 className="text-3xl font-extrabold text-white md:text-4xl">
            Your site should be showing up. Let's fix that today.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/90">
            Grab the Master AI Studio SEO Prompt free with a SaaSSuite community account —
            you'll go straight to it, and you also get our snapshots, courses and prompt
            library.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <Button
              asChild
              size="lg"
              className="w-full min-h-[52px] bg-white px-10 text-base font-semibold text-[hsl(var(--pricing-accent))] hover:bg-white/90 sm:w-auto"
            >
              <a href={signupHref}>Create my free account</a>
            </Button>
            <p className="text-xs text-white/75">
              Free forever · Straight to the prompt — no onboarding · No card needed
            </p>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default SkillLanding;
