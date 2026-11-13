import { useState } from "react";
import { Check, Copy, ExternalLink, Loader2, Lock, ShieldCheck } from "lucide-react";
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

const SLACK_INSTALL = "https://auth.saassuite.ai/functions/v1/slack-install";

export function Choices({ options, disabled, onPick }: { options: string[]; disabled?: boolean; onPick: (o: string) => void }) {
  const [customOption, setCustomOption] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  return (
    <div className="mt-2 space-y-2">
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Button key={o} variant="outline" type="button" disabled={disabled} onClick={() => {
          if (requiresCustomAnswer(o)) { setCustomOption(o); setAnswer(""); }
          else { setCustomOption(null); onPick(o); }
        }}
          className="rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none">
          {o}
        </Button>
      ))}
    </div>
    {customOption && <form className="flex gap-2" onSubmit={(e) => {
      e.preventDefault();
      if (!disabled && answer.trim()) { onPick(answer.trim()); setCustomOption(null); setAnswer(""); }
    }}>
      <Input autoFocus aria-label="Your response" placeholder={customOption === "Other" ? "What would you like?" : "Tell me what you have in mind…"} value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={disabled} />
      <Button type="submit" size="icon" aria-label="Send your response" disabled={disabled || !answer.trim()}><Check className="h-4 w-4" /></Button>
    </form>}
    </div>
  );
}

export function MultiPick({ options, disabled, onSubmit, submitLabel = "Add these" }: { options: string[]; disabled?: boolean; onSubmit: (picked: string[]) => void; submitLabel?: string }) {
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (o: string) => setPicked((p) => (p.includes(o) ? p.filter((x) => x !== o) : [...p, o]));
  return (
    <div className="mt-3 rounded-2xl border border-border bg-card p-2">
      <ul className="max-h-72 overflow-y-auto overscroll-contain">
        {options.map((o) => (
          <li key={o}>
            <button type="button" disabled={disabled} onClick={() => toggle(o)} aria-pressed={picked.includes(o)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-muted disabled:opacity-50">
              <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded border", picked.includes(o) ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                {picked.includes(o) && <Check className="h-3.5 w-3.5" />}
              </span>
              {o}
            </button>
          </li>
        ))}
      </ul>
      <div className="flex justify-end gap-2 p-2 border-t border-border mt-1">
        <Button variant="ghost" size="sm" disabled={disabled} onClick={() => onSubmit([])}>None for now</Button>
        <Button size="sm" disabled={disabled || picked.length === 0} onClick={() => onSubmit(picked)}>{submitLabel} ({picked.length})</Button>
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
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted overflow-hidden">{logo}</div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
      {connected ? (
        <span className="flex items-center gap-1 text-sm text-primary"><Check className="h-4 w-4" /> Connected</span>
      ) : (
        <Button size="sm" variant="outline" className="rounded-full" onClick={onAuthorize} disabled={busy}>Authorize</Button>
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
        <Button size="sm" className="rounded-full" onClick={onDone}>I'm done, go back to chat</Button>
      )}
    </div>
  );
}

export function ConnectApps(props: { agencyId: string | null; email: string | null; slackConnected: boolean; ghlConnected: boolean; onSlackDone: () => void; onGhlAuthorize: () => void }) {
  return (
    <div className="mt-3 space-y-2">
      <SlackCard agencyId={props.agencyId} email={props.email} connected={props.slackConnected} onDone={props.onSlackDone} />
      <AppRow logo={<HighLevelLogo />} title="HighLevel" desc="Lets me create your menu link, see your sub-accounts and set things up for you."
        connected={props.ghlConnected} onAuthorize={props.onGhlAuthorize} />
    </div>
  );
}

/** Secure HighLevel token form: the token goes straight to our encrypted store, never into chat. */
export function GhlConnectForm({ agencyId, connected, disabled, onConnected, onSkip, showSkip = true }: { agencyId: string | null; connected: boolean; disabled?: boolean; onConnected: (companyName: string | null) => void; onSkip: () => void; showSkip?: boolean }) {
  const [token, setToken] = useState("");
  const [loc, setLoc] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (connected) {
    return <p className="mt-3 flex items-center gap-2 text-sm text-primary"><ShieldCheck className="h-4 w-4" /> HighLevel is connected.</p>;
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
    <div className="mt-3 space-y-3 rounded-2xl border border-border bg-card p-4">
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
        <Button variant="accent" onClick={submit} disabled={disabled || busy} className="rounded-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Save securely to connect GoHighLevel
        </Button>
        {showSkip && <Button variant="ghost" onClick={onSkip} disabled={disabled || busy}>Skip for now</Button>}
      </div>
    </div>
  );
}

export function MenuLinkStep({ agencyId, connected, installed, onCreated, onConnect }: { agencyId: string | null; connected: boolean; installed: boolean; onCreated: (id: string) => void; onConnect: () => void }) {
  if (installed) return <p className="mt-3 flex items-center gap-2 text-sm text-primary"><Check className="h-4 w-4" /> Your menu link is installed.</p>;
  if (!connected) {
    return (
      <div className="mt-3 rounded-2xl border border-border bg-card p-4 text-sm space-y-2">
        <p>Connect HighLevel first so I can install the menu link for you.</p>
        <Button size="sm" className="rounded-full" onClick={onConnect}>Connect HighLevel</Button>
      </div>
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
    <a href={href} className="mt-3 inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline">
      {label} <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}

export function HubLinkCard({ url, onConnect }: { url: string; onConnect: () => void }) {
  return <div className="mt-2 space-y-2 rounded-lg border border-border bg-card p-3">
    <p className="font-medium">Your Client Hub</p>
    <p className="text-sm text-muted-foreground">This is your customers’ welcome, onboarding, education and support page. Preview it now; connecting HighLevel and adding your menu link and agency-level CSS/JS on desktop completes installation.</p>
    <p className="break-all text-xs text-muted-foreground">{url}</p>
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(url); toast.success("Client Hub link copied"); } catch { toast.error("Couldn't copy. Select the link above instead."); } }}><Copy className="h-4 w-4" />Copy link</Button>
      <Button size="sm" variant="outline" asChild><a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />Open in new tab</a></Button>
      <Button size="sm" variant="ghost" onClick={onConnect}>Connect HighLevel</Button>
    </div>
  </div>;
}

export function UpgradeButtons({ disabled, onUpgrade }: { disabled?: boolean; onUpgrade: (plan: "basic" | "advanced" | "enhanced") => void }) {
  return <div className="mt-2 space-y-2">
    <div className="flex flex-wrap gap-2">{(["basic", "advanced", "premium"] as const).map((key) => {
      const p = SAAS_PLANS[key];
      return <Button key={key} size="sm" variant="outline" disabled={disabled} onClick={() => onUpgrade(key === "premium" ? "enhanced" : key)}>{p.name} · ${p.monthlyPrice}/mo</Button>;
    })}</div>
    <p className="text-xs text-muted-foreground">Basic: branding + menu removal. Advanced: unlimited users + power tools, including <PlanFeatureLabel feature={SAME_DAY_WL_SUPPORT} />. Premium Support: our human team supports your clients. Review payment before confirming.</p>
  </div>;
}
