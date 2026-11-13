import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Star, Crown, Phone, Menu, ArrowRight, Sparkles, Shield, CheckCircle } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import AnimatedSection from "@/components/AnimatedSection";
import FanbasisEmbeddedCheckout from "@/components/FanbasisEmbeddedCheckout";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import PlanFeatureLabel from "@/components/pricing/PlanFeatureLabel";
import { SAME_DAY_WL_SUPPORT } from "@/constants/pricingPlans";

const FANBASIS_PRODUCT_IDS = {
  basic: "Exvo0",
  advanced: "G8xq8",
  annual: "Exvo0", // using basic for annual until a separate annual product is created
};

const FANBASIS_CREATOR_ID = "saassuite";

const PricingDummy = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [checkoutProduct, setCheckoutProduct] = useState<keyof typeof FANBASIS_PRODUCT_IDS | null>(null);
  const { user, session } = useUser();

  const basicFeatures = [
    "25+ brandless onboarding videos",
    "Custom video uploads",
    "Custom checklists",
    "Support ticketing",
    "White label branding tool",
    "Video visibility toggles",
    "AI Offer & Ads tool",
    "Auto-redirect to onboarding on login",
    "Up to 5 users",
  ];

  const advancedFeatures = [
    "Everything in Basic",
    "3 custom SaaS plan onboarding experiences",
    "SaaS Health Dashboard",
    "Login & onboarding tracking",
    "Unlimited custom AI support bots",
    "AI marketing suite",
    "1:1 support",
    SAME_DAY_WL_SUPPORT,
    "Unlimited users",
  ];

  const yearlyBonuses = [
    { name: "1000+ Niched B2B Leads", value: "$2,997" },
    { name: "Human-Powered Email Warmup", value: "$497" },
    { name: "My 6-Email-System Snapshot", value: "$197" },
    { name: "Exclusive WLS Discount for Hyper-Qualified Leads", value: "$997" },
  ];

  return (
    <>
      <SEO
        title="Pricing Plans (Test) - SaaSSuite"
        description="Test pricing page with Fanbasis checkout."
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
                <Badge variant="secondary" className="ml-2 hidden sm:inline-flex">TEST - Fanbasis Checkout</Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-16">
          <div className="text-center mb-16">
            <AnimatedSection animation="fade-blur" delay={0.2}>
              <Badge className="mb-6 bg-orange-100 text-orange-700 border-orange-200 text-base px-6 py-2">
                ⚠️ TEST PAGE - Fanbasis Checkout
              </Badge>
            </AnimatedSection>
            <AnimatedSection animation="fade-blur" delay={0.4}>
              <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-purple-700 to-purple-500 bg-clip-text text-transparent">
                Choose Your Plan
              </h1>
            </AnimatedSection>
            <AnimatedSection animation="fade-blur" delay={0.6}>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                This is a test page using Fanbasis embedded checkout.
              </p>
            </AnimatedSection>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
            {/* Basic Plan */}
            <AnimatedSection animation="fade-in" delay={0.2}>
              <Card className="relative h-full hover:shadow-xl transition-all duration-300 border-2 hover:border-purple-200">
                <CardHeader className="text-center pb-6">
                  <div className="flex justify-center mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center">
                      <Star className="h-7 w-7 text-purple-600" />
                    </div>
                  </div>
                  <CardTitle className="text-2xl">Basic</CardTitle>
                  <CardDescription>Perfect for getting started</CardDescription>
                  <div className="mt-4">
                    <span className="text-5xl font-bold text-gray-900">$27</span>
                    <span className="text-gray-500">/month</span>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col flex-1">
                  <ul className="space-y-3 mb-8 flex-1">
                    {basicFeatures.map((feature, index) => (
                      <li key={index} className="flex items-center gap-3">
                        <Check className="h-4 w-4 text-purple-600 flex-shrink-0" />
                        <PlanFeatureLabel feature={feature} className="text-sm text-gray-700" />
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                    size="lg"
                    onClick={() => setCheckoutProduct("basic")}
                  >
                    Get Started
                  </Button>
                </CardContent>
              </Card>
            </AnimatedSection>

            {/* Yearly Plan */}
            <AnimatedSection animation="fade-in" delay={0.4}>
              <Card className="relative h-full hover:shadow-2xl transition-all duration-300 border-2 border-purple-500 shadow-lg shadow-purple-100">
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-4 py-1 shadow-md">
                    <Crown className="w-3 h-3 mr-1" /> Best Value
                  </Badge>
                </div>
                <CardHeader className="text-center pb-6">
                  <div className="flex justify-center mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center">
                      <Crown className="h-7 w-7 text-white" />
                    </div>
                  </div>
                  <CardTitle className="text-2xl">Annual</CardTitle>
                  <CardDescription>Save big + exclusive bonuses</CardDescription>
                  <div className="mt-4">
                    <div className="inline-block bg-red-100 text-red-600 px-3 py-1 rounded-md mb-2">
                      <span className="text-sm font-semibold line-through">$1,164/year</span>
                    </div>
                    <div>
                      <span className="text-5xl font-bold text-gray-900">$970</span>
                      <span className="text-gray-500">/year</span>
                    </div>
                    <div className="text-sm text-purple-600 font-semibold mt-2">
                      Save $194 vs monthly
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col flex-1">
                  <ul className="space-y-3 mb-6 flex-1">
                    {advancedFeatures.map((feature, index) => (
                      <li key={index} className="flex items-center gap-3">
                        <Check className="h-4 w-4 text-purple-600 flex-shrink-0" />
                        <PlanFeatureLabel feature={feature} className="text-sm text-gray-700" />
                      </li>
                    ))}
                  </ul>
                  <div className="bg-purple-50 rounded-xl p-4 mb-6 border border-purple-200">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      <span className="font-bold text-sm text-purple-700">EXCLUSIVE BONUSES</span>
                    </div>
                    <div className="space-y-2">
                      {yearlyBonuses.map((bonus, index) => (
                        <div key={index} className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 flex-1">
                            <CheckCircle className="w-3.5 h-3.5 text-purple-500 mt-0.5 flex-shrink-0" />
                            <span className="text-xs text-gray-700">{bonus.name}</span>
                          </div>
                          <span className="text-xs font-bold text-purple-600 whitespace-nowrap">{bonus.value}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-purple-200 text-center">
                      <span className="text-sm font-bold text-purple-700">Over $4,600+ in bonuses</span>
                    </div>
                  </div>
                  <Button
                    className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-[0_4px_14px_0_rgba(147,51,234,0.3)]"
                    size="lg"
                    onClick={() => setCheckoutProduct("annual")}
                  >
                    Claim Your Offer
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            </AnimatedSection>

            {/* Advanced Plan */}
            <AnimatedSection animation="fade-in" delay={0.6}>
              <Card className="relative h-full hover:shadow-xl transition-all duration-300 border-2 hover:border-purple-200">
                <CardHeader className="text-center pb-6">
                  <div className="flex justify-center mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center">
                      <Sparkles className="h-7 w-7 text-purple-600" />
                    </div>
                  </div>
                  <CardTitle className="text-2xl">Advanced</CardTitle>
                  <CardDescription>Full power, monthly billing</CardDescription>
                  <div className="mt-4">
                    <span className="text-5xl font-bold text-gray-900">$97</span>
                    <span className="text-gray-500">/month</span>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col flex-1">
                  <ul className="space-y-3 mb-8 flex-1">
                    {advancedFeatures.map((feature, index) => (
                      <li key={index} className="flex items-center gap-3">
                        <Check className="h-4 w-4 text-purple-600 flex-shrink-0" />
                        <PlanFeatureLabel feature={feature} className="text-sm text-gray-700" />
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                    size="lg"
                    onClick={() => setCheckoutProduct("advanced")}
                  >
                    Get Started
                  </Button>
                </CardContent>
              </Card>
            </AnimatedSection>
          </div>

          <Footer />
        </div>

        {/* Fanbasis Embedded Checkout */}
        {checkoutProduct && (
          <FanbasisEmbeddedCheckout
            productId={FANBASIS_PRODUCT_IDS[checkoutProduct]}
            creatorId={FANBASIS_CREATOR_ID}
            open={!!checkoutProduct}
            onOpenChange={(open) => { if (!open) setCheckoutProduct(null); }}
            label={`Checkout – ${checkoutProduct === "basic" ? "Basic" : checkoutProduct === "annual" ? "Annual" : "Advanced"} Plan`}
          />
        )}
      </div>
    </>
  );
};

export default PricingDummy;
