import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Copy, Loader2, MessageCircle, RefreshCw, Workflow } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { ghl, WEBHOOK_URL, ASSIGN_WEBHOOK_URL } from "@/components/highlevel/ghlApi";
import { AI_FEATURE_SCOPES } from "@/components/highlevel/aiScopes";
import { SETTINGS_NAV_LINKS } from "@/components/highlevel/settingsNavLinks";
import { STANDARD_PRESET_NAME, standardPresetLinks, GUIDE_SCREENSHOTS, menuRemovalBodies, menuRemovalInstallCodes, resolveMenuRemovalLink, MENU_REMOVAL_STEPS, nextMenuRemovalStep } from "@/lib/menuRemovalGuide";
import SnapshotImportActions from "@/components/highlevel/SnapshotImportActions";

import { buildAiPermissionCode, buildBuyerResolverCode } from "@/lib/menuRemovalWorkflowCode";
import { useUser } from "@/contexts/UserContext";
import { CopilotCard } from "@/components/premium/copilot/CopilotBits";
import { cn } from "@/lib/utils";

const shots = import.meta.glob("@/assets/menu-removal-guide/*.asset.json", { eager: true, import: "default" }) as Record<string, { url: string }>;
export function screenshotUrl(key: string): string | null {
  const hit = Object.entries(shots).find(([p]) => p.endsWith(`/${key}.png.asset.json`));
  return hit ? hit[1].url : null;
}

export function GuideScreenshot({ k }: { k: string }) {
  const url = screenshotUrl(k);
  if (!url) return null;
  return (
    <figure className="px-surface mt-2 overflow-hidden border border-border/60">
      <a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={GUIDE_SCREENSHOTS[k] || "Setup screenshot"} loading="lazy" className="w-full max-h-96 object-contain bg-muted" /></a>
      {GUIDE_SCREENSHOTS[k] && <figcaption className="px-3 py-2 text-xs text-muted-foreground">{GUIDE_SCREENSHOTS[k]}</figcaption>}
    </figure>
  );
}

const copyText = async (t: string, label: string) => {
  try { await navigator.clipboard.writeText(t); toast.success(`${label} copied`); }
  catch { toast.error("Couldn't copy. Select the text and copy it manually."); }
};

function CopyCard({ title, value, displayValue, mono = true }: { title: string; value: string; displayValue?: string; mono?: boolean }) {
  return (
    <div className="space-y-2 rounded-md border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 text-sm font-medium">{title}</p>
        <Button size="sm" variant="outline" className="shrink-0" aria-label={`Copy ${title}`} onClick={() => copyText(value, title)}><Copy className="h-3.5 w-3.5" />Copy</Button>
      </div>
      <pre className={`max-h-48 overflow-auto rounded-sm bg-muted p-2 text-xs whitespace-pre-wrap break-all ${mono ? "font-mono" : ""}`}>{displayValue ?? value}</pre>
    </div>
  );
}

