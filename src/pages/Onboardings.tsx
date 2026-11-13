import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Calendar, Users, Video, FileText, ClipboardList, Sparkles, ArrowRight, Menu } from "lucide-react";
import PageSEO from "@/components/PageSEO";
import Footer from "@/components/Footer";
import saassuiteLogo from "@/assets/saassuitelogo-dark.png";

const features = [
  {
    icon: Calendar,
    title: "Our Signature 2-Call System",
    desc: "One call for tech setup, one call for training. Simple, effective, and easy for new users to digest.",
  },
  {
    icon: Users,
    title: "Kind, Knowledgeable, Professional Team",
    desc: "Our agents are trained to represent your brand with warmth and clarity, on camera and off.",
  },
  {
    icon: Video,
    title: "You Can Join (But You Won't Need To)",
    desc: "Most agency owners skip onboarding calls because they know their clients are in great hands.",
  },
];

const steps = [
  {
    n: "01",
    title: "Your client signs up through your funnel",
    desc: "They purchase your SaaS offer like normal—no changes needed on your end.",
  },
  {
    n: "02",
    title: "They fill out our onboarding form",
    desc: "Branded to your business, the form collects all the key info we need to get started (business name, domains, niche, etc.).",
  },
  {
    n: "03",
    title: "They schedule two calls",
    desc: "Tech Setup Call: we handle A2P, domains, social connections, numbers, chat widget, and more. Training Call: we walk them through how to actually use the system day-to-day.",
  },
  {
    n: "04",
    title: "You get all the credit",
    desc: "Fully white-labeled. Your clients think it's your team handling the entire onboarding experience.",
  },
];

const included = [
  { icon: ClipboardList, title: "Done-For-You Onboarding Snapshot", desc: "Includes our onboarding form, a 7-day after-purchase email sequence, and a 30/60/90-day check-in sequence (email + SMS) to ensure long-term client success." },
  { icon: FileText, title: "Custom Onboarding SOP for Your Agency", desc: "We build a step-by-step SOP mapped to your agency's preferences. No cookie-cutter scripts—every onboarding is tailored to you." },
  { icon: Sparkles, title: "Mock Onboarding Call (Optional)", desc: "Experience the full onboarding process as your clients would—before sending them our way." },
  { icon: Video, title: "Two 1-on-1 Zoom Calls Per Client", desc: "1 hour Tech Setup (A2P, domains, email, webchat, social, custom values) + 1 hour Training tailored to your agency's setup." },
  { icon: Calendar, title: "All Calls Recorded", desc: "Every call is recorded and sent to both your client and you—revisit anytime without having to attend." },
  { icon: Users, title: "Post-Onboarding Summary + Recording", desc: "A full recap with links to recordings so your clients (and you) can reference everything later." },
];

const PricingCard = ({
  name,
  perOnboarding,
  range,
  highlight,
}: {
  name: string;
  perOnboarding: string;
  range: string;
  highlight?: boolean;
}) => (
  <Card
    className={`relative p-8 flex flex-col bg-white ${
      highlight
        ? "border-purple-600 border-2 shadow-xl shadow-purple-600/20 scale-[1.02]"
        : "border-gray-200"
    }`}
  >
    {highlight && (
      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
        Best Value
      </span>
    )}
    <h3 className="text-2xl font-bold mb-2 text-gray-900">{name}</h3>
    <p className="text-gray-600 mb-6">{range}</p>
    <div className="mb-6">
      <span className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">{perOnboarding}</span>
      <span className="text-gray-600 ml-2">/ onboarding</span>
    </div>
    <ul className="space-y-3 mb-8 flex-1">
      {[
        "Full white-labeled experience",
        "2-call onboarding (tech + training)",
        "Custom SOP built for your agency",
        "All Zoom calls recorded & shared",
        "Post-onboarding summary",
        "Done-for-you onboarding snapshot",
      ].map((f) => (
        <li key={f} className="flex items-start gap-2">
          <Check className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
          <span className="text-sm text-gray-700">{f}</span>
        </li>
      ))}
    </ul>
    <Button size="lg" className={`w-full ${highlight ? "bg-purple-600 hover:bg-purple-700 text-white" : "bg-gray-900 hover:bg-gray-800 text-white"}`} asChild>
      <a href="https://saassuite.ai/book">Get Started</a>
    </Button>
  </Card>
);

