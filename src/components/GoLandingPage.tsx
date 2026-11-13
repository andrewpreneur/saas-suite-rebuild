import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { signInWithStoreProvider } from "@/lib/nativeOAuth";
import { useUser } from "@/contexts/UserContext";
import { toast } from "sonner";
import { ArrowRight, ArrowDown, Check, User, Play, Loader2, Menu, Star, Shield, CheckCircle } from "lucide-react";
import BumpCheckoutFlow from "@/components/bump/BumpCheckoutFlow";
import { navigateWithParams } from "@/utils/preserveParams";
import Footer from "./Footer";
import TestimonialsCarousel from "./TestimonialsCarousel";
import VideoTestimonialsSection from "./VideoTestimonialsSection";
import saassuiteLogo from "@/assets/saassuitelogo-dark.png";
import { SAME_DAY_WL_SUPPORT } from "@/constants/pricingPlans";
import PlanFeatureLabel from "@/components/pricing/PlanFeatureLabel";

export type GoLandingVariant = "hero" | "breakdown";
export type GoLandingCtaMode = "dual" | "paid";
export type GoLandingPricingFilter = "both" | "basic" | "advanced";

interface GoLandingPageProps {
  variant?: GoLandingVariant;
  ctaMode?: GoLandingCtaMode;
  showBreakdownSection?: boolean;
  pricingFilter?: GoLandingPricingFilter;
}