const clean = (v: unknown) => {
  const raw = typeof v === "string" ? v.trim() : "";
  const m = raw.match(/custom-menu-link\/([^/?#\s]+)/i);
  return m ? m[1] : raw;
};

export function MenuRemovalSetupCard({ agencyId, onHelp, onConnect, onUpgrade }: { agencyId: string | null; onHelp?: () => void; onConnect?: () => void; onUpgrade?: () => void }) {
  const { plan } = useUser();
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState("");
  const [auto, setAuto] = useState<any>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [presets, setPresets] = useState<string[]>([]);
  const [preset, setPreset] = useState("");
  const [menuId, setMenuId] = useState("");
  const [ai, setAi] = useState<string[]>(["ai_studio"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [freshToken, setFreshToken] = useState("");
  const [usersToken, setUsersToken] = useState("");
  const [step, setStep] = useState(0);
  const stepKey = `ss_menu_removal_step_${agencyId}`;
  const advance = (direction: number) => {
    const next = nextMenuRemovalStep(step, direction);
    setStep(next);
    try { sessionStorage.setItem(stepKey, String(next)); } catch { /* session storage optional */ }
  };
  const [menuOptions, setMenuOptions] = useState<Array<{ id: string; title: string }>>([]);

  const loadPresets = async () => {
    if (!agencyId) return [];
    const { data, error: presetError } = await supabase.from("menu_link_rules").select("preset_name").eq("agency_id", agencyId).not("preset_name", "is", null);
    if (presetError) throw new Error(presetError.message);
    const names = Array.from(new Set((data || []).map((r: any) => String(r.preset_name)).filter(Boolean)));
    setPresets(names); setPreset((p) => p || names[0] || "");
    return names;
  };

  const load = async () => {
    if (!agencyId) return;
    if (!/^(BASIC|ADVANCED|PREMIUM|ENHANCED)$/i.test(plan || "")) { setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const s: any = await ghl("status", agencyId);
      setCompanyId(s?.connection?.company_id || ""); setAuto(s?.automation);
      setConnected(!!s?.connection?.connected);
      await loadPresets();
      const { data: cfg, error: configError } = await supabase.from("agency_menu_config").select("menu_link_id").eq("agency_id", agencyId).maybeSingle();
      if (configError) throw new Error(configError.message);
      setMenuId(clean(cfg?.menu_link_id));
      if (s?.connection?.connected) {
        const result = await ghl<{ menus: Array<{ menu_id: string; title: string | null; url: string | null }> }>("menus", agencyId);
        setMenuOptions((result.menus || []).map(m => ({ id: m.menu_id, title: m.title || m.menu_id })));
        const saved = await ghl<{ menu_id: string | null }>("plan_menu", agencyId);
        setMenuId(resolveMenuRemovalLink(result.menus || [], saved.menu_id || cfg?.menu_link_id, agencyId));
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load workflow details"); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    setSecret(null); setFreshToken(""); setUsersToken(""); setMenuOptions([]);
    try {
      const saved = Number(sessionStorage.getItem(stepKey) || 0);
      setStep(Number.isInteger(saved) ? nextMenuRemovalStep(saved, 0) : 0);
    } catch { setStep(0); }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agencyId, plan]);

  if (!agencyId) return null;
  if (loading) return <CopilotCard icon={<Workflow />} title="Remove Menu Links" description="Loading your workflow details…"><div className="space-y-2" aria-hidden="true"><div className="px-skeleton h-4 w-2/3 rounded-sm" /><div className="px-skeleton h-16 w-full rounded-md" /></div></CopilotCard>;
  if (error) return <CopilotCard icon={<Workflow />} title="Remove Menu Links" description="We couldn't load your setup details."><div className="space-y-3" role="alert"><p className="text-sm text-destructive">{error}</p><div className="flex flex-wrap gap-2"><Button variant="accent" size="sm" onClick={() => void load()}><RefreshCw className="h-4 w-4" />Retry loading setup</Button><Button size="sm" variant="ghost" onClick={onHelp}>Text us</Button></div></div></CopilotCard>;
  if (!/^(BASIC|ADVANCED|PREMIUM|ENHANCED)$/i.test(plan || "")) return <CopilotCard icon={<Workflow />} title="Remove Menu Links" description="Menu link removal requires Basic ($27/month) or higher. You can continue your free Client Hub setup." actions={<Button size="sm" variant="accent" onClick={onUpgrade}>Review plans</Button>} />;

  const createSecret = async () => {
    if (auto?.has_secret && !confirm("Create a new secret? Workflows using your old secret will stop working until you paste the new one.")) return;
    setBusy(true);
    try { 
      const r: any = await ghl("rotate_secret", agencyId); 
      setSecret(r.secret); 
      setAuto((a: any) => ({ ...a, has_secret: true, secret_prefix: String(r.secret).slice(0, 8) }));
    }
    catch (e: any) { toast.error(e.message || "Couldn't create a secret"); } finally { setBusy(false); }
  };

  const createStandard = async () => {
    setBusy(true);
    try {
      const existing = await loadPresets();
      if (existing.includes(STANDARD_PRESET_NAME)) { setPreset(STANDARD_PRESET_NAME); return; }
      const { error } = await supabase.from("menu_link_rules").insert({ agency_id: agencyId, sub_account_id: null, preset_name: STANDARD_PRESET_NAME, hidden_links: standardPresetLinks(SETTINGS_NAV_LINKS.map(l => l.tabId)) as any, is_active: false } as any);
      if (error) throw new Error(error.message);
      await loadPresets(); setPreset(STANDARD_PRESET_NAME); toast.success("Standard preset created");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't create preset"); }
    finally { setBusy(false); }
  };
  const { preset: presetBody, assign: assignBody } = menuRemovalBodies(agencyId, preset || "YOURPRESETHERE", menuId || "YOURMENULINKIDHERE");
  const install = menuRemovalInstallCodes(agencyId);

  return (
    <CopilotCard icon={<Workflow />} title="Remove Menu Links" description={`Step ${step + 1} of ${MENU_REMOVAL_STEPS.length}`}>
      <div className="flex gap-1" role="progressbar" aria-label="Setup progress" aria-valuemin={1} aria-valuemax={MENU_REMOVAL_STEPS.length} aria-valuenow={step + 1}>
        {MENU_REMOVAL_STEPS.map((_, index) => <span key={index} className={cn("h-1 flex-1 rounded-full transition-colors", index <= step ? "bg-brand" : "bg-muted")} />)}
      </div>
      {step === 0 && <>
      <p className="font-medium">Install the snapshot and open “Remove Menu Links”</p>
      <SnapshotImportActions />
      <p className="text-xs text-muted-foreground">Accept and load the snapshot in HighLevel, then return to this chat. We’ll configure one step at a time here; editing and publishing the workflow still happens in HighLevel.</p>
      </>}
      {step === 1 && <>
        <p className="font-medium">Check the buyer and workflow trigger</p>
        <p>The buyer’s sub-account must already exist, and the contact email must match a user on that sub-account. Choose your purchase trigger and add a wait if needed so account creation finishes first.</p>
      </>}
      {step === 2 && <>
      <CopyCard title="Your agency ID" value={agencyId} />
      <CopyCard title="Agency White Label: Custom CSS" value={install.css} />
      <CopyCard title="Agency White Label: Custom JavaScript" value={install.js} />
      {!connected && <Button size="sm" variant="outline" onClick={onConnect}>Connect HighLevel in chat</Button>}
      {companyId ? <CopyCard title="Company ID (action #1)" value={companyId} /> : <p className="text-muted-foreground">Connect HighLevel to see your Company ID.</p>}
      <p className="text-xs text-muted-foreground">Create a fresh agency Private Integration token with View Locations, View Users and View Companies. Your saved connection token stays encrypted and cannot be shown.</p>
      <Input type="password" aria-label="Fresh HighLevel workflow token" autoComplete="off" placeholder="Fresh token for action #1 (local to this card)" value={freshToken} onChange={e => setFreshToken(e.target.value)} />
      <p className="text-xs text-muted-foreground">Map the Custom Code input “email” to the contact's email. Copy the code, test with a real buyer, then save. This fresh token is inserted locally into the code; it never goes into chat history.</p>
      <CopyCard title="Action #1: resolve buyer code" value={buildBuyerResolverCode(companyId, freshToken.trim())} displayValue={buildBuyerResolverCode(companyId, freshToken ? "[secure token included when copied]" : "")} />
      {freshToken && <Button size="sm" variant="ghost" onClick={() => setFreshToken("")}>Clear fresh token</Button>}
      <GuideScreenshot k="configurefirstcodeaction2" />
      </>}
      {step === 3 && <>
      <div className="space-y-2 rounded-md border border-border bg-card p-3">
        <p className="text-sm font-medium">SaaSSuite webhook secret (actions #2 and #3)</p>
        {secret ? <>
          <div className="flex gap-2"><Input readOnly value={secret} className="font-mono text-xs" /><Button size="icon" variant="outline" aria-label="Copy secret" onClick={() => copyText(secret, "Secret")}><Copy className="h-4 w-4" /></Button></div>
          <p className="text-xs text-destructive">Copy it now. It won't be shown again.</p>
        </> : (
          <p className="text-xs text-muted-foreground">
            {auto?.has_secret 
              ? `Your secret starts with ${auto.secret_prefix}… — use the one you already saved in HighLevel, or rotate to get a new one.` 
              : "Create your secret, then paste it into the X-SaaSSuite-Webhook-Secret header."}
          </p>
        )}
        <Button size="sm" variant="outline" disabled={busy} onClick={createSecret}>{auto?.has_secret ? "Rotate secret" : "Create secret"}</Button>
      </div>

      <div className="space-y-2 rounded-md border border-border bg-card p-3">
        <p className="text-sm font-medium">Preset</p>
        {presets.length ? <div className="flex flex-wrap gap-2">{presets.map((p) => <Button key={p} size="sm" variant={p === preset ? "secondary" : "outline"} aria-pressed={p === preset} className={p === preset ? "ring-1 ring-brand/40 text-brand" : undefined} onClick={() => setPreset(p)}>{p}</Button>)}</div>
          : <><p className="text-xs text-muted-foreground">No preset yet. The Standard preset hides everything except Media.</p>
            <Button size="sm" variant="outline" disabled={busy} onClick={createStandard}>Create Standard preset</Button></>}
      </div>
      <CopyCard title="Action #2 URL (POST)" value={WEBHOOK_URL} />
      <p className="text-xs text-muted-foreground">Actions #2 and #3: Content-Type: application/json. Header X-SaaSSuite-Webhook-Secret: paste the secret above.</p>
      <CopyCard title="Action #2 body (apply preset)" value={presetBody} />
      <GuideScreenshot k="modifylast3workflowactions1" />
      </>}
      {step === 4 && <>
      <p className="font-medium">Assign your Client Hub menu link</p>
      {menuId && <CopyCard title="Menu link ID" value={menuId} />}
      {menuOptions.length > 0 && <div className="space-y-2"><p className="font-medium">Menu link to assign</p><div className="flex flex-wrap gap-2">{menuOptions.map(m => <Button key={m.id} size="sm" variant={m.id === menuId ? "secondary" : "outline"} aria-pressed={m.id === menuId} className={m.id === menuId ? "ring-1 ring-brand/40 text-brand" : undefined} onClick={() => setMenuId(m.id)}>{m.title}</Button>)}</div></div>}
      <CopyCard title="Action #3 URL (POST)" value={ASSIGN_WEBHOOK_URL} />
      {!menuId && <p className="text-muted-foreground">Choose your installed menu link above, or refresh if it was just installed. We won’t guess if more than one matches.</p>}
      <p className="text-xs text-muted-foreground">Use the same X-SaaSSuite-Webhook-Secret from action #2 and Content-Type: application/json.</p>
      {menuId && <CopyCard title="Action #3 body (assign menu link)" value={assignBody} />}
      </>}
      {step === 5 && <>

      <div className="space-y-2 rounded-md border border-border bg-card p-3">
        <p className="text-sm font-medium">Action #4 AI features</p>
        <div className="grid gap-2 sm:grid-cols-2">{AI_FEATURE_SCOPES.map((f) => (
          <label key={f.key} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-sm border border-border p-2 transition-colors hover:bg-muted">
            <Checkbox checked={ai.includes(f.key)} onCheckedChange={(v) => setAi((c) => v ? [...c, f.key] : c.filter((k) => k !== f.key))} /><span>{f.label}</span>
          </label>))}</div>
      </div>
      <p className="text-xs text-muted-foreground">Replace the action #4 webhook with Custom Code and remove the webhook. HighLevel cannot merge inside a webhook, and PUT /users replaces every scope. Map the code input user_id to action #1's user_id. Paste a separate Private Integration token with only View Users and Edit Users into the field below. It is copied into the code on this page and is not sent to chat. AI Studio is selected by default and uses the v2 scopes. Existing permissions stay. The menu link does not need a scope on the buyer.</p>
      <p className="text-xs text-muted-foreground">HighLevel will not save this Custom Code action until its built-in Test passes. That Test runs the pasted code for real: the user_id is read and then updated with PUT. Run that Test with your own dummy or test user, never a real client user.</p>
      <Input type="password" aria-label="Fresh HighLevel users token" autoComplete="off" placeholder="Fresh View Users + Edit Users token (local to this card)" value={usersToken} onChange={e => setUsersToken(e.target.value)} />
      <CopyCard title="Action #4: grant AI access (custom code)" value={buildAiPermissionCode(companyId, usersToken.trim(), ai)} displayValue={buildAiPermissionCode(companyId, usersToken ? "[secure token included when copied]" : "", ai)} />
      {usersToken && <Button size="sm" variant="ghost" onClick={() => setUsersToken("")}>Clear users token</Button>}
      </>}
      {step === 6 && <>
      <GuideScreenshot k="howtotestatendofsetup" />
      <p className="text-xs text-muted-foreground">Use HighLevel's variable picker for action #1 outputs location_id and user_id if its reference differs. Save all actions, publish, run a real buyer through the trigger, then refresh their sub-account. Confirm the chosen links disappear, the right Hub link appears, and selected AI features open.</p>
      </>}
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button size="sm" variant="ghost" disabled={step === 0} onClick={() => advance(-1)}><ArrowLeft className="h-4 w-4" />Back</Button>
        {step < MENU_REMOVAL_STEPS.length - 1 && <Button size="sm" variant="accent" disabled={step === 4 && !menuId} onClick={() => advance(1)}>Done, next step<ArrowRight className="h-4 w-4" /></Button>}
        <span className="flex-1" />
        <Button size="sm" variant="ghost" onClick={() => void load()}><RefreshCw className="h-4 w-4" />Refresh details</Button>
        <Button size="sm" variant="ghost" onClick={onHelp}><MessageCircle className="h-4 w-4" />Text us</Button>
      </div>
    </CopilotCard>
  );
}
