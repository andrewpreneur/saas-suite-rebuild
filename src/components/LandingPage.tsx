import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { toast } from "sonner";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, CheckCircle, Star, Users, Zap, Shield, ArrowRight, Sparkles, CreditCard, Gift, X, Video, Menu, Check, User, Play, Headphones, Loader2, ArrowLeft, Plus } from "lucide-react";
import BumpCheckoutFlow from "@/components/bump/BumpCheckoutFlow";
import SaasPricingCards from '@/components/pricing/SaasPricingCards';
import type { CheckoutPlan } from '@/constants/pricingPlans';
import { Switch } from "@/components/ui/switch";
import { navigateWithParams } from "@/utils/preserveParams";
import VideoLibrary from "./VideoLibrary";
import BrandingToolShowcase from "./BrandingToolShowcase";
import AffiliateHighlight from "./AffiliateHighlight";
import AffiliatePromoSection from "./AffiliatePromoSection";

import AnimatedSection from "./AnimatedSection";
import Footer from "./Footer";
import TestimonialsCarousel from "./TestimonialsCarousel";
import VideoTestimonialsSection from "./VideoTestimonialsSection";
import FeatureHighlight from "./FeatureHighlight";
import TextRequestDialog from "./TextRequestDialog";
import videoOnboardingImage from "@/assets/video-onboarding.png";
import trackActivityImage from "@/assets/track-activity.png";
import customOnboardingImage from "@/assets/custom-onboarding.png";
import toggleVideosImage from "@/assets/toggle-videos.png";
import saassuiteLogo from "@/assets/saassuitelogo-dark.png";

interface LandingPageProps {
  bonusesMode?: boolean;
  onBonusesEmailSubmit?: (data: { email: string; name: string; phone: string }) => Promise<void> | void;
  onBonusesGoogle?: () => Promise<void> | void;
  bonusesLoading?: boolean;
  bonusesError?: string | null;
}

