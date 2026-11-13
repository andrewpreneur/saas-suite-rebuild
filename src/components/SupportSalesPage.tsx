import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Menu,
  ShieldCheck,
  Users,
} from "lucide-react";
import AnimatedSection from "./AnimatedSection";
import CustomVideoPlayer from "./CustomVideoPlayer";
import TestimonialsCarousel from "./TestimonialsCarousel";
import VideoTestimonialsSection from "./VideoTestimonialsSection";
import TestimonialsPager from "./TestimonialsPager";
import BumpCheckoutFlow from "./bump/BumpCheckoutFlow";
import SupportWinsSection from "./support/SupportWinsSection";
import supportVideo from "@/assets/support-hero.mp4.asset.json";
import supportPoster from "@/assets/support-hero-poster.jpg.asset.json";
import BillingCycleToggle from './pricing/BillingCycleToggle';
import { SAAS_PLANS, checkoutPlanFor, type BillingCycle, type CheckoutPlan } from '@/constants/pricingPlans';
import PlanFeatureLabel from '@/components/pricing/PlanFeatureLabel';

const ADVANCED_FEATURES = SAAS_PLANS.advanced.features;
const ENHANCED_FEATURES = SAAS_PLANS.premium.features;

const FAQS = [
  {
    q: "Will you build things for my customers? Websites? Automations?",
    a: "That's Agency Support — our white-glove fulfillment tier where we build websites, automations, and workflows for your customers. It's $1,000-$3,000/month depending on how many accounts you have.",
    cta: { label: "See Agency Support pricing", href: "/#pricing" },
  },
  {
    q: "Will you open tickets on our behalf?",
    a: "Yes! Just make sure we're in the sub-account and we'll open and manage tickets for your customers.",
  },
  {
    q: "How fast is human support?",
    a: "Within US hours, support is typically under 1 hour — average responses land within 10 minutes. Outside US hours, responses can take up to 12 hours. Our team is entirely US-based and HighLevel certified, so you're getting the best of the best. We may not always be the fastest, but we solve problems faster than any overseas team.",
  },
];

