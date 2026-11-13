import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, CheckCircle, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { useMetaPixel } from "@/hooks/useMetaPixel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import AnimatedSection from "@/components/AnimatedSection";
import Footer from "@/components/Footer";
import TestimonialsCarousel from "@/components/TestimonialsCarousel";
import StripeEmbeddedCheckout from "@/components/StripeEmbeddedCheckout";
import PlanFeatureLabel from "@/components/pricing/PlanFeatureLabel";
import { SAME_DAY_WL_SUPPORT } from "@/constants/pricingPlans";

const PRIMARY_FEATURES = [
  "Advanced SaaSSuite access for a full year",
  "1:1 weekly support and direct Slack access",
  "A complete WebinarKit account included",
  "Webinar strategy, build support, and advisory",
  "Ads consultation and creative support",
  "Done-for-you SaaSSuite onboarding setup",
];

const ADVANCED_FEATURES = [
  "Unlimited users and subaccounts",
  "Three custom onboarding experiences",
  "SaaS health and onboarding tracking",
  "24/7 AI and human support for your team",
  SAME_DAY_WL_SUPPORT,
];

const PREMIUM_FEATURES = [
  "Everything in Advanced",
  "White-labeled support for your customers",
  "Live chat, ticket, email, and Zoom support",
  "Dedicated Slack channel and priority escalation",
];

