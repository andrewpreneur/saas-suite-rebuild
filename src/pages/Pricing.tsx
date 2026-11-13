import { useState, useEffect } from "react";
import { supportSmsUrl } from "@/lib/supportContact";
import { useMetaPixel } from "@/hooks/useMetaPixel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Menu, MessageSquareText, Sparkles } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import AnimatedSection from "@/components/AnimatedSection";
import BumpCheckoutFlow from "@/components/bump/BumpCheckoutFlow";
import Footer from "@/components/Footer";
import TestimonialsCarousel from "@/components/TestimonialsCarousel";
import PageSEO from "@/components/PageSEO";
import { PRICING_FAQS } from "@/config/pageFaqs";
import { buildFaqJsonLd, buildBreadcrumbJsonLd } from "@/lib/seoJsonLd";
import PricingModeToggle from "@/components/pricing/PricingModeToggle";
import AgencyPricingCards from "@/components/pricing/AgencyPricingCards";
import type { PricingMode } from "@/constants/pricingPlans";
import type { CheckoutPlan } from "@/constants/pricingPlans";
import SaasPricingCards from '@/components/pricing/SaasPricingCards';

const SMS_MESSAGE = "Can I learn more about saassuite pricing? I have x clients and want...";


const COST_COMPARISON = [
  {
    feature: 'White-label onboarding software',
    doItYourself: '$15,000–$50,000 upfront',
    saasSuite: 'Included in Advanced',
    fullBuild: 'Included',
  },
  {
    feature: '24/7 customer support coverage',
    doItYourself: '$8,000–$18,000/month',
    saasSuite: 'Support for your team included',
    fullBuild: 'White-label client support included',
  },
  {
    feature: 'Customer onboarding specialist',
    doItYourself: '$3,500–$6,500/month',
    saasSuite: 'Tools and guided experiences included',
    fullBuild: 'Handled for you',
  },
  {
    feature: 'Knowledge base and help center',
    doItYourself: '$100–$500/month',
    saasSuite: 'Included in Advanced',
    fullBuild: 'Included and managed',
  },
  {
    feature: 'Login and onboarding analytics',
    doItYourself: '$150–$600/month',
    saasSuite: 'Included in Advanced',
    fullBuild: 'Included and monitored',
  },
  {
    feature: 'CRM, workflows, and implementation',
    doItYourself: '$1,500–$7,500/project',
    saasSuite: 'Self-managed with SaaSSuite tools',
    fullBuild: 'Built and managed for you',
  },
] as const;

