import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import Footer from "@/components/Footer";
import TestimonialsCarousel from "@/components/TestimonialsCarousel";
import SEO from "@/components/SEO";
import cyberWeekTitle from "@/assets/cyber-week-title.png";
import saassuiteLogo from "@/assets/saassuite-logo-cyber.png";
const CyberWeek = () => {
  const [step, setStep] = useState(1);
  const [hasAccount, setHasAccount] = useState<boolean | null>(null);
  const linkToShow = hasAccount === false ? "https://www.gohighlevel.com/cyber-monday-2025?fp_ref=howtousehighlevel" : "https://app.gohighlevel.com/holiday-promos?fp_ref=howtousehighlevel";
  
  // Calculate target time: 6 days, 14 hours, 50 minutes from now
  const getTargetTime = () => {
    const now = new Date();
    return new Date(now.getTime() + (6 * 24 * 60 * 60 * 1000) + (14 * 60 * 60 * 1000) + (50 * 60 * 1000));
  };
  
  const [timeLeft, setTimeLeft] = useState(() => {
    const target = getTargetTime();
    const diff = target.getTime() - new Date().getTime();
    return diff;
  });

  useEffect(() => {
    const target = getTargetTime();
    
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const diff = target.getTime() - now;
      
      if (diff <= 0) {
        setTimeLeft(0);
        clearInterval(interval);
      } else {
        setTimeLeft(diff);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (milliseconds: number) => {
    const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));
    const hours = Math.floor((milliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
    
    return { days, hours, minutes, seconds };
  };

  const { days, hours, minutes, seconds } = formatTime(timeLeft);
  const handleCopy = () => {
    navigator.clipboard.writeText(linkToShow);
    toast.success("Link copied to clipboard!");
  };
  const handleOpenLink = () => {
    window.location.href = linkToShow;
  };
  const handleAnswer = (answer: boolean) => {
    setHasAccount(answer);
    setStep(2);
  };

  const scrollToForm = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Meta Pixel Code
  // Meta Pixel is loaded once globally in index.html; PageView fires via MetaPixelRouteTracker.
  return <div className="min-h-screen" style={{ backgroundColor: '#0B0F1E' }}>
      <SEO title="Cyber Week Exclusive - SaaSSuite" description="Get exclusive Cyber Week access to over $11,000 in bonuses with SaaSSuite and HighLevel." />

      {/* Header */}
      <div className="border-b border-white/10" style={{ backgroundColor: '#0B0F1E' }}>
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-center">
            <a href="/" className="flex items-center space-x-3">
              <img src={saassuiteLogo} alt="SaaSSuite Logo" className="w-10 h-10" />
              <h1 className="text-3xl font-bold text-white">SaaSSuite</h1>
            </a>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="text-center mb-12 animate-fade-in">
          <img src={cyberWeekTitle} alt="Cyber Week" className="w-full max-w-2xl mx-auto mb-6" style={{ marginLeft: 'calc(50% - 15px)', transform: 'translateX(-50%)' }} />
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-8">
            Get 50% Off GHL + SaaSSuite Bonuses for FREE
          </h2>
        </div>

        {/* Step 1: Question */}
        {step === 1 && <Card className="p-8 shadow-lg animate-scale-in">
            <h2 className="text-2xl font-semibold text-center mb-8 text-foreground">
              Do you already have a HighLevel account?
            </h2>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" variant="outline" onClick={() => handleAnswer(false)} className="text-lg py-6 hover:scale-105 transition-transform">
                No, I don't
              </Button>
              <Button size="lg" onClick={() => handleAnswer(true)} className="text-lg py-6 hover:scale-105 transition-transform">
                Yes, I do
              </Button>
            </div>
          </Card>}

        {/* Step 2: Link Display */}
        {step === 2 && <Card className="p-8 shadow-lg animate-scale-in">
            <p className="text-center text-muted-foreground mb-6">
              Copy and save this link to access your bonuses:
            </p>

            {/* Link Display Box */}
            <div className="mb-6">
              <div className="flex gap-2">
                <Input value={linkToShow} readOnly className="flex-1 font-mono text-sm bg-muted" />
                <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0" aria-label="Copy">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Open Link Button */}
            <Button 
              size="lg" 
              onClick={handleOpenLink} 
              className="w-full mb-8 text-lg py-6 bg-gradient-to-r from-[#C506DC] to-[#1975E8] hover:from-[#C506DC]/90 hover:to-[#1975E8]/90 text-white font-bold shadow-[0_0_20px_rgba(197,6,220,0.5),0_0_40px_rgba(25,117,232,0.3)] hover:shadow-[0_0_30px_rgba(197,6,220,0.7),0_0_50px_rgba(25,117,232,0.5)] transition-all duration-300"
            >
              <ExternalLink className="mr-2 h-5 w-5" />
              CLAIM OFFER
            </Button>

            {/* Bonus Highlight */}
            <div className="bg-green-500/10 border-2 border-green-500 rounded-lg p-6">
              <p className="text-green-700 dark:text-green-400 font-semibold text-lg text-center mb-4">
                You're getting access to over $11,000 in bonuses by signing up under us!
              </p>
              <ul className="text-green-700 dark:text-green-400 font-medium text-left space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-xl shrink-0">✅</span>
                  <span>SaaSSuite Advanced</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-xl shrink-0">✅</span>
                  <span>25+ Onboarding Videos</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-xl shrink-0">✅</span>
                  <span>Done-For-You Email Warmup</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-xl shrink-0">✅</span>
                  <span>1000 Free Leads</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-xl shrink-0">✅</span>
                  <span>AI Chat Support</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-xl shrink-0">✅</span>
                  <span>And More!</span>
                </li>
              </ul>
            </div>

            {/* Back Button */}
            <div className="mt-6 text-center">
              <Button variant="ghost" onClick={() => {
            setStep(1);
            setHasAccount(null);
          }}>
                ← Start Over
              </Button>
            </div>
          </Card>}
        
        {/* Countdown Timer */}
        <div className="mt-6 text-center">
          <p className="text-white/80 text-sm mb-3">Offer ends in:</p>
          <div className="flex justify-center gap-3">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 min-w-[68px]">
              <div className="text-2xl font-bold text-white">{days}</div>
              <div className="text-[10px] text-white/70 uppercase mt-1">Days</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 min-w-[68px]">
              <div className="text-2xl font-bold text-white">{hours}</div>
              <div className="text-[10px] text-white/70 uppercase mt-1">Hours</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 min-w-[68px]">
              <div className="text-2xl font-bold text-white">{minutes}</div>
              <div className="text-[10px] text-white/70 uppercase mt-1">Minutes</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 min-w-[68px]">
              <div className="text-2xl font-bold text-white">{seconds}</div>
              <div className="text-[10px] text-white/70 uppercase mt-1">Seconds</div>
            </div>
          </div>
        </div>
      </div>

      {/* Review Widget / Testimonials */}
      <div className="mt-8 mb-16">
        <h2 className="text-3xl font-bold text-white text-center mb-8">What Our Customers Say</h2>
        <TestimonialsCarousel />
      </div>

      {/* CTA Button */}
      <div className="pb-16 text-center">
        <Button 
          size="lg" 
          onClick={scrollToForm}
          className="text-lg py-6 px-8 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700"
        >
          Claim the Cyber Week Offer
        </Button>
      </div>
    </div>;
};
export default CyberWeek;