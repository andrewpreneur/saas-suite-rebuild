import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, ArrowUp, Users, Bot, Sparkles, Cpu, Youtube } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import Footer from "@/components/Footer";
import AnimatedSection from "@/components/AnimatedSection";
import SEO from "@/components/SEO";
import andrewGeorgeImage from "@/assets/andrew-george.png";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const AIWebinar = () => {
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email) {
      toast.error("Please fill in your name and email.");
      return;
    }
    setIsSubmitting(true);
    try {
      // Store in Supabase
      const { error } = await supabase.from("ai_webinar_registrations" as any).insert({
        first_name: fullName,
        last_name: null,
        email: email.toLowerCase(),
      } as any);
      if (error) throw error;

      // Fire webhook
      try {
        await supabase.functions.invoke("notify-ai-webinar-webhook", {
          body: { full_name: fullName, email: email.toLowerCase() },
        });
      } catch (webhookErr) {
        console.error("Webhook error (non-blocking):", webhookErr);
      }

      setIsConfirmed(true);
    } catch (err: any) {
      console.error(err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <SEO
        title="AI SaaS & Agents Webinar | SaaSSuite"
        description="Learn how to build and sell AI-powered SaaS tools and AI agents on HighLevel. Register for our upcoming workshop."
        image="/assets/webinar-social.png"
      />
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        {/* Header */}
        <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-center">
              <Link to="/" className="flex items-center justify-center">
                <img src="/assets/saassuite-logo.png" alt="SaaSSuite Logo" className="h-11 w-auto" />
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-0">
          {/* Hero Section */}
          <div
            className="relative mx-auto px-6 py-12 mb-12"
            style={{
              backgroundImage: "url(/assets/hero-bg.png)",
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              borderRadius: "25px",
            }}
          >
            <div className="text-center mb-8">
              <AnimatedSection animation="fade-blur" delay={0}>
                <div className="inline-block bg-[#882BDB] text-white px-6 py-2 rounded-full mb-4 font-bold text-sm tracking-wide">
                  🤖 ATTENTION HIGHLEVEL USERS
                </div>
              </AnimatedSection>
              <AnimatedSection animation="fade-blur" delay={150}>
                <h1 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
                  How To Build & Sell <span className="text-[#882BDB]">AI-Powered SaaS Tools</span> & AI Agents on HighLevel
                </h1>
              </AnimatedSection>
              <AnimatedSection animation="fade-blur" delay={300}>
                <p className="text-muted-foreground mb-8 text-xl font-medium">
                  ...and charge premium prices while your AI does the heavy lifting
                </p>
              </AnimatedSection>

              <AnimatedSection animation="fade-blur" delay={450} className="max-w-md mx-auto">
                <Button
                  size="lg"
                  onClick={() => setIsRegistrationOpen(true)}
                  className="w-full bg-[#882BDB] hover:bg-[#882BDB]/90 text-white font-bold text-xl px-8 py-6 mb-4"
                >
                  SAVE MY SEAT
                </Button>
              </AnimatedSection>
              <AnimatedSection animation="fade-blur" delay={600} className="max-w-md mx-auto">
                <p className="text-muted-foreground text-sm font-medium">
                  &gt;&gt; Free Workshop — Date TBD — Register Now to Reserve Your Spot &lt;&lt;
                </p>
              </AnimatedSection>

              <AnimatedSection animation="fade-blur" delay={100}>
                <div className="flex items-center justify-center gap-2 mt-6 text-muted-foreground">
                  <Users className="w-5 h-5" />
                  <span className="text-sm font-medium">Trusted by 500+ Agencies</span>
                </div>
              </AnimatedSection>
            </div>
          </div>

          {/* What You'll Learn */}
          <AnimatedSection animation="fade-blur" delay={250} className="max-w-4xl mx-auto mb-16">
            <div className="bg-card border border-border rounded-lg p-8 md:p-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center text-foreground">
                Here's what you'll learn
              </h2>
              <div className="space-y-4 text-lg">
                {[
                  "How to create AI-powered SaaS tools inside HighLevel that your customers will pay premium prices for",
                  "The step-by-step process to build AI agents that handle support, onboarding, and sales — automatically",
                  "How to package and sell AI solutions as a recurring revenue stream alongside your SaaS",
                  "The exact AI tech stack and prompts we use to deliver real results for our clients",
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Check className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                    <span className="text-muted-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </AnimatedSection>

          {/* Meet Your Presenter */}
          <AnimatedSection animation="fade-blur" className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">Meet Your Presenter</h2>
          </AnimatedSection>

          <AnimatedSection animation="fade-blur" className="max-w-5xl mx-auto mb-16">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <img src={andrewGeorgeImage} alt="Andrew George" className="rounded-lg shadow-xl w-full max-w-md mx-auto" />
              </div>
              <div>
                <h2 className="text-3xl font-bold mb-6">Hi, I'm Andrew George</h2>
                <ul className="space-y-4 text-lg text-muted-foreground">
                  {[
                    "Certified HighLevel educator with 20,000+ subscribers",
                    "Founder of SaaSSuite & 6 Figure Agency Owner",
                    "Building AI-powered tools & agents for HighLevel agencies",
                  ].map((text, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="text-center mt-8">
              <Button
                size="lg"
                onClick={() => setIsRegistrationOpen(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-lg px-8 py-6"
              >
                Save My Seat
                <ArrowUp className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </AnimatedSection>

          {/* Are You Struggling Section */}
          <AnimatedSection animation="fade-blur" delay={350} className="max-w-5xl mx-auto mb-16">
            <div className="p-8 md:p-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-10 text-center text-foreground">
                Are you struggling to...
              </h2>
              <div className="grid md:grid-cols-3 gap-8 mb-10">
                <div className="bg-card border border-border rounded-lg p-6">
                  <h3 className="text-xl font-bold mb-4 text-primary flex items-center gap-2">
                    <div className="bg-green-500 rounded-full p-1 flex-shrink-0">
                      <Bot className="w-5 h-5 text-white" strokeWidth={3} />
                    </div>
                    BUILD AI TOOLS?
                  </h3>
                  <ul className="space-y-3 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span>Don't know where to start with AI inside HighLevel?</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span>Overwhelmed by all the AI tools and don't know what actually works?</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span>Want to offer AI but aren't sure how to package or price it?</span>
                    </li>
                  </ul>
                </div>
                <div className="bg-card border border-border rounded-lg p-6">
                  <h3 className="text-xl font-bold mb-4 text-primary flex items-center gap-2">
                    <div className="bg-green-500 rounded-full p-1 flex-shrink-0">
                      <Sparkles className="w-5 h-5 text-white" strokeWidth={3} />
                    </div>
                    SELL AI AGENTS?
                  </h3>
                  <ul className="space-y-3 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span>Not sure how to build agents that actually deliver value?</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span>Struggling to differentiate from other GHL agencies?</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span>Missing the AI wave while competitors are charging premium?</span>
                    </li>
                  </ul>
                </div>
                <div className="bg-card border border-border rounded-lg p-6">
                  <h3 className="text-xl font-bold mb-4 text-primary flex items-center gap-2">
                    <div className="bg-green-500 rounded-full p-1 flex-shrink-0">
                      <Cpu className="w-5 h-5 text-white" strokeWidth={3} />
                    </div>
                    SCALE WITH AI?
                  </h3>
                  <ul className="space-y-3 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span>Manually handling support & onboarding instead of automating?</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span>Can't figure out how to make AI work for your niche?</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span>Need a proven framework to add AI to your offer stack?</span>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="text-center">
                <Button
                  size="lg"
                  onClick={() => setIsRegistrationOpen(true)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-lg px-8 py-6"
                >
                  Save My Seat
                  <ArrowUp className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </div>
          </AnimatedSection>

          {/* Final CTA */}
          <AnimatedSection animation="fade-blur" delay={550} className="max-w-4xl mx-auto mb-16">
            <div className="bg-black rounded-lg p-12 text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-primary-foreground">
                Ready to Add AI to Your Agency?
              </h2>
              <p className="text-xl text-primary-foreground/90 mb-8">
                Join us for this workshop and discover how to build, sell, and scale AI-powered SaaS tools & agents on HighLevel.
              </p>
              <div className="flex justify-center">
                <Button
                  size="lg"
                  onClick={() => setIsRegistrationOpen(true)}
                  className="bg-background hover:bg-background/90 text-foreground font-semibold text-lg px-10 py-6 shadow-lg"
                >
                  Save My Seat
                  <ArrowUp className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </div>
          </AnimatedSection>
        </main>

        <Footer />

        {/* Registration Popup */}
        <Dialog open={isRegistrationOpen} onOpenChange={(open) => {
          setIsRegistrationOpen(open);
          if (!open) {
            setIsConfirmed(false);
            setFullName("");
            setEmail("");
          }
        }}>
          <DialogContent className="sm:max-w-md max-h-[90vh]">
            <ScrollArea className="max-h-[80vh]">
              <div className="px-1">
                <DialogHeader>
                  <DialogTitle className="text-center text-2xl">
                    {isConfirmed ? "🎉 You're Registered!" : "🤖 Reserve Your Spot"}
                  </DialogTitle>
                  <DialogDescription className="text-center">
                    {isConfirmed
                      ? "Check your email in the next 24–48 hours for your invite with the date & details."
                      : "Date TBD — We'll email you when it's locked in."}
                  </DialogDescription>
                </DialogHeader>

                {isConfirmed ? (
                  <div className="text-center py-6 space-y-4">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                      <Check className="w-8 h-8 text-green-600" />
                    </div>
                    <p className="text-muted-foreground">
                      Be on the lookout in your inbox — we'll send your invite within <strong>24–48 hours</strong>.
                    </p>
                    <div className="space-y-3 pt-2">
                      <a
                        href="https://www.youtube.com/@andrewpreneurship?sub_confirmation=1"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 w-full bg-red-600 hover:bg-red-700 text-white font-bold text-base px-6 py-3 rounded-md transition-colors"
                      >
                        <Youtube className="w-5 h-5" />
                        Subscribe on YouTube
                      </a>
                      <Button variant="outline" onClick={() => setIsRegistrationOpen(false)} className="w-full">
                        Close
                      </Button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} autoComplete="on" className="space-y-4 pt-2">
                    <Input
                      placeholder="Full Name *"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      name="name"
                      autoComplete="name"
                    />
                    <Input
                      type="email"
                      placeholder="Email *"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      name="email"
                      autoComplete="email"
                    />
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-[#882BDB] hover:bg-[#882BDB]/90 text-white font-bold text-lg py-5"
                    >
                      {isSubmitting ? "Registering..." : "SAVE MY SEAT"}
                    </Button>
                  </form>
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default AIWebinar;
