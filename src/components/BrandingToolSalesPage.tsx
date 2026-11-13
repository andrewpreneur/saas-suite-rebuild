import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Check, CheckCircle, Menu, Palette, Shield, Sparkles, Star, Users, Video, User } from "lucide-react";
import AnimatedSection from "./AnimatedSection";
import StripeEmbeddedCheckout from "@/components/StripeEmbeddedCheckout";
import TestimonialsCarousel from "./TestimonialsCarousel";
import FeatureHighlight from "./FeatureHighlight";
import videoOnboardingImage from "@/assets/video-onboarding.png";
import trackActivityImage from "@/assets/track-activity.png";
import customOnboardingImage from "@/assets/custom-onboarding.png";
import toggleVideosImage from "@/assets/toggle-videos.png";
import brandingV1Preview from "@/assets/branding-v1-preview.png";
import brandingV2Preview from "@/assets/branding-v2-preview.png";


const BrandingToolSalesPage = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  // Uses the app's own checkout so access is granted automatically.
  const payProps = {
    href: "/pricing",
    onClick: (e: React.MouseEvent) => { e.preventDefault(); setCheckoutOpen(true); },
  };

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
              <Badge variant="secondary" className="ml-2 hidden sm:inline-flex">Branding Tool</Badge>
            </div>
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-3">
              <Button variant="outline" asChild>
                <a href="/login">Login</a>
              </Button>
              <Button className="bg-purple-600 hover:bg-purple-700 text-white" asChild>
                <a {...payProps}>
                  Get Access for $27
                </a>
              </Button>
            </div>
            
            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        
        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="max-w-6xl mx-auto px-6 py-4 space-y-2">
              <Button variant="outline" asChild className="w-full justify-start">
                <a href="/login" onClick={() => setIsMobileMenuOpen(false)}>Login</a>
              </Button>
              <Button className="bg-purple-600 hover:bg-purple-700 text-white w-full justify-start" asChild>
                <a {...payProps}>
                  Get Access for $27
                </a>
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
                <Palette className="w-12 h-12 text-purple-600" />
              </div>
            </div>
          </AnimatedSection>

          <div className="mb-2 text-5xl sm:text-7xl font-bold text-gray-900 text-center">
            <span 
              className="inline-block mr-4 opacity-0"
              style={{ animation: 'fadeInFromBlur 0.6s ease-out 0.4s forwards' }}
            >
              Your GHL.
            </span>
            <span 
              className="inline-block mr-4 opacity-0"
              style={{ animation: 'fadeInFromBlur 0.6s ease-out 0.6s forwards' }}
            >
              Your Colors.
            </span>
            <span 
              className="inline-block opacity-0"
              style={{ animation: 'fadeInFromBlur 0.6s ease-out 0.8s forwards' }}
            >
              Your Way.
            </span>
          </div>

          <div 
            className="opacity-0"
            style={{ animation: 'fadeInFromBlur 0.6s ease-out 1s forwards' }}
          >
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Experience the easiest to use branding tool out there. Simply enter your colors, configure fonts and themes, and generate your Custom CSS.
            </p>
          </div>
          
          {/* CTA */}
          <div 
            className="opacity-0"
            style={{ animation: 'fadeInFromBlur 0.6s ease-out 1.2s forwards' }}
          >
            <div className="mb-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button 
                size="lg" 
                className="text-lg px-8 py-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl font-semibold shadow-[0_4px_14px_0_rgba(147,51,234,0.3)] hover:shadow-[0_6px_20px_0_rgba(147,51,234,0.4)] transition-all duration-200 flex items-center gap-2" 
                asChild
              >
                <a {...payProps}>
                  Get Access for $27
                  <ArrowRight className="w-5 h-5" />
                </a>
              </Button>
              
              <Button 
                size="lg" 
                className="text-lg px-8 py-4 bg-gray-800 hover:bg-gray-900 text-white rounded-xl font-semibold shadow-[0_4px_14px_0_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_0_rgba(0,0,0,0.3)] transition-all duration-200 flex items-center gap-2" 
                onClick={() => document.getElementById('v2-branding-section')?.scrollIntoView({ behavior: 'smooth' })}
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

      {/* V2 Branding Tool Highlight */}
      <div id="v2-branding-section" className="max-w-6xl mx-auto px-6 py-16">
        <AnimatedSection animation="fade-in">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-purple-100 text-purple-700 border-purple-200 text-sm px-4 py-1">Now with V2 Support</Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Brand Both V1 & V2 HighLevel
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Whether you're on the classic HighLevel interface or the new V2, our branding tool generates pixel-perfect Custom CSS for both versions.
            </p>
          </div>
        </AnimatedSection>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* V1 Branding */}
          <AnimatedSection animation="fade-in" delay={200}>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-[0_4px_24px_-4px_rgba(0,0,0,0.08)]">
              <div className="h-72 sm:h-80 overflow-hidden bg-gray-100">
                <img 
                  src={brandingV1Preview} 
                  alt="V1 HighLevel Branding Preview" 
                  className="w-full h-full object-cover object-left-top"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Classic HighLevel Branding</h3>
                <p className="text-gray-600">Full sidebar, navigation, and UI element customization for HighLevel's classic interface.</p>
              </div>
            </div>
          </AnimatedSection>

          {/* V2 Branding */}
          <AnimatedSection animation="fade-in" delay={400}>
            <div className="bg-white rounded-2xl border border-purple-200 overflow-hidden shadow-[0_4px_24px_-4px_rgba(147,51,234,0.12)]">
              <div className="h-72 sm:h-80 overflow-hidden bg-gray-900">
                <img 
                  src={brandingV2Preview} 
                  alt="V2 HighLevel Branding Preview" 
                  className="w-full h-full object-cover object-left-top"
                />
              </div>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xl font-bold text-gray-900">V2 HighLevel Branding</h3>
                  <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs">New</Badge>
                </div>
                <p className="text-gray-600">Full support for HighLevel's new V2 interface including updated sidebar, settings panel, and all new UI components.</p>
              </div>
            </div>
          </AnimatedSection>
        </div>

        {/* Branding Features */}
        <AnimatedSection animation="fade-in">
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {[
              { title: "Pick Your Colors", desc: "Enter your brand colors and watch your entire GHL interface transform instantly." },
              { title: "Configure Fonts & Themes", desc: "Choose from a variety of fonts and theme styles to match your agency's identity." },
              { title: "Generate Custom CSS", desc: "One-click CSS generation ready to paste into your HighLevel Custom CSS field." },
            ].map((item, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 text-center shadow-sm">
                <div className="w-12 h-12 mx-auto mb-4 bg-purple-100 rounded-full flex items-center justify-center">
                  <Check className="w-6 h-6 text-purple-600" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h4>
                <p className="text-gray-600 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </AnimatedSection>

        {/* Mid-page CTA */}
        <AnimatedSection animation="fade-in" className="text-center py-8">
          <Button 
            size="lg" 
            className="text-lg px-8 py-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl font-semibold shadow-[0_4px_14px_0_rgba(147,51,234,0.3)] hover:shadow-[0_6px_20px_0_rgba(147,51,234,0.4)] transition-all duration-200" 
            asChild
          >
            <a {...payProps}>
              Get Access for $27
              <ArrowRight className="w-5 h-5 ml-2" />
            </a>
          </Button>
        </AnimatedSection>
      </div>

      {/* Three Feature Highlights - same as home page */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <AnimatedSection animation="fade-in">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">But That's Not All...</h2>
            <p className="text-lg text-gray-600">Your $27/mo also unlocks these powerful tools</p>
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
            <div className="absolute inset-0 bg-gradient-to-r from-purple-100 to-blue-100 rounded-xl opacity-50"></div>
            <div className="relative z-10">
              <div className="w-24 h-24 mx-auto mb-6 bg-purple-100 rounded-full flex items-center justify-center shadow-lg">
                <Video className="w-12 h-12 text-purple-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Onboard & Educate</h3>
              <p className="text-gray-700 font-medium">20+ brand-less videos to teach your clients how to use your software</p>
            </div>
          </div>
          
          <div className="text-center p-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Fully White-Labeled</h3>
            <p className="text-gray-600">Customize and match your agency + your onboarding with custom color</p>
          </div>
        </div>
      </div>

      {/* Feature Highlights Section */}
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
            Ready to Brand Your HighLevel?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Join 500+ agencies already using SaaSSuite to white-label their client experience
          </p>
          <Button 
            size="lg" 
            className="text-lg px-8 py-3 bg-[#6043ef] hover:bg-[#5a3dd8] text-white" 
            asChild
          >
            <a {...payProps}>
              Get Access for $27
              <ArrowRight className="w-5 h-5 ml-2" />
            </a>
          </Button>
        </AnimatedSection>

        {/* FAQ Section */}
        <AnimatedSection animation="fade-in">
          <div className="bg-white rounded-xl p-8 shadow-sm border mb-16">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-8">Frequently Asked Questions</h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">What is the Branding Tool?</h3>
                <p className="text-gray-600 mb-4">The Branding Tool lets you generate Custom CSS for your HighLevel account so your sidebar, navigation, and UI match your brand colors perfectly.</p>
                
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Does it support V2 HighLevel?</h3>
                <p className="text-gray-600 mb-4">Yes! We support both the classic V1 interface and the new V2 HighLevel interface with dedicated branding tools for each.</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Do I need HighLevel to use this?</h3>
                <p className="text-gray-600 mb-4">Yes, SaaSSuite is designed to work with your existing HighLevel account to provide additional customization and features.</p>
                
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
                  Get Access for $27
                  <ArrowRight className="w-5 h-5 ml-2" />
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="/book">Book a Call</a>
              </Button>
            </div>
          </div>
        </AnimatedSection>

        {/* Footer */}
        <div className="text-center text-gray-600">
          <p>&copy; 2025 SaaSSuite. All rights reserved.</p>
          <div className="mt-4">
            <Button variant="link" className="text-blue-600 hover:text-blue-800" onClick={() => window.open('https://saassuite.ai/book', '_blank')}>
              Need help? Contact us
            </Button>
          </div>
        </div>
      </div>
      <StripeEmbeddedCheckout plan="basic" open={checkoutOpen} onOpenChange={setCheckoutOpen} />
    </div>
  );
};

export default BrandingToolSalesPage;
