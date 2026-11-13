import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Check, Mail, Menu, Shield, Sparkles, Users, BookOpen, Inbox, Flame, CheckCircle } from "lucide-react";
import AnimatedSection from "./AnimatedSection";
import TestimonialsCarousel from "./TestimonialsCarousel";
import FeatureHighlight from "./FeatureHighlight";
import videoOnboardingImage from "@/assets/video-onboarding.png";
import trackActivityImage from "@/assets/track-activity.png";
import customOnboardingImage from "@/assets/custom-onboarding.png";
import toggleVideosImage from "@/assets/toggle-videos.png";

// Placeholder — user will provide the real URL
const EMAIL_WARMUP_PAYMENT_LINK = "https://link.saassuite.ai/payment-link/69af2b9c1e612197c07c14d2";

const EmailWarmupSalesPage = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Meta Pixel Code
  // Meta Pixel is loaded once globally in index.html; PageView fires via MetaPixelRouteTracker.

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
              <Badge variant="secondary" className="ml-2 hidden sm:inline-flex">Email Warmup</Badge>
            </div>
            <div className="hidden md:flex items-center space-x-3">
              <Button variant="outline" asChild>
                <a href="/login">Login</a>
              </Button>
              <Button className="bg-purple-600 hover:bg-purple-700 text-white" asChild>
                <a href={EMAIL_WARMUP_PAYMENT_LINK}>Get Started — $199</a>
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
                <a href={EMAIL_WARMUP_PAYMENT_LINK}>Get Started — $199</a>
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
              <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center">
                <Flame className="w-12 h-12 text-orange-500" />
              </div>
            </div>
          </AnimatedSection>

          <div className="mb-2 text-4xl sm:text-6xl font-bold text-gray-900 text-center">
            <span className="inline-block opacity-0" style={{ animation: 'fadeInFromBlur 0.6s ease-out 0.4s forwards' }}>
              Guaranteed Inbox Placement
            </span>
            <br />
            <span className="inline-block opacity-0" style={{ animation: 'fadeInFromBlur 0.6s ease-out 0.6s forwards' }}>
              for GHL Emails
            </span>
          </div>

          <div className="opacity-0" style={{ animation: 'fadeInFromBlur 0.6s ease-out 1s forwards' }}>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Stop landing in spam. Our done-for-you email warmup service ensures your HighLevel emails hit the inbox every time — so your outreach, automations, and campaigns actually get seen.
            </p>
          </div>

          <div className="opacity-0" style={{ animation: 'fadeInFromBlur 0.6s ease-out 1.2s forwards' }}>
            <div className="mb-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                className="text-lg px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-semibold shadow-[0_4px_14px_0_rgba(249,115,22,0.3)] hover:shadow-[0_6px_20px_0_rgba(249,115,22,0.4)] transition-all duration-200 flex items-center gap-2"
                asChild
              >
                <a href={EMAIL_WARMUP_PAYMENT_LINK}>
                  Get Started — $199 One-Time
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
            <div className="mb-4 flex items-center justify-center gap-2 text-orange-600 font-medium">
              <Sparkles className="w-5 h-5" />
              <span className="text-lg">+ Free Month of SaaSSuite Included</span>
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
            <Badge className="mb-4 bg-orange-100 text-orange-700 border-orange-200 text-sm px-4 py-1">Done-For-You Service</Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              We Warm Up Your Emails So You Don't Have To
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Our team handles the entire warmup process for your GHL sending domains and mailboxes. You focus on building your business — we make sure your emails land.
            </p>
          </div>
        </AnimatedSection>

        <AnimatedSection animation="fade-in">
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {[
              { icon: Inbox, title: "Hit the Primary Inbox", desc: "Our warmup process builds your sender reputation so your emails bypass spam filters and land where they belong." },
              { icon: Flame, title: "Done-For-You Setup", desc: "We configure everything — DNS records, warmup schedules, and engagement patterns. You just submit your details." },
              { icon: CheckCircle, title: "Free Month of SaaSSuite", desc: "Every email warmup purchase includes a complimentary month of SaaSSuite to help onboard and retain your clients." },
            ].map((item, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 text-center shadow-sm">
                <div className="w-12 h-12 mx-auto mb-4 bg-orange-100 rounded-full flex items-center justify-center">
                  <item.icon className="w-6 h-6 text-orange-500" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h4>
                <p className="text-gray-600 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </AnimatedSection>

        {/* Pricing Highlight */}
        <AnimatedSection animation="fade-in" className="py-8">
          <div className="max-w-lg mx-auto bg-gradient-to-br from-orange-50 to-orange-100/50 rounded-2xl border-2 border-orange-200 p-8 text-center">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">One-Time Payment</h3>
            <div className="text-5xl font-bold text-orange-600 mb-2">$199</div>
            <p className="text-gray-600 mb-6">No recurring fees. Pay once, get warmed up.</p>
            <ul className="text-left space-y-3 mb-6 max-w-sm mx-auto">
              {[
                "Full DNS & mailbox warmup setup",
                "Sender reputation building",
                "Spam filter bypass optimization",
                "Free month of SaaSSuite included",
                "Works with any GHL account"
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-orange-500 flex-shrink-0" />
                  <span className="text-gray-700">{item}</span>
                </li>
              ))}
            </ul>
            <Button
              size="lg"
              className="w-full text-lg bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-semibold"
              asChild
            >
              <a href={EMAIL_WARMUP_PAYMENT_LINK}>
                Get Started Now
                <ArrowRight className="w-5 h-5 ml-2" />
              </a>
            </Button>
          </div>
        </AnimatedSection>
      </div>

      {/* But That's Not All */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <AnimatedSection animation="fade-in">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">But That's Not All...</h2>
            <p className="text-lg text-gray-600">Your free month of SaaSSuite also unlocks these powerful tools</p>
          </div>
        </AnimatedSection>

        <div className="grid md:grid-cols-3 gap-8 mb-12 max-w-5xl mx-auto items-center">
          <div className="text-center p-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
              <Users className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Track Activity</h3>
            <p className="text-gray-600">Dashboard to track onboarded users, completion rates, login activity, and more</p>
          </div>
          <div className="text-center p-8 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-100 to-blue-100 rounded-xl opacity-50"></div>
            <div className="relative z-10">
              <div className="w-24 h-24 mx-auto mb-6 bg-orange-100 rounded-full flex items-center justify-center shadow-lg">
                <BookOpen className="w-12 h-12 text-orange-500" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Onboard & Educate</h3>
              <p className="text-gray-700 font-medium">20+ brand-less videos to teach your clients how to use your software</p>
            </div>
          </div>
          <div className="text-center p-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-green-600" />
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
            Ready to Land in the Inbox?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Stop losing leads to spam folders. Get your GHL emails warmed up today.
          </p>
          <Button
            size="lg"
            className="text-lg px-8 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
            asChild
          >
            <a href={EMAIL_WARMUP_PAYMENT_LINK}>
              Get Started — $199
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
                <h3 className="text-lg font-semibold text-gray-900 mb-2">What is email warmup?</h3>
                <p className="text-gray-600 mb-4">Email warmup gradually builds your sender reputation by sending and receiving real engagement on your email accounts. This tells inbox providers (Gmail, Outlook, etc.) that your emails are trustworthy.</p>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Is this a one-time service?</h3>
                <p className="text-gray-600 mb-4">Yes! You pay $199 once and we handle the full warmup process for you. No recurring fees or hidden charges.</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">What's included with the free month of SaaSSuite?</h3>
                <p className="text-gray-600 mb-4">You get full access to SaaSSuite's Starter plan — including onboarding videos, custom checklists, support ticketing, and branding tools — completely free for your first month.</p>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Does this work with HighLevel's built-in email?</h3>
                <p className="text-gray-600 mb-4">Yes, our service is specifically designed for HighLevel's email infrastructure including LC Email, Mailgun, and custom SMTP setups.</p>
              </div>
            </div>
          </div>
        </AnimatedSection>

        {/* Still Have Questions */}
        <AnimatedSection animation="scale-in" className="text-center py-12 mb-16">
          <div className="bg-orange-50 rounded-2xl p-8 border border-orange-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Still Have Questions?</h2>
            <p className="text-gray-600 mb-6">Get your emails warmed up today or reach out for more information</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-white" asChild>
                <a href={EMAIL_WARMUP_PAYMENT_LINK}>
                  Get Started — $199
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
    </div>
  );
};

export default EmailWarmupSalesPage;