const GoLandingPage = ({
  variant = "hero",
  ctaMode = "dual",
  showBreakdownSection = false,
  pricingFilter = "both",
}: GoLandingPageProps = {}) => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [affiliateId, setAffiliateId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<'basic' | 'advanced' | null>(null);
  const [checkoutLoading] = useState(false);
  const { user, session } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref') || sessionStorage.getItem('affiliate_id');
    if (ref) setAffiliateId(ref);
  }, []);

  const openSignupForm = () => navigate(navigateWithParams('/signup'));

  const handleGoogle = async () => {
    setIsLoading(true);
    if (affiliateId) sessionStorage.setItem('google_oauth_affiliate_id', affiliateId);
    const message = await signInWithStoreProvider('google', '/app', () => setIsLoading(false));
    if (message) {
      toast.error(message);
      setIsLoading(false);
    }
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    navigate(navigateWithParams(`/signup?email=${encodeURIComponent(trimmed)}`));
  };

  const basicFeatures = [
    "25+ Brandless Video Onboarding Series",
    "Upload Custom Videos",
    "Create Custom Onboarding Checklists",
    "White-Label Knowledge Base",
    "Support Ticketing",
    "White Label Branding Tool",
    "Toggle On/Off Videos",
    "AI Offer & Ads Tool",
    "Up to 5 users",
  ];

  const advancedFeatures = [
    "Everything in Basic, plus…",
    "3 Custom SaaS Plan Onboarding Experiences",
    "SaaS Health Dashboard",
    "Login Tracking",
    "Onboarding Tracking",
    "Voice AI Onboarding",
    "Unlimited 24/7 Human & AI Chat Support",
    SAME_DAY_WL_SUPPORT,
    "Unlimited Users",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <a href="/" className="flex items-center space-x-3">
              <img src={saassuiteLogo} alt="SaaSSuite Logo" className="w-8 h-8 rounded-md" />
              <h1 className="text-2xl font-bold text-gray-900">SaaSSuite</h1>
            </a>
            <div className="hidden md:flex items-center space-x-3">
              <Button variant="outline" asChild>
                <a href="/login">Login</a>
              </Button>
              {ctaMode !== "paid" && !(user && session) && (
                <Button className="bg-purple-600 hover:bg-purple-700 text-white" onClick={openSignupForm}>
                  Start for Free
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
              {ctaMode !== "paid" && !(user && session) && (
                <Button className="bg-purple-600 hover:bg-purple-700 text-white w-full" onClick={openSignupForm}>
                  Start for Free
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Hero */}
      <div className="max-w-3xl mx-auto px-6 pt-12 pb-8 text-center">
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 shadow-sm border border-gray-200">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm font-medium text-gray-700">The Ultimate GHL SaaS System</span>
          </div>
        </div>

        {variant === "hero" ? (
          <>
            <div className="mb-4 sm:text-[5.2rem] sm:leading-[5.6rem] text-gray-900 text-5xl font-bold sm:font-semibold">
              <span className="inline-block mr-2 sm:mr-4">Onboard.</span>
              <span className="inline-block mr-2 sm:mr-4">Educate.</span>
              <span className="inline-block">Support.</span>
            </div>
            <p className="text-xl text-gray-600 mb-8">
              Your journey to an AI powered, auto-pilot, HighLevel SaaS is just beginning...
            </p>
          </>
        ) : (
          <>
            <h1 className="mb-4 text-5xl sm:text-7xl font-bold text-gray-900">
              5 Minute Breakdown
            </h1>
            <p className="text-xl sm:text-2xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
              How GHL agencies and SaaSpreneurs{" "}
              <span className="text-purple-600 font-semibold">get clients daily</span>{" "}
              and onboard them{" "}
              <span className="text-purple-600 font-semibold">effortlessly</span>{" "}
              with this secret system
            </p>
          </>
        )}

        {/* Breakdown video (moved above CTA on breakdown variants) */}
        {variant === "breakdown" && showBreakdownSection && (
          <div className="max-w-3xl mx-auto mb-8">
            <div className="relative rounded-xl overflow-hidden shadow-2xl bg-black group">
              <video
                id="go-hero-video"
                controls
                poster="https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/69ce0b2e66c8fcfd16f88de4.gif"
                className="w-full aspect-video"
                preload="metadata"
                onPlay={() => setIsVideoPlaying(true)}
                onPause={() => setIsVideoPlaying(false)}
                onEnded={() => setIsVideoPlaying(false)}
              >
                <source src="https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/6a1251673c3aed7c639fbc38.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
              {!isVideoPlaying && (
                <button
                  onClick={() => {
                    const video = document.getElementById('go-hero-video') as HTMLVideoElement;
                    if (video) video.play();
                  }}
                  className="absolute inset-0 flex items-center justify-center z-10 cursor-pointer"
                  aria-label="Play video"
                >
                  <div className="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-[0_0_30px_rgba(94,22,234,0.4)]" style={{ backgroundColor: '#5E16EA' }}>
                    <Play className="w-6 h-6 text-white ml-0.5" fill="white" />
                  </div>
                </button>
              )}
            </div>
          </div>
        )}

        {/* CTA Block */}
        <div className="mb-2 max-w-md mx-auto">
          {ctaMode === "dual" ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={isLoading}
                onClick={handleGoogle}
                className="w-full bg-white rounded-full border border-gray-200 hover:bg-gray-50 text-[#6043ef] font-normal text-lg py-6 shadow-sm"
              >
                <span>Continue with Google</span>
                <svg className="ml-2 h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              </Button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-gray-50 px-3 text-gray-500">Or</span>
                </div>
              </div>

              <form onSubmit={handleEmailSubmit} className="space-y-3">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your business email"
                  required
                  className="w-full bg-white rounded-full border border-gray-200 py-6 px-5 text-center"
                />
                <Button
                  type="submit"
                  size="lg"
                  className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-full border border-gray-200 font-semibold py-6 shadow-[0_4px_14px_0_rgba(147,51,234,0.3)] hover:shadow-[0_6px_20px_0_rgba(147,51,234,0.4)] transition-all duration-200 flex items-center justify-center gap-2"
                >
                  Get Started
                  <ArrowRight className="w-5 h-5" />
                </Button>
                <p className="text-xs text-center text-gray-500 pt-1">
                  By proceeding, you agree to the{' '}
                  <a href="/terms" className="underline hover:text-gray-700">Terms of Service</a>{' '}
                  and{' '}
                  <a href="/privacy" className="underline hover:text-gray-700">Privacy Policy</a>
                </p>
              </form>
            </>
          ) : (
            <div className="space-y-3">
              <Button
                type="button"
                size="lg"
                onClick={() => {
                  document.getElementById('pricing-section')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-full border border-gray-200 font-semibold py-6 text-lg shadow-[0_4px_14px_0_rgba(147,51,234,0.3)] hover:shadow-[0_6px_20px_0_rgba(147,51,234,0.4)] transition-all duration-200 flex items-center justify-center gap-2"
              >
                Sign Up Today
                <ArrowRight className="w-5 h-5" />
              </Button>
              <p className="text-xs text-center text-gray-500 pt-1">
                By proceeding, you agree to the{' '}
                <a href="/terms" className="underline hover:text-gray-700">Terms of Service</a>{' '}
                and{' '}
                <a href="/privacy" className="underline hover:text-gray-700">Privacy Policy</a>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 5 Minute Breakdown */}
      {showBreakdownSection && variant !== "breakdown" && (
      <div className="max-w-3xl mx-auto px-6 pt-8 pb-4 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">
          5 Minute Breakdown: How GHL agencies and SaaSpreneurs get clients daily and onboard them effortlessly with this secret system
        </h2>

        <div className="relative rounded-xl overflow-hidden shadow-2xl bg-black group">
          <video
            id="go-hero-video"
            controls
            poster="https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/69ce0b2e66c8fcfd16f88de4.gif"
            className="w-full aspect-video"
            preload="metadata"
            onPlay={() => setIsVideoPlaying(true)}
            onPause={() => setIsVideoPlaying(false)}
            onEnded={() => setIsVideoPlaying(false)}
          >
            <source src="https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/6a1251673c3aed7c639fbc38.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          {!isVideoPlaying && (
            <button
              onClick={() => {
                const video = document.getElementById('go-hero-video') as HTMLVideoElement;
                if (video) video.play();
              }}
              className="absolute inset-0 flex items-center justify-center z-10 cursor-pointer"
              aria-label="Play video"
            >
              <div className="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-[0_0_30px_rgba(94,22,234,0.4)]" style={{ backgroundColor: '#5E16EA' }}>
                <Play className="w-6 h-6 text-white ml-0.5" fill="white" />
              </div>
            </button>
          )}
        </div>
      </div>
      )}

      {/* Testimonials */}
      <VideoTestimonialsSection />


      {/* Features & Pricing */}
      <div id="pricing-section" className="py-16 bg-gradient-to-b from-gray-100/80 to-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-3">Features &amp; Pricing</h2>
            <div className="flex justify-center">
              <ArrowDown className="w-7 h-7 text-purple-600 animate-bounce" />
            </div>
          </div>

          <div className={`grid grid-cols-1 ${pricingFilter === "both" ? "md:grid-cols-2" : ""} gap-8 ${pricingFilter === "both" ? "max-w-4xl" : "max-w-md"} mx-auto items-stretch`}>
            {/* Basic Plan */}
            {pricingFilter !== "advanced" && (
            <div className="relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                <span className="inline-block bg-white text-gray-700 text-xs font-semibold px-3 py-1 rounded-full border border-gray-200 shadow-sm">
                  Best for New Agencies
                </span>
              </div>
              <div className="bg-white rounded-2xl p-8 border border-gray-200 flex flex-col shadow-[0_4px_24px_-4px_rgba(0,0,0,0.08)] h-full">
                <h3 className="text-xl font-semibold text-gray-900 mb-1">Basic</h3>
                <p className="text-gray-500 text-sm mb-4">Support your momentum with a completely custom SaaS experience.</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-5xl font-bold text-gray-900">$27</span>
                  <span className="text-gray-500">/ month</span>
                </div>
                <Button
                  className="w-full bg-[#8125D3] hover:bg-[#6f1fb5] text-white text-base py-5 rounded-xl mb-6"
                  onClick={() => setSelectedProduct('basic')}
                  disabled={checkoutLoading && selectedProduct === 'basic'}
                >
                  {checkoutLoading && selectedProduct === 'basic' ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading...</>
                  ) : 'Subscribe'}
                </Button>
                <div className="space-y-3">
                  {basicFeatures.map((feature, i) => {
                    const isUser = feature.toLowerCase().includes('user');
                    return (
                      <div key={i} className="flex items-start gap-3">
                        {isUser ? (
                          <User className="w-4 h-4 text-[#8125D3] mt-0.5 flex-shrink-0" />
                        ) : (
                          <Check className="w-4 h-4 text-[#8125D3] mt-0.5 flex-shrink-0" />
                        )}
                        <PlanFeatureLabel feature={feature} className="text-gray-700 text-sm" />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            )}

            {/* Advanced Plan (emphasized) */}
            {pricingFilter !== "basic" && (
            <div className={`relative ${pricingFilter === "both" ? "md:scale-[1.04]" : ""}`}>
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                <span className="inline-block bg-purple-600 text-white text-xs font-semibold px-3 py-1 rounded-full border border-purple-700 shadow-sm">
                  Best for Growing Agencies
                </span>
              </div>
              <div className="bg-white rounded-2xl p-8 border-2 border-purple-500 flex flex-col shadow-[0_8px_32px_-4px_rgba(129,37,211,0.25)] h-full">
                <h3 className="text-2xl font-semibold text-gray-900 mb-1">Advanced</h3>
                <p className="text-gray-500 text-sm mb-4">Unlimited users. Endless analytics. Instant execution.</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-6xl font-bold text-gray-900">$97</span>
                  <span className="text-gray-500">/ month</span>
                </div>
                <Button
                  className="w-full bg-[#8125D3] hover:bg-[#6f1fb5] text-white text-base py-5 rounded-xl mb-6"
                  onClick={() => setSelectedProduct('advanced')}
                  disabled={checkoutLoading && selectedProduct === 'advanced'}
                >
                  {checkoutLoading && selectedProduct === 'advanced' ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading...</>
                  ) : 'Subscribe'}
                </Button>
                <div className="space-y-3">
                  {advancedFeatures.map((feature, i) => {
                    const isUser = feature.toLowerCase().includes('user');
                    const isHeader = feature.startsWith('Everything in');
                    if (isHeader) {
                      return (
                        <p key={i} className="text-gray-900 font-semibold text-sm">{feature}</p>
                      );
                    }
                    return (
                      <div key={i} className="flex items-start gap-3">
                        {isUser ? (
                          <User className="w-4 h-4 text-[#8125D3] mt-0.5 flex-shrink-0" />
                        ) : (
                          <Check className="w-4 h-4 text-[#8125D3] mt-0.5 flex-shrink-0" />
                        )}
                        <PlanFeatureLabel feature={feature} className="text-gray-700 text-sm" />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            )}
          </div>

          <BumpCheckoutFlow
            plan={selectedProduct || 'basic'}
            open={!!selectedProduct}
            onOpenChange={(open) => { if (!open) setSelectedProduct(null); }}
            email={email || undefined}
            affiliateId={affiliateId}
          />

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
            <Badge variant="secondary" className="text-base px-6 py-2 bg-green-50 text-green-700 border-green-200">
              <Shield className="w-5 h-5 mr-2" />
              Secure Stripe Checkout
            </Badge>
            <Badge variant="secondary" className="text-base px-6 py-2 bg-blue-50 text-blue-700 border-blue-200">
              <CheckCircle className="w-4 h-4 mr-2" />
              Cancel anytime, no contracts
            </Badge>
          </div>

          {ctaMode === "paid" && !(user && session) && (
            <div className="mt-16 pt-10 border-t border-gray-200 text-center">
              <p className="text-gray-500 mb-4">Not ready to upgrade?</p>
              <Button
                variant="outline"
                size="lg"
                onClick={openSignupForm}
                className="rounded-full px-8 py-6 text-base border-gray-300 text-gray-700 hover:bg-gray-100 hover:text-gray-900"
              >
                Start for Free
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Testimonials carousel (moved below pricing) */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <TestimonialsCarousel />
      </div>

      <Footer />
    </div>
  );
};

export default GoLandingPage;