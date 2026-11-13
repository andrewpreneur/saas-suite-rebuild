import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Bot, Sparkles, Zap, Shield, ArrowRight, MessageSquare } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import Footer from "@/components/Footer";
import AnimatedSection from "@/components/AnimatedSection";
import SEO from "@/components/SEO";

const AI = () => {
  const { session } = useUser();
  const navigate = useNavigate();
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const handlePurchase = () => {
    navigate("/#pricing");
  };

  const handleUpgrade = () => {
    // TODO: Implement upgrade flow
    console.log("Upgrade to branded agent");
  };

  return (
    <>
      <SEO 
        title="AI Support Agent - 24/7 Customer Support" 
        description="Automate your customer support with our AI agent featuring 99% success rate. Available in Standard Brandless and Branded options." 
      />
      
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        {/* Header */}
        <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Link to="/" className="flex items-center">
                <img src="/assets/saassuite-logo.png" alt="SaaSSuite Logo" className="h-11 w-auto" />
              </Link>
              <div className="flex items-center gap-4">
                {session ? (
                  <Button asChild variant="outline">
                    <Link to="/app">Dashboard</Link>
                  </Button>
                ) : (
                  <>
                    <Button asChild variant="ghost">
                      <Link to="/login">Login</Link>
                    </Button>
                    <Button asChild>
                      <Link to="/signup">Get Started</Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-12">
          {/* Hero Section */}
          <AnimatedSection animation="fade-blur" delay={0} className="text-center mb-20">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-6 py-2 rounded-full mb-6 animate-pulse">
              <Sparkles className="w-4 h-4" />
              <span className="font-semibold text-sm">Updated November 2025</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
              AI Support Agent
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto">
              Automate your customer support with an intelligent AI agent that works 24/7
            </p>
            <div className="flex items-center justify-center gap-6 mb-8">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium">99% Success Rate</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium">Instant Response</span>
              </div>
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium">Always Available</span>
              </div>
            </div>
          </AnimatedSection>

          {/* Demo Section */}
          <AnimatedSection animation="scale-in" delay={100} className="max-w-4xl mx-auto mb-20">
            <div className="bg-card border border-border rounded-2xl p-8 shadow-xl">
              <div className="aspect-video bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl overflow-hidden relative">
                <video 
                  src="/assets/ai-chat-demo.mov" 
                  autoPlay 
                  loop 
                  muted 
                  playsInline
                  className="w-full h-full object-cover rounded-xl"
                />
              </div>
            </div>
          </AnimatedSection>

          {/* Features Grid */}
          <AnimatedSection animation="fade-blur" delay={200} className="max-w-6xl mx-auto mb-20">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              Powerful Features Built In
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-card border border-border rounded-xl p-6 hover:shadow-lg transition-all">
                <div className="bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                  <Bot className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">24/7 Availability</h3>
                <p className="text-muted-foreground">Never miss a customer inquiry with round-the-clock AI support</p>
              </div>
              
              <div className="bg-card border border-border rounded-xl p-6 hover:shadow-lg transition-all">
                <div className="bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">Intelligent Responses</h3>
                <p className="text-muted-foreground">Context-aware answers that understand your business</p>
              </div>
              
              <div className="bg-card border border-border rounded-xl p-6 hover:shadow-lg transition-all">
                <div className="bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">99% Success Rate</h3>
                <p className="text-muted-foreground">Proven track record of resolving customer inquiries</p>
              </div>
            </div>
          </AnimatedSection>

          {/* Pricing Comparison */}
          <AnimatedSection animation="fade-blur" delay={300} className="max-w-6xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
              Choose Your AI Agent
            </h2>
            <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
              Select the perfect AI support solution for your business needs
            </p>
            
            <div className="grid md:grid-cols-2 gap-8">
              {/* Standard Brandless Agent */}
              <div 
                className="bg-card border-2 border-border rounded-2xl p-8 hover:border-primary transition-all relative"
                onMouseEnter={() => setHoveredCard("standard")}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <div className="absolute top-8 right-8">
                  <div className="bg-green-500/10 text-green-500 px-4 py-1 rounded-full text-sm font-semibold">
                    Included
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-gray-900 to-gray-700 w-16 h-16 rounded-xl flex items-center justify-center mb-6">
                  <Bot className="w-8 h-8 text-white" />
                </div>
                
                <h3 className="text-2xl font-bold mb-2">Standard Brandless Agent</h3>
                <p className="text-muted-foreground mb-6">
                  Professional black & white themed agent that fits any agency
                </p>
                
                <div className="text-3xl font-bold mb-6">
                  Included
                  <span className="text-base font-normal text-muted-foreground ml-2">
                    with all SaaSSuite plans
                  </span>
                </div>
                
                <div className="space-y-3 mb-8">
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Universal black & white theme</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Never discloses software name</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">No HighLevel branding</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">24/7 customer support</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">99% success rate</span>
                  </div>
                </div>
                
                {session ? (
                  <Button asChild className="w-full" size="lg">
                    <Link to="/app">
                      Access Dashboard
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                ) : (
                  <Button onClick={handlePurchase} className="w-full" size="lg">
                    Purchase SaaSSuite
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>

              {/* Branded AI Agent */}
              <div 
                className="bg-card border-2 border-primary rounded-2xl p-8 hover:shadow-2xl transition-all relative"
                onMouseEnter={() => setHoveredCard("branded")}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <div className="absolute top-8 right-8">
                  <div className="bg-primary/10 text-primary px-4 py-1 rounded-full text-sm font-semibold">
                    Popular
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-primary to-primary/60 w-16 h-16 rounded-xl flex items-center justify-center mb-6">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                
                <h3 className="text-2xl font-bold mb-2">Branded AI Agent</h3>
                <p className="text-muted-foreground mb-6">
                  Fully customized agent tailored to your brand identity
                </p>
                
                <div className="text-3xl font-bold mb-6">
                  $20
                  <span className="text-base font-normal text-muted-foreground">/month per customer</span>
                </div>
                
                <div className="space-y-3 mb-8">
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm font-semibold">Everything in Standard, plus:</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Branded to your colors</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">15-minute setup & implementation call</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Custom prompting & responses</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Human handover capability</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Custom actions (SMS, email, notifications)</span>
                  </div>
                </div>
                
                {session ? (
                  <Button onClick={handleUpgrade} className="w-full" size="lg" variant="default">
                    Upgrade Agent
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button onClick={handlePurchase} className="w-full" size="lg" variant="default">
                    Purchase SaaSSuite
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            </div>
          </AnimatedSection>

          {/* Disclaimer */}
          <AnimatedSection animation="fade-blur" delay={400} className="max-w-4xl mx-auto mb-12">
            <div className="bg-muted/50 border border-border rounded-xl p-6 text-center">
              <p className="text-sm text-muted-foreground">
                <strong>Important:</strong> AI Support Agents are exclusively available to SaaSSuite users and cannot be purchased separately. 
                Both agent types require an active SaaSSuite subscription.
              </p>
            </div>
          </AnimatedSection>

          {/* Final CTA */}
          <AnimatedSection animation="fade-blur" delay={500} className="text-center mb-12">
            <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 rounded-2xl p-12 border border-primary/20">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Ready to Transform Your Support?
              </h2>
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                Join hundreds of agencies using AI to deliver exceptional customer support
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                {session ? (
                  <Button asChild size="lg" className="min-w-[200px]">
                    <Link to="/app">Go to Dashboard</Link>
                  </Button>
                ) : (
                  <>
                    <Button onClick={handlePurchase} size="lg" className="min-w-[200px]">
                      Get Started Now
                    </Button>
                    <Button asChild size="lg" variant="outline" className="min-w-[200px]">
                      <Link to="/pricing">View Pricing</Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </AnimatedSection>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default AI;