const LandingPage = ({
  bonusesMode = false,
  onBonusesEmailSubmit,
  onBonusesGoogle,
  bonusesLoading = false,
  bonusesError = null,
}: LandingPageProps = {}) => {
  const [email, setEmail] = useState("");
  const [bonusesEmail, setBonusesEmail] = useState("");
  const [bonusesName, setBonusesName] = useState("");
  const [bonusesPhone, setBonusesPhone] = useState("");
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
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
  const [isTextDialogOpen, setIsTextDialogOpen] = useState(false);
  const [affiliateId, setAffiliateId] = useState<string | null>(null);
  const [showGhlDialog, setShowGhlDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CheckoutPlan | null>(null);
  const [enhancedOn, setEnhancedOn] = useState(false);
  const [enhancedMounted, setEnhancedMounted] = useState(false);
  const [enhancedLeaving, setEnhancedLeaving] = useState(false);
  const [fullBuildOn, setFullBuildOn] = useState(false);
  const [fullBuildMounted, setFullBuildMounted] = useState(false);
  const [fullBuildLeaving, setFullBuildLeaving] = useState(false);

  const toggleEnhanced = (on: boolean) => {
    setEnhancedOn(on);
    if (on) {
      setEnhancedLeaving(false);
      setEnhancedMounted(true);
    } else {
      setEnhancedLeaving(true);
      window.setTimeout(() => { setEnhancedMounted(false); setEnhancedLeaving(false); }, 250);
    }
  };

  const toggleFullBuild = (on: boolean) => {
    if (on) {
      setFullBuildOn(true);
      setFullBuildLeaving(false);
      setFullBuildMounted(true);
    } else {
      setFullBuildLeaving(true);
      window.setTimeout(() => {
        setFullBuildOn(false);
        setFullBuildMounted(false);
        setFullBuildLeaving(false);
      }, 350);
    }
  };
  
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const heroVideoRef = useState<HTMLVideoElement | null>(null);
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

  // Meta Pixel now loads in index.html for all routes (fires before React hydration)

  // Check for affiliate ID in URL params and store it
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    // Support both ?ref= (affiliate slug, used by useAffiliateTracking) and
    // legacy ?am_id= (raw affiliate id). notify-stripe-purchase resolves
    // either a slug or a UUID, so passing whichever we have is fine.
    const refParam = searchParams.get('ref');
    const amId = searchParams.get('am_id');
    const resolved =
      refParam ||
      amId ||
      (typeof window !== 'undefined'
        ? localStorage.getItem('affiliate_ref') ||
          localStorage.getItem('affiliate_id') ||
          sessionStorage.getItem('affiliate_id')
        : null);
    if (resolved) {
      setAffiliateId(resolved);
      sessionStorage.setItem('affiliate_id', resolved);
    }
  }, [location.search]);

  // Check for hash-based routing for transfer video, confirmation, affiliate section, and signup
  useEffect(() => {
    if (location.hash === '#transfer-video') {
      setShowTransferVideoDialog(true);
    } else if (location.hash === '#confirmation') {
      setShowConfirmationDialog(true);
    } else if (location.hash === '#appointment-confirmed') {
      setShowAppointmentConfirmationDialog(true);
    } else if (location.hash === '#affiliate') {
      // Scroll to affiliate section
      setTimeout(() => {
        document.getElementById('affiliate-section')?.scrollIntoView({
          behavior: 'smooth'
        });
      }, 100);
    } else if (location.hash === '#signup') {
      // Scroll to direct access/signup section
      setTimeout(() => {
        document.getElementById('signup-section')?.scrollIntoView({
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
        // Cleanup script when dialog closes
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

      // Check if user already exists using secure function
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
        // Update last_accessed for existing user using secure function
        const updateSuccess = await supabase.rpc('update_user_access', {
          user_email: emailLower
        });
        if (!updateSuccess.data) {
          throw new Error('Failed to update user access');
        }

        // Set user in context
        setUser(existingUser.email, existingUser.id.toString(), existingUser.approval);
        if (existingUser.approval !== "NO") {
          toast.success("Welcome back! Access granted.");
          setShowLoginDialog(false);
          // Navigate to app page using React Router
          navigate(navigateWithParams("/app"));
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

  const handleSelectProduct = (product: CheckoutPlan) => {
    setSelectedProduct(product);
  };

  // Auto-open checkout when visiting /basic or /advanced
  useEffect(() => {
    if (location.pathname === '/basic') {
      setSelectedProduct('basic');
    } else if (location.pathname === '/advanced') {
      setSelectedProduct('advanced');
    }
  }, [location.pathname]);

  const handleCancelCheckout = () => {
    setSelectedProduct(null);
    setCheckoutError(null);
    setCheckoutLoading(false);
  };

  const openSignupForm = () => {
    navigate(navigateWithParams('/signup'));
  };

  const scrollToPricing = () => {
    document.getElementById('pricing-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const features = ["Streamline HighLevel interface", "Custom branding tools", "Step-by-step onboarding guides", "Marketing automation setup", "White-label customization", "AI-powered feature recommendations"];
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <a href="/" className="flex items-center space-x-3">
                <img src={saassuiteLogo} alt="SaaSSuite Logo" className="w-8 h-8 rounded-md" />
                <span className="text-2xl font-bold text-gray-900">SaaSSuite</span>
              </a>
              <Badge variant="secondary" className="ml-2 hidden sm:inline-flex">HighLevel White-Label Tool</Badge>
            </div>
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-3">
              <Button variant="outline" asChild>
                <a href="/login">Login</a>
              </Button>
              {!(user && session) && (
                <Button className="bg-purple-600 hover:bg-purple-700 text-white" onClick={scrollToPricing}>
                  Start for Free
                </Button>
              )}
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
               {!(user && session) && (
                 <Button className="bg-purple-600 hover:bg-purple-700 text-white w-full justify-start" onClick={() => {
                   setIsMobileMenuOpen(false);
                   scrollToPricing();
                 }}>
                   Start for Free
                 </Button>
               )}
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
          {/* Animated Logo/Icon removed */}

          {bonusesMode && (
            <div
              className="mb-6 flex justify-center opacity-0"
              style={{ animation: 'fadeInFromBlur 0.6s ease-out 0.2s forwards' }}
            >
              <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-to-r from-purple-600 to-purple-700 text-white text-sm font-semibold shadow-[0_4px_14px_0_rgba(147,51,234,0.35)]">
                <Sparkles className="w-4 h-4" />
                Hey Dallas Attendees!
              </div>
            </div>
          )}

          {/* Animated Header with Individual Word Animations */}
          {bonusesMode ? (
            <div className="mb-2 sm:text-[5.2rem] sm:leading-[5.6rem] text-gray-900 text-5xl font-bold sm:font-semibold text-center">
              <span
                className="inline-block mr-2 sm:mr-4 opacity-0"
                style={{ animation: 'fadeInFromBlur 0.6s ease-out 0.4s forwards' }}
              >
                Accept
              </span>
              <span
                className="inline-block mr-2 sm:mr-4 opacity-0"
                style={{ animation: 'fadeInFromBlur 0.6s ease-out 0.6s forwards' }}
              >
                Your Event
              </span>
              <span
                className="inline-block opacity-0"
                style={{ animation: 'fadeInFromBlur 0.6s ease-out 0.8s forwards' }}
              >
                Gifts Below!
              </span>
            </div>
          ) : (
          <>
          <div className="flex justify-center mb-6 opacity-0" style={{ animation: 'fadeInFromBlur 0.6s ease-out 0.2s forwards' }}>
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 shadow-sm border border-gray-200">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm font-medium text-gray-700">The Ultimate GHL SaaS System</span>
            </div>
          </div>
          <h1 className="mb-2 sm:text-[5.2rem] sm:leading-[5.6rem] text-gray-900 text-5xl font-bold sm:font-semibold text-center">
            <span 
              className="inline-block mr-2 sm:mr-4 opacity-0"
              style={{
                animation: 'fadeInFromBlur 0.6s ease-out 0.4s forwards'
              }}
            >
              Onboard.
            </span>
        <span 
          className="inline-block mr-2 sm:mr-4 opacity-0"
          style={{
            animation: 'fadeInFromBlur 0.6s ease-out 0.6s forwards'
          }}
        >
          Educate.
        </span>
        <span 
          className="inline-block opacity-0"
          style={{
            animation: 'fadeInFromBlur 0.6s ease-out 0.8s forwards'
          }}
        >
          Support.
        </span>
      </h1>
          </>
      )}

      {/* Subtitle with fade from blur */}
      <div 
        className="opacity-0"
        style={{
          animation: 'fadeInFromBlur 0.6s ease-out 1s forwards'
        }}
      >
        <p className="text-xl text-gray-600 mb-8">
          {bonusesMode
            ? "Claim your free SaaSSuite BASIC account + your seat for next week's exclusive webinar."
            : "Your journey to an AI powered, auto-pilot, HighLevel SaaS is just beginning..."}
        </p>
          </div>

          {/* Bonuses signup (Google + email) — shown above the video on /bonuses */}
          {bonusesMode && (
            <div
              className="opacity-0 max-w-md mx-auto mb-8"
              style={{ animation: 'fadeInFromBlur 0.6s ease-out 1.1s forwards' }}
            >
              <div className="bg-white/80 backdrop-blur rounded-2xl shadow-xl border border-purple-100 p-6 space-y-4">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full bg-white"
                  disabled={bonusesLoading}
                  onClick={() => onBonusesGoogle?.()}
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-gray-500">Or</span>
                  </div>
                </div>

                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (bonusesEmail && bonusesName.trim() && bonusesPhone.trim()) {
                      onBonusesEmailSubmit?.({
                        email: bonusesEmail,
                        name: bonusesName.trim(),
                        phone: bonusesPhone.trim(),
                      });
                    }
                  }}
                >
                  <Input
                    type="text"
                    value={bonusesName}
                    onChange={(e) => setBonusesName(e.target.value)}
                    placeholder="Full name"
                    required
                    maxLength={100}
                    className="bg-white"
                  />
                  <Input
                    type="email"
                    value={bonusesEmail}
                    onChange={(e) => setBonusesEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    className="bg-white"
                  />
                  <Input
                    type="tel"
                    value={bonusesPhone}
                    onChange={(e) => setBonusesPhone(e.target.value)}
                    placeholder="Phone number"
                    required
                    maxLength={30}
                    className="bg-white"
                  />
                  {bonusesError && (
                    <Alert variant="destructive">
                      <AlertDescription>{bonusesError}</AlertDescription>
                    </Alert>
                  )}
                  <Button
                    type="submit"
                    size="lg"
                    disabled={bonusesLoading}
                    className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl font-semibold shadow-[0_4px_14px_0_rgba(147,51,234,0.3)]"
                  >
                    {bonusesLoading ? 'Claiming...' : 'Claim My Bonuses'}
                  </Button>
                  <p className="text-xs text-center text-gray-500">No password required — finish setup on your laptop later tonight.</p>
                </form>
              </div>
            </div>
          )}
          
          {/* Video Player Section with fade from blur */}
          <div 
            className="opacity-0"
            style={{
              animation: 'fadeInFromBlur 0.6s ease-out 1.2s forwards'
            }}
          >
            {bonusesMode && (
              <div className="max-w-3xl mx-auto mb-4 flex flex-col items-center gap-2">
                <p className="text-lg sm:text-xl font-semibold text-gray-800">
                  Learn more about SaaSSuite
                </p>
                <ArrowRight className="w-6 h-6 text-purple-600 rotate-90 animate-bounce" />
              </div>
            )}
            <div className="max-w-3xl mx-auto mb-8">
              <div className="relative rounded-xl overflow-hidden shadow-2xl bg-black group">
                <video
                  id="hero-video"
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
                      const video = document.getElementById('hero-video') as HTMLVideoElement;
                      if (video) { video.play(); }
                    }}
                    className="absolute inset-0 flex items-center justify-center z-10 cursor-pointer group/btn"
                    aria-label="Play video"
                  >
                    <div className="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-[0_0_30px_rgba(94,22,234,0.4)]" style={{ backgroundColor: '#5E16EA' }}>
                      <Play className="w-6 h-6 text-white ml-0.5" fill="white" />
                    </div>
                  </button>
                )}
              </div>
            </div>
          </div>
          
          {/* Modified CTA Buttons */}
          {!bonusesMode && (
          <div 
            className="opacity-0"
            style={{
              animation: 'fadeInFromBlur 0.6s ease-out 1.4s forwards'
            }}
          >
            <div className="mb-4 max-w-md mx-auto">
              <Button
                size="lg"
                onClick={scrollToPricing}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-full font-semibold py-6 text-lg shadow-[0_4px_14px_0_rgba(147,51,234,0.3)] hover:shadow-[0_6px_20px_0_rgba(147,51,234,0.4)] transition-all duration-200 flex items-center justify-center gap-2"
              >
                Start For Free
                <ArrowRight className="w-5 h-5" />
              </Button>
            </div>

            
            {/* Trust Badge */}
            <div className="mb-12 flex items-center justify-center gap-2 text-gray-600">
               <Users className="w-5 h-5" />
               <span className="text-lg font-medium">Trusted by 1200+ Accounts</span>
             </div>
          </div>
          )}
          {bonusesMode && (
            <div className="mb-12 flex items-center justify-center gap-2 text-gray-600">
              <Users className="w-5 h-5" />
              <span className="text-lg font-medium">Trusted by 1200+ Accounts</span>
            </div>
          )}
        </div>
      </div>

      {/* Three Feature Highlights Section - Outside background */}
      <div className="max-w-6xl mx-auto px-6 pt-12 pb-2">
        <div className="grid md:grid-cols-3 gap-8 mb-2 max-w-5xl mx-auto items-center">
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
                   <Headphones className="w-8 h-8 text-green-600" />
                 </div>
                 <h3 className="text-xl font-semibold text-gray-900 mb-2">Support 24/7</h3>
                 <p className="text-gray-600">Use our AI Native support system to educate customers and reduce churn</p>
             </div>
           </div>
        </div>
      </div>

      {/* Testimonials Section - After feature cards */}
      <VideoTestimonialsSection />


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

      {/* Pricing Section */}
      <div id="pricing-section" className="py-20 bg-gradient-to-b from-gray-100/80 to-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <AnimatedSection animation="fade-in">
            <div className="text-center mb-12">
               <div className="flex items-center justify-center gap-2 sm:gap-4">
                 <span className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900">Start</span>
                 <img 
                   src="/assets/saassuite-pricing-logo.png" 
                   alt="SaaSSuite Logo" 
                   className="h-14 sm:h-20 md:h-24 w-auto drop-shadow-[0_8px_20px_rgba(0,0,0,0.3)]" 
                   style={{ transform: 'rotate(-6deg)' }}
                 />
                 <span className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900">for free.</span>
               </div>
               <p className="text-lg text-gray-500 max-w-xl mx-auto mt-4">
                 Whether you're just getting started or scaling your agency, there's a plan for you.
               </p>

               {/* SaaSSuite / Full Build Services switcher */}
               <div className="mt-8 inline-flex items-center rounded-full border border-purple-200 bg-white p-1.5 shadow-sm" role="tablist" aria-label="Pricing type">
                 <button
                   type="button"
                   role="tab"
                   aria-selected={!fullBuildOn}
                   onClick={() => fullBuildOn && toggleFullBuild(false)}
                   className={`px-5 sm:px-8 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 ${!fullBuildOn ? 'bg-[#8125D3] text-white shadow' : 'text-gray-500 hover:text-gray-900'}`}
                 >
                   SaaSSuite
                 </button>
                 <button
                   type="button"
                   role="tab"
                   aria-selected={fullBuildOn}
                   onClick={() => !fullBuildOn && toggleFullBuild(true)}
                   className={`px-5 sm:px-8 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 flex items-center gap-1.5 ${fullBuildOn ? 'bg-[#8125D3] text-white shadow' : 'text-gray-500 hover:text-gray-900'}`}
                 >
                   <Sparkles className="w-4 h-4" />
                   Full Build Services
                 </button>
               </div>

               {/* GHL / upgrade helper placed under the switcher */}
               <button 
                 onClick={() => setShowGhlDialog(true)}
                 className="block mx-auto mt-4 text-sm text-purple-600 hover:text-purple-800 underline underline-offset-2 transition-colors"
               >
                 Need GHL or Want to Upgrade?
               </button>
            </div>

              <div>
              {/* SaaS Pricing Cards */}
              {!fullBuildOn && <div style={{ animation: 'pricingGridIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) both' }}><SaasPricingCards onSelect={handleSelectProduct} onStarter={openSignupForm} /></div>}

              {/* Full Build Services Cards (toggle) */}
              {fullBuildMounted && (
                <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2">
                  {/* Done For You Business Build */}
                  <div
                    className="bg-white rounded-2xl p-8 border border-gray-200 flex flex-col shadow-[0_4px_24px_-4px_rgba(0,0,0,0.08)]"
                    style={{ animation: `${fullBuildLeaving ? 'premiumCardOut' : 'premiumCardIn'} 0.35s ease-out forwards` }}
                  >
                    <h3 className="text-2xl font-semibold text-gray-900 mb-2">Done For You Business Build</h3>
                    <p className="text-gray-500 mb-6">Full client builds and agency builds, built to your exact specs.</p>
                    <div className="flex items-baseline gap-1 mb-6">
                      <span className="text-5xl font-bold text-gray-900">$2,997</span>
                      <span className="text-gray-500">one-time</span>
                    </div>
                    <Button
                      className="w-full bg-[#8125D3] hover:bg-[#6f1fb5] text-white text-base py-5 rounded-xl mb-6"
                      onClick={() => navigate('/book')}
                    >
                      Book a Call
                    </Button>
                    <p className="text-gray-900 font-semibold text-sm mb-4">What's included:</p>
                    <div className="space-y-3">
                      {[
                        "Custom website build",
                        "HighLevel automations & workflows",
                        "Onboarding video series",
                        "Custom onboarding checklists",
                        "White-label branding setup",
                        "Menu link removal & navigation",
                        "AI chat support configuration",
                        "Done for you — or for your client"
                      ].map((feature, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <Check className="w-4 h-4 text-[#8125D3] mt-0.5 flex-shrink-0" />
                          <span className="text-gray-700 text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Premium GHL VA Placement */}
                  <div
                    className="bg-white rounded-2xl p-8 border border-gray-200 flex flex-col shadow-[0_4px_24px_-4px_rgba(0,0,0,0.08)]"
                    style={{ animation: `${fullBuildLeaving ? 'premiumCardOut' : 'premiumCardIn'} 0.35s ease-out forwards` }}
                  >
                    <h3 className="text-2xl font-semibold text-gray-900 mb-2">Premium GHL VA Placement</h3>
                    <p className="text-gray-500 mb-6">Trained GHL virtual assistants placed directly into your agency.</p>
                    <div className="flex items-baseline gap-1 mb-6">
                      <span className="text-5xl font-bold text-gray-900">$15</span>
                      <span className="text-gray-500">/ hr</span>
                    </div>
                    <Button
                      className="w-full bg-[#8125D3] hover:bg-[#6f1fb5] text-white text-base py-5 rounded-xl mb-6"
                      onClick={() => navigate('/book')}
                    >
                      Book a Call
                    </Button>
                    <p className="text-gray-900 font-semibold text-sm mb-4">What you get:</p>
                    <div className="space-y-3">
                      {[
                        "Vetted, GHL-trained virtual assistants",
                        "Placement matched to your agency needs",
                        "Flexible hourly billing",
                        "Support for builds, automations & ops",
                        "No long-term contracts required",
                        "Scale up or down as you grow"
                      ].map((feature, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <Check className="w-4 h-4 text-[#8125D3] mt-0.5 flex-shrink-0" />
                          <span className="text-gray-700 text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              </div>

             {/* Stripe Embedded Checkout */}
            <BumpCheckoutFlow
              plan={selectedProduct || "basic"}
              open={!!selectedProduct}
              onOpenChange={(open) => { if (!open) handleCancelCheckout(); }}
              email={email || undefined}
              affiliateId={affiliateId}
            />

            {/* Guarantee Badges */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
              <Badge variant="secondary" className="text-base px-6 py-2 bg-green-50 text-green-700 border-green-200">
                <Shield className="w-6 h-6 mr-2" />
                Secure Stripe Checkout
              </Badge>
              <Badge variant="secondary" className="text-base px-6 py-2 bg-blue-50 text-blue-700 border-blue-200">
                <CheckCircle className="w-4 h-4 mr-2" />
                Cancel anytime, no contracts
              </Badge>
            </div>

            {/* Agencies Love Button */}
            <div className="text-center mt-8">
              <Button
                variant="outline"
                size="lg"
                onClick={() => document.getElementById('testimonials-section')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-lg px-8 py-4 border-2 hover:bg-purple-50 hover:border-purple-400 transition-all duration-200"
              >
                Agencies Love SaaSSuite
                <Star className="w-5 h-5 ml-2 text-yellow-500 fill-yellow-500" />
              </Button>
            </div>
          </AnimatedSection>
        </div>
      </div>

      {/* Testimonials carousel (moved below pricing) */}
      {!bonusesMode && <section className="border-y border-border bg-background px-6 py-10 text-center">
        <p className="mb-4 text-lg font-semibold text-foreground">Want the whole thing done for you?</p>
        <Button
          size="lg"
          className="ghl-dfy-cta h-auto min-h-12 whitespace-normal rounded-lg px-6 py-3 text-base sm:text-lg"
          onClick={() => navigate(navigateWithParams('/ghldfy'))}
        >
          <span>We'll Build Your ENTIRE GHL <span className="block text-sm font-normal sm:ml-3 sm:inline">Learn More</span></span>
          <ArrowRight className="ml-3 h-5 w-5 shrink-0" />
        </Button>
      </section>}
      <div id="testimonials-section" className="max-w-6xl mx-auto px-6 pt-2 pb-12">
        <TestimonialsCarousel />
      </div>

      {/* Affiliate Program Promo */}
      <AffiliatePromoSection />


      <div className="max-w-6xl mx-auto px-6 py-12">

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
               Get direct access to transform your agency today.
             </p>
             <div className="flex flex-col sm:flex-row gap-4 justify-center">
               <Button size="lg" onClick={scrollToPricing}>
                 Start for Free
                 <ArrowRight className="w-5 h-5 ml-2" />
               </Button>
             </div>
          </div>
        </AnimatedSection>

         {/* Footer */}
         <div className="text-center text-gray-600">
           <p>&copy; 2025 SaaSSuite. All rights reserved.</p>
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
      <Dialog open={showSubscriptionDialog} onOpenChange={() => setShowSubscriptionDialog(false)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center">Start Your Subscription</DialogTitle>
            <DialogDescription className="text-center">
              {isYearly ? 'Complete your yearly subscription below' : 'Complete your monthly subscription below'}
            </DialogDescription>
          </DialogHeader>
          
          {/* Form Embed */}
          <div className="flex justify-center">
            {isYearly ? <iframe src="https://lynks.lynkific.com/widget/survey/U1xtz8JplvdjKQk2Z1Rw" style={{
            border: 'none',
            width: '100%',
            minHeight: '400px'
          }} scrolling="no" id="U1xtz8JplvdjKQk2Z1Rw" title="yearly subscription survey" /> : <iframe src="https://lynks.lynkific.com/widget/survey/3eLMVQk7vT2H03JIkQbB" style={{
            border: 'none',
            width: '100%',
            minHeight: '400px'
          }} scrolling="no" id="3eLMVQk7vT2H03JIkQbB" title="monthly subscription survey" />}
          </div>
        </DialogContent>
      </Dialog>

      {/* Lite Plan Dialog */}
      <Dialog open={showLiteDialog} onOpenChange={() => setShowLiteDialog(false)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center">Get Lite Access</DialogTitle>
            <DialogDescription className="text-center">
              Complete your Lite plan purchase below
            </DialogDescription>
          </DialogHeader>
          
          {/* Form Embed */}
          <div className="flex justify-center">
            <iframe 
              src="https://lynks.lynkific.com/widget/survey/fud5hPrLNbaTeKap4Mt9" 
              style={{
                border: 'none',
                width: '100%',
                minHeight: '400px'
              }} 
              scrolling="no" 
              id="fud5hPrLNbaTeKap4Mt9" 
              title="lite plan survey" 
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Pro+Growth Plan Dialog */}
      <Dialog open={showProDialog} onOpenChange={() => setShowProDialog(false)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center">Get Pro+Growth Access</DialogTitle>
            <DialogDescription className="text-center">
              Complete your Pro+Growth plan purchase below
            </DialogDescription>
          </DialogHeader>
          
          {/* Form Embed */}
          <div className="flex justify-center">
            <iframe 
              src="https://lynks.lynkific.com/widget/survey/2TEWrjD728dRKSVl98IO" 
              style={{
                border: 'none',
                width: '100%',
                minHeight: '400px'
              }} 
              scrolling="no" 
              id="2TEWrjD728dRKSVl98IO" 
              title="pro+growth plan survey" 
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Transfer Video Dialog */}
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

      {/* Confirmation Dialog */}
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

      {/* Appointment Confirmation Dialog */}
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
                  openSignupForm();
                }}
              >
                Get Started
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* GHL Affiliate Dialog */}
      <Dialog open={showGhlDialog} onOpenChange={setShowGhlDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center">Get SaaSSuite Free, Forever</DialogTitle>
            <DialogDescription className="text-center text-base pt-2">
              Don't pay us. Sign up for HighLevel through our links and get SaaSSuite for free, forever.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center pt-4">
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 text-base"
              onClick={() => window.open('https://gofreesaas.com', '_blank')}
            >
              Take me to your GHL affiliate links
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />

      {/* Fixed Help Button */}
      <button
        onClick={() => window.open('https://flowto.it/e9x57Mdihx?fc=0', '_blank')}
        className="fixed bottom-6 right-6 bg-primary text-primary-foreground rounded-full w-16 h-16 shadow-lg hover:bg-primary/90 transition-all flex items-center justify-center z-50"
        aria-label="Get help"
      >
        <span className="text-2xl font-bold">?</span>
      </button>
    </div>
  );
};
export default LandingPage;