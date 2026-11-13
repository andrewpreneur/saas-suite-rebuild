import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { MessageCircle, LogIn, Monitor, Copy, Sparkles, Gift, CalendarDays, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { MessageResponse } from "@/components/ai-elements/message";
import { Composer } from "@/components/copilot-workspace/Composer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MenuRemovalVideo } from "@/components/copilot-workspace/MenuRemovalVideo";
import { TextUsDialog } from "@/components/dashboard/SetupHelpPopup";
import StripeEmbeddedCheckout from "@/components/StripeEmbeddedCheckout";
import { parseAssistant, splitReply } from "@/lib/copilotWorkspace";
import { consumeCopilotStream } from "@/lib/copilotStream";
import { focusFromPath, validCopilotFocus, COPILOT_TOPICS } from "@/lib/copilotFocus";
import { navigateWithParams, getTrackingParams } from "@/utils/preserveParams";
import { rememberNextPath } from "@/utils/deepLink";
import { getVisitorId, markPendingClaim, signedInCopilotPath, AFFILIATE_URL, PUBLIC_TRIAL_SOURCE, PUBLIC_TRIAL_DAYS, PUBLIC_MENU_GREETING, publicChosenName } from "@/lib/publicCopilot";
import { AGENCY_BOOKING_URL } from "../../supabase/functions/_shared/bookingOffer";
import { AFFILIATE_DEAL, BRANDING_VIDEO_URL, INSTALLATION_VIDEO_URL, UNDERSTANDING_VIDEO_URL } from "../../supabase/functions/_shared/featureAnswers";
import { SUPPORT_SMS_NUMBER } from "@/lib/supportContact";
import PlanFeatureLabel from "@/components/pricing/PlanFeatureLabel";
import { SAME_DAY_WL_SUPPORT } from "@/constants/pricingPlans";

type Msg = { id: string; role: "user" | "assistant"; content: string };

const GREETING = "Hi! I'm SaaSSuite Copilot. Ask me anything about SaaSSuite: what it does, which plan fits you, or how setup works. No account needed to chat.";

function isMobile() {
  return typeof window !== "undefined" && (window.innerWidth < 768 || !!window.matchMedia?.("(pointer: coarse)")?.matches);
}

function TrialCard({ plan, focus }: { plan: "basic" | "advanced"; focus?: string | null }) {
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);
  const price = plan === "basic" ? "$27/month" : "$97/month";
  const norm = email.trim().toLowerCase();
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div>
        <p className="text-lg font-semibold text-foreground">{price}</p>
        <p className="text-sm text-muted-foreground">{plan === "basic" ? "Basic" : "Advanced"} plan · {PUBLIC_TRIAL_DAYS} days free, then billed {price}. Card required, cancel any time before the trial ends.</p>
        {plan === "advanced" ? <p className="text-sm text-foreground"><PlanFeatureLabel feature={SAME_DAY_WL_SUPPORT} /></p> : null}
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm)) return toast.error("Enter a valid email"); markPendingClaim(focus); setOpen(true); }}>
        <Input type="email" aria-label="Email for trial" placeholder="you@agency.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button type="submit"><Sparkles className="h-4 w-4" />Start free trial</Button>
      </form>
      <StripeEmbeddedCheckout plan={plan} trialSource={PUBLIC_TRIAL_SOURCE} email={norm} open={open} onOpenChange={setOpen} />
    </div>
  );
}

