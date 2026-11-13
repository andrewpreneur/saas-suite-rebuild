import { useState } from "react";
import { Check, Copy, ExternalLink, Link2, Loader2, Lock, PlugZap, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import slackLogo from "@/assets/slack-logo.webp.asset.json";
import highLevelLogo from "@/assets/highlevel-logo.webp.asset.json";
import { ghl } from "@/components/highlevel/ghlApi";
import CreateMenuLinkWidget from "@/components/highlevel/CreateMenuLinkWidget";
import { VIDEO_CATEGORIES } from "@/constants/videoCategories";
import { cn } from "@/lib/utils";
import { requiresCustomAnswer } from "@/lib/copilotWorkspace";
import { SAAS_PLANS, SAME_DAY_WL_SUPPORT } from "@/constants/pricingPlans";
import PlanFeatureLabel from "@/components/pricing/PlanFeatureLabel";
import { CopilotCard } from "@/components/premium/copilot/CopilotBits";

const SLACK_INSTALL = "https://backend-disconnected.invalid/functions/v1/slack-install";

/** Quiet status line for a step that is already done. */
function DoneLine({ icon: Icon = Check, children }: { icon?: typeof Check; children: React.ReactNode }) {
  return (
    <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-success/10 px-3 py-1.5 text-sm font-medium text-success">
      <Icon className="h-4 w-4" /> {children}
    </p>
  );
}

const chip =
  "h-auto min-h-11 whitespace-normal rounded-full border border-border bg-card px-4 py-2 text-left text-sm font-normal text-foreground shadow-card " +
  "transition-[transform,border-color,color] duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:bg-card hover:text-brand " +
  "active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none sm:min-h-9";

export function Choices({ options, disabled, onPick }: { options: string[]; disabled?: boolean; onPick: (o: string) => void }) {
  const [customOption, setCustomOption] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  return (
    <div className="mt-3 space-y-2">
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Button key={o} variant="outline" type="button" disabled={disabled} onClick={() => {
          if (requiresCustomAnswer(o)) { setCustomOption(o); setAnswer(""); }
          else { setCustomOption(null); onPick(o); }
        }}
          className={cn(chip, customOption === o && "border-brand/50 text-brand")}>
          {o}
        </Button>
      ))}
    </div>
    {customOption && <form className="flex gap-2" onSubmit={(e) => {
      e.preventDefault();
      if (!disabled && answer.trim()) { onPick(answer.trim()); setCustomOption(null); setAnswer(""); }
    }}>
      <Input autoFocus aria-label="Your response" placeholder={customOption === "Other" ? "What would you like?" : "Tell me what you have in mind…"} value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={disabled} />
      <Button type="submit" variant="accent" size="icon" aria-label="Send your response" disabled={disabled || !answer.trim()}><Check className="h-4 w-4" /></Button>
    </form>}
    </div>
  );
}

