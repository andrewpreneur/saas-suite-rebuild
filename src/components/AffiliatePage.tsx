import { useEffect, useRef, useState } from "react";
import PageSEO from "@/components/PageSEO";
import { buildBreadcrumbJsonLd } from "@/lib/seoJsonLd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Star,
  Users,
  DollarSign,
  Gift,
  ArrowRight,
  Car,
  Percent,
  ClipboardCheck,
  Share2,
  Banknote,
  Calculator,
  BarChart3,
  PlayCircle,
  MessageCircle,
} from "lucide-react";
import TestimonialsCarousel from "./TestimonialsCarousel";
import VideoTestimonialsSection from "./VideoTestimonialsSection";
import AnimatedSection from "./AnimatedSection";
import Footer from "./Footer";
import FeatureHighlight from "./FeatureHighlight";
import { useNavigate } from "react-router-dom";
import videoOnboardingImage from "@/assets/video-onboarding.png";
import trackActivityImage from "@/assets/track-activity.png";
import customOnboardingImage from "@/assets/custom-onboarding.png";
import toggleVideosImage from "@/assets/toggle-videos.png";
import affiliateOg from "@/assets/affiliate-og.jpg";

// Affiliate earnings testimonials. The section stays hidden while this is empty.
const AFFILIATE_WINS: { name: string; earnings: string; quote: string }[] = [];

const FAQS = [
  {
    q: "How long does the referral cookie last?",
    a: "60 days. If someone clicks your link and signs up within 60 days, they're credited to you.",
  },
  {
    q: "When and how do I get paid?",
    a: "By bank transfer on the 1st and 15th of each month. There's no minimum payout.",
  },
  {
    q: "Do I need to be a SaaSSuite customer?",
    a: "No. Joining is free. Refer your first customer and you also get free SaaSSuite access for as long as they stay.",
  },
  {
    q: "Can I promote to my own HighLevel clients?",
    a: "Yes. Your own clients and agency network are the best place to start.",
  },
  {
    q: "How does the 10% sub-affiliate commission work?",
    a: "When someone you referred becomes an affiliate, you earn 10% recurring on every customer they bring in, on top of your own 30%.",
  },
  {
    q: "What if a customer cancels?",
    a: "Commissions are paid for as long as the customer stays subscribed. When they cancel, commissions on that customer stop.",
  },
];

const fmt = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