const Onboardings = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white text-gray-900">
      <PageSEO
        title="White-Label Client Onboarding for HighLevel Agencies | SaaSSuite"
        description="Done-for-you white-label onboarding for your HighLevel SaaS clients. Two-call system, full tech setup, and training—handled by our team under your brand."
        path="/onboardings"
      />

      {/* Header */}
      <div className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <a href="/" className="flex items-center space-x-3">
                <img src={saassuiteLogo} alt="SaaSSuite Logo" className="w-8 h-8 rounded-md" />
                <h1 className="text-2xl font-bold text-gray-900">SaaSSuite</h1>
              </a>
              <Badge variant="secondary" className="ml-2 hidden sm:inline-flex">Done-For-You Onboarding</Badge>
            </div>
            <div className="hidden md:flex items-center space-x-3">
              <Button variant="outline" asChild>
                <a href="/login">Login</a>
              </Button>
              <Button className="bg-purple-600 hover:bg-purple-700 text-white" asChild>
                <a href="#pricing">Get Started</a>
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
                <a href="#pricing">Get Started</a>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-100/60 via-white to-white pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-purple-300/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-purple-200/40 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-6 py-24 text-center">
          <span className="inline-block bg-purple-100 text-purple-700 text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full mb-6">
            White-Label Done-For-You
          </span>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6 text-gray-900">
            Client Onboarding That Actually Gets Your Customers{" "}
            <span className="bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">Set Up Right</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 mb-10 max-w-3xl mx-auto">
            Because the sale isn't the finish line—<strong className="text-gray-900">it's the starting line.</strong>
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-600/20" asChild>
              <a href="#pricing">Get Started <ArrowRight className="ml-1 w-4 h-4" /></a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="https://saassuite.ai/book">Book a Demo</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-6 text-gray-900">You just closed a deal. Now what?</h2>
        <p className="text-lg text-gray-600 mb-6">
          Your client's excited—but how do you make sure they're fully set up, confident, and actually
          using what they bought?
        </p>
        <p className="text-lg text-gray-600 mb-10">
          If you've ever tried onboarding clients yourself, you know the pain. Waiting on domain logins,
          forgotten Facebook passwords, explaining what a DNS record is for the hundredth time.
        </p>
        <div className="bg-gradient-to-br from-purple-50 to-white border border-purple-200 rounded-2xl p-8 shadow-sm">
          <h3 className="text-2xl font-bold mb-3 text-gray-900">That's where SaaSSuite comes in.</h3>
          <p className="text-gray-600">
            Send your clients our way and we'll make sure all the tech is set up correctly and they're
            fully trained on how to use your system—under your brand.
          </p>
        </div>
      </section>

      {/* Why */}
      <section className="bg-white border-y border-gray-200 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-14 text-gray-900">
            Why Agencies Choose Our White-Label Onboarding
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((f) => (
              <Card key={f.title} className="p-8 border-gray-200 hover:border-purple-300 hover:shadow-lg transition-all">
                <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center mb-4">
                  <f.icon className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900">{f.title}</h3>
                <p className="text-gray-600">{f.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-14 text-gray-900">How It Works</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {steps.map((s) => (
            <Card key={s.n} className="p-8 border-gray-200 bg-white hover:shadow-lg transition-all">
              <div className="text-sm font-bold text-purple-600 mb-2">STEP {s.n}</div>
              <h3 className="text-2xl font-bold mb-3 text-gray-900">{s.title}</h3>
              <p className="text-gray-600">{s.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Included */}
      <section className="bg-white border-y border-gray-200 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-14 text-gray-900">
            What's Included in Every Onboarding
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {included.map((it) => (
              <Card key={it.title} className="p-6 border-gray-200 hover:border-purple-300 hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center mb-4">
                  <it.icon className="w-5 h-5 text-purple-600" />
                </div>
                <h3 className="text-lg font-bold mb-2 text-gray-900">{it.title}</h3>
                <p className="text-sm text-gray-600">{it.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-5xl font-bold mb-4 text-gray-900">Simple, Volume-Based Pricing</h2>
          <p className="text-lg text-gray-600">
            The more onboardings you book, the less you pay per client. No contracts, no monthly fees.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <PricingCard
            name="Starter"
            perOnboarding="$60"
            range="Under 100 onboardings"
          />
          <PricingCard
            name="Scale"
            perOnboarding="$45"
            range="100+ onboardings"
            highlight
          />
        </div>
        <p className="text-center text-sm text-gray-600 mt-8">
          Not sure which tier you need? <a href="https://saassuite.ai/book" className="text-purple-600 hover:text-purple-700 underline underline-offset-4">Book a call</a> and we'll help you figure it out.
        </p>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-br from-purple-600 to-purple-800 text-white py-20">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Stop losing clients to bad onboarding.
          </h2>
          <p className="text-lg md:text-xl opacity-90 mb-10">
            Hand it off to a team that does this every day—and watch your retention go up.
          </p>
          <Button size="lg" className="bg-white text-purple-700 hover:bg-gray-100" asChild>
            <a href="https://saassuite.ai/book">Book Your Discovery Call <ArrowRight className="ml-1 w-4 h-4" /></a>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Onboardings;