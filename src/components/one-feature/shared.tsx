import { useEffect, useRef, useState } from "react";
import { isTestTraffic } from "@/utils/testTraffic";
import { hasOptedOutOfTracking, trackingPixelsAllowed } from "@/utils/trackingConsent";
import { useNavigate } from "react-router-dom";
import confetti from "canvas-confetti";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Check, Copy, MessageCircle } from "lucide-react";
import { TextUsDialog } from "@/components/dashboard/SetupHelpPopup";
import { trackSiteEvent } from "@/components/SiteTracker";
import { GHL_AFFILIATE_TRIAL_URL } from "@/constants/ghlAffiliate";
import { TRAINING_YOUTUBE_ID } from "./videoId";
import { YouTubeFacade } from "@/components/media/YouTubeFacade";
import { openTrainingSuccess } from "@/lib/trainingSuccessNav";

export { TRAINING_YOUTUBE_ID };
export const WL_SALES_VIDEO =
  "https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/6a8f8bbd4fe741935400e1b2.mp4";
export const AFFILIATE_CODE = "andrewgeorge";
export const UPGRADE_297_URL = "https://www.gohighlevel.com/297upgrade?fp_ref=andrewgeorge";
export const UPGRADE_497_URL = "https://www.gohighlevel.com/saasupgrade?fp_ref=andrewgeorge";
export const AFFILIATE_UPGRADE_CREDIT = UPGRADE_497_URL;
export const NO_ACCOUNT_URL = GHL_AFFILIATE_TRIAL_URL;
export const SAAS_DISCOUNT_CODE = "AISAAS";

export type GhlPlan = "none" | "97" | "297" | "497";

export const fireConfetti = () => {
  confetti({ particleCount: 140, spread: 90, origin: { y: 0.35 } });
  setTimeout(() => confetti({ particleCount: 80, spread: 140, origin: { y: 0.4 } }), 350);
};

export const go = (url: string) => {
  window.location.href = url;
};

export function TrainingVideo({ captions = false, eager = true }: { captions?: boolean; eager?: boolean }) {
  const sent = useRef(false);
  const markPlayed = () => {
    if (sent.current) return;
    sent.current = true;
    trackSiteEvent("video_play", "training_video");
  };
  // YouTube iframes swallow clicks; a window blur while the iframe is focused means the visitor clicked the player.
  useEffect(() => {
    const onBlur = () => setTimeout(() => {
      if (!(document.activeElement instanceof HTMLIFrameElement)) return;
      if (!document.activeElement.title.startsWith("One-Feature")) return;
      markPlayed();
    }, 0);
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, []);
  return (
    <div className="training-video relative mx-auto aspect-video w-full max-w-4xl overflow-hidden rounded-lg border border-border bg-card shadow-lg" onClick={markPlayed}>
      <YouTubeFacade videoId={TRAINING_YOUTUBE_ID} title="One-Feature free training" eager={eager} fetchPriority={eager ? "high" : "low"} captions={captions} />
    </div>
  );
}

const leadSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(255),
  phone: z.string().trim().min(7, "Enter a valid phone").max(30),
});

export function LeadForm({ page, form, onDone, submitLabel = "Get Instant Access" }: {
  page: string; form: string; onDone: () => void; submitLabel?: string;
}) {
  const [values, setValues] = useState({ name: "", email: "", phone: "" });
  const [hasGhl, setHasGhl] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = leadSchema.safeParse(values);
    if (!parsed.success) return setError(parsed.error.errors[0].message);
    if (hasGhl === null) return setError("Tell us if you have a HighLevel account");
    setError("");
    setSaving(true);
    try {
      const params = new URLSearchParams(window.location.search);
      const utm: Record<string, string> = {};
      params.forEach((v, k) => { if (k.startsWith("utm_") || k === "fbclid") utm[k] = v; });
      const { data, error: dbError } = await supabase.functions.invoke("one-feature-lead", { body: {
        name: parsed.data.name, email: parsed.data.email, phone: parsed.data.phone,
        has_highlevel: hasGhl, page, form, utm, meta: leadTracking(),
      } });
      if (dbError) {
        setError("Something went wrong — please try again.");
        return;
      }
      if (data?.created === true && typeof data.event_id === "string") fireConfirmedLead(data.event_id, page);
      try { sessionStorage.setItem("oft_lead", JSON.stringify({ name: parsed.data.name, hasGhl })); } catch { /* ignore */ }
      onDone();
    } catch {
      setError("Something went wrong — please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form noValidate onSubmit={submit} className="space-y-3 text-left">
      <Input placeholder="Name" value={values.name} maxLength={100} onChange={(e) => setValues({ ...values, name: e.target.value })} className="h-12 text-base" />
      <Input placeholder="Email" type="email" value={values.email} maxLength={255} onChange={(e) => setValues({ ...values, email: e.target.value })} className="h-12 text-base" />
      <Input placeholder="Phone" type="tel" value={values.phone} maxLength={30} onChange={(e) => setValues({ ...values, phone: e.target.value })} className="h-12 text-base" />
      <p className="pt-1 text-sm font-semibold text-foreground">Do you have a HighLevel account?</p>
      <div className="grid grid-cols-2 gap-3">
        {[true, false].map((v) => (
          <button key={String(v)} type="button" onClick={() => setHasGhl(v)}
            className={`rounded-lg border-2 py-4 text-lg font-bold transition ${hasGhl === v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary"}`}>
            {v ? "Yes" : "No"}
          </button>
        ))}
      </div>
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      <Button type="submit" size="lg" disabled={saving} className="webinar-2-cta min-h-14 w-full text-lg font-extrabold uppercase">
        {saving ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}

export function BigChoice({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="w-full rounded-lg border-2 border-border bg-card px-5 py-5 text-left text-lg font-bold text-foreground transition hover:border-primary hover:bg-primary/5">
      {label}
    </button>
  );
}

export function CopyField({ label, value, onCopied }: { label: string; value: string; onCopied?: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="min-w-0 max-w-full rounded-lg border-2 border-dashed border-primary bg-primary/5 p-4 text-left">
      <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-primary">{label}</p>
      <div className="flex min-w-0 max-w-full flex-col gap-2">
        <code className="block min-w-0 max-w-full break-all text-sm font-semibold text-foreground">{value}</code>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-auto min-h-9 w-full min-w-0 whitespace-normal"
          onClick={() => {
            void navigator.clipboard?.writeText(value);
            setCopied(true);
            if (onCopied) onCopied();
            else setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          <span className="ml-1">{copied ? "Copied" : "Copy"}</span>
        </Button>
      </div>
    </div>
  );
}

const wideCta =
  "h-auto min-h-14 w-full min-w-0 max-w-full whitespace-normal px-4 py-3 text-center text-base font-extrabold uppercase leading-snug sm:text-lg";

const planLabel = (p: GhlPlan) => (p === "none" ? "no HighLevel account" : `a HighLevel account on the $${p} plan`);

/** Final step: upgrade / signup destination routed by HighLevel plan. */
export function UpgradeDestination({
  plan,
  showQuestions = false,
  signupUrl = NO_ACCOUNT_URL,
  signupLabel = "Create My HighLevel Account",
  signupCopyLabel,
  open = go,
  upgrade497Url = UPGRADE_497_URL,
  upgrade297Url = UPGRADE_297_URL,
  affiliateCode = AFFILIATE_CODE,
  readyAction,
  onCopied,
  onOpened,
  onSave,
  saveLabel = "Save link (.txt)",
}: {
  plan: GhlPlan;
  showQuestions?: boolean;
  /** Defaults to the training-page trial link. The kit popup passes the Russell signup URL. */
  signupUrl?: string;
  signupLabel?: string;
  signupCopyLabel?: string;
  /** Defaults to a same-tab visit. The kit popup opens a new tab. */
  open?: (url: string) => void;
  /** Defaults to the One Feature page links. The kit popup passes the Russell upgrade URLs. */
  upgrade497Url?: string;
  upgrade297Url?: string;
  affiliateCode?: string;
  /** Kit popup only. The $497 plan continues the funnel instead of opening SaaSSuite signup. */
  readyAction?: { title: string; detail: string; label: string; onContinue: () => void };
  /** Kit popup: copying a link moves the wizard forward. */
  onCopied?: () => void;
  /** Kit popup: opening HighLevel moves the wizard forward. The link still opens in a new tab. */
  onOpened?: () => void;
  /** Kit popup: downloads the branch links, then moves the wizard forward. */
  onSave?: () => void;
  saveLabel?: string;
}) {
  const [textOpen, setTextOpen] = useState(false);
  useEffect(() => { fireConfetti(); }, []);

  const smsMessage = `Hey Andrew, I want to build the AI SaaS model you showed in the youtube training. My name is...... and I ${plan === "none" ? "don't have a HighLevel account" : `do have a HighLevel account on the $${plan} plan`}... My question is...`;
  const openLink = (url: string) => {
    open(url);
    onOpened?.();
  };

  return (
    <div className="min-w-0 max-w-full space-y-4">
      {plan === "none" && (
        <>
          <p className="text-muted-foreground">First you'll need a HighLevel account — start here:</p>
          {signupCopyLabel && <CopyField label={signupCopyLabel} value={signupUrl} onCopied={onCopied} />}
          <Button type="button" size="lg" className={`webinar-2-cta ${wideCta}`} onClick={() => openLink(signupUrl)}>
            {signupLabel}
          </Button>
        </>
      )}
      {(plan === "97" || plan === "297") && (
        <>
          <CopyField label="Affiliate Upgrade Credit" value={upgrade497Url} onCopied={onCopied} />
          <Button type="button" size="lg" className={`webinar-2-cta ${wideCta}`} onClick={() => openLink(upgrade497Url)}>
            Complete My Upgrade — $497 Plan
          </Button>
        </>
      )}
      {plan === "97" && (
        <div className="min-w-0 space-y-4 pt-2">
          <CopyField label="Affiliate Code" value={affiliateCode} onCopied={onCopied} />
          <Button type="button" size="lg" variant="outline" className={wideCta} onClick={() => openLink(upgrade297Url)}>
            Complete My Upgrade — $297 Plan
          </Button>
        </div>
      )}
      {plan === "497" && readyAction && (
        <>
          <h2 className="text-xl font-extrabold text-foreground">{readyAction.title}</h2>
          <p className="break-words text-muted-foreground">{readyAction.detail}</p>
          <Button type="button" size="lg" className={`webinar-2-cta ${wideCta}`} onClick={readyAction.onContinue}>
            {readyAction.label}
          </Button>
        </>
      )}
      {plan === "497" && !readyAction && (
        <>
          <CopyField label="Exclusive SaaS Suite Discount Code" value={SAAS_DISCOUNT_CODE} onCopied={onCopied} />
          <Button type="button" size="lg" className={`webinar-2-cta ${wideCta}`} onClick={() => go("/signup")}>
            Create My SaaS Suite Account
          </Button>
        </>
      )}
      {onSave && (
        <Button type="button" size="lg" variant="outline" className={wideCta} onClick={onSave}>
          {saveLabel}
        </Button>
      )}
      {showQuestions && (
        <>
          <Button size="lg" variant="secondary" className="min-h-12 w-full text-base font-bold" onClick={() => setTextOpen(true)}>
            <MessageCircle className="mr-2 h-5 w-5" /> Questions?
          </Button>
          <TextUsDialog open={textOpen} onOpenChange={setTextOpen} message={smsMessage} phone="3372270501"
            title="Text Andrew" description={`Send a quick text — we'll help you get set up with ${planLabel(plan)}.`} />
        </>
      )}
    </div>
  );
}

export function useGoTo() {
  const navigate = useNavigate();
  return (path: string) => {
    const splitAt = path.indexOf("?");
    const pathname = splitAt === -1 ? path : path.slice(0, splitAt);
    const extra = splitAt === -1 ? "" : path.slice(splitAt + 1);
    const next = new URLSearchParams(window.location.search);
    new URLSearchParams(extra).forEach((value, key) => next.set(key, value));
    const search = next.toString();
    const target = search ? `${pathname}?${search}` : pathname;
    if (pathname === "/onefeaturetraining-success") {
      openTrainingSuccess(target, navigate);
      return;
    }
    navigate(target);
  };
}

/**
 * Facebook match data for a training opt-in. Does not fire Lead.
 * The browser event waits until one-feature-lead returns created: true and
 * event_id lead_<row id>, then fireConfirmedLead uses that same id.
 */
export function leadTracking() {
  const cookie = (n: string) => document.cookie.match(new RegExp(`(?:^|; )${n}=([^;]*)`))?.[1] ?? null;
  let fbclid: string | null = null;
  try { fbclid = new URLSearchParams(window.location.search).get("fbclid") || localStorage.getItem("fbclid"); } catch { /* ignore */ }
  const test = isTestTraffic();
  return { fbp: cookie("_fbp"), fbc: cookie("_fbc"), fbclid, page_url: window.location.href, tracking_optout: hasOptedOutOfTracking(), is_test: test };
}

/** Browser Lead for a row the server just inserted. eventID must be lead_<row id>. */
export function fireConfirmedLead(eventId: string, contentName?: string) {
  if (!eventId.startsWith("lead_")) return;
  try {
    const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
    if (typeof fbq !== "function" || !trackingPixelsAllowed()) return;
    const data = contentName ? { content_name: contentName } : {};
    fbq("track", "Lead", data, { eventID: eventId });
  } catch {
    /* ignore */
  }
}