const Special = () => {
  useMetaPixel();
  const [checkoutPlan, setCheckoutPlan] = useState<"advanced" | "enhanced" | null>(null);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="flex min-h-11 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <img
              src="/lovable-uploads/f3f326f8-20fd-4406-a246-f4b2dbc34614.png"
              alt=""
              className="h-8 w-8"
            />
            <span className="text-xl font-bold">SaaSSuite</span>
          </Link>
          <Button variant="ghost" asChild>
            <Link to="/login">Sign in</Link>
          </Button>
        </div>
      </header>

      <main>
        <section className="border-b bg-gradient-to-b from-accent/70 to-background">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,0.88fr)_minmax(480px,1.12fr)] lg:items-start lg:gap-14 lg:py-20">
            <AnimatedSection animation="fade-in">
              <div className="pt-2 lg:sticky lg:top-8">
                <Badge className="mb-6 border border-pricing-accent/20 bg-pricing-accent/10 px-3 py-1.5 text-pricing-accent hover:bg-pricing-accent/10">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Complete annual offer
                </Badge>

                <h1 className="max-w-xl text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
                  Build, onboard, and support your SaaS for <span className="text-pricing-accent">$997</span>
                </h1>
                <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
                  Get the complete SaaSSuite platform for one year, plus direct help building the onboarding, support, webinars, and ads that move your SaaS forward.
                </p>

                <div className="my-8 flex items-end gap-3 border-y py-6">
                  <span className="text-5xl font-bold">$997</span>
                  <span className="pb-1 text-base text-muted-foreground">per year</span>
                </div>

                <ul className="space-y-4" aria-label="Included with the annual offer">
                  {PRIMARY_FEATURES.map((feature) => (
                    <li key={feature} className="flex gap-3">
                      <CheckCircle className="mt-0.5 h-5 w-5 flex-none text-success" aria-hidden="true" />
                      <span className="font-medium leading-6">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button asChild size="lg" variant="outline" className="mt-6 w-full sm:w-auto">
                  <a href="https://gofreesaas.com/ai-studio-sales-video">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    Claim Your Free Bonus
                  </a>
                </Button>


                <div className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-success" aria-hidden="true" />
                    Secure Stripe checkout
                  </span>
                  <span className="flex items-center gap-2">
                    <LockKeyhole className="h-4 w-4 text-success" aria-hidden="true" />
                    Payment details stay protected
                  </span>
                </div>
              </div>
            </AnimatedSection>

            <AnimatedSection animation="fade-in" delay={0.12}>
              <div className="overflow-hidden rounded-lg border bg-card shadow-elevated">
                <div className="border-b px-5 py-4">
                  <p className="font-semibold">Complete your purchase</p>
                  <p className="mt-1 text-sm text-muted-foreground">Your checkout is ready below.</p>
                </div>
                <StripeEmbeddedCheckout
                  plan="special"
                  open
                  inline
                  onOpenChange={() => undefined}
                />
              </div>
            </AnimatedSection>
          </div>
        </section>

        <section className="border-b py-16 sm:py-20" aria-labelledby="why-this-offer">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <AnimatedSection animation="fade-in">
              <div className="mx-auto max-w-3xl text-center">
                <p className="text-sm font-semibold uppercase text-pricing-accent">More than software</p>
                <h2 id="why-this-offer" className="mt-3 text-3xl font-bold sm:text-4xl">
                  The systems and support to turn signups into successful customers
                </h2>
                <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
                  SaaSSuite gives customers a clear first step, answers questions around the clock, and shows you where people need help. This offer adds direct guidance so you can put the complete system to work faster.
                </p>
              </div>
            </AnimatedSection>

            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {[
                ["Launch clearly", "Give every customer branded onboarding, education, and a guided path from day one."],
                ["Support consistently", "Combine instant AI answers with real human help when a conversation needs a person."],
                ["Improve with evidence", "See adoption, onboarding progress, and support activity instead of guessing what customers need."],
              ].map(([title, description], index) => (
                <AnimatedSection key={title} animation="fade-in" delay={index * 0.08}>
                  <div className="h-full border-t-2 border-pricing-accent pt-5">
                    <h3 className="text-xl font-bold">{title}</h3>
                    <p className="mt-3 leading-relaxed text-muted-foreground">{description}</p>
                  </div>
                </AnimatedSection>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-muted/40 py-16 sm:py-20" aria-labelledby="monthly-options">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <AnimatedSection animation="fade-in">
              <div className="mx-auto mb-12 max-w-2xl text-center">
                <p className="text-sm font-semibold uppercase text-pricing-accent">Prefer monthly?</p>
                <h2 id="monthly-options" className="mt-3 text-3xl font-bold sm:text-4xl">Choose a monthly plan</h2>
                <p className="mt-4 text-lg text-muted-foreground">
                  Start with the level of support your SaaS needs today.
                </p>
              </div>
            </AnimatedSection>

            <div className="grid gap-6 md:grid-cols-2">
              <AnimatedSection animation="fade-in" delay={0.08}>
                <Card className="flex h-full flex-col border-border bg-card">
                  <CardHeader>
                    <CardTitle className="text-2xl">Advanced</CardTitle>
                    <CardDescription>Powerful onboarding, insight, and support for your team.</CardDescription>
                    <div className="pt-4 text-4xl font-bold">
                      $97<span className="text-base font-normal text-muted-foreground">/month</span>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col">
                    <ul className="mb-8 flex-1 space-y-3">
                      {ADVANCED_FEATURES.map((feature) => (
                        <li key={feature} className="flex gap-3 text-sm">
                          <Check className="mt-0.5 h-4 w-4 flex-none text-pricing-accent" aria-hidden="true" />
                          <PlanFeatureLabel feature={feature} />
                        </li>
                      ))}
                    </ul>
                    <Button variant="outline" className="w-full" onClick={() => setCheckoutPlan("advanced")}>
                      Choose Advanced <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </AnimatedSection>

              <AnimatedSection animation="fade-in" delay={0.16}>
                <Card className="flex h-full flex-col border-2 border-pricing-accent bg-card shadow-card">
                  <CardHeader>
                    <Badge className="mb-2 w-fit bg-pricing-accent text-pricing-accent-foreground hover:bg-pricing-accent">White-label support</Badge>
                    <CardTitle className="text-2xl">Premium Support</CardTitle>
                    <CardDescription>Our team supports your customers under your brand.</CardDescription>
                    <div className="pt-4 text-4xl font-bold">
                      $297<span className="text-base font-normal text-muted-foreground">/month</span>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col">
                    <ul className="mb-8 flex-1 space-y-3">
                      {PREMIUM_FEATURES.map((feature) => (
                        <li key={feature} className="flex gap-3 text-sm">
                          <Check className="mt-0.5 h-4 w-4 flex-none text-pricing-accent" aria-hidden="true" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button className="w-full bg-pricing-accent text-pricing-accent-foreground hover:bg-pricing-accent-hover" onClick={() => setCheckoutPlan("enhanced")}>
                      Choose Premium Support <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </AnimatedSection>
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-20" aria-labelledby="customer-results">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center">
              <p className="text-sm font-semibold uppercase text-pricing-accent">Customer stories</p>
              <h2 id="customer-results" className="mt-3 text-3xl font-bold sm:text-4xl">Built for agencies ready to scale support</h2>
            </div>
            <TestimonialsCarousel />
          </div>
        </section>
      </main>

      <StripeEmbeddedCheckout
        plan={checkoutPlan ?? "advanced"}
        open={checkoutPlan !== null}
        onOpenChange={(open) => {
          if (!open) setCheckoutPlan(null);
        }}
      />

      <Footer />
    </div>
  );
};

export default Special;