import { Link } from "react-router-dom";
import { TextUsLink } from "@/components/TextUsLink";
import { ArrowDown, ArrowRight, Check, Layers3, Megaphone, Headphones, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import PageSEO from "@/components/PageSEO";
import { GHL_DFY_PRICING, ghlDfyPaymentTotal } from "@/config/ghlDfy";
import { navigateWithParams } from "@/utils/preserveParams";
import { useAffiliateTracking } from "@/hooks/useAffiliateTracking";
import foundationImage from "@/assets/ghl-dfy-foundation.jpg";
import salesImage from "@/assets/ghl-dfy-sales.jpg";
import onboardingImage from "@/assets/ghl-dfy-onboarding.jpg";

const stages = [
  {
    id: "foundation", number: "01", name: "Foundation", icon: Layers3,
    headline: "The business behind your business.",
    description: "A connected HighLevel setup built around your offer, your customers, and the way you work. Not a pile of disconnected tools for you to figure out later.",
    image: foundationImage, alt: "Illustration of connected websites, apps, and business systems on a solid foundation",
    groups: [
      { title: "Your offer, built out", items: ["Custom websites and pages", "Offer development and product setup", "Business management systems"] },
      { title: "Your communication, connected", items: ["Email sending setup and warmup", "SMS setup and smart lists", "Automations and connected workflows"] },
      { title: "Your technology, tailored", items: ["Custom vibe-coded GHL app", "API setup and custom integrations", "Mobile app setup and more"] },
    ],
    outcome: "One connected foundation. Built for your business.",
  },
  {
    id: "sales", number: "02", name: "Sales", icon: Megaphone,
    headline: "From the first impression to the sales conversation.",
    description: "We build the assets, put the campaigns together, and help do the selling. Your offer gets a complete sales process, not just a website and a good-luck message.",
    image: salesImage, alt: "Illustration of webinar recording equipment, presentation slides, and advertising tools",
    groups: [
      { title: "Your presentation", items: ["Sales webinar development", "Sales video and slide deck", "We record your webinar"] },
      { title: "Your advertising", items: ["Ad creative production", "Ad campaign setup", "We run your ads"] },
      { title: "Your sales process", items: ["A connected prospect journey", "Follow-up automations", "We sell to your prospects"] },
    ],
    outcome: "The message, the campaigns, and the selling. Connected.",
  },
  {
    id: "onboarding", number: "03", name: "Onboarding & Retention", icon: Headphones,
    headline: "Make becoming a customer feel like the beginning.",
    description: "The work doesn't stop at the sale. We build the onboarding, education, and support experience that helps customers get started and keep moving forward.",
    image: onboardingImage, alt: "Illustration of a welcoming onboarding pathway, training videos, and customer support",
    groups: [
      { title: "A clear first step", items: ["Custom onboarding tracks", "Guided setup and checklists", "Your SaaSSuite setup, built for you"] },
      { title: "Education made for you", items: ["Custom onboarding videos", "Training around your offer", "An organized customer learning experience"] },
      { title: "Support behind the scenes", items: ["Your support team setup", "Your chat support setup", "Connected customer support workflows"] },
    ],
    outcome: "A customer experience beyond the checkout.",
  },
];

const money = (value: number) => `$${value.toLocaleString("en-US")}`;

function BookButton({ children = "Let's Build Your GHL", className = "" }: { children?: React.ReactNode; className?: string }) {
  return <Button asChild size="lg" className={`ghl-dfy-cta h-auto min-h-12 whitespace-normal rounded-lg px-6 py-3 text-base ${className}`}>
    <Link to={navigateWithParams("/book")}>{children}<ArrowRight className="ml-2 h-4 w-4 shrink-0" /></Link>
  </Button>;
}

export default function GhlDfy() {
  useAffiliateTracking("ghldfy");
  return (
    <div className="ghl-dfy-page min-h-screen bg-background text-foreground">
      <PageSEO title="GHL DFY — Your Entire HighLevel Business, Built For You | SaaSSuite" description="SaaSSuite builds your HighLevel foundation, sales system, and customer onboarding. GHL Done For You: $20,000 paid in full or $5,000 a month for five months." path="/ghldfy" noindex />
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link to={navigateWithParams("/")} aria-label="SaaSSuite home" className="flex items-center gap-2 font-semibold">
            <img src="/assets/saassuite-logo.png" alt="" width={32} height={32} className="h-8 w-8 object-contain" />SaaSSuite
          </Link>
          <Button asChild variant="ghost" className="text-sm"><Link to={navigateWithParams("/book")}>Let's Talk<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
        </div>
      </header>
      <main>
        <section className="webinar-2-hero px-5 pb-12 pt-12 text-center sm:px-8 sm:pb-16 sm:pt-20">
          <div className="mx-auto max-w-4xl ghl-dfy-enter">
            <p className="ghl-dfy-accent mb-5 flex items-center justify-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4" />HIGHLEVEL. DONE FOR YOU.</p>
            <h1 className="text-5xl font-bold leading-tight sm:text-6xl">GHL DFY</h1>
            <p className="mx-auto mt-4 max-w-3xl text-3xl font-semibold leading-tight sm:text-5xl">We'll Build Your <span className="ghl-dfy-accent">ENTIRE GHL.</span></p>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">Your foundation. Your sales. Your customer experience. A complete done-for-you build by the SaaSSuite team, so you're not piecing it all together alone.</p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <BookButton />
              <Button asChild variant="ghost" size="lg"><a href="#the-build">See What We Build<ArrowDown className="ml-2 h-4 w-4" /></a></Button>
            </div>
            <p className="mt-5 text-sm text-muted-foreground">{money(GHL_DFY_PRICING.paidInFull)} paid in full or {money(GHL_DFY_PRICING.monthlyPayment)}/month for {GHL_DFY_PRICING.paymentMonths} months</p>
          </div>
        </section>

        <section id="the-build" className="scroll-mt-6 border-y border-border">
          <div className="mx-auto grid max-w-6xl grid-cols-1 px-5 sm:grid-cols-3 sm:px-8">
            {stages.map(({ id, number, name, icon: Icon }) => <a key={id} href={`#${id}`} className="group flex items-center gap-4 border-b border-border py-6 last:border-b-0 sm:border-b-0 sm:px-5 sm:py-8">
              <span className="ghl-dfy-accent text-sm font-semibold">{number}</span><Icon className="ghl-dfy-accent h-6 w-6 shrink-0" /><span className="flex-1 text-base font-semibold">{name}</span><ArrowDown className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-y-1" />
            </a>)}
          </div>
        </section>

        <div className="mx-auto max-w-3xl px-5 py-14 text-center sm:py-20">
          <h2 className="text-3xl font-bold sm:text-4xl">Not another course.<br />The actual implementation.</h2>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">You don't need another list of things to build. You need the website, the systems, the sales assets, and the support experience working together. That's the job.</p>
        </div>

        {stages.map((stage, index) => <section id={stage.id} key={stage.id} className={`ghl-dfy-stage scroll-mt-6 border-t border-border ${index === 1 ? "bg-muted/40" : "bg-background"}`}>
          <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-20">
            <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
              <div className={index === 1 ? "lg:order-2" : ""}>
                <p className="ghl-dfy-accent mb-4 text-sm font-semibold">STAGE {stage.number} / {stage.name.toUpperCase()}</p>
                <h2 className="text-3xl font-bold leading-tight sm:text-4xl">{stage.headline}</h2>
                <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">{stage.description}</p>
              </div>
              <img src={stage.image} alt={stage.alt} width={1200} height={912} loading="lazy" className={`aspect-[4/3] w-full rounded-lg object-cover ${index === 1 ? "lg:order-1" : ""}`} />
            </div>
            <div className="mt-10 grid gap-8 md:grid-cols-3">
              {stage.groups.map(group => <div key={group.title} className="border-t border-border pt-6">
                <h3 className="mb-4 text-lg font-semibold">{group.title}</h3>
                <ul className="space-y-3">{group.items.map(item => <li key={item} className="flex gap-3 text-sm leading-relaxed text-muted-foreground"><Check className="ghl-dfy-check mt-0.5 h-4 w-4 shrink-0" />{item}</li>)}</ul>
              </div>)}
            </div>
            <p className="ghl-dfy-accent mt-8 flex items-center gap-2 border-t border-border pt-6 text-sm font-semibold"><ArrowRight className="h-4 w-4 shrink-0" />{stage.outcome}</p>
          </div>
        </section>)}

        <section id="investment" className="border-t border-border px-5 py-14 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-4xl">
            <div className="mb-10 text-center"><p className="ghl-dfy-accent mb-3 text-sm font-semibold">ONE BUILD. TWO WAYS TO PAY.</p><h2 className="text-3xl font-bold sm:text-4xl">Your entire GHL, done for you.</h2><p className="mt-4 text-muted-foreground">Foundation, sales, and onboarding. The same three-stage service with either payment option.</p></div>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="ghl-dfy-price-card rounded-lg border-2 p-7 sm:p-8">
                <p className="ghl-dfy-accent text-sm font-semibold">PAY IN FULL</p><p className="mt-5 text-4xl font-bold sm:text-5xl">{money(GHL_DFY_PRICING.paidInFull)}</p><p className="mt-3 text-muted-foreground">One upfront payment</p>
                <p className="mt-6 min-h-12 text-sm text-muted-foreground">Save {money(ghlDfyPaymentTotal() - GHL_DFY_PRICING.paidInFull)} compared with the payment plan.</p><BookButton className="mt-6 w-full">Discuss My Build</BookButton>
              </div>
              <div className="rounded-lg border border-border bg-card p-7 sm:p-8">
                <p className="text-sm font-semibold text-muted-foreground">MONTHLY PAYMENT PLAN</p><p className="mt-5 text-4xl font-bold sm:text-5xl">{money(GHL_DFY_PRICING.monthlyPayment)}<span className="text-lg font-normal text-muted-foreground">/month</span></p><p className="mt-3 text-muted-foreground">For {GHL_DFY_PRICING.paymentMonths} months</p>
                <p className="mt-6 min-h-12 text-sm text-muted-foreground">{GHL_DFY_PRICING.paymentMonths} monthly payments. {money(ghlDfyPaymentTotal())} total.<br />This is a fixed payment plan, not a cancel-anytime subscription.</p><BookButton className="mt-6 w-full">Discuss My Payment Plan</BookButton>
              </div>
            </div>
            <p className="mt-6 text-center text-sm leading-relaxed text-muted-foreground">We'll confirm your scope, delivery schedule, advertising budget, and any software or third-party costs on the call before you commit. All fees are non-refundable.</p>
          </div>
        </section>

        <section className="border-t border-border bg-muted/40 px-5 py-14 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-3xl"><h2 className="mb-8 text-center text-3xl font-bold">A few things you may be wondering.</h2>
            <Accordion type="single" collapsible>
              <AccordionItem value="dfy"><AccordionTrigger className="text-base">What does done for you actually mean?</AccordionTrigger><AccordionContent className="leading-relaxed text-muted-foreground">We do the implementation across the three stages above: your business setup, sales assets and campaigns, and customer onboarding and support. Your build starts with agreeing the scope around your offer and business.</AccordionContent></AccordionItem>
              <AccordionItem value="existing"><AccordionTrigger className="text-base">Can we work with my existing HighLevel setup?</AccordionTrigger><AccordionContent className="leading-relaxed text-muted-foreground">Bring your current setup to the call. We'll review what you already have and discuss what needs building, connecting, or improving rather than assume you're starting from scratch.</AccordionContent></AccordionItem>
              <AccordionItem value="involvement"><AccordionTrigger className="text-base">What will you need from me?</AccordionTrigger><AccordionContent className="leading-relaxed text-muted-foreground">Your business goals, offer details, brand materials, access to the tools we need, and feedback on the build. We handle the implementation; you help make sure it fits your business.</AccordionContent></AccordionItem>
              <AccordionItem value="timing"><AccordionTrigger className="text-base">How long does it take, and how long do you run the ads?</AccordionTrigger><AccordionContent className="leading-relaxed text-muted-foreground">The delivery schedule and duration of advertising and sales support are agreed for your project. We'll walk through those details, the ad budget, and any ongoing costs before you commit. We don't promise a fixed launch date or guaranteed sales results.</AccordionContent></AccordionItem>
              <AccordionItem value="payments"><AccordionTrigger className="text-base">Do both payment options include the same build?</AccordionTrigger><AccordionContent className="leading-relaxed text-muted-foreground">Yes. Both cover the same agreed three-stage build. Pay {money(GHL_DFY_PRICING.paidInFull)} upfront, or {money(GHL_DFY_PRICING.monthlyPayment)} a month for {GHL_DFY_PRICING.paymentMonths} months ({money(ghlDfyPaymentTotal())} total).</AccordionContent></AccordionItem>
            </Accordion>
          </div>
        </section>
        <section className="webinar-2-hero px-5 py-14 text-center sm:px-8 sm:py-20">
          <div className="mx-auto max-w-2xl"><h2 className="text-3xl font-bold sm:text-4xl">Let's stop planning it.<br /><span className="ghl-dfy-accent">Let's build it.</span></h2><p className="mb-7 mt-5 text-lg text-muted-foreground">Tell us what you want your HighLevel business to become. We'll talk through what it takes to build it for you.</p><BookButton /><p className="mt-5 flex justify-center"><TextUsLink /></p></div>
        </section>
      </main>
      <footer className="border-t border-border px-5 py-8 text-center text-sm text-muted-foreground">
        <p className="mb-4 font-semibold text-foreground">SaaSSuite</p><nav className="flex flex-wrap justify-center gap-x-5 gap-y-3" aria-label="Footer"><Link to="/">Home</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/refunds">Refunds</Link><Link to="/cookies">Cookies</Link><Link to="/accessibility">Accessibility</Link><Link to="/support">Support</Link></nav>
        <p className="mt-5">© {new Date().getFullYear()} SaaSSuite, a product of DNA Media Consulting LLC.</p><p className="mx-auto mt-3 max-w-xl text-xs leading-relaxed">SaaSSuite is an independent product and is not affiliated with, endorsed by, or sponsored by HighLevel Inc. Results are not guaranteed.</p>
      </footer>
    </div>
  );
}