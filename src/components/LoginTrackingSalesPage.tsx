import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Check, BarChart3, Menu, Shield, Sparkles, Users, BookOpen, Activity, Eye } from "lucide-react";
import AnimatedSection from "./AnimatedSection";
import StripeEmbeddedCheckout from "@/components/StripeEmbeddedCheckout";
import TestimonialsCarousel from "./TestimonialsCarousel";
import FeatureHighlight from "./FeatureHighlight";
import videoOnboardingImage from "@/assets/video-onboarding.png";
import trackActivityImage from "@/assets/track-activity.png";
import customOnboardingImage from "@/assets/custom-onboarding.png";
import toggleVideosImage from "@/assets/toggle-videos.png";


const ROTATING_WORDS = ["Logins", "Education", "Onboarding", "Retention", "Engagement", "Progress"];

const LoginTrackingSalesPage = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  // Uses the app's own checkout so access is granted automatically.
  const payProps = {
    href: "/pricing",
    onClick: (e: React.MouseEvent) => { e.preventDefault(); setCheckoutOpen(true); },
  };
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Meta Pixel Code
  // Meta Pixel is loaded once globally in index.html; PageView fires via MetaPixelRouteTracker.

  // Rotating word animation
  useEffect(() => {
    if (isPaused) return;

    intervalRef.current = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentWordIndex((prev) => (prev + 1) % ROTATING_WORDS.length);
        setIsAnimating(false);
      }, 300);
    }, 2000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPaused]);

  const handleWordInteraction = () => {
    setIsPaused(true);
    setTimeout(() => setIsPaused(false), 4000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <a href="/" className="flex items-center space-x-3">
                <img src="/lovable-uploads/f3f326f8-20fd-4406-a246-f4b2dbc34614.png" alt="SaaSSuite Logo" className="w-8 h-8" />
                <h1 className="text-2xl font-bold text-gray-900">SaaSSuite</h1>
              </a>
              <Badge variant="secondary" className="ml-2 hidden sm:inline-flex">Login Tracking</Badge>
            </div>
            <div className="hidden md:flex items-center space-x-3">
              <Button variant="outline" asChild>
                <a href="/login">Login</a>
              </Button>
              <Button className="bg-purple-600 hover:bg-purple-700 text-white" asChild>
                <a {...payProps}>Get Access for $97/mo</a>
              </Button>
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
              <Button className="bg-purple-600 hover:bg-purple-700 text-white w-full justify-start" asChild>
                <a {...payProps}>Get Access for $97/mo</a>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Hero Section */}
      <div
        className="relative mx-auto px-6 py-12"
        style={{
          maxWidth: '1024px',
          backgroundImage: 'url(/assets/hero-bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          borderBottomLeftRadius: '25px',
          borderBottomRightRadius: '25px'
        }}
      >
        <div className="text-center mb-16">
          <AnimatedSection animation="fade-in" delay={200}>
            <div className="mb-6 flex justify-center">
              <div className="w-24 h-24 bg-purple-100 rounded-full flex items-center justify-center">
                <BarChart3 className="w-12 h-12 text-purple-600" />
              </div>
            </div>
          </AnimatedSection>

          <div className="mb-2 text-5xl sm:text-7xl font-bold text-gray-900 text-center">
            <span className="inline-block mr-3 opacity-0" style={{ animation: 'fadeInFromBlur 0.6s ease-out 0.4s forwards' }}>
              Track
            </span>
            <span
              className="inline-block opacity-0 cursor-pointer select-none"
              style={{ animation: 'fadeInFromBlur 0.6s ease-out 0.6s forwards' }}
              onClick={handleWordInteraction}
              onMouseDown={handleWordInteraction}
            >
              <span
                className={`inline-block transition-all duration-300 bg-gradient-to-r from-purple-600 to-purple-500 bg-clip-text text-transparent ${
                  isAnimating ? 'opacity-0 translate-y-4 blur-[4px]' : 'opacity-100 translate-y-0 blur-0'
                }`}
              >
                {ROTATING_WORDS[currentWordIndex]}.
              </span>
            </span>
          </div>

          <div className="opacity-0" style={{ animation: 'fadeInFromBlur 0.6s ease-out 1s forwards' }}>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Know exactly who's logging in, what they're learning, and where they drop off. SaaSSuite gives you full visibility into your clients' onboarding and education journey.
            </p>
          </div>

          <div className="opacity-0" style={{ animation: 'fadeInFromBlur 0.6s ease-out 1.2s forwards' }}>
            <div className="mb-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                className="text-lg px-8 py-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl font-semibold shadow-[0_4px_14px_0_rgba(147,51,234,0.3)] hover:shadow-[0_6px_20px_0_rgba(147,51,234,0.4)] transition-all duration-200 flex items-center gap-2"
                asChild
              >
                <a {...payProps}>
                  Get Access for $97/mo
                  <ArrowRight className="w-5 h-5" />
                </a>
              </Button>
              <Button
                size="lg"
                className="text-lg px-8 py-4 bg-gray-800 hover:bg-gray-900 text-white rounded-xl font-semibold shadow-[0_4px_14px_0_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_0_rgba(0,0,0,0.3)] transition-all duration-200 flex items-center gap-2"
                onClick={() => document.getElementById('features-section')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Learn More
                <ArrowRight className="w-5 h-5" />
              </Button>
            </div>
            <div className="mb-12 flex items-center justify-center gap-2 text-gray-600">
              <Users className="w-5 h-5" />
              <span className="text-lg font-medium">Trusted by 500+ Agencies</span>
            </div>
          </div>
        </div>
      </div>

      {/* Core Features */}
      <div id="features-section" className="max-w-6xl mx-auto px-6 py-16">
        <AnimatedSection animation="fade-in">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-purple-100 text-purple-700 border-purple-200 text-sm px-4 py-1">SaaS Health Dashboard</Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Full Visibility Into Your Client Base
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              See who logged in, when they last visited, how far they've progressed through onboarding, and which clients are at risk of churning — all from one dashboard.
            </p>
          </div>
        </AnimatedSection>

        <AnimatedSection animation="fade-in">
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {[
              { icon: Eye, title: "Login Tracking", desc: "See exactly who's logging in, how often, and when they last accessed your platform." },
              { icon: Activity, title: "Onboarding Progress", desc: "Track each client's progress through your onboarding steps and identify drop-off points." },
              { icon: BarChart3, title: "Retention Insights", desc: "Identify at-risk clients before they churn with engagement metrics and activity patterns." },
            ].map((item, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 text-center shadow-sm">
                <div className="w-12 h-12 mx-auto mb-4 bg-purple-100 rounded-full flex items-center justify-center">
                  <item.icon className="w-6 h-6 text-purple-600" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h4>
                <p className="text-gray-600 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </AnimatedSection>

        {/* Mid CTA */}
        <AnimatedSection animation="fade-in" className="text-center py-8">
          <Button
            size="lg"
            className="text-lg px-8 py-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl font-semibold shadow-[0_4px_14px_0_rgba(147,51,234,0.3)] hover:shadow-[0_6px_20px_0_rgba(147,51,234,0.4)] transition-all duration-200"
            asChild
          >
            <a {...payProps}>
              Get Access for $97/mo
              <ArrowRight className="w-5 h-5 ml-2" />
            </a>
          </Button>
        </AnimatedSection>
      </div>

      {/* But That's Not All */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <AnimatedSection animation="fade-in">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">But That's Not All...</h2>
            <p className="text-lg text-gray-600">Your $97/mo also unlocks these powerful tools</p>
          </div>
        </AnimatedSection>

        <div className="grid md:grid-cols-3 gap-8 mb-12 max-w-5xl mx-auto items-center">
          <div className="text-center p-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">AI Support Bots</h3>
            <p className="text-gray-600">Unlimited custom AI chat bots trained on your business, available 24/7</p>
          </div>
          <div className="text-center p-8 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-100 to-blue-100 rounded-xl opacity-50"></div>
            <div className="relative z-10">
              <div className="w-24 h-24 mx-auto mb-6 bg-purple-100 rounded-full flex items-center justify-center shadow-lg">
                <BookOpen className="w-12 h-12 text-purple-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Onboard & Educate</h3>
              <p className="text-gray-700 font-medium">20+ brand-less videos to teach your clients how to use your software</p>
            </div>
          </div>
          <div className="text-center p-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <Shield className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">White-Label Branding</h3>
            <p className="text-gray-600">Full branding tool with Custom CSS generation for both V1 & V2 HighLevel</p>
          </div>
        </div>
      </div>

      {/* Feature Highlights */}
      <div className="space-y-4">
        <FeatureHighlight
          title="Video Onboarding Inside Your SaaS"
          description="Seamlessly embed professional onboarding videos directly within your SaaS platform. Guide your clients through setup and features with engaging video tutorials that reduce support tickets and accelerate time-to-value."
          image={videoOnboardingImage}
          imagePosition="right"
        />
        <div className="flex justify-center py-2">
          <ArrowRight className="w-5 h-5 text-black/30 rotate-90" />
        </div>
        <FeatureHighlight
          title="Track Activity of Your Users"
          description="Monitor user engagement and progress with comprehensive activity tracking. Understand which features resonate most with your clients and identify areas where they need additional support to maximize platform adoption."
          image={trackActivityImage}
          imagePosition="left"
        />
        <div className="flex justify-center py-2">
          <ArrowRight className="w-5 h-5 text-black/30 rotate-90" />
        </div>
        <FeatureHighlight
          title="Create Custom Onboarding Experiences"
          description="Design personalized onboarding journeys tailored to your clients' unique needs. Customize video sequences, branding, and content flow to deliver a white-label experience that perfectly aligns with your agency's identity."
          image={customOnboardingImage}
          imagePosition="right"
        />
        <div className="flex justify-center py-2">
          <ArrowRight className="w-5 h-5 text-black/30 rotate-90" />
        </div>
        <FeatureHighlight
          title="Toggle On/Off Videos To Tailor Client Education"
          description="Maintain complete control over your educational content. Easily enable or disable specific videos to create curated learning paths that match each client's experience level and business requirements."
          image={toggleVideosImage}
          imagePosition="left"
        />
      </div>

      {/* Testimonials */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div id="testimonials-section">
          <TestimonialsCarousel />
        </div>

        {/* Final CTA */}
        <AnimatedSection animation="fade-in" className="text-center py-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to Track & Optimize Client Success?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Join 500+ agencies using SaaSSuite to monitor, educate, and retain their clients
          </p>
          <Button
            size="lg"
            className="text-lg px-8 py-3 bg-[#6043ef] hover:bg-[#5a3dd8] text-white"
            asChild
          >
            <a {...payProps}>
              Get Access for $97/mo
              <ArrowRight className="w-5 h-5 ml-2" />
            </a>
          </Button>
        </AnimatedSection>

        {/* FAQ */}
        <AnimatedSection animation="fade-in">
          <div className="bg-white rounded-xl p-8 shadow-sm border mb-16">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-8">Frequently Asked Questions</h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">What does Login Tracking include?</h3>
                <p className="text-gray-600 mb-4">You get a full SaaS Health Dashboard showing login activity, onboarding progress, video completion rates, and engagement metrics for every client.</p>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Can I see who's at risk of churning?</h3>
                <p className="text-gray-600 mb-4">Yes! The dashboard highlights clients who haven't logged in recently or haven't completed onboarding, so you can proactively reach out before they cancel.</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Does it work with all HighLevel plans?</h3>
                <p className="text-gray-600 mb-4">Yes, SaaSSuite works with any HighLevel account — whether you're on the Starter, Freelancer, or Agency plan.</p>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Can I cancel anytime?</h3>
                <p className="text-gray-600 mb-4">Absolutely! You can cancel your subscription at any time without any penalties or hidden fees.</p>
              </div>
            </div>
          </div>
        </AnimatedSection>

        {/* Still Have Questions */}
        <AnimatedSection animation="scale-in" className="text-center py-12 mb-16">
          <div className="bg-primary/5 rounded-2xl p-8 border border-primary/10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Still Have Questions?</h2>
            <p className="text-gray-600 mb-6">Get direct access to transform your agency today or reach out for support</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild>
                <a {...payProps}>
                  Get Access for $97/mo
                  <ArrowRight className="w-5 h-5 ml-2" />
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="/book">Book a Call</a>
              </Button>
            </div>
          </div>
        </AnimatedSection>

        <div className="text-center text-gray-600">
          <p>&copy; 2025 SaaSSuite. All rights reserved.</p>
          <div className="mt-4">
            <Button variant="link" className="text-blue-600 hover:text-blue-800" onClick={() => window.open('https://saassuite.ai/book', '_blank')}>
              Need help? Contact us
            </Button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInFromBlur {
          0% { opacity: 0; filter: blur(8px); transform: translateY(16px); }
          100% { opacity: 1; filter: blur(0px); transform: translateY(0); }
        }
      `}</style>
      <StripeEmbeddedCheckout plan="advanced" open={checkoutOpen} onOpenChange={setCheckoutOpen} />
    </div>
  );
};

export default LoginTrackingSalesPage;