export function MultiPick({ options, disabled, onSubmit, submitLabel = "Add these" }: { options: string[]; disabled?: boolean; onSubmit: (picked: string[]) => void; submitLabel?: string }) {
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (o: string) => setPicked((p) => (p.includes(o) ? p.filter((x) => x !== o) : [...p, o]));
  return (
    <div className="px-surface mt-3 border border-border/60 p-2">
      <ul className="max-h-72 overflow-y-auto overscroll-contain">
        {options.map((o) => (
          <li key={o}>
            <button type="button" disabled={disabled} onClick={() => toggle(o)} aria-pressed={picked.includes(o)}
              className={cn("flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50", picked.includes(o) && "bg-brand-subtle hover:bg-brand-subtle")}>
              <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border transition-colors", picked.includes(o) ? "border-brand bg-brand text-brand-foreground" : "border-border bg-card")}>
                {picked.includes(o) && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              </span>
              {o}
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-1 flex flex-wrap justify-end gap-2 border-t border-border p-2">
        <Button variant="ghost" size="sm" disabled={disabled} onClick={() => onSubmit([])}>None for now</Button>
        <Button variant="accent" size="sm" disabled={disabled || picked.length === 0} onClick={() => onSubmit(picked)}>{submitLabel} ({picked.length})</Button>
      </div>
    </div>
  );
}

export function VideosPicker({ disabled, onSubmit }: { disabled?: boolean; onSubmit: (picked: string[]) => void }) {
  const options = VIDEO_CATEGORIES.flatMap((c) => c.modules.map((m) => m.name));
  return <MultiPick options={options} disabled={disabled} onSubmit={onSubmit} submitLabel="Teach these" />;
}

function AppRow({ logo, title, desc, connected, onAuthorize, busy }: { logo: React.ReactNode; title: string; desc: string; connected?: boolean; onAuthorize: () => void; busy?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card p-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">{logo}</div>
      <div className="min-w-0 flex-[1_1_12rem]">
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
      {connected ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-sm font-medium text-success"><Check className="h-4 w-4" /> Connected</span>
      ) : (
        <Button size="sm" variant="accent" onClick={onAuthorize} disabled={busy}>Authorize</Button>
      )}
    </div>
  );
}

export const HighLevelLogo = () => (
  <img src={highLevelLogo.url} alt="HighLevel" className="h-11 w-11 object-contain" />
);

/** Slack card: opens the Slack install in a new tab, then offers "Go back to chat". */
export function SlackCard({ agencyId, email, connected, onDone }: { agencyId: string | null; email: string | null; connected: boolean; onDone: () => void }) {
  const [opened, setOpened] = useState(false);
  const authorize = () => {
    if (!agencyId) { toast.error("Your account is still loading — try again in a second."); return; }
    const url = `${SLACK_INSTALL}?agency_id=${encodeURIComponent(agencyId)}&email=${encodeURIComponent(email ?? "")}`;
    const w = window.open(url, "_blank", "noopener");
    if (!w) window.location.href = url;
    setOpened(true);
  };
  return (
    <div className="space-y-2">
      <AppRow logo={<img src={slackLogo.url} alt="" className="h-7 w-7 object-contain" />} title="Slack"
        desc="Get alerts, reports and chat with me from your Slack workspace." connected={connected} onAuthorize={authorize} />
      {opened && !connected && (
        <Button size="sm" variant="outline" onClick={onDone}>I'm done, go back to chat</Button>
      )}
    </div>
  );
}

export function ConnectApps(props: { agencyId: string | null; email: string | null; slackConnected: boolean; ghlConnected: boolean; onSlackDone: () => void; onGhlAuthorize: () => void }) {
  return (
    <CopilotCard icon={<PlugZap />} title="Connect your apps" description="Authorize each one once. I'll take it from there.">
      <div className="space-y-2">
        <SlackCard agencyId={props.agencyId} email={props.email} connected={props.slackConnected} onDone={props.onSlackDone} />
        <AppRow logo={<HighLevelLogo />} title="HighLevel" desc="Lets me create your menu link, see your sub-accounts and set things up for you."
          connected={props.ghlConnected} onAuthorize={props.onGhlAuthorize} />
      </div>
    </CopilotCard>
  );
}

/** Secure HighLevel token form: the token goes straight to our encrypted store, never into chat. */
export function GhlConnectForm({ agencyId, connected, disabled, onConnected, onSkip, showSkip = true }: { agencyId: string | null; connected: boolean; disabled?: boolean; onConnected: (companyName: string | null) => void; onSkip: () => void; showSkip?: boolean }) {
  const [token, setToken] = useState("");
  const [loc, setLoc] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (connected) {
    return <DoneLine icon={ShieldCheck}>HighLevel is connected.</DoneLine>;
  }
  const submit = async () => {
    if (!agencyId) return;
    setErr(null);
    if (token.trim().length < 20) { setErr("That token looks too short. Copy the full Private Integration token."); return; }
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(loc.trim())) { setErr("Add your Location ID (letters and numbers, found in Settings > Business Profile)."); return; }
    setBusy(true);
    try {
      const r = await ghl<{ connection: { company_name?: string | null } }>("connect", agencyId, { token: token.trim(), location_id: loc.trim() });
      setToken("");
      onConnected(r.connection?.company_name ?? null);
    } catch (e: any) {
      setErr(e.message || "HighLevel didn't accept that token.");
    } finally { setBusy(false); }
  };
  return (
    <CopilotCard icon={<Lock />} title="Connect HighLevel" description="Your token goes straight to our encrypted store. It never appears in this chat.">
      <div className="space-y-1.5">
        <Label htmlFor="ghl-token">Private Integration token</Label>
        <Input id="ghl-token" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="pit-..." disabled={disabled || busy} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ghl-loc">Location ID</Label>
        <Input id="ghl-loc" autoComplete="off" value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="e.g. 6W75zTfWTj7QOIgIZsCH" disabled={disabled || busy} />
      </div>
      {err && <p className="text-sm text-destructive" role="alert">{err}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="accent" onClick={submit} disabled={disabled || busy} className="h-auto min-h-10 whitespace-normal py-2 text-left">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Save securely to connect GoHighLevel
        </Button>
        {showSkip && <Button variant="ghost" onClick={onSkip} disabled={disabled || busy}>Skip for now</Button>}
      </div>
    </CopilotCard>
  );
}

export function MenuLinkStep({ agencyId, connected, installed, onCreated, onConnect }: { agencyId: string | null; connected: boolean; installed: boolean; onCreated: (id: string) => void; onConnect: () => void }) {
  if (installed) return <DoneLine>Your menu link is installed.</DoneLine>;
  if (!connected) {
    return (
      <CopilotCard icon={<Link2 />} title="Install your menu link" description="Connect HighLevel first so I can install the menu link for you."
        actions={<Button size="sm" variant="accent" onClick={onConnect}>Connect HighLevel</Button>} />
    );
  }
  return (
    <div className="mt-3">
      <CreateMenuLinkWidget agencyId={agencyId} defaultUrl={agencyId ? `https://yoursoftwareonboarding.com/v2/${agencyId}` : ""} onCreated={onCreated} hideUrl />
    </div>
  );
}

export function OpenLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand underline-offset-4 hover:underline">
      {label} <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}

export function HubLinkCard({ url, onConnect }: { url: string; onConnect: () => void }) {
  return (
    <CopilotCard icon={<Sparkles />} title="Your Client Hub"
      description="Your customers’ welcome, onboarding, education and support page. Preview it now; connecting HighLevel and adding your menu link and agency-level CSS/JS on desktop completes installation.">
      <p className="break-all rounded-md bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">{url}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="accent" asChild><a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />Open Client Hub</a></Button>
        <Button size="sm" variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(url); toast.success("Client Hub link copied"); } catch { toast.error("Couldn't copy. Select the link above instead."); } }}><Copy className="h-4 w-4" />Copy link</Button>
        <Button size="sm" variant="ghost" onClick={onConnect}>Connect HighLevel</Button>
      </div>
    </CopilotCard>
  );
}

