import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { CheckCircle2, Clock, Lock, ShieldCheck } from "lucide-react";
import PageSEO from "@/components/PageSEO";
import { supabase } from "@/integrations/supabase/client";

const STANDARDS = [
  "90% or more of support requests must be answered within 10 minutes.",
  "The remaining 10% of support requests must be answered within 12 hours.",
  "100% of support requests must be kind, understanding and human-written. No AI-written answers.",
  "100% escalation honesty. If you do not understand a question or lack the technical ability to answer it, you research it first — help documentation, Google, YouTube — and you are honest when you need to escalate.",
  "100% English grammatical accuracy. Every message you send is reviewed for correct American English.",
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
type Day = (typeof DAYS)[number];
type Hours = Record<string, { start: string; end: string }>;

const emptyHours = (): Hours =>
  DAYS.reduce((acc, d) => ({ ...acc, [d]: { start: "09:00", end: "17:00" } }), {} as Hours);

export default function SupportRep() {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [slackNotify, setSlackNotify] = useState(true);
  const [worksWeekends, setWorksWeekends] = useState(false);
  const [sameEveryDay, setSameEveryDay] = useState(true);
  const [standard, setStandard] = useState({ start: "09:00", end: "17:00" });
  const [hours, setHours] = useState<Hours>(emptyHours);
  const [agreed, setAgreed] = useState<boolean[]>(STANDARDS.map(() => false));
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ ends: string; queued: number } | null>(null);

  const allAgreed = agreed.every(Boolean);

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecking(true);
    const { data, error } = await supabase.functions.invoke("support-rep-apply", {
      body: { password, check_only: true },
    });
    setChecking(false);
    if (error || !data?.ok) {
      toast.error("That password is not correct.");
      return;
    }
    setUnlocked(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allAgreed) {
      toast.error("Please agree to all five standards.");
      return;
    }
    setSubmitting(true);
    const workingHours: Hours = sameEveryDay
      ? DAYS.reduce((acc, d) => {
          if (!worksWeekends && (d === "Saturday" || d === "Sunday")) return acc;
          return { ...acc, [d]: standard };
        }, {} as Hours)
      : Object.fromEntries(
          Object.entries(hours).filter(([d]) => worksWeekends || (d !== "Saturday" && d !== "Sunday")),
        );

    const { data, error } = await supabase.functions.invoke("support-rep-apply", {
      body: {
        password,
        name,
        email,
        phone,
        slack_notify: slackNotify,
        works_weekends: worksWeekends,
        hours: workingHours,
        agreed: true,
      },
    });
    setSubmitting(false);
    if (error || !data?.ok) {
      toast.error(data?.error || "Something went wrong. Please try again.");
      return;
    }
    setDone({ ends: data.training_ends_at, queued: data.queued_requests || 0 });
  };

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <PageSEO title="Support Representative Application" description="Private application page." path="/support-rep" noindex />
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Support Representative Application</CardTitle>
            <CardDescription>Enter the password you were given to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={unlock} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gate-password">Password</Label>
                <Input
                  id="gate-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={checking}>
                {checking ? "Checking…" : "Continue"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-lg text-center">
          <CardHeader>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>You're in. Your two weeks starts now.</CardTitle>
            <CardDescription>
              We've queued {done.queued} practice support requests. They will arrive at random times, mostly between
              8:00am and 9:00pm Central. Answer every one as if it were a real customer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your trial ends {new Date(done.ends).toLocaleDateString()}.
            </p>
            <Button asChild className="w-full">
              <Link to="/support-rep/portal">Open your training portal</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <PageSEO title="Support Representative Application" description="Private application page." path="/support-rep" noindex />
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Become a SaaSSuite support representative</h1>
          <p className="text-muted-foreground">
            Read every standard below. You will be measured against all five for two weeks before you support a single
            real customer.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">What we expect, every single day</CardTitle>
            <CardDescription>Tick each one to confirm you accept it.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {STANDARDS.map((s, i) => (
              <label
                key={i}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
              >
                <Checkbox
                  checked={agreed[i]}
                  onCheckedChange={(v) =>
                    setAgreed((prev) => prev.map((a, idx) => (idx === i ? v === true : a)))
                  }
                  aria-label={`Agree to standard ${i + 1}`}
                />
                <span className="text-sm text-foreground">
                  <span className="mr-2 font-semibold text-primary">{i + 1}.</span>
                  {s}
                </span>
              </label>
            ))}
          </CardContent>
        </Card>

        <form onSubmit={submit}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="rep-name">Full name</Label>
                  <Input id="rep-name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rep-phone">Phone number</Label>
                  <Input
                    id="rep-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rep-email">Email address</Label>
                <Input
                  id="rep-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  This is how you'll sign in to your training portal.
                </p>
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3">
                <Checkbox
                  checked={slackNotify}
                  onCheckedChange={(v) => setSlackNotify(v === true)}
                  aria-label="Notify me in Slack"
                />
                <span className="text-sm text-foreground">I want to be notified in Slack</span>
              </label>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-foreground">Your working hours</h3>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant={sameEveryDay ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSameEveryDay(true)}
                  >
                    Same hours every day
                  </Button>
                  <Button
                    type="button"
                    variant={!sameEveryDay ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSameEveryDay(false)}
                  >
                    Set each day
                  </Button>
                </div>

                {sameEveryDay ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="std-start">Start</Label>
                      <Input
                        id="std-start"
                        type="time"
                        value={standard.start}
                        onChange={(e) => setStandard((s) => ({ ...s, start: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="std-end">End</Label>
                      <Input
                        id="std-end"
                        type="time"
                        value={standard.end}
                        onChange={(e) => setStandard((s) => ({ ...s, end: e.target.value }))}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {DAYS.filter((d) => worksWeekends || (d !== "Saturday" && d !== "Sunday")).map((d: Day) => (
                      <div key={d} className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
                        <span className="text-sm text-foreground">{d}</span>
                        <Input
                          type="time"
                          className="w-28"
                          aria-label={`${d} start`}
                          value={hours[d].start}
                          onChange={(e) =>
                            setHours((h) => ({ ...h, [d]: { ...h[d], start: e.target.value } }))
                          }
                        />
                        <Input
                          type="time"
                          className="w-28"
                          aria-label={`${d} end`}
                          value={hours[d].end}
                          onChange={(e) => setHours((h) => ({ ...h, [d]: { ...h[d], end: e.target.value } }))}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3">
                  <Checkbox
                    checked={worksWeekends}
                    onCheckedChange={(v) => setWorksWeekends(v === true)}
                    aria-label="I work weekends"
                  />
                  <span className="text-sm text-foreground">I work weekends</span>
                </label>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={submitting || !allAgreed}>
                {submitting ? "Submitting…" : "I agree — start my two-week trial"}
              </Button>
              {!allAgreed && (
                <p className="text-center text-xs text-muted-foreground">
                  Agree to all five standards above to continue.
                </p>
              )}
            </CardContent>
          </Card>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already applied? <Link to="/support-rep/portal" className="text-primary underline">Sign in to your portal</Link>
        </p>
      </div>
    </div>
  );
}