const AffiliatePage = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    listSize: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSlug, setSubmittedSlug] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [submittedName, setSubmittedName] = useState<string | null>(null);
  const navigate = useNavigate();
  const [referrals, setReferrals] = useState(10);
  const [planPrice, setPlanPrice] = useState("97");
  const monthly = referrals * Number(planPrice) * 0.3;
  const heroRef = useRef<HTMLElement>(null);
  const [showSticky, setShowSticky] = useState(false);
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setShowSticky(!e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.listSize) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      // Generate slug from first name (lowercase, no spaces)
      const firstName = formData.name
        .split(" ")[0]
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      let slug = firstName;

      // Check if slug already exists, append number if needed
      const { data: existingSlugs } = await supabase
        .from("affiliates")
        .select("affiliate_slug")
        .like("affiliate_slug", `${firstName}%`);

      if (existingSlugs && existingSlugs.length > 0) {
        const existingSet = new Set(existingSlugs.map((s) => s.affiliate_slug));
        let counter = 1;
        while (existingSet.has(slug)) {
          slug = `${firstName}${counter}`;
          counter++;
        }
      }

      const { error } = await supabase.from("affiliates").insert({
        full_name: formData.name,
        email: formData.email,
        company: formData.company || null,
        network_size: formData.listSize,
        audience_description: formData.message || null,
        affiliate_slug: slug,
      });

      if (error) {
        console.error("Error submitting affiliate application:", error);
        toast.error("Something went wrong. Please try again.");
        return;
      }

      // Also update saas_suite_users if they have an account (will be fully enabled on admin approval)
      await supabase
        .from("saas_suite_users")
        .update({ affiliate_slug: slug })
        .eq("email", formData.email);

      toast.success("Application submitted successfully! We'll be in touch soon.");
      setSubmittedSlug(slug);
      setSubmittedEmail(formData.email.trim().toLowerCase());
      setSubmittedName(formData.name);
      // Scroll the success card into view
      setTimeout(() => {
        document
          .getElementById("affiliate-form")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    } catch (error) {
      console.error("Error submitting affiliate application:", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollToForm = () => {
    document
      .getElementById("affiliate-form-section")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <PageSEO
        title="SaaSSuite Affiliate Program — 30% Recurring Commissions"
        description="Earn 30% recurring commission for life promoting SaaSSuite to HighLevel agencies, plus 10% on sub-affiliates and a $1,000/month car bonus. Free to join, approved instantly."
        path="/affiliate"
        image={`https://saassuite.ai${affiliateOg}`}
        jsonLd={buildBreadcrumbJsonLd([{ name: "Affiliate Program", path: "/affiliate" }])!}
      />

      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-30">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
            <div className="flex items-center justify-between gap-3">
              <a href="/" className="flex items-center gap-2">
                <img
                  src="/lovable-uploads/f3f326f8-20fd-4406-a246-f4b2dbc34614.png"
                  alt="SaaSSuite Logo"
                  className="w-8 h-8"
                />
                <span className="text-xl sm:text-2xl font-bold text-gray-900">SaaSSuite</span>
                <Badge variant="secondary" className="ml-1 hidden sm:inline-flex">
                  Affiliate Program
                </Badge>
              </a>
              <div className="flex items-center gap-2">
                <Button variant="ghost" asChild className="hidden sm:inline-flex">
                  <a href="/auth">Sign In</a>
                </Button>
                <Button
                  className="bg-[#6043ef] hover:bg-[#6043ef]/90 text-white"
                  onClick={scrollToForm}
                >
                  Become an Affiliate
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          {/* 1. HERO */}
          <section ref={heroRef} className="text-center mb-10">
            <Badge
              variant="secondary"
              className="mb-5 bg-[#6043ef]/10 text-[#6043ef] border-[#6043ef]/20"
            >
              SaaSSuite Affiliate Program
            </Badge>
            <h1 className="text-3xl sm:text-5xl font-bold text-gray-900 leading-tight max-w-4xl mx-auto mb-5">
              Earn <span className="text-[#6043ef]">30% Recurring for Life</span> — Promote the Tool
              That Keeps Your HighLevel Clients From Churning
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-7">
              SaaSSuite adds video onboarding inside HighLevel so clients stick around. Your clients
              stay longer, you earn every month they do.
            </p>
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-8">
              {[
                { icon: Percent, label: "30% lifetime recurring" },
                { icon: Users, label: "10% on sub-affiliates" },
                { icon: Car, label: "$1,000/mo car bonus" },
              ].map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-2 rounded-full border border-[#6043ef]/20 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm"
                >
                  <Icon className="w-4 h-4 text-[#6043ef]" /> {label}
                </span>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                className="bg-[#6043ef] hover:bg-[#6043ef]/90 text-white w-full sm:w-auto"
                onClick={scrollToForm}
              >
                Become an Affiliate <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <button
                type="button"
                className="text-[#6043ef] font-medium hover:underline"
                onClick={() =>
                  document
                    .getElementById("earnings-calculator")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Calculate your earnings ↓
              </button>
            </div>
          </section>

          <AnimatedSection animation="scale-in" delay={150}>
            <div className="max-w-3xl mx-auto mb-20">
              <div className="relative rounded-xl overflow-hidden shadow-2xl bg-black">
                <video
                  controls
                  poster="https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/69ce0b2e66c8fcfd16f88de4.gif"
                  className="w-full aspect-video"
                  preload="metadata"
                >
                  <source
                    src="https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/69ce0b282a8b886979f996f5.mov"
                    type="video/mp4"
                  />
                  Your browser does not support the video tag.
                </video>
              </div>
            </div>
          </AnimatedSection>

          {/* 2. HOW IT WORKS */}
          <section className="mb-20">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-10">How it works</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  icon: ClipboardCheck,
                  title: "1. Apply",
                  text: "Takes 60 seconds. You're approved instantly and get your link right away.",
                },
                {
                  icon: Share2,
                  title: "2. Share your link",
                  text: "Use our demo videos to show agencies how SaaSSuite works, then share your personal link.",
                },
                {
                  icon: Banknote,
                  title: "3. Get paid",
                  text: "Paid by bank transfer on the 1st and 15th of each month. No minimum payout.",
                },
              ].map(({ icon: Icon, title, text }) => (
                <Card key={title} className="border-gray-200">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-xl bg-[#6043ef]/10 flex items-center justify-center mb-4">
                      <Icon className="w-6 h-6 text-[#6043ef]" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
                    <p className="text-gray-600">{text}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* 3. EARNINGS CALCULATOR */}
          <section id="earnings-calculator" className="mb-20 scroll-mt-24">
            <Card className="border-2 border-[#6043ef]/20 bg-gradient-to-br from-[#6043ef]/5 to-white max-w-4xl mx-auto">
              <CardContent className="p-6 sm:p-10">
                <div className="flex items-center gap-2 mb-2">
                  <Calculator className="w-6 h-6 text-[#6043ef]" />
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                    Earnings calculator
                  </h2>
                </div>
                <p className="text-gray-600 mb-8">
                  See what your referrals could pay you every month.
                </p>
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-8">
                    <div>
                      <div className="flex justify-between mb-3">
                        <Label htmlFor="ref-count">How many clients/agencies will you refer?</Label>
                        <span className="font-bold text-[#6043ef]">{referrals}</span>
                      </div>
                      <Slider
                        id="ref-count"
                        min={1}
                        max={100}
                        step={1}
                        value={[referrals]}
                        onValueChange={(v) => setReferrals(v[0])}
                        aria-label="Number of referrals"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-2">
                        <span>1</span>
                        <span>100</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Plan they choose</Label>
                      <Select value={planPrice} onValueChange={setPlanPrice}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="27">Basic — $27/mo</SelectItem>
                          <SelectItem value="97">Advanced — $97/mo</SelectItem>
                          <SelectItem value="297">Premium Support — $297/mo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div
                    className="rounded-xl bg-white border border-[#6043ef]/20 p-6 flex flex-col justify-center"
                    aria-live="polite"
                  >
                    <p className="text-sm text-gray-500">Monthly commission</p>
                    <p className="text-4xl font-bold text-[#6043ef] mb-4">{fmt(monthly)}</p>
                    <p className="text-sm text-gray-500">Yearly commission</p>
                    <p className="text-2xl font-bold text-gray-900 mb-4">{fmt(monthly * 12)}</p>
                    <p className="text-sm text-gray-700 font-medium">
                      Plus 10% of everything your sub-affiliates earn
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-6">
                  Estimates only. Earnings depend on your effort and audience; not a guarantee of
                  income.
                </p>
              </CardContent>
            </Card>
          </section>

          {/* 4. REWARD TIERS */}
          <section className="mb-20" data-tip-target="affiliate-rewards">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-3">Reward tiers</h2>
            <p className="text-gray-600 text-center mb-10">
              The more you refer, the more you unlock.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                {
                  icon: Gift,
                  name: "Level 1",
                  req: "Refer your first customer",
                  reward: "Free SaaSSuite access + 30% commission",
                  note: "Free access lasts as long as that customer stays.",
                },
                {
                  icon: DollarSign,
                  name: "Level 2",
                  req: "Every customer you refer",
                  reward: "30% recurring revenue",
                  note: "Example: 10 Advanced customers ≈ $291/month.",
                },
                {
                  icon: Users,
                  name: "Second Tier",
                  req: "A referral becomes an affiliate",
                  reward: "10% on their referrals",
                  note: "On top of your 30%. Optional: pass part of your commission on as a discount.",
                },
              ].map(({ icon: Icon, name, req, reward, note }) => (
                <Card key={name} className="border-gray-200">
                  <CardContent className="p-6 flex flex-col h-full">
                    <Icon className="w-7 h-7 text-[#6043ef] mb-3" />
                    <h3 className="text-lg font-bold text-gray-900">{name}</h3>
                    <p className="text-xs uppercase tracking-wide text-gray-500 mt-3">To unlock</p>
                    <p className="text-gray-900 font-medium mb-3">{req}</p>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Reward</p>
                    <p className="text-[#6043ef] font-bold mb-3">{reward}</p>
                    <p className="text-sm text-gray-600 mt-auto">{note}</p>
                  </CardContent>
                </Card>
              ))}
              <Card className="border-2 border-[#6043ef] shadow-xl relative bg-gradient-to-br from-[#6043ef]/10 to-white">
                <Badge className="absolute -top-3 left-6 bg-[#6043ef] text-white hover:bg-[#6043ef]">
                  Elite
                </Badge>
                <CardContent className="p-6 flex flex-col h-full">
                  <Car className="w-7 h-7 text-[#6043ef] mb-3" />
                  <h3 className="text-lg font-bold text-gray-900">
                    Level 3: Supercar SaaS Program
                  </h3>
                  <p className="text-xs uppercase tracking-wide text-gray-500 mt-3">To unlock</p>
                  <p className="text-gray-900 font-medium mb-3">100 active sign-ups</p>
                  <p className="text-3xl font-extrabold text-[#6043ef] leading-tight">
                    $1,000/month
                  </p>
                  <p className="text-sm font-semibold text-gray-900 mb-3">car bonus</p>
                  <img
                    src="/lovable-uploads/e6427c65-4e30-42a1-9096-3cb91ccac070.png"
                    alt="Luxury sports car"
                    loading="lazy"
                    className="w-full h-28 object-cover rounded-lg mb-3"
                  />
                  <p className="text-sm text-gray-600 mt-auto">
                    Mercedes-AMG GT, Aston Martin, BMW M4, Porsche 911 or comparable. Plus priority
                    support and a dedicated account manager.
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* 5. WHY IT'S EASY TO SELL */}
          <section className="mb-20">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">Why it's easy to sell</h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                You're not selling another tool — you're selling lower churn to people who already
                use HighLevel.
              </p>
            </div>
            <div className="space-y-4 mb-8">
              <FeatureHighlight
                title="Video Onboarding Inside Your SaaS"
                description="Seamlessly embed professional onboarding videos directly within your SaaS platform. Guide clients through setup with video tutorials that reduce support tickets and speed up time-to-value."
                image={videoOnboardingImage}
                imagePosition="right"
              />
              <FeatureHighlight
                title="Track Activity of Your Users"
                description="Monitor engagement and progress with activity tracking. See which features land and where clients need more help."
                image={trackActivityImage}
                imagePosition="left"
              />
              <FeatureHighlight
                title="Create Custom Onboarding Experiences"
                description="Design personalized onboarding journeys with custom video sequences, branding, and content flow that match the agency's identity."
                image={customOnboardingImage}
                imagePosition="right"
              />
              <FeatureHighlight
                title="Toggle On/Off Videos To Tailor Client Education"
                description="Enable or disable specific videos to build learning paths that match each client's experience level."
                image={toggleVideosImage}
                imagePosition="left"
              />
            </div>
            <div className="max-w-3xl mx-auto rounded-xl border-l-4 border-[#6043ef] bg-[#6043ef]/5 p-5 sm:p-6">
              <p className="font-semibold text-gray-900">Already a HighLevel affiliate?</p>
              <p className="text-gray-700">
                SaaSSuite stacks on top — same audience, extra recurring income.
              </p>
            </div>
          </section>

          {/* 6. WHAT YOU GET */}
          <section className="mb-20" data-tip-target="affiliate-benefits">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-10">
              What you get as an affiliate
            </h2>
            <div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {[
                {
                  icon: BarChart3,
                  title: "Real-time dashboard",
                  text: "Track clicks, sign-ups and earnings as they happen.",
                },
                {
                  icon: PlayCircle,
                  title: "Demo videos",
                  text: "Ready-to-share videos that show agencies exactly how it works.",
                },
                {
                  icon: MessageCircle,
                  title: "Private community",
                  text: "Swap ideas and wins with other SaaSSuite affiliates.",
                },
              ].map(({ icon: Icon, title, text }) => (
                <div key={title} className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-[#6043ef]/10 rounded-full flex items-center justify-center">
                    <Icon className="w-8 h-8 text-[#6043ef]" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
                  <p className="text-gray-600">{text}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 7. PROOF */}
          <section className="mb-20">
            {AFFILIATE_WINS.length > 0 && (
              <div className="mb-14">
                <h2 className="text-3xl font-bold text-gray-900 text-center mb-8">
                  Affiliate wins
                </h2>
                <div className="grid md:grid-cols-3 gap-5">
                  {AFFILIATE_WINS.map((w) => (
                    <Card key={w.name}>
                      <CardContent className="p-6">
                        <p className="text-2xl font-bold text-[#6043ef] mb-2">{w.earnings}</p>
                        <p className="text-gray-700 mb-3">“{w.quote}”</p>
                        <p className="text-sm font-semibold text-gray-900">{w.name}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-2">
              Your clients will thank you
            </h2>
            <VideoTestimonialsSection />
            <div className="mt-8">
              <TestimonialsCarousel />
            </div>
          </section>

          {/* 8. APPLICATION FORM */}
          <section id="affiliate-form-section" className="max-w-2xl mx-auto mb-20 scroll-mt-24">
            <p className="text-center text-sm font-medium text-gray-600 mb-4">
              Free to join · No minimum sales · Approved instantly
            </p>
            <Card
              className="border-2 border-[#6043ef]/20 bg-gradient-to-br from-[#6043ef]/5 to-white"
              data-tip-target="affiliate-form-card"
            >
              <CardHeader className="text-center">
                <CardTitle className="text-2xl font-bold text-gray-900 flex items-center justify-center">
                  <Users className="w-6 h-6 text-[#6043ef] mr-2" />
                  Become an Affiliate
                </CardTitle>
                <CardDescription className="text-gray-600">Takes about 60 seconds</CardDescription>
              </CardHeader>
              <CardContent id="affiliate-form">
                {submittedSlug ? (
                  <div className="space-y-5 text-center py-2">
                    <div className="mx-auto w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                      <Star className="w-7 h-7 text-green-600 fill-green-600" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">
                        You're in{submittedName ? `, ${submittedName.split(" ")[0]}` : ""}!
                      </h3>
                      <p className="text-gray-600">
                        Check your email for your affiliate link and starter kit.
                      </p>
                    </div>
                    <div className="bg-[#6043ef]/5 border border-[#6043ef]/20 rounded-lg p-4 text-left">
                      <p className="text-xs text-gray-500 mb-1">Your affiliate ID</p>
                      <p className="font-mono text-lg font-semibold text-[#6043ef]">
                        {submittedSlug}
                      </p>
                    </div>
                    <Button
                      size="lg"
                      className="w-full bg-[#6043ef] hover:bg-[#6043ef]/90 text-white"
                      onClick={() => {
                        const params = new URLSearchParams({
                          email: submittedEmail || "",
                          ref: submittedSlug,
                          affiliate_signup: "1",
                        });
                        navigate(`/signup?${params.toString()}`);
                      }}
                    >
                      Create my account
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <p className="text-xs text-gray-500">
                      Takes less than a minute — sign up with email or Google.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name *</Label>
                      <Input
                        id="name"
                        type="text"
                        autoComplete="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Your full name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address *</Label>
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="your@email.com"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company">Agency name</Label>
                      <Input
                        id="company"
                        type="text"
                        autoComplete="organization"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        placeholder="Your agency name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="listSize">Size of Your HighLevel User Network *</Label>
                      <Select
                        value={formData.listSize}
                        onValueChange={(value) => setFormData({ ...formData, listSize: value })}
                      >
                        <SelectTrigger id="listSize">
                          <SelectValue placeholder="Select network size" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1-10">1-10 HighLevel users</SelectItem>
                          <SelectItem value="11-25">11-25 HighLevel users</SelectItem>
                          <SelectItem value="26-50">26-50 HighLevel users</SelectItem>
                          <SelectItem value="51-100">51-100 HighLevel users</SelectItem>
                          <SelectItem value="100+">100+ HighLevel users</SelectItem>
                          <SelectItem value="building">Building my network</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="message">Tell us about your audience</Label>
                      <Textarea
                        id="message"
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        placeholder="Describe your HighLevel user network, community, or audience..."
                        rows={4}
                      />
                    </div>
                    <Button
                      type="submit"
                      size="lg"
                      className="w-full bg-[#6043ef] hover:bg-[#6043ef]/90 text-white"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Submitting..." : "Become an Affiliate"}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </section>

          {/* 9. FAQ */}
          <section className="max-w-3xl mx-auto mb-20">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-8">Questions</h2>
            <Accordion type="single" collapsible className="space-y-3">
              {FAQS.map((f, i) => (
                <AccordionItem
                  key={f.q}
                  value={`faq-${i}`}
                  className="border border-gray-200 rounded-lg bg-white px-5"
                >
                  <AccordionTrigger className="text-left hover:no-underline">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-600">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            <p className="text-center text-sm text-gray-600 mt-6">
              Read the full{" "}
              <a href="/terms" className="text-[#6043ef] hover:underline">
                affiliate terms
              </a>
              .
            </p>
          </section>

          {/* 10. FINAL CTA */}
          <section className="mb-16 rounded-2xl bg-gradient-to-br from-[#6043ef] to-[#4a32c9] p-8 sm:p-12 text-center text-white">
            <h2 className="text-2xl sm:text-4xl font-bold mb-6">
              Your clients already need this. Start earning from it.
            </h2>
            <Button
              size="lg"
              variant="secondary"
              className="bg-white text-[#6043ef] hover:bg-white/90"
              onClick={scrollToForm}
            >
              Become an Affiliate <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </section>

          <p className="text-xs text-gray-500 text-center max-w-3xl mx-auto mb-8">
            Earnings shown are examples, not a guarantee of income; results depend on your effort
            and audience. Affiliates must disclose their affiliate relationship when promoting.
          </p>

          <Footer />
        </div>

        {/* Sticky mobile CTA */}
        <div
          className={`sm:hidden fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur px-4 pt-3 transition-transform duration-200 ${showSticky ? "translate-y-0" : "translate-y-full"}`}
          style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
          aria-hidden={!showSticky}
        >
          <Button
            size="lg"
            className="w-full bg-[#6043ef] hover:bg-[#6043ef]/90 text-white"
            onClick={scrollToForm}
            tabIndex={showSticky ? 0 : -1}
          >
            Become an Affiliate
          </Button>
        </div>
      </div>
    </>
  );
};

export default AffiliatePage;