const PLAN_NOTES: Record<"basic" | "advanced" | "premium", React.ReactNode> = {
  basic: "Branding and menu removal.",
  advanced: <>Unlimited users and power tools, including <PlanFeatureLabel feature={SAME_DAY_WL_SUPPORT} /></>,
  premium: "Our human team supports your clients.",
};

export function UpgradeButtons({ disabled, onUpgrade }: { disabled?: boolean; onUpgrade: (plan: "basic" | "advanced" | "enhanced") => void }) {
  return (
    <CopilotCard icon={<Sparkles />} title="Plans and upgrades" description="Pick a plan to review. You confirm payment in Stripe before anything changes.">
      <ul className="space-y-2">{(["basic", "advanced", "premium"] as const).map((key) => {
        const p = SAAS_PLANS[key];
        return (
          <li key={key} className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card p-3">
            <div className="min-w-0 flex-[1_1_14rem]">
              <p className="font-medium text-foreground">{p.name} <span className="font-normal text-muted-foreground">· ${p.monthlyPrice}/mo</span></p>
              <p className="text-sm text-muted-foreground">{PLAN_NOTES[key]}</p>
            </div>
            <Button size="sm" variant={key === "advanced" ? "accent" : "outline"} disabled={disabled} aria-label={`${p.name} · $${p.monthlyPrice}/mo`} onClick={() => onUpgrade(key === "premium" ? "enhanced" : key)}>Review {p.name}</Button>
          </li>
        );
      })}</ul>
    </CopilotCard>
  );
}