export default function PublicCopilot() {
  const { email, session, isLoading } = useUser();
  const location = useLocation();
  const focus = focusFromPath(location.pathname) || validCopilotFocus(new URLSearchParams(location.search).get("copilot_focus"));
  const visitorId = useMemo(() => getVisitorId(focus), [focus]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [customName, setCustomName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [trainingOpen, setTrainingOpen] = useState(false);
  const assistantName = publicChosenName(messages) || "Copilot";
  useEffect(() => {
    if (email) return;
    let cancel = false;
    setMessages([]);
    supabase.functions.invoke("public-copilot", { body: { action: "history", visitorId } }).then(({ data }) => {
      if (!cancel && Array.isArray(data?.messages)) setMessages(data.messages);
    });
    return () => { cancel = true; };
  }, [visitorId, email]);

  // Only a live auth session sends visitors into the app — a stale email value
  // (e.g. left-over account switching state) must never redirect the public page.
  if (!isLoading && session && email) return <Navigate to={signedInCopilotPath(location.pathname, location.search)} replace />;

  const signInHref = (path: "/login" | "/signup") => {
    // Carry UTMs inside the return path so they survive OAuth callbacks that drop outer params.
    const destParams = getTrackingParams();
    destParams.delete("next");
    if (focus) destParams.set("copilot_focus", focus);
    const destQuery = destParams.toString();
    const dest = signedInCopilotPath(location.pathname, destQuery ? `?${destQuery}` : "");
    rememberNextPath(dest);
    markPendingClaim(focus);
    const params = new URLSearchParams(navigateWithParams(path).split("?")[1] || "");
    params.set("next", dest);
    if (focus) params.set("copilot_focus", focus);
    return `${path}?${params}`;
  };

  const send = async (text: string, nameChoice?: string) => {
    if (!text.trim() || busy) return;
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", content: text }]);
    setBusy(true);
    markPendingClaim(focus);
    try {
      const { data, error } = await supabase.functions.invoke("public-copilot", {
        body: { action: "chat", visitorId, content: text, nameChoice, focus: focus ? COPILOT_TOPICS[focus] : null, focusKey: focus, client: { isMobile: isMobile(), width: window.innerWidth } },
      });
      if (data instanceof Response) {
        const id = crypto.randomUUID();
        setMessages((m) => [...m, { id, role: "assistant", content: "" }]);
        let acc = "";
        await consumeCopilotStream(data, (event) => {
          if (event.type === "delta") {
            acc += event.text;
            const next = acc;
            setMessages((m) => m.map((row) => row.id === id ? { ...row, content: next } : row));
          } else if (event.type === "replace") {
            acc = event.text;
            setMessages((m) => m.map((row) => row.id === id ? { ...row, content: event.text } : row));
          }
        });
        return;
      }
      if (error || data?.error) throw new Error(data?.error || "failed");
      setMessages((m) => [...m, { id: data.id || crypto.randomUUID(), role: "assistant", content: data.content }]);
      if (data.openAuth) setAuthOpen(true);
    } catch {
      toast.error("Copilot couldn't reply. Please try again.");
    } finally { setBusy(false); }
  };

  const desktopUrl = `https://saassuite.ai${location.pathname}${location.search}`;
  const renderWidget = (name: string, key: string) => {
    switch (name) {
      case "name_options": return <div key={key} className="space-y-2">
        <div className="flex flex-wrap gap-2">{["Frankie", "Jamie", "Copilot", "Other"].map((option) => <Button key={option} size="sm" variant="outline" disabled={busy || !!publicChosenName(messages)} onClick={() => option === "Other" ? setCustomName(true) : void send(option, option)}>{option}</Button>)}</div>
        {customName && <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (nameDraft.trim()) { void send(nameDraft.trim(), nameDraft.trim()); setCustomName(false); } }}><Input aria-label="Assistant name" maxLength={40} value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} /><Button type="submit" disabled={busy || !nameDraft.trim()}>Save name</Button></form>}
      </div>;
      case "confirm_menu_removal": return <div key={key} className="flex flex-wrap gap-2"><Button size="sm" disabled={busy} onClick={() => void send("Yes, let's do that")}>Yes, let's do that</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => void send("No, I want something else")}>Something else</Button></div>;
      case "menu_removal_video": return <MenuRemovalVideo key={key} />;
      case "book_call": return <Button key={key} asChild size="sm" variant="outline"><a href={navigateWithParams(AGENCY_BOOKING_URL)}><CalendarDays className="h-4 w-4" />Book a call</a></Button>;
      case "branding_video": return <video key={key} controls preload="metadata" src={BRANDING_VIDEO_URL} className="aspect-video w-full max-w-xl rounded-lg bg-muted" />;
      case "installation_video": return <video key={key} controls preload="metadata" src={INSTALLATION_VIDEO_URL} className="aspect-video w-full max-w-xl rounded-lg bg-muted" />;
      case "understanding_video": return <video key={key} controls preload="metadata" src={UNDERSTANDING_VIDEO_URL} className="aspect-video w-full max-w-xl rounded-lg bg-muted" />;
      case "signin": return (
        <div key={key} className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setAuthOpen(true)}><LogIn className="h-4 w-4" />Sign in or create account</Button>
        </div>);
      case "trial_basic": return <TrialCard key={key} plan="basic" focus={focus} />;
      case "trial_advanced": return <TrialCard key={key} plan="advanced" focus={focus} />;
      case "affiliate": return (
        <div key={key} className="rounded-xl border border-border bg-card p-4 space-y-2">
          <p className="text-sm text-foreground"><strong>SaaSSuite ADVANCED free.</strong> {AFFILIATE_DEAL}</p>
          <Button size="sm" onClick={() => { window.location.href = AFFILIATE_URL; }}><Gift className="h-4 w-4" />Go Free SaaS</Button>
        </div>);
      case "desktop_link": return (
        <div key={key} className="rounded-xl border border-border bg-card p-4 space-y-2">
          <p className="text-sm text-foreground"><Monitor className="mr-1 inline h-4 w-4" />Setup needs a computer. Open this link on your desktop:</p>
          <div className="flex gap-2">
            <Input readOnly value={desktopUrl} aria-label="Desktop link" />
            <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard?.writeText(desktopUrl); toast.success("Link copied"); }}><Copy className="h-4 w-4" />Copy</Button>
          </div>
        </div>);
      case "textus": return <Button key={key} size="sm" variant="outline" onClick={() => setHelpOpen(true)}><MessageCircle className="h-4 w-4" />Text us for human help</Button>;
      default: return null;
    }
  };

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <img src="/assets/saassuite-logo.png" alt="SaaSSuite" className="h-7 w-7 object-contain" />
        <span className="min-w-0 truncate font-semibold text-foreground">SaaSSuite {assistantName}</span>
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setHelpOpen(true)}><MessageCircle className="h-4 w-4" />Text us</Button>
          <Button size="sm" asChild><a href={signInHref("/login")}>Sign in</a></Button>
        </div>
      </header>
      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl space-y-3 px-4 py-6">
          {[{ id: "greeting", role: "assistant" as const, content: focus === "menulinkremoval" ? (messages.length ? "Let's continue with Menu Link Removal." : PUBLIC_MENU_GREETING) : GREETING }, ...messages].map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="ml-auto max-w-[85%] rounded-2xl bg-muted px-4 py-2 text-foreground whitespace-pre-wrap">{m.content}</div>
            ) : (
              splitReply(m.content).map((part, i) => {
                const { text, widgets } = parseAssistant(part);
                return (
                  <div key={`${m.id}-${i}`} className="space-y-2">
                    {text && <MessageResponse>{text}</MessageResponse>}
                    {widgets.map((w, j) => {
                      const widgetKey = `${m.id}-${i}-${j}`;
                      if (w.kind === "choices") return <div key={widgetKey} className="flex flex-wrap gap-2">{w.options.map((option) => /book a call/i.test(option) ? <Button key={option} asChild size="sm" variant="outline"><a href={navigateWithParams(AGENCY_BOOKING_URL)}>{option}</a></Button> : /text us/i.test(option) ? <Button key={option} size="sm" variant="outline" onClick={() => setHelpOpen(true)}>{option}</Button> : <Button key={option} size="sm" variant="outline" disabled={busy} onClick={() => void send(option)}>{option}</Button>)}</div>;
                      return w.kind === "widget" ? renderWidget(w.name, widgetKey) : null;
                    })}
                  </div>
                );
              })
            )
          )}
          {busy && <div className="flex gap-1 py-2" aria-label="Copilot is typing">{[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: `${i * 150}ms` }} />)}</div>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="mx-auto w-full max-w-3xl px-4 pb-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">{focus === "menulinkremoval" && <><Button size="sm" variant="outline" onClick={() => setTrainingOpen((value) => !value)}><Monitor className="h-4 w-4" />Training video</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => void send("Help me check why my snapshot access is locked")}><LockKeyhole className="h-4 w-4" />Snapshot</Button></>}<Button asChild size="sm" variant="ghost"><a href={navigateWithParams(AGENCY_BOOKING_URL)}><CalendarDays className="h-4 w-4" />Book a call</a></Button><Button size="sm" variant="ghost" onClick={() => setHelpOpen(true)}><MessageCircle className="h-4 w-4" />Text Us Now</Button></div>
        {trainingOpen && <MenuRemovalVideo />}
        <Composer placeholder={`Work with ${assistantName}`} disabled={busy} onSend={(text) => send(text)} />
        <p className="mt-2 text-center text-xs text-muted-foreground">Sign in to install and set things up. Your chat comes with you.</p>
      </div>
      <TextUsDialog open={helpOpen} onOpenChange={setHelpOpen} phone={SUPPORT_SMS_NUMBER} title="Talk to a human" description="Text our team with any question about SaaSSuite." message="Hi! I have a question about SaaSSuite." />
      <Dialog open={authOpen} onOpenChange={setAuthOpen}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Continue with your account</DialogTitle><DialogDescription>Your chat and Menu Link Removal interest come with you. Training is free to watch; the snapshot requires verified Basic-or-higher access.</DialogDescription></DialogHeader><div className="flex flex-wrap gap-2"><Button asChild><a href={signInHref("/login")}>Sign in</a></Button><Button asChild variant="outline"><a href={signInHref("/signup")}>Create free account</a></Button><Button variant="ghost" onClick={() => setAuthOpen(false)}>Keep learning</Button></div></DialogContent></Dialog>
    </div>
  );
}