const SupportSalesPage = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<CheckoutPlan | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('annual');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const afterVideoRef = useRef<HTMLDivElement>(null);

  // Meta Pixel is loaded once globally in index.html; PageView fires via MetaPixelRouteTracker.

  const handleEnded = () => {
    afterVideoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <a href="/" className="flex items-center space-x-3">
                <img src="/lovable-uploads/f3f326f8-20fd-4406-a246-f4b2dbc34614.png" alt="SaaSSuite logo" className="w-8 h-8" />
                <span className="text-2xl font-bold text-gray-900">SaaSSuite</span>
              </a>
              <Badge variant="secondary" className="ml-2 hidden sm:inline-flex">AI + Human Support</Badge>
            </div>
            <div className="hidden md:flex items-center space-x-3">
              <Button variant="outline" asChild>
                <a href="/login">Login</a>
              </Button>
              <Button className="bg-purple-600 hover:bg-purple-700 text-white" onClick={() => setCheckoutPlan(checkoutPlanFor('advanced', billingCycle))}>
                Get support
              </Button>
            </div>
            <div className="md:hidden">
              <Button variant="outline" size="sm" aria-label="Open menu" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2">
                <Menu className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="max-w-6xl mx-auto px-6 py-4 space-y-2">
              <Button variant="outline" asChild className="w-full justify-start">
                <a href="/login">Login</a>
              </Button>
              <Button className="bg-purple-600 hover:bg-purple-700 text-white w-full justify-start" onClick={() => setCheckoutPlan(checkoutPlanFor('advanced', billingCycle))}>
                Get support
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Hero */}
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
        <div className="text-center">
          <AnimatedSection animation="fade-in" delay={200}>
            <div className="mb-6 flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-purple-100 px-5 py-2 text-sm font-semibold uppercase tracking-wider text-purple-700 ring-1 ring-purple-200 shadow-sm">
                GHL Agency Owner
              </span>
            </div>
          </AnimatedSection>

          <h1 className="mb-2 text-4xl sm:text-6xl font-bold text-gray-900 text-center">
            <span className="inline-block opacity-0" style={{ animation: "fadeInFromBlur 0.6s ease-out 0.4s forwards" }}>
              The Easiest 24/7 Chat Support For Your GHL SaaS
            </span>
          </h1>

          <div className="opacity-0" style={{ animation: "fadeInFromBlur 0.6s ease-out 1s forwards" }}>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Your customers ask for it. You don't have it.{"\u00a0"}
              <br />
              Implemented in 2,000+ accounts. 96% satisfaction.
            </p>
          </div>

          {/* Hero video */}
          <div className="opacity-0" style={{ animation: "fadeInFromBlur 0.6s ease-out 1.15s forwards" }}>
            <CustomVideoPlayer
              src={supportVideo.url}
              poster={supportPoster.url}
              videoId="support-hero-video"
              onEnded={handleEnded}
            />
          </div>

          <div className="opacity-0" style={{ animation: "fadeInFromBlur 0.6s ease-out 1.3s forwards" }}>
            <div className="mt-8 mb-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                className="text-lg px-8 py-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl font-semibold shadow-[0_4px_14px_0_rgba(147,51,234,0.3)] transition-all duration-200 flex items-center gap-2"
                onClick={() => setCheckoutPlan(checkoutPlanFor('advanced', billingCycle))}
              >
                Get support
                <ArrowRight className="w-5 h-5" />
              </Button>
              <Button
                size="lg"
                className="text-lg px-8 py-4 bg-gray-800 hover:bg-gray-900 text-white rounded-xl font-semibold transition-all duration-200 flex items-center gap-2"
                onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
              >
                See pricing
                <ArrowRight className="w-5 h-5" />
              </Button>
            </div>
            <div className="mb-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-gray-700">
              <span className="flex items-center gap-2"><Users className="w-5 h-5" /> Trusted by 2000+ sub accounts</span>
              <span className="flex items-center gap-2"><ShieldCheck className="w-5 h-5" /> 100% US-based, HighLevel certified</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile testimonials (above pricing) */}
      <div className="md:hidden">
        <TestimonialsPager />
      </div>

      {/* Pricing */}
      <div ref={afterVideoRef} id="pricing" className="max-w-5xl mx-auto px-6 py-16 scroll-mt-24">
        <AnimatedSection animation="fade-in">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Simple support pricing</h2>
          </div>
          <BillingCycleToggle value={billingCycle} onChange={setBillingCycle} className="mb-10" />
        </AnimatedSection>

        <div className="grid md:grid-cols-2 gap-6 items-start">
          <div className="bg-white rounded-2xl border-2 border-purple-300 p-8 shadow-lg">
            <Badge className="mb-4 bg-purple-100 text-purple-700 border-purple-200">Most popular</Badge>
            <h3 className="text-2xl font-bold text-gray-900">Advanced</h3>
            <div className="mt-2 mb-1 flex items-baseline gap-1">
              <span className="text-5xl font-bold text-foreground">${billingCycle === 'annual' ? SAAS_PLANS.advanced.annualTotal?.toLocaleString('en-US') : SAAS_PLANS.advanced.monthlyPrice}</span>
              <span className="text-lg font-semibold text-foreground">{billingCycle === 'annual' ? '/year' : '/month'}</span>
            </div>
            <p className="text-xs text-muted-foreground">{billingCycle === 'annual' ? 'Billed in full yearly · Auto-renews yearly' : 'Billed monthly · Auto-renews monthly'}</p>
            {billingCycle === 'annual' && <p className="mt-1 text-xs text-muted-foreground">Equivalent to ${SAAS_PLANS.advanced.annualMonthlyEquivalent}/month</p>}
             <p className="text-gray-600 mb-6">AI support, onboarding, and the full SaaSSuite platform.</p>
            <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white" size="lg" onClick={() => setCheckoutPlan(checkoutPlanFor('advanced', billingCycle))}>
              Subscribe
            </Button>
            <ul className="mt-6 space-y-3">
              {ADVANCED_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-3 text-gray-700">
                  <Check className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                  <PlanFeatureLabel feature={f} />
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8 shadow-lg">
             <Badge className="mb-4 bg-white/10 text-white border-white/20">RECOMMENDED · Premium Support</Badge>
             <h3 className="text-2xl font-bold text-white">Advanced + Premium Support</h3>
            <div className="mt-2 mb-1 flex items-baseline gap-1">
               <span className="text-5xl font-bold text-pricing-premium-foreground">${billingCycle === 'annual' ? SAAS_PLANS.premium.annualTotal?.toLocaleString('en-US') : SAAS_PLANS.premium.monthlyPrice}</span>
              <span className="text-lg font-semibold text-pricing-premium-foreground">{billingCycle === 'annual' ? '/year' : '/month'}</span>
            </div>
            <p className="text-xs text-pricing-premium-foreground/70">{billingCycle === 'annual' ? 'Billed in full yearly · Auto-renews yearly' : 'Billed monthly · Auto-renews monthly'}</p>
            {billingCycle === 'annual' && <p className="mt-1 text-xs text-pricing-premium-foreground/70">Equivalent to ${SAAS_PLANS.premium.annualMonthlyEquivalent}/month</p>}
             <p className="text-gray-300 mb-6">Add human handover, customer ticket management, Slack access, and priority escalation.</p>
            <Button className="w-full bg-white text-gray-900 hover:bg-gray-100" size="lg" onClick={() => setCheckoutPlan(checkoutPlanFor('premium', billingCycle))}>
               Subscribe
            </Button>
             <div className="mt-6 border-t border-white/20 pt-5">
               <p className="font-semibold text-white">Premium add-ons</p>
             </div>
             <ul className="mt-4 space-y-3">
              {ENHANCED_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-3 text-gray-100">
                  <Check className="w-5 h-5 text-purple-300 shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Testimonials */}
      <VideoTestimonialsSection />

      {/* Real support conversations, live from the database */}
      <SupportWinsSection />



      {/* US team */}
      <div className="max-w-4xl mx-auto px-6 pb-4">
        <AnimatedSection animation="fade-in">
          <div className="rounded-2xl bg-white border border-gray-200 p-8 text-center shadow-sm">
            <ShieldCheck className="w-10 h-10 text-purple-600 mx-auto mb-3" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">A 100% US-based support team</h2>
            <p className="text-gray-600">
              Every support member on our team is based inside the United States and is HighLevel certified. Your customers talk to real,
              certified experts — never an overseas call center.
            </p>
          </div>
        </AnimatedSection>
      </div>

      {/* Testimonials carousel (spaced away from video testimonials) */}
      <div className="max-w-6xl mx-auto px-6 py-12 hidden md:block">
        <TestimonialsCarousel />
      </div>

      {/* FAQ */}
      <div className="max-w-3xl mx-auto px-6 pb-20">
        <AnimatedSection animation="fade-in">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-8">Frequently asked questions</h2>
        </AnimatedSection>
        <div className="space-y-3">
          {FAQS.map((item, i) => {
            const isOpen = openFaq === i;
            return (
              <div key={i} className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between gap-4 text-left px-5 py-4 min-h-[56px]"
                >
                  <span className="font-semibold text-gray-900">{item.q}</span>
                  <ChevronDown className={`w-5 h-5 shrink-0 text-gray-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                </button>
                <div className={`grid transition-all duration-300 ease-out ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                  <div className="overflow-hidden">
                    <div className="px-5 pb-5 text-gray-600">
                      <p>{item.a}</p>
                      {item.cta && (
                        <Button variant="outline" className="mt-4" asChild>
                          <a href={item.cta.href}>{item.cta.label}</a>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 text-center text-gray-600">
          <p>&copy; {new Date().getFullYear()} SaaSSuite. All rights reserved.</p>
          <Button variant="link" className="text-blue-600 hover:text-blue-800" asChild>
            <a href="/book">Need help? Book a call</a>
          </Button>
        </div>
      </div>

      {checkoutPlan && (
        <BumpCheckoutFlow
          plan={checkoutPlan}
          open={!!checkoutPlan}
          onOpenChange={(v) => { if (!v) setCheckoutPlan(null); }}
        />
      )}

      {/* Fixed Help Button */}
      <button
        onClick={() => window.open('https://flowto.it/e9x57Mdihx?fc=0', '_blank')}
        className="fixed bottom-6 right-6 bg-purple-600 text-white rounded-full w-16 h-16 shadow-lg hover:bg-purple-700 transition-all flex items-center justify-center z-50"
        aria-label="Get help"
      >
        <span className="text-2xl font-bold">?</span>
      </button>

      <style>{`
        @keyframes fadeInFromBlur {
          0% { opacity: 0; filter: blur(8px); transform: translateY(16px); }
          100% { opacity: 1; filter: blur(0px); transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="fadeInFromBlur"] { animation: none !important; opacity: 1 !important; }
        }
      `}</style>
    </div>
  );
};

export default SupportSalesPage;
