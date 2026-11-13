import { useEffect, useState } from "react";
import { Check, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import PageSEO from "@/components/PageSEO";
import { Button } from "@/components/ui/button";
import saassuiteLogo from "@/assets/saassuitelogo-dark.png";

const HIGHLEVEL_APP_URL = "https://app.gohighlevel.com/";

const MarketplaceReturn = () => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 3000);
    return () => window.clearTimeout(timer);
  }, []);

  const returnToHighLevel = () => {
    window.location.href = HIGHLEVEL_APP_URL;
  };

  return (
    <div className="min-h-screen bg-gradient-background text-foreground">
      <PageSEO
        title="SaaSSuite Connected — Return to HighLevel"
        description="Your SaaSSuite marketplace connection is ready. Continue back to HighLevel."
        path="/marketplace"
        noindex
      />
      <header className="border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center px-5 sm:px-8">
          <img src={saassuiteLogo} alt="" className="h-9 w-9 rounded-md" />
          <span className="ml-3 font-bold">SaaSSuite</span>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl items-center justify-center px-5 py-12">
        <section className="w-full max-w-xl text-center" aria-live="polite">
          <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-primary/20 bg-primary/5 animate-glow-pulse" />
            <div className="absolute inset-3 rounded-full border-2 border-primary/15" />
            {!ready ? (
              <Loader2 className="relative h-12 w-12 animate-spin text-primary" aria-label="Finishing connection" />
            ) : (
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-success text-success-foreground animate-fade-in">
                <Check className="h-10 w-10" strokeWidth={3} />
              </div>
            )}
          </div>

          <div className="mt-7 min-h-[190px]">
            {!ready ? (
              <div className="animate-fade-in">
                <p className="text-sm font-semibold uppercase text-primary">Finishing setup</p>
                <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Connecting SaaSSuite to HighLevel</h1>
                <p className="mx-auto mt-4 max-w-md leading-7 text-muted-foreground">
                  Your confirmation is complete. We’re preparing the handoff back to your HighLevel account.
                </p>
                <div className="mx-auto mt-7 h-1.5 max-w-xs overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-full origin-left bg-gradient-primary marketplace-progress" />
                </div>
              </div>
            ) : (
              <div className="animate-fade-in">
                <p className="text-sm font-semibold uppercase text-success">You’re all set</p>
                <h1 className="mt-3 text-3xl font-bold sm:text-4xl">SaaSSuite is ready</h1>
                <p className="mx-auto mt-4 max-w-md leading-7 text-muted-foreground">
                  Continue to HighLevel to finish working in your account.
                </p>
                <Button size="lg" className="mt-7 min-h-12 w-full sm:w-auto sm:px-8" onClick={returnToHighLevel}>
                  Take me back to HighLevel
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <p className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 text-success" />
                  Connection confirmed securely
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default MarketplaceReturn;