const Pricing = () => {
  useMetaPixel();
  const pageTitle = "Pricing | SaaSSuite HighLevel White Label Tool";
  const pageDescription = "Simple, transparent pricing for SaaSSuite. Find the right plan to white-label and scale your HighLevel agency.";
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<CheckoutPlan | null>(null);
  const { user, session } = useUser();
  const [affiliateId, setAffiliateId] = useState<string | null>(null);
  const [pricingMode, setPricingMode] = useState<PricingMode>('saas');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const amId = params.get('am_id');
    const ref = params.get('ref');
    if (amId) {
      setAffiliateId(amId);
    } else if (ref) {
      setAffiliateId(ref);
      localStorage.setItem('affiliate_ref', ref);
    } else {
      const stored = localStorage.getItem('affiliate_ref') || localStorage.getItem('affiliate_id') || sessionStorage.getItem('affiliate_id');
      if (stored) setAffiliateId(stored);
    }
  }, []);

  return (
    <>
      <PageSEO
        title={pageTitle}
        description={pageDescription}
        path="/pricing"
        jsonLd={[
          buildBreadcrumbJsonLd([{ name: "Pricing", path: "/pricing" }])!,
          buildFaqJsonLd(PRICING_FAQS)!,
        ]}
      />
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <a href="/" className="flex items-center space-x-3">
                  <img src="/lovable-uploads/f3f326f8-20fd-4406-a246-f4b2dbc34614.png" alt="SaaSSuite Logo" className="w-8 h-8" />
                  <h1 className="text-2xl font-bold text-gray-900">SaaSSuite</h1>
                </a>
                <Badge variant="secondary" className="ml-2 hidden sm:inline-flex">HighLevel White-Label Tool</Badge>
              </div>
              <div className="hidden md:flex items-center space-x-3">
                <Button variant="outline" asChild>
                  <a href="/login">Login</a>
                </Button>
                {!(user && session) && (
                  <Button className="bg-purple-600 hover:bg-purple-700 text-white" asChild>
                    <a href="/signup">Get Started</a>
                  </Button>
                )}
              </div>
              <div className="md:hidden">
                <Button variant="outline" size="sm" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2">
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
                {!(user && session) && (
                  <Button className="bg-purple-600 hover:bg-purple-700 text-white w-full justify-start" asChild>
                    <a href="/signup">Get Started</a>
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="container mx-auto px-4 py-16">
          {/* Header */}
          <div className="text-center mb-16">
            <AnimatedSection animation="fade-blur" delay={0.2}>
              <Badge className="mb-6 bg-purple-100 text-purple-700 border-purple-200 text-base px-6 py-2">
                <Sparkles className="w-4 h-4 mr-2" />
                Simple, Transparent Pricing
              </Badge>
            </AnimatedSection>
            <AnimatedSection animation="fade-blur" delay={0.4}>
              <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-purple-700 to-purple-500 bg-clip-text text-transparent">
                Choose Your Plan
              </h1>
            </AnimatedSection>
            <AnimatedSection animation="fade-blur" delay={0.6}>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                All plans include our full suite of white-label tools. Start growing your agency today.
              </p>
            </AnimatedSection>
          </div>

          {/* Pricing Cards */}
          <PricingModeToggle
            value={pricingMode}
            onChange={setPricingMode}
            className="mb-10"
          />

          {pricingMode === 'agency' ? (
            <div className="max-w-6xl mx-auto mb-16">
              <AgencyPricingCards variant="panel" />
            </div>
          ) : (
          <SaasPricingCards className="mx-auto mb-16 max-w-7xl" onSelect={setCheckoutPlan} onStarter={() => { window.location.href = '/signup'; }} />
          )}

          {/* Cost comparison */}
          <AnimatedSection animation="fade-in" className="mb-20">
            <div className="mx-auto max-w-7xl">
              <div className="mx-auto mb-10 max-w-3xl text-center">
                <Badge className="mb-4 bg-pricing/10 text-pricing border-pricing/20">The true cost of doing it yourself</Badge>
                <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">Build a team—or use ours</h2>
                <p className="text-lg text-muted-foreground">
                  Compare typical market costs for separate software, support, and onboarding with one connected service.
                </p>
              </div>

              <div className="hidden overflow-hidden rounded-lg border border-border bg-card shadow-sm md:block">
                <table className="w-full table-fixed text-left">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="w-[25%] p-5 text-sm font-semibold text-foreground">What you need</th>
                      <th className="w-[25%] p-5 text-sm font-semibold text-foreground">Build, hire, and manage yourself</th>
                      <th className="w-[25%] p-5 text-sm font-semibold text-pricing">SaaSSuite Advanced</th>
                      <th className="w-[25%] p-5 text-sm font-semibold text-pricing">Agency Full Build</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {COST_COMPARISON.map((row) => (
                      <tr key={row.feature} className="align-top">
                        <td className="p-5 font-medium text-foreground">{row.feature}</td>
                        <td className="p-5 text-muted-foreground">{row.doItYourself}</td>
                        <td className="p-5 text-foreground"><Check className="mr-2 inline h-4 w-4 text-pricing" />{row.saasSuite}</td>
                        <td className="p-5 text-foreground"><Check className="mr-2 inline h-4 w-4 text-pricing" />{row.fullBuild}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-4 md:hidden">
                {COST_COMPARISON.map((row) => (
                  <div key={row.feature} className="rounded-lg border border-border bg-card p-5 shadow-sm">
                    <h3 className="mb-4 font-semibold text-foreground">{row.feature}</h3>
                    <dl className="space-y-4 text-sm">
                      <div><dt className="font-medium text-muted-foreground">Build, hire, and manage yourself</dt><dd className="mt-1 text-foreground">{row.doItYourself}</dd></div>
                      <div><dt className="font-medium text-pricing">SaaSSuite Advanced</dt><dd className="mt-1 flex gap-2 text-foreground"><Check className="mt-0.5 h-4 w-4 shrink-0 text-pricing" />{row.saasSuite}</dd></div>
                      <div><dt className="font-medium text-pricing">Agency Full Build</dt><dd className="mt-1 flex gap-2 text-foreground"><Check className="mt-0.5 h-4 w-4 shrink-0 text-pricing" />{row.fullBuild}</dd></div>
                    </dl>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Typical market estimates vary by scope, location, staffing level, and provider. SaaSSuite pricing is shown in the plans above.
              </p>
            </div>
          </AnimatedSection>

          {/* Testimonials */}
          <AnimatedSection animation="fade-in" className="mb-20">
            <div id="testimonials-section" className="mx-auto max-w-6xl">
              <div className="mb-8 text-center">
                <h2 className="text-3xl font-bold text-foreground md:text-4xl">Agencies love SaaSSuite</h2>
                <p className="mt-3 text-lg text-muted-foreground">See what agency owners say about running support and onboarding with SaaSSuite.</p>
              </div>
              <TestimonialsCarousel />
            </div>
          </AnimatedSection>

          {/* FAQ Section */}
          <div id="faq-section">
            <AnimatedSection animation="fade-in">
              <div className="bg-white rounded-xl p-8 shadow-sm border mb-16">
                <h2 className="text-3xl font-bold text-gray-900 text-center mb-8">Frequently Asked Questions</h2>
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">What is SaaSSuite?</h3>
                    <p className="text-gray-600 mb-4">SaaSSuite is a comprehensive tool designed to enhance and customize your HighLevel experience with white-label capabilities.</p>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Do I need HighLevel to use this?</h3>
                    <p className="text-gray-600 mb-4">Yes, SaaSSuite is designed to work with your existing HighLevel account to provide additional customization and features.</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Is there a setup fee?</h3>
                    <p className="text-gray-600 mb-4">No setup fees! You only pay the monthly or yearly subscription fee with instant access after payment.</p>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Can I cancel anytime?</h3>
                    <p className="text-gray-600 mb-4">Absolutely! You can cancel your subscription at any time without any penalties or hidden fees.</p>
                  </div>
                </div>
              </div>
            </AnimatedSection>
          </div>

          {/* Text CTA */}
          <AnimatedSection animation="scale-in" className="text-center py-12 mb-16">
            <div className="mx-auto max-w-4xl rounded-lg border border-pricing/20 bg-pricing/5 p-8 md:p-12">
              <MessageSquareText className="mx-auto mb-4 h-9 w-9 text-pricing" />
              <h2 className="mb-3 text-3xl font-bold text-foreground">Have a question?</h2>
              <p className="mx-auto mb-6 max-w-xl text-muted-foreground">Text us and a representative will respond right away to help you choose the right service.</p>
              <Button
                asChild
                size="lg"
                className="bg-pricing text-pricing-foreground hover:bg-pricing-hover"
              >
                <a href={supportSmsUrl(SMS_MESSAGE)} aria-label="Text us">
                  <MessageSquareText className="mr-2 h-5 w-5" />
                  Text Us
                </a>
              </Button>

            </div>
          </AnimatedSection>

          <Footer />
        </div>

        {/* Stripe Embedded Checkout */}
        <BumpCheckoutFlow
          plan={checkoutPlan || "basic"}
          open={!!checkoutPlan}
          onOpenChange={(open) => { if (!open) setCheckoutPlan(null); }}
          email={user?.email || undefined}
          affiliateId={affiliateId}
        />
      </div>
    </>
  );
};

export default Pricing;
