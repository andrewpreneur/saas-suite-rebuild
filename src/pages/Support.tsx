import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ExternalLink, HelpCircle, LifeBuoy, Loader2, MessageSquareText, Send, ShieldCheck } from "lucide-react";
import PageSEO from "@/components/PageSEO";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import saassuiteLogo from "@/assets/saassuitelogo-dark.png";

const TOPICS = ["Account access", "Installation", "Client Hub", "Support and ticketing", "Billing", "Other"];

const Support = () => {
  const [form, setForm] = useState({ name: "", email: "", agencyName: "", topic: "", question: "", website: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    const agencyName = form.agencyName.trim();
    const question = form.question.trim();
    if (name.length < 2) return setError("Please enter your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Please enter a valid email address.");
    if (!form.topic) return setError("Please choose a support topic.");
    if (question.length < 10) return setError("Please add a little more detail to your question.");

    setSubmitting(true);
    try {
      const { data, error: functionError } = await supabase.functions.invoke("public-support-submit", {
        body: {
          name,
          email,
          agency_name: agencyName,
          topic: form.topic,
          question,
          website: form.website,
        },
      });
      if (functionError || !data?.ok) throw new Error(data?.error || functionError?.message || "Submission failed");
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "We couldn't send your question. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageSEO
        title="SaaSSuite Support — Submit a Support Question"
        description="Ask the SaaSSuite support team about account access, installation, Client Hub, ticketing, billing, or another platform question."
        path="/support"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "ContactPage",
          name: "SaaSSuite Support",
          url: "https://saassuite.ai/support",
        }}
      />

      <header className="border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link to="/" className="flex items-center gap-3" aria-label="SaaSSuite home">
            <img src={saassuiteLogo} alt="" className="h-9 w-9 rounded-md" />
            <span className="font-bold">SaaSSuite</span>
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link to="/setup">
              Setup guide
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>

      <main>
        <section className="border-b border-border/70 bg-gradient-background">
          <div className="mx-auto max-w-6xl px-5 py-12 text-center sm:px-8 sm:py-16">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary animate-fade-in">
              <LifeBuoy className="h-7 w-7" />
            </div>
            <p className="mt-5 text-sm font-semibold uppercase text-primary">Public support</p>
            <h1 className="mx-auto mt-3 max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">How can we help?</h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
              Send the SaaSSuite team your question. Include what you expected, what happened, and where you were working so we can understand it clearly.
            </p>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:px-8 md:py-14 lg:grid-cols-[0.75fr_1.25fr]">
          <aside className="space-y-4">
            {[
              { icon: MessageSquareText, title: "Describe the issue", body: "Tell us the page, action, and result. Exact wording from an error message is useful." },
              { icon: ShieldCheck, title: "Keep secrets private", body: "Never send passwords, private API keys, card details, or one-time login codes." },
              { icon: HelpCircle, title: "Need setup help?", body: "The public setup guide covers installation, Client Hub, onboarding, support, and ticketing." },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-lg border border-border bg-card p-5 shadow-card">
                  <Icon className="h-5 w-5 text-primary" />
                  <h2 className="mt-3 font-semibold">{item.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.body}</p>
                </div>
              );
            })}
            <Button asChild variant="outline" className="w-full">
              <Link to="/setup">Open the setup guide</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link to="/support-service">
                See our support in action
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          </aside>

          <div className="rounded-lg border border-border bg-card p-5 shadow-elevated sm:p-7">
            {submitted ? (
              <div className="flex min-h-[520px] flex-col items-center justify-center text-center animate-fade-in" aria-live="polite">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success/10 text-success">
                  <CheckCircle2 className="h-11 w-11" />
                </div>
                <h2 className="mt-5 text-2xl font-bold">Your question was submitted</h2>
                <p className="mt-3 max-w-md leading-7 text-muted-foreground">
                  The SaaSSuite team can now review the details you sent. Keep this page bookmarked if you need the setup guide later.
                </p>
                <div className="mt-6 flex w-full max-w-sm flex-col gap-3 sm:flex-row sm:justify-center">
                  <Button onClick={() => { setSubmitted(false); setForm({ name: "", email: "", agencyName: "", topic: "", question: "", website: "" }); }}>
                    Ask another question
                  </Button>
                  <Button asChild variant="outline"><Link to="/setup">View setup guide</Link></Button>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-5">
                <div>
                  <p className="text-sm font-semibold uppercase text-primary">Support request</p>
                  <h2 className="mt-2 text-2xl font-bold">Send us your question</h2>
                  <p className="mt-2 text-sm text-muted-foreground">All fields marked required must be completed.</p>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="support-name">Name *</Label>
                    <Input id="support-name" autoComplete="name" required maxLength={120} value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="support-email">Email *</Label>
                    <Input id="support-email" type="email" autoComplete="email" required maxLength={320} value={form.email} onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))} />
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="support-agency">Agency name</Label>
                    <Input id="support-agency" autoComplete="organization" maxLength={160} value={form.agencyName} onChange={(e) => setForm((current) => ({ ...current, agencyName: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Topic *</Label>
                    <Select value={form.topic} onValueChange={(topic) => setForm((current) => ({ ...current, topic }))}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Choose a topic" /></SelectTrigger>
                      <SelectContent>
                        {TOPICS.map((topic) => <SelectItem key={topic} value={topic}>{topic}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="support-question">What do you need help with? *</Label>
                  <Textarea
                    id="support-question"
                    required
                    minLength={10}
                    maxLength={5000}
                    rows={8}
                    value={form.question}
                    onChange={(e) => setForm((current) => ({ ...current, question: e.target.value }))}
                    placeholder="Tell us what you were doing, what you expected, and what happened instead..."
                    className="resize-y"
                  />
                  <p className="text-right text-xs text-muted-foreground">{form.question.length}/5,000</p>
                </div>

                <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
                  <Label htmlFor="support-website">Website</Label>
                  <Input id="support-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm((current) => ({ ...current, website: e.target.value }))} />
                </div>

                {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

                <Button type="submit" size="lg" className="min-h-11 w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {submitting ? "Sending question..." : "Submit support question"}
                </Button>
                <p className="text-center text-xs text-muted-foreground">Your question is stored securely for the SaaSSuite team to review.</p>
              </form>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Support;
