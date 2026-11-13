import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowRight, ArrowDown, Check, Play, Shield, Star, Lock } from "lucide-react";
import PageSEO from "@/components/PageSEO";
import Footer from "@/components/Footer";
import TestimonialsCarousel from "@/components/TestimonialsCarousel";
import CourseCheckout from "@/components/course/CourseCheckout";
import type { CourseConfig } from "@/config/courses";
import saassuiteLogo from "@/assets/saassuitelogo-dark.png";

const HERO_POSTER =
  "https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/69ce0b2e66c8fcfd16f88de4.gif";
const HERO_VIDEO =
  "https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/6a1251673c3aed7c639fbc38.mp4";

interface CourseSalesPageProps {
  course: CourseConfig;
}

/**
 * Shared sales-page template for the one-time $27 digital courses.
 * Structure follows the layout that converts best across our paid pages:
 * hook → hero video → CTA → stakes → what's inside → proof → price → guarantee.
 */
const CourseSalesPage = ({ course }: CourseSalesPageProps) => {
  const [email, setEmail] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const videoId = `course-video-${course.key}`;

  const scrollToOffer = () =>
    document.getElementById("offer")?.scrollIntoView({ behavior: "smooth" });

  const words = course.headline.split(" ");

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <PageSEO
        title={course.seo.title}
        description={course.seo.description}
        path={course.path}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Course",
          name: course.cardTitle,
          description: course.seo.description,
          provider: { "@type": "Organization", name: "SaaSSuite", url: "https://saassuite.ai" },
          offers: {
            "@type": "Offer",
            price: "27.00",
            priceCurrency: "USD",
            category: "OneTimePurchase",
            availability: "https://schema.org/InStock",
          },
        }}
      />

      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a href="/" className="flex items-center gap-3">
            <img src={saassuiteLogo} alt="SaaSSuite" className="h-8 w-8 rounded-md" />
            <span className="text-2xl font-bold text-gray-900">SaaSSuite</span>
          </a>
          <Button
            className="bg-purple-600 text-white hover:bg-purple-700"
            onClick={scrollToOffer}
            aria-label={`${course.key}-header-cta`}
            data-track-click
          >
            Get instant access
          </Button>
        </div>
      </header>

      {/* Hero (same hero-bg graphic as the home page) */}
      <div
        className="relative mx-auto px-6 py-12"
        style={{
          maxWidth: "1024px",
          backgroundImage: "url(/assets/hero-bg.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          borderBottomLeftRadius: "25px",
          borderBottomRightRadius: "25px",
        }}
      >
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              {course.eyebrow}
            </span>
          </div>

          <h1 className="mb-4 text-4xl font-bold text-gray-900 sm:text-6xl sm:leading-[1.05]">
            {words.map((w, i) => (
              <span
                key={i}
                className="mr-2 inline-block opacity-0 sm:mr-3"
                style={{ animation: `fadeInFromBlur 0.6s ease-out ${0.08 * i}s forwards` }}
              >
                {w}
              </span>
            ))}
          </h1>

          <p className="mx-auto mb-8 max-w-2xl text-lg text-gray-600 sm:text-xl">{course.subhead}</p>

          {/* Hero video */}
          <div className="mx-auto mb-8 max-w-2xl">
            <div className="group relative overflow-hidden rounded-xl bg-black shadow-2xl">
              <video
                id={videoId}
                controls
                poster={HERO_POSTER}
                className="aspect-video w-full"
                preload="metadata"
                onPlay={() => setIsVideoPlaying(true)}
                onPause={() => setIsVideoPlaying(false)}
                onEnded={() => setIsVideoPlaying(false)}
              >
                <source src={HERO_VIDEO} type="video/mp4" />
              </video>
              {!isVideoPlaying && (
                <button
                  onClick={() => (document.getElementById(videoId) as HTMLVideoElement)?.play()}
                  className="absolute inset-0 z-10 flex cursor-pointer items-center justify-center"
                  aria-label="Play video"
                >
                  <span
                    className="flex h-14 w-14 items-center justify-center rounded-full transition-all duration-300 hover:scale-110"
                    style={{ backgroundColor: "#5E16EA" }}
                  >
                    <Play className="ml-0.5 h-6 w-6 text-white" fill="white" />
                  </span>
                </button>
              )}
            </div>
          </div>

          <div className="mx-auto max-w-md space-y-3">
            <Button
              size="lg"
              onClick={scrollToOffer}
              aria-label={`${course.key}-hero-cta`}
              data-track-click
              className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-purple-700 py-6 text-lg font-semibold text-white shadow-[0_4px_14px_0_rgba(147,51,234,0.3)] transition-all hover:from-purple-700 hover:to-purple-800"
            >
              {course.ctaLabel}
              <ArrowRight className="h-5 w-5" />
            </Button>
            <p className="text-sm font-medium text-gray-700">{course.promise}</p>
          </div>
        </div>
      </div>

      {/* Who it's for */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <h2 className="mb-8 text-center text-3xl font-bold text-gray-900 sm:text-4xl">
          Read this if any of it sounds like you
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {course.forWho.map((item, i) => (
            <div key={i} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <Check className="mb-3 h-5 w-5 text-purple-600" />
              <p className="text-sm text-gray-700">{item}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Button
            size="lg"
            variant="outline"
            onClick={scrollToOffer}
            aria-label={`${course.key}-midpage-cta`}
            data-track-click
            className="rounded-full border-gray-300 px-8 py-6 text-base"
          >
            Start today for $27
          </Button>
        </div>
      </section>

      {/* What's inside */}
      <section className="bg-gradient-to-b from-gray-100/80 to-gray-50 py-16">
        <div className="mx-auto max-w-4xl px-6">
          <div className="mb-10 text-center">
            <h2 className="mb-3 text-3xl font-bold text-gray-900 sm:text-4xl">What's included</h2>
            <p className="text-gray-600">Everything below is delivered the moment you buy.</p>
          </div>
          <div className="space-y-4">
            {course.includes.map((item, i) => (
              <div
                key={i}
                className="flex gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.08)]"
              >
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 text-sm font-bold text-purple-700">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-gray-900">{item.title}</h3>
                  <p className="mt-1 text-sm text-gray-600">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Proof */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-6 flex items-center justify-center gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
          ))}
        </div>
        <TestimonialsCarousel />
      </section>

      {/* Offer */}
      <section id="offer" className="bg-gradient-to-b from-gray-50 to-gray-100/80 py-16">
        <div className="mx-auto max-w-md px-6">
          <div className="mb-8 text-center">
            <h2 className="mb-3 text-3xl font-bold text-gray-900 sm:text-4xl">One payment. Yours forever.</h2>
            <div className="flex justify-center">
              <ArrowDown className="h-7 w-7 animate-bounce text-purple-600" />
            </div>
          </div>

          <div className="rounded-2xl border-2 border-purple-500 bg-white p-8 shadow-[0_8px_32px_-4px_rgba(129,37,211,0.25)]">
            <h3 className="text-2xl font-semibold text-gray-900">{course.cardTitle}</h3>
            <p className="mb-4 text-sm text-gray-500">{course.cardSubtitle}</p>
            <div className="mb-6 flex items-baseline gap-2">
              <span className="text-6xl font-bold text-gray-900">$27</span>
              <span className="text-gray-500">one time</span>
            </div>

            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your best email"
              className="mb-3 rounded-xl py-6 text-center"
            />
            <Button
              className="mb-4 w-full rounded-xl bg-[#8125D3] py-6 text-base text-white hover:bg-[#6f1fb5]"
              onClick={() => setCheckoutOpen(true)}
              aria-label={`${course.key}-offer-cta`}
              data-track-click
            >
              {course.ctaLabel}
            </Button>
            <p className="mb-6 flex items-center justify-center gap-1.5 text-xs text-gray-500">
              <Lock className="h-3 w-3" /> Secure checkout by Stripe
            </p>

            <div className="space-y-3">
              {course.includes.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#8125D3]" />
                  <span className="text-sm text-gray-700">{item.title}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Guarantee */}
          <div className="mt-8 rounded-2xl border border-green-200 bg-green-50 p-6">
            <div className="mb-2 flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-700" />
              <h3 className="font-bold text-green-900">{course.guarantee.headline}</h3>
            </div>
            <p className="text-sm text-green-900/80">{course.guarantee.body}</p>
            {course.guarantee.terms && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-green-900/70">
                  Terms — you have to prove you:
                </p>
                <ul className="space-y-1.5">
                  {course.guarantee.terms.map((t, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-green-900/80">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-700" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="mt-8 flex justify-center">
            <Badge
              variant="secondary"
              className="border-blue-200 bg-blue-50 px-6 py-2 text-base text-blue-700"
            >
              Instant access · No subscription
            </Badge>
          </div>
        </div>
      </section>

      <CourseCheckout
        course={course.key}
        title={course.cardTitle}
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        email={email.trim().toLowerCase() || undefined}
      />

      <Footer />
    </div>
  );
};

export default CourseSalesPage;
