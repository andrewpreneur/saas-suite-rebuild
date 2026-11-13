import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, Copy, KeyRound, Link2, ListFilter, Loader2, MapPin, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { MoreMenu } from "@/components/premium/MoreMenu";
import { Disclosure, StatusRow } from "@/components/premium/settings/Page";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { ghl } from "./ghlApi";

type Connection = { connected: boolean; company_id?: string; company_name?: string; token_prefix?: string | null; last_sync_at?: string; last_error?: string; capabilities?: Record<string, boolean | string> };
const scopes = [
  ["View Companies", "companies.readonly"],
  ["View Locations", "locations.readonly"],
  ["View Users", "users.readonly"],
  ["Custom Menu Links (view)", "custom-menu-link.readonly"],
  ["Custom Menu Links (edit), needed to assign onboarding to sub-accounts", "custom-menu-link.write"],
];
const benefits = [
  { icon: ListFilter, title: "Make every menu your own", text: "Unlock advanced menu removal with your sub-accounts ready to pick." },
  { icon: ShieldCheck, title: "Connect your onboarding", text: "Verify installation and set up multiple onboarding paths." },
  { icon: KeyRound, title: "Two details. One connection.", text: "Create a private integration token, share one location ID, and we find your company." },
];

export default function HighLevelIntegrationPanel({ agencyId, onStatus }: { agencyId: string | null; /** Reports the connection once it is known, so a list row can show it. */ onStatus?: (status: { connected: boolean; name?: string | null }) => void }) {
  const [conn, setConn] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"token-guide" | "token" | "location-guide" | "location" | "connecting" | "success">("token-guide");
  const [token, setToken] = useState("");
  const [locationId, setLocationId] = useState("");
  const [formError, setFormError] = useState("");
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const requestId = useRef(0);
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;
  useEffect(() => { if (conn) onStatusRef.current?.({ connected: !!conn.connected, name: conn.company_name }); }, [conn]);
  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true); setError(""); setConn(null);
    if (!agencyId) return;
    try {
      const result = await ghl<{ connection: Connection }>("status", agencyId);
      if (id === requestId.current) setConn(result.connection);
    } catch (e) { if (id === requestId.current) setError(e instanceof Error ? e.message : "Couldn't load your connection. Try again."); }
    finally { if (id === requestId.current) setLoading(false); }
  }, [agencyId]);
  useEffect(() => { setOpen(false); setToken(""); setLocationId(""); void load(); return () => { requestId.current++; }; }, [load]);
  const start = () => { setToken(""); setLocationId(""); setFormError(""); setStep("token-guide"); setOpen(true); };
  const close = (value: boolean) => { if (step === "connecting") return; setOpen(value); if (!value) { setToken(""); setLocationId(""); setFormError(""); } };
  const copyCompany = async () => {
    try { await navigator.clipboard.writeText(conn?.company_id || ""); toast.success("Company ID copied"); }
    catch { toast.error("Couldn't copy. Select your company ID and copy it manually."); }
  };
  const connect = async () => {
    if (!agencyId) return;
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(locationId.trim())) { setFormError("Paste just the location ID, not the full page address."); return; }
    const id = requestId.current;
    setFormError(""); setStep("connecting");
    try {
      const result = await ghl<{ connection: Connection }>("connect", agencyId, { token: token.trim(), location_id: locationId.trim() });
      if (id !== requestId.current) return;
      if (!result.connection?.connected) throw new Error("The connection wasn't confirmed. Check your token and location ID, then try again.");
      setConn(result.connection); setToken(""); setLocationId(""); setStep("success");
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) confetti({ particleCount: 65, spread: 70, origin: { y: 0.45 }, disableForReducedMotion: true });
    } catch (e) { if (id === requestId.current) { setFormError(e instanceof Error ? e.message : "Couldn't connect. Check your details and try again."); setStep("location"); } }
  };
  const run = async (action: string) => {
    if (!agencyId) return;
    setBusy(action);
    try { await ghl(action, agencyId); toast.success(action === "disconnect" ? "HighLevel disconnected" : action === "sync" ? "HighLevel synced" : "Connection checked"); setDisconnectOpen(false); await load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't complete that action. Try again."); }
    finally { setBusy(null); }
  };
  if (loading) return <section aria-busy="true" className="space-y-3"><p role="status" className="sr-only">Loading your HighLevel connection</p><div className="px-skeleton h-12 rounded-lg" /><div className="px-skeleton h-11 rounded-lg" /></section>;
  if (error) return <section role="alert" className="space-y-4"><p className="flex items-center gap-2 text-sm text-destructive"><AlertTriangle className="h-5 w-5 shrink-0" />{error}</p><Button variant="outline" className="h-11 sm:h-10" onClick={() => void load()}>Retry loading connection</Button></section>;
  const lastSync = conn?.last_sync_at ? new Date(conn.last_sync_at).toLocaleString() : "";
  return <section>
    {conn?.connected ? <>
      <StatusRow tone={conn.last_error ? "error" : "on"} label={`Connected to ${conn.company_name || "your agency account"}`} detail={lastSync ? `Last synced ${lastSync}.` : "Your sub-accounts are ready to pick across SaaS Suite."}>
        <Button variant="accent" className="h-11 flex-1 sm:h-10 sm:flex-none" disabled={!!busy} onClick={() => void run("sync")}>{busy === "sync" ? <><Loader2 className="animate-spin" aria-hidden="true" />Syncing sub-accounts</> : <><RefreshCw aria-hidden="true" />Sync sub-accounts</>}</Button>
        <MoreMenu label="More HighLevel actions" items={[
          { label: busy === "test" ? "Testing connection" : "Test connection", icon: <ShieldCheck />, disabled: !!busy, onSelect: () => void run("test") },
          { label: "Replace token", icon: <KeyRound />, disabled: !!busy, onSelect: start },
          ...(conn.company_id ? [{ label: "Copy company ID", icon: <Copy />, onSelect: () => void copyCompany() }] : []),
          { label: "Disconnect HighLevel", icon: <Unplug />, danger: true, separated: true, disabled: !!busy, onSelect: () => setDisconnectOpen(true) },
        ]} />
      </StatusRow>
      {conn.last_error && <p role="alert" className="mt-4 flex items-start gap-2 text-sm text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />The latest sync needs attention: {conn.last_error}</p>}
      {Object.entries(conn.capabilities || {}).some(([, value]) => value !== true) && <p role="alert" className="mt-4 flex items-start gap-2 text-sm text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />Some read permissions are missing. Replace your token with all the required scopes.</p>}
      <Disclosure label="Connection details">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="min-w-0"><dt className="text-muted-foreground">Private integration token</dt><dd className="mt-1 break-all font-mono">{conn.token_prefix ? `${conn.token_prefix}••••••••••••` : "•••••••••••• (stored securely)"}</dd></div>
          <div className="min-w-0"><dt className="text-muted-foreground">Company ID</dt><dd className="mt-1 break-all font-mono">{conn.company_id || "Not available"}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">The token is encrypted. Only its first six characters are ever shown.</p>
      </Disclosure>
    </> : <>
      <StatusRow tone="off" label="Not connected" detail="Read-only access. Your private integration token stays encrypted.">
        <Button variant="accent" className="h-11 flex-1 sm:h-10 sm:flex-none" onClick={start}>Connect HighLevel<ArrowRight aria-hidden="true" /></Button>
      </StatusRow>
      <Disclosure label="What connecting unlocks">
        <ul className="space-y-4">{benefits.map(({ icon: Icon, title, text }) => <li key={title} className="flex items-start gap-3"><span className="px-icon-chip size-9 shrink-0" aria-hidden="true"><Icon className="size-[18px]" /></span><div className="min-w-0"><h3 className="text-sm font-semibold text-foreground">{title}</h3><p className="mt-0.5 text-sm text-muted-foreground">{text}</p></div></li>)}</ul>
      </Disclosure>
    </>}
    <Dialog open={open} onOpenChange={close}><DialogContent className="max-w-xl max-h-[90dvh] overflow-y-auto" onEscapeKeyDown={(e) => { if (step === "connecting") e.preventDefault(); }} onPointerDownOutside={(e) => e.preventDefault()}>
      <DialogHeader><DialogTitle>{step === "success" ? "Your HighLevel is connected" : step === "connecting" ? "Connecting your HighLevel account" : ["token-guide", "token"].includes(step) ? "Step 1 of 2 · Private integration token" : "Step 2 of 2 · Location ID"}</DialogTitle><DialogDescription>{step === "success" ? "Your agency is ready to use in SaaS Suite." : step === "connecting" ? "Verifying your account and finding your company ID." : "Connect once to use your agency’s sub-accounts across SaaS Suite."}</DialogDescription></DialogHeader>
      <div className="flex gap-2" aria-hidden="true"><span className="h-1 flex-1 rounded bg-primary" /><span className={`h-1 flex-1 rounded ${["token-guide", "token"].includes(step) ? "bg-muted" : "bg-primary"}`} /></div>
      {step === "token-guide" && <div className="space-y-6"><ol className="list-decimal pl-5 space-y-3 text-sm"><li>Log into HighLevel and switch to <b>Agency view</b>.</li><li>Open <b>Settings → Private Integrations</b>, then create a new integration.</li><li>Name it <b>SaaS Suite</b>, select these four read-only scopes, and create your token.</li></ol><ul className="divide-y rounded-lg border">{scopes.map(([name, scope]) => <li key={scope} className="flex items-start gap-3 p-3"><Check className="h-4 w-4 shrink-0 text-primary mt-1" /><div className="min-w-0"><p className="text-sm font-medium">{name}</p><code className="break-all text-xs text-muted-foreground">{scope}</code></div></li>)}</ul><p className="text-xs text-muted-foreground">HighLevel shows the token only once. Copy it before leaving that screen. No write permissions needed.</p><Button variant="accent" className="w-full min-h-11" onClick={() => setStep("token")}>I have my token<ArrowRight className="h-4 w-4 ml-2" /></Button></div>}
      {step === "token" && <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (token.trim().length < 20 || token.trim().length > 4000) { setFormError("Paste the full private integration token from HighLevel."); return; } setFormError(""); setStep("location-guide"); }}><Label htmlFor="ghl-token" className="block">Private integration token</Label><Input id="ghl-token" type="password" autoComplete="off" autoFocus value={token} onChange={(e) => setToken(e.target.value)} placeholder="pit-…" aria-invalid={!!formError} aria-describedby={formError ? "ghl-error" : undefined} /><p className="text-xs text-muted-foreground">Kept only in this dialog until your account is connected.</p>{formError && <p id="ghl-error" role="alert" className="text-sm text-destructive">{formError}</p>}<div className="flex justify-between gap-3"><Button type="button" variant="ghost" onClick={() => { setFormError(""); setStep("token-guide"); }}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button><Button variant="accent" type="submit">Save token and continue<ArrowRight className="h-4 w-4 ml-2" /></Button></div></form>}
      {step === "location-guide" && <div className="space-y-6"><div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted"><MapPin className="h-8 w-8 text-primary" /></div><ol className="list-decimal pl-5 space-y-3 text-sm"><li>Open any <b>sub-account</b> belonging to your HighLevel agency.</li><li>Look at the page address in your browser.</li><li>Copy the ID immediately after <code>/location/</code> and before the next slash.</li></ol><div className="rounded-lg bg-muted p-4 text-sm font-mono break-all">…/location/<span className="font-semibold text-primary">YOUR_LOCATION_ID</span>/dashboard</div><p className="text-sm text-muted-foreground">We use this one location to find your Company ID automatically.</p><div className="flex justify-between gap-3"><Button variant="ghost" onClick={() => setStep("token")}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button><Button variant="accent" onClick={() => setStep("location")}>I have my location ID<ArrowRight className="h-4 w-4 ml-2" /></Button></div></div>}
      {step === "location" && <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void connect(); }}><Label htmlFor="ghl-location" className="block">Sub-account location ID</Label><Input id="ghl-location" autoFocus value={locationId} onChange={(e) => setLocationId(e.target.value)} placeholder="Paste the location ID" className="font-mono" aria-invalid={!!formError} aria-describedby={formError ? "ghl-error" : undefined} />{formError && <p id="ghl-error" role="alert" className="text-sm text-destructive">{formError}</p>}<div className="flex justify-between gap-3"><Button type="button" variant="ghost" onClick={() => { setFormError(""); setStep("location-guide"); }}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button><Button variant="accent" type="submit">Connect HighLevel<Link2 className="h-4 w-4 ml-2" /></Button></div><Button type="button" variant="link" className="px-0 text-muted-foreground" onClick={() => { setFormError(""); setStep("token"); }}>Change my token</Button></form>}
      {step === "connecting" && <div className="flex min-h-48 flex-col items-center justify-center gap-4 text-center" role="status"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="font-medium">Securely connecting your agency</p><p className="text-sm text-muted-foreground">Checking permissions and loading your sub-accounts. This can take a moment.</p></div>}
      {step === "success" && <div className="space-y-6 py-4 text-center"><CheckCircle2 className="mx-auto h-16 w-16 text-primary" /><p className="text-xl font-semibold">{conn?.company_name || "You're all set"}</p><p className="text-sm text-muted-foreground">Company ID: <code className="break-all">{conn?.company_id}</code></p><Button variant="accent" className="w-full min-h-11" onClick={() => close(false)}>Done<Check className="h-4 w-4 ml-2" /></Button></div>}
    </DialogContent></Dialog>
    <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}><DialogContent><DialogHeader><DialogTitle>Disconnect HighLevel?</DialogTitle><DialogDescription>Existing menu rules stay in place. Sub-account lookups and connection-powered features stop until you reconnect.</DialogDescription></DialogHeader><div className="flex justify-end gap-3"><Button variant="outline" onClick={() => setDisconnectOpen(false)}>Keep connected</Button><Button variant="destructive" disabled={!!busy} onClick={() => void run("disconnect")}>{busy === "disconnect" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Disconnect HighLevel</Button></div></DialogContent></Dialog>
  </section>;
}
