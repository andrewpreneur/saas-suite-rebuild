import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { toast } from "sonner";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, CheckCircle, Star, Users, Zap, Shield, ArrowRight, Sparkles, CreditCard, Gift, X, Video, Menu, Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import VideoLibrary from "./VideoLibrary";
import BrandingToolShowcase from "./BrandingToolShowcase";
import AffiliateHighlight from "./AffiliateHighlight";
import AnimatedSection from "./AnimatedSection";
import Footer from "./Footer";
import StripeEmbeddedCheckout from "@/components/StripeEmbeddedCheckout";
import TestimonialsCarousel from "./TestimonialsCarousel";
import PlanFeatureLabel from "@/components/pricing/PlanFeatureLabel";
import { SAME_DAY_WL_SUPPORT } from "@/constants/pricingPlans";

const PromoPage = () => {
  const [email, setEmail] = useState("");
  // Uses the app's own checkout so access is granted automatically.
  const [checkoutPlan, setCheckoutPlan] = useState<"basic" | "advanced" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);
  const [showLiteDialog, setShowLiteDialog] = useState(false);
  const [showProDialog, setShowProDialog] = useState(false);
  const [showTransferVideoDialog, setShowTransferVideoDialog] = useState(false);
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
  const [confirmationTimer, setConfirmationTimer] = useState(10);
  const [showLoginButton, setShowLoginButton] = useState(false);
  const [showAppointmentConfirmationDialog, setShowAppointmentConfirmationDialog] = useState(false);
  const [isYearly, setIsYearly] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [affiliateId, setAffiliateId] = useState<string | null>(null);
  const {
    setUser,
    user,
    session
  } = useUser();
  const {
    toast: shadcnToast
  } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Meta Pixel Code
  // Meta Pixel is loaded once globally in index.html; PageView fires via MetaPixelRouteTracker.

  // Check for affiliate ID in URL params and store it
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const amId = searchParams.get('am_id');
    if (amId) {
      setAffiliateId(amId);
      sessionStorage.setItem('affiliate_id', amId);
    } else {
      const storedAffiliateId = sessionStorage.getItem('affiliate_id');
      if (storedAffiliateId) {
        setAffiliateId(storedAffiliateId);
      }
    }
  }, [location.search]);

  // Check for hash-based routing
  useEffect(() => {
    if (location.hash === '#transfer-video') {
      setShowTransferVideoDialog(true);
    } else if (location.hash === '#confirmation') {
      setShowConfirmationDialog(true);
    } else if (location.hash === '#appointment-confirmed') {
      setShowAppointmentConfirmationDialog(true);
    } else if (location.hash === '#affiliate') {
      setTimeout(() => {
        document.getElementById('affiliate-section')?.scrollIntoView({
          behavior: 'smooth'
        });
      }, 100);
    } else if (location.hash === '#signup' || location.hash === '#pricing') {
      setTimeout(() => {
        document.getElementById('pricing-section')?.scrollIntoView({
          behavior: 'smooth'
        });
      }, 100);
    }
  }, [location.hash]);

  // Update URL when dialogs open/close
  useEffect(() => {
    if (showTransferVideoDialog && location.hash !== '#transfer-video') {
      window.history.pushState(null, '', '#transfer-video');
    } else if (!showTransferVideoDialog && location.hash === '#transfer-video') {
      window.history.pushState(null, '', window.location.pathname);
    }
    if (showConfirmationDialog && location.hash !== '#confirmation') {
      window.history.pushState(null, '', '#confirmation');
    } else if (!showConfirmationDialog && location.hash === '#confirmation') {
      window.history.pushState(null, '', window.location.pathname);
    }
  }, [showTransferVideoDialog, showConfirmationDialog, location.hash]);

  // Load external script when subscription dialog opens
  useEffect(() => {
    if (showSubscriptionDialog) {
      const script = document.createElement('script');
      script.src = 'https://lynks.lynkific.com/js/form_embed.js';
      script.async = true;
      document.head.appendChild(script);
      return () => {
        const existingScript = document.querySelector('script[src="https://lynks.lynkific.com/js/form_embed.js"]');
        if (existingScript) {
          existingScript.remove();
        }
      };
    }
  }, [showSubscriptionDialog]);

  // Confirmation dialog timer
  useEffect(() => {
    if (showConfirmationDialog && !showLoginButton) {
      const timer = setInterval(() => {
        setConfirmationTimer(prev => {
          if (prev <= 1) {
            setShowLoginButton(true);
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [showConfirmationDialog, showLoginButton]);

  // Reset confirmation dialog state when it closes
  useEffect(() => {
    if (!showConfirmationDialog) {
      setConfirmationTimer(10);
      setShowLoginButton(false);
    }
  }, [showConfirmationDialog]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please enter your email address");
      return;
    }
    setIsLoading(true);
    try {
      const emailLower = email.trim().toLowerCase();

      const {
        data: existingUsers,
        error: fetchError
      } = await supabase.rpc('get_user_by_email', {
        user_email: emailLower
      });
      if (fetchError) {
        throw fetchError;
      }
      const existingUser = existingUsers?.[0];
      if (existingUser) {
        const updateSuccess = await supabase.rpc('update_user_access', {
          user_email: emailLower
        });
        if (!updateSuccess.data) {
          throw new Error('Failed to update user access');
        }

        setUser(existingUser.email, existingUser.id.toString(), existingUser.approval);
        if (existingUser.approval !== "NO") {
          toast.success("Welcome back! Access granted.");
          setShowLoginDialog(false);
          navigate("/app");
        } else {
          shadcnToast({
            variant: "destructive",
            title: "Access denied.",
            description: "Your account access has been denied."
          });
        }
      } else {
        toast.error("Account not found. Please sign up using one of the options below.");
      }
    } catch (error) {
      console.error('Error handling login:', error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToPricing = () => {
    document.getElementById('pricing-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToTestimonials = () => {
    document.getElementById('testimonials-section')?.scrollIntoView({ behavior: 'smooth' });
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
              <Badge variant="secondary" className="ml-2 hidden sm:inline-flex">HighLevel White-Label Tool</Badge>
            </div>
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-3">
              <Button className="bg-purple-600 hover:bg-purple-700 text-white" onClick={scrollToPricing}>
                Start for Free
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
              <Button className="bg-purple-600 hover:bg-purple-700 text-white w-full justify-start" onClick={() => {
                setIsMobileMenuOpen(false);
                scrollToPricing();
              }}>
                Start for Free
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Hero Background Container */}
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
        {/* Hero Section */}
        <div className="text-center mb-16">
          {/* Animated Logo/Icon */}
          <AnimatedSection animation="fade-in" delay={200}>
            <div className="mb-6 flex justify-center">
              <img 
                src="/lovable-uploads/1c6dcd77-b1e8-4e49-9845-0bdbbd2ebfde.png" 
                alt="Onboarding arrows icon" 
                className="w-24 h-24"
              />
            </div>
          </AnimatedSection>

          {/* Animated Header with Individual Word Animations */}
          <div className="mb-2 text-5xl sm:text-7xl font-normal text-gray-900">
            <span 
              className="inline-block mr-4 opacity-0"
              style={{
                animation: 'fadeInFromBlur 0.6s ease-out 0.4s forwards'
              }}
            >
              Onboard.
            </span>
            <span 
              className="inline-block mr-4 opacity-0"
              style={{
                animation: 'fadeInFromBlur 0.6s ease-out 0.6s forwards'
              }}
            >
              Train.
            </span>
            <span 
              className="inline-block opacity-0"
              style={{
                animation: 'fadeInFromBlur 0.6s ease-out 0.8s forwards'
              }}
            >
              Retain.
            </span>
          </div>

          {/* Subtitle with fade from blur */}
          <div 
            className="opacity-0"
            style={{
              animation: 'fadeInFromBlur 0.6s ease-out 1s forwards'
            }}
          >
            <p className="text-xl text-gray-600 mb-8">Your journey to AI powered, white-labeled onboarding starts here.</p>
          </div>
          
          {/* Video Player Section with fade from blur */}
          <div 
            className="opacity-0"
            style={{
              animation: 'fadeInFromBlur 0.6s ease-out 1.2s forwards'
            }}
          >
            <div className="max-w-3xl mx-auto mb-8">
              <div className="relative rounded-xl overflow-hidden shadow-2xl bg-black">
                <video controls poster="https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/69ce0b2e66c8fcfd16f88de4.gif" className="w-full aspect-video" preload="metadata">
                  <source src="https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/69ce0b282a8b886979f996f5.mov" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>
            </div>
          </div>
          
          {/* Modified CTA Buttons */}
          <div 
            className="opacity-0"
            style={{
              animation: 'fadeInFromBlur 0.6s ease-out 1.4s forwards'
            }}
          >
            <div className="mb-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button 
                size="lg" 
                className="text-lg px-8 py-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl font-semibold shadow-[0_4px_14px_0_rgba(147,51,234,0.3)] hover:shadow-[0_6px_20px_0_rgba(147,51,234,0.4)] transition-all duration-200 flex items-center gap-2" 
                onClick={scrollToPricing}>
                Start for Free
                <ArrowRight className="w-5 h-5" />
              </Button>
              
              <Button 
                size="lg" 
                className="text-lg px-8 py-4 bg-gray-800 hover:bg-gray-900 text-white rounded-xl font-semibold shadow-[0_4px_14px_0_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_0_rgba(0,0,0,0.3)] transition-all duration-200 flex items-center gap-2" 
                asChild>
                <a href="/book">
                  Book a Call
                  <ArrowRight className="w-5 h-5" />
                </a>
              </Button>
            </div>
            
            {/* Trust Badge */}
            <div className="mb-12 flex items-center justify-center gap-2 text-gray-600">
              <Users className="w-5 h-5" />
              <span className="text-lg font-medium">Trusted by 500+ Agencies</span>
            </div>
          </div>
        </div>
      </div>

      {/* Three Feature Highlights Section - Outside background */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-3 gap-8 mb-12 max-w-5xl mx-auto items-center">
            <div 
              className="opacity-0"
              style={{
                animation: 'fadeInFromBlur 0.6s ease-out 1.6s forwards'
              }}
            >
              <div className="text-center p-6">
                <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                  <Users className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Track Activity</h3>
                <p className="text-gray-600">Dashboard to track onboarded users, completion rates, login activity, and more</p>
              </div>
            </div>
            
            {/* Center - Emphasized Video Onboarding Tool */}
            <div 
              className="opacity-0"
              style={{
                animation: 'fadeInFromBlur 0.6s ease-out 1.8s forwards'
              }}
            >
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
            </div>
            
            <div 
              className="opacity-0"
              style={{
                animation: 'fadeInFromBlur 0.6s ease-out 2s forwards'
              }}
            >
              <div className="text-center p-6">
                <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Fully White-Labeled</h3>
                <p className="text-gray-600">Customize and match your agency + your onboarding with custom color</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div id="pricing-section" className="max-w-6xl mx-auto px-6 py-16">
        <AnimatedSection animation="fade-in">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Choose Your Plan</h2>
            <p className="text-xl text-gray-600">Select the perfect plan for your agency</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Basic Plan */}
            <Card className="relative border-2 border-gray-200 hover:border-purple-300 transition-all duration-300 hover:shadow-xl">
              <CardHeader className="text-center pb-8">
                <CardTitle className="text-3xl font-bold text-gray-900 mb-2">Basic</CardTitle>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-5xl font-bold text-gray-900">$27</span>
                  <span className="text-gray-600">/month</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">25+ Video Onboarding Tool</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">New Monthly Videos</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">Activity Dashboard</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">Branding Tool</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">Menu Link Deletion Tool</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">AI Offer & Ads Tool</span>
                  </div>
                </div>
                <Button 
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white text-lg py-6"
                  onClick={() => setCheckoutPlan("basic")}
                >
                  Get Started
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </CardContent>
            </Card>

            {/* Advanced Plan */}
            <Card className="relative border-2 border-purple-500 hover:border-purple-600 transition-all duration-300 shadow-lg hover:shadow-2xl">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-purple-600 text-white px-4 py-1">Most Popular</Badge>
              </div>
              <CardHeader className="text-center pb-8 pt-8">
                <CardTitle className="text-3xl font-bold text-gray-900 mb-2">Advanced</CardTitle>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-5xl font-bold text-gray-900">$97</span>
                  <span className="text-gray-600">/month</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">25+ Video Onboarding Tool</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">New Monthly Videos</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">Activity Dashboard</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">Branding Tool</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">Menu Link Deletion Tool</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">AI Offer & Ads Tool</span>
                  </div>
                  <Separator className="my-4" />
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                    <PlanFeatureLabel feature={SAME_DAY_WL_SUPPORT} className="text-gray-900 font-semibold" />
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-900 font-semibold">3 Custom Onboarding Experiences</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-900 font-semibold">Collect Name/Email Login Tracking</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-900 font-semibold">Customize Shown Videos (On/Off Toggle)</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-900 font-semibold">Advanced Branding</span>
                  </div>
                </div>
                <Button 
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white text-lg py-6"
                  onClick={() => setCheckoutPlan("advanced")}
                >
                  Get Started
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>
          
          {/* Guarantee Badges */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
            <Badge variant="secondary" className="text-base px-6 py-2 bg-green-50 text-green-700 border-green-200">
              <Shield className="w-6 h-6 mr-2" />
              Secure Stripe Checkout
            </Badge>
            <Badge variant="secondary" className="text-base px-6 py-2 bg-blue-50 text-blue-700 border-blue-200">
              <CheckCircle className="w-4 h-4 mr-2" />
              Cancel anytime, no contracts
            </Badge>
          </div>
          
          {/* Testimonials Scroll Button */}
          <div className="text-center mt-8">
            <Button 
              variant="outline" 
              size="lg"
              onClick={scrollToTestimonials}
              className="text-lg px-8 py-4 border-2 hover:bg-purple-50 hover:border-purple-400 transition-all duration-200"
            >
              Agencies Love SaaSSuite
              <Star className="w-5 h-5 ml-2 text-yellow-500 fill-yellow-500" />
            </Button>
          </div>
        </AnimatedSection>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Testimonials Section */}
        <div id="testimonials-section">
          <TestimonialsCarousel />
        </div>

        {/* Get Access Section */}
        <AnimatedSection animation="fade-in" className="text-center py-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to Transform Your HighLevel Experience?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Join thousands of agencies already using SaaSSuite to enhance their client experience
          </p>
          <Button size="lg" className="text-lg px-8 py-3 bg-[#6043ef] hover:bg-[#5a3dd8] text-white" onClick={scrollToPricing}>
            Start for Free
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
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

        {/* Final CTA After FAQ */}
        <AnimatedSection animation="scale-in" className="text-center py-12 mb-16">
          <div className="bg-primary/5 rounded-2xl p-8 border border-primary/10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Still Have Questions?
            </h2>
            <p className="text-gray-600 mb-6">
              Get direct access to transform your agency today or reach out for support
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={scrollToPricing}>
                Start for Free
                <ArrowRight className="w-5 h-5 ml-2" />
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

      {/* Login Dialog */}
      <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Welcome Back</DialogTitle>
            <DialogDescription className="text-center">
              Enter your email to access your SaaSSuite account
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Input type="email" placeholder="Enter your email" value={email} onChange={e => setEmail(e.target.value)} className="w-full" required />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Subscription Dialog */}
      <Dialog open={showSubscriptionDialog} onOpenChange={setShowSubscriptionDialog}>
        <DialogContent className="sm:max-w-3xl max-w-[90vw]">
          <DialogHeader>
            <DialogTitle>Subscribe Now</DialogTitle>
            <DialogDescription>
              Choose your subscription plan to get started.
            </DialogDescription>
          </DialogHeader>
          {/* Subscription form or content here */}
        </DialogContent>
      </Dialog>

      {/* Lite Dialog */}
      <Dialog open={showLiteDialog} onOpenChange={setShowLiteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Lite Plan Details</DialogTitle>
            <DialogDescription>
              Details about the Lite plan.
            </DialogDescription>
          </DialogHeader>
          {/* Lite plan content here */}
        </DialogContent>
      </Dialog>

      {/* Pro Dialog */}
      <Dialog open={showProDialog} onOpenChange={setShowProDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pro Plan Details</DialogTitle>
            <DialogDescription>
              Details about the Pro plan.
            </DialogDescription>
          </DialogHeader>
          {/* Pro plan content here */}
        </DialogContent>
      </Dialog>

      <Dialog open={showTransferVideoDialog} onOpenChange={() => setShowTransferVideoDialog(false)}>
        <DialogContent className="sm:max-w-4xl max-w-[90vw]">
          <DialogHeader>
            <DialogTitle>Transfer Video</DialogTitle>
            <DialogDescription>
              Watch this video to learn how to transfer your videos to SaaSSuite.
            </DialogDescription>
          </DialogHeader>
          <div className="relative rounded-xl overflow-hidden shadow-2xl bg-black">
            <video controls poster="/lovable-uploads/770219d1-f336-4790-9824-dfab3747acd2.png" className="w-full aspect-video" preload="metadata">
              <source src="https://storage.googleapis.com/msgsndr/T69cI1milcirIORef4Ib/media/68a40816fcbcd6820d3b12aa.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showConfirmationDialog} onOpenChange={() => setShowConfirmationDialog(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirming Access</DialogTitle>
            <DialogDescription>
              Please wait while we confirm your access. This may take a few seconds.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center space-y-4">
            <CheckCircle className="w-12 h-12 text-green-500" />
            {!showLoginButton ? <p>Redirecting in {confirmationTimer} seconds...</p> : <Button onClick={() => setShowLoginDialog(true)}>Login Now</Button>}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAppointmentConfirmationDialog} onOpenChange={() => setShowAppointmentConfirmationDialog(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Thanks for Booking!</DialogTitle>
            <DialogDescription className="text-center">
              Thanks for booking a demo call with us.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <CheckCircle className="w-16 h-16 text-green-500" />
            <div className="space-y-3">
              <p className="text-gray-700">
                In the meantime, you can create an account to try our tool for free for 7 days so you can come to our call with questions.
              </p>
              <Button 
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                onClick={() => {
                  setShowAppointmentConfirmationDialog(false);
                  navigate(affiliateId ? `/signup?am_id=${affiliateId}` : "/signup");
                }}
              >
                Get Started
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      <StripeEmbeddedCheckout
        plan={checkoutPlan || "advanced"}
        open={checkoutPlan !== null}
        onOpenChange={(next) => { if (!next) setCheckoutPlan(null); }}
      />

      <Footer />
    </div>
  );
};

export default PromoPage;
