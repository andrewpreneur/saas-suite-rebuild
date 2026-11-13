import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Loader2, Download, Webhook, Link2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AI_FEATURE_SCOPES } from "./aiScopes";
import { buildAiPermissionCode } from "@/lib/menuRemovalWorkflowCode";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles } from "lucide-react";
import { ghl, WEBHOOK_URL, ASSIGN_WEBHOOK_URL } from "./ghlApi";

import SnapshotImportActions from "./SnapshotImportActions";
import { TextUsLink } from "@/components/TextUsLink";
const SUPPORT_MESSAGE = "I'm trying to hide menu links and I'm stuck... this is what's happening...";

function TextSupport() {
  return <TextUsLink message={SUPPORT_MESSAGE} variant="ghost" size="sm" className="gap-2">Text us</TextUsLink>;
}

interface Props { agencyId: string | null; presetName?: string; presets?: string[] }
type PlanLink = { key: string; label: string; menuId: string; planAgencyId: string };

const clean = (v: unknown) => {
  const raw = typeof v === "string" ? v.trim() : "";
  const m = raw.match(/custom-menu-link\/([^/?#\s]+)/i);
  return m ? m[1] : raw;
};

function CopyField({ label, value, onCopy }: { label: string; value: string; onCopy: (t: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2"><Input readOnly value={value} className="font-mono text-xs" /><Button size="icon" variant="outline" aria-label={`Copy ${label}`} onClick={() => onCopy(value)}><Copy className="w-4 h-4" /></Button></div>
    </div>
  );
}

function Payload({ body, onCopy }: { body: string; onCopy: (t: string) => void }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between"><Label className="text-xs">Request body</Label>
        <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => onCopy(body)}><Copy className="w-3.5 h-3.5" />Copy</Button></div>
      <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">{body}</pre>
    </div>
  );
}

export default function MenuAutomationPanel({ agencyId, presetName, presets = [] }: Props) {
  const [conn, setConn] = useState<any>(null);
  const [auto, setAuto] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [preset, setPreset] = useState(presetName || presets[0] || "");
  const [planLinks, setPlanLinks] = useState<PlanLink[]>([]);
  const [planKey, setPlanKey] = useState("");
  const [action, setAction] = useState<"add" | "remove">("add");
  const [aiFeatures, setAiFeatures] = useState<string[]>(["ai_studio"]);
  const [usersToken, setUsersToken] = useState("");

  const load = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true); setError("");
    try {
      const s = await ghl("status", agencyId);
      setConn(s.connection); setAuto(s.automation);
      // Saved menu link IDs for each of the owner's plans.
      const { data: owner } = await supabase.from("saas_suite_users")
        .select("agency_id, agency_id_basic, agency_id_advanced")
        .or(`agency_id.eq.${agencyId},agency_id_basic.eq.${agencyId},agency_id_advanced.eq.${agencyId}`).maybeSingle();
      const o: any = owner;
      const plans = o ? [o.agency_id_basic || o.agency_id, o.agency_id_advanced].filter(Boolean) : [agencyId];
      const ids = Array.from(new Set([agencyId, ...plans])) as string[];
      const { data: cfg } = await supabase.from("agency_menu_config").select("agency_id, menu_link_id, menu_link_id_2").in("agency_id", ids);
      const out: PlanLink[] = [];
      ids.forEach((pid, i) => {
        const row: any = (cfg || []).find((r: any) => r.agency_id === pid);
        if (!row) return;
        const label = `Plan ${i + 1} (${pid})`;
        [row.menu_link_id, row.menu_link_id_2].map(clean).forEach((m, j) => {
          if (m && !out.some((x) => x.menuId === m)) out.push({ key: `${pid}:${j}`, label: j ? `${label} — 2nd link` : label, menuId: m, planAgencyId: pid });
        });
      });
      setPlanLinks(out);
      setPlanKey((k) => k || out[0]?.key || "");
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }, [agencyId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (presetName) setPreset(presetName); }, [presetName]);

  const selected = useMemo(() => planLinks.find((p) => p.key === planKey), [planLinks, planKey]);
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); toast.success("Copied"); } catch { toast.error("Could not copy. Select the text and copy it manually."); } };

  if (!agencyId) return <p className="text-sm text-muted-foreground">Set your agency name first.</p>;
  if (loading) return <div role="status" className="flex min-h-48 items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading automation…</div>;
  if (error) return <div role="alert" className="space-y-3"><p className="text-sm text-destructive">{error}</p><Button variant="outline" onClick={() => void load()}>Retry loading automation</Button></div>;

  const removeBody = `{
  "location_id": "{{custom_code.1.output.location_id}}",
  "email": "{{contact.email}}",
  "preset_name": "${preset || "[YOUR PRESET HERE]"}",
  "agency_id": "${agencyId}"
}`;
  const assignBody = `{
  "action": "${action}",
  "agency_id": "${selected?.planAgencyId || agencyId}",
  "menu_link_id": "${selected?.menuId || "[YOUR MENU LINK ID]"}",
  "location_id": "{{custom_code.1.output.location_id}}"
}`;

  const removalStep = 4;
  const aiStep = 5;
  const assignStep = 6;
  const aiCode = buildAiPermissionCode(conn?.company_id || "", usersToken.trim(), aiFeatures);
  const aiCodeDisplay = buildAiPermissionCode(conn?.company_id || "", usersToken ? "[secure token included when copied]" : "", aiFeatures);

  const secretBlock = (
    <div className="space-y-1.5">
      <Label className="text-xs">Header: X-SaaSSuite-Webhook-Secret</Label>
      {newSecret ? (
        <div className="rounded-md border border-primary p-2 space-y-1">
          <div className="flex gap-2"><Input readOnly value={newSecret} className="font-mono text-xs" /><Button size="icon" variant="outline" aria-label="Copy secret" onClick={() => copy(newSecret)}><Copy className="w-4 h-4" /></Button></div>
          <p className="text-xs text-destructive">Copy it now — it won't be shown again.</p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{auto?.has_secret ? `Your secret starts with ${auto.secret_prefix}… — use the one you already saved in HighLevel, or rotate to get a new one.` : "No secret yet — create one and paste it into your workflow header."}</p>
      )}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={async () => {
          if (auto?.has_secret && !confirm("Rotate? Workflows using the old secret will stop working.")) return;
          setBusy(true);
          try { const r = await ghl("rotate_secret", agencyId); setNewSecret(r.secret); setAuto((a: any) => ({ ...a, has_secret: true, secret_prefix: String(r.secret).slice(0, 8) })); toast.success("New secret created"); }
          catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
        }}>{auto?.has_secret ? "Rotate secret" : "Create secret"}</Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 min-w-0">
      <Card data-tip-target="menu-automation-snapshot">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Download className="w-4 h-4 text-primary" />1. Install the standard snapshot</CardTitle>
          <CardDescription>Install the snapshot and load it into your main agency account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SnapshotImportActions />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TextSupport />
          </div>
        </CardContent>
      </Card>

      <Card data-tip-target="menu-automation-workflow">
        <CardHeader>
          <CardTitle className="text-base">2. Open the Menu Link Removal workflow</CardTitle>
          <CardDescription>Go to Automations and open the “Menu Link Removal” workflow.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-end gap-2">
          <TextSupport />
        </CardContent>
      </Card>

      <Card data-tip-target="menu-automation-secret">
        <CardHeader>
          <CardTitle className="text-base">3. Create your webhook secret</CardTitle>
          <CardDescription>This secret proves the workflow request really came from your HighLevel account, so nobody else can trigger menu link changes for your customers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-xs text-muted-foreground">Click below to generate your secret, copy it, and paste it into the <b>X-SaaSSuite-Webhook-Secret</b> header of the Webhook action in your workflow. New secrets are shown once — save yours somewhere safe. If you already have one, use the secret saved in your workflow.</p>
          {secretBlock}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TextSupport />
          </div>
        </CardContent>
      </Card>

      <Card data-tip-target="menu-automation-removal">
        <CardHeader>
          <CardTitle className="flex items-start gap-2 text-base"><Webhook className="w-4 h-4 text-primary shrink-0 mt-1" />{removalStep}. Configure, Copy, And Paste The Body Into The Webhook Action in Your Workflow</CardTitle>
          <CardDescription>Applies one of your presets to the buyer's sub-account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div id="removal-how-it-works" className="space-y-4 border-l-2 border-border pl-4">
            <p className="text-xs text-muted-foreground">The workflow sends the buyer's sub-account and selected preset to SaaS Suite, which applies your hidden menu links. HighLevel may bill Custom Webhook actions as premium actions.</p>
            <CopyField label="Webhook URL (POST)" value={WEBHOOK_URL} onCopy={copy} />
            {secretBlock}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Preset</Label>
            {presets.length ? (
              <Select value={preset} onValueChange={setPreset}>
                <SelectTrigger><SelectValue placeholder="Choose a preset" /></SelectTrigger>
                <SelectContent>{presets.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            ) : <p className="text-xs text-muted-foreground">{preset || "Save a named preset in Menu Link Removal first, then pick it here."}</p>}
          </div>
          <Payload body={removeBody} onCopy={copy} />
          <p className="text-xs text-muted-foreground">Pick <b>email</b> and <b>location_id</b> from HighLevel's variable picker — use the buyer's login email.</p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TextSupport />
          </div>
        </CardContent>
      </Card>

      <Card data-tip-target="menu-automation-ai">
        <CardHeader>
          <CardTitle className="flex items-start gap-2 text-base"><Sparkles className="w-4 h-4 text-primary shrink-0 mt-1" />{aiStep}. For Selling Standalone AI Features ONLY (AI Studio, Voice AI, etc.)</CardTitle>
          <CardDescription>Skip this if you aren't selling a single AI feature on its own.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <ol className="list-decimal pl-5 space-y-1 text-sm">
            <li>Create a Private Integration token with only <b>View Users</b> and <b>Edit Users</b></li>
            <li>Replace the last user-permission webhook with a <b>Custom Code</b> action. Remove the webhook so it cannot run as well</li>
            <li>Add an input property named <b>user_id</b> and map it to the action #1 output <b>user_id</b></li>
            <li>Paste the code below. HighLevel will not save this Custom Code action until its built-in Test passes, and that Test runs the code for real: the user is read and then updated. Run that Test with your own dummy or test user, never a real client user. Then save and publish</li>
          </ol>
          <div id="ai-how-it-works" className="space-y-4 border-l-2 border-border pl-4">
            <p className="text-xs text-muted-foreground">HighLevel's webhook cannot merge a GET into a PUT, and PUT /users replaces the buyer's entire scope list. This code reads their current scopes and permission flags, adds only the AI features you pick (AI Studio uses the v2 scopes), and writes the combined list back. Existing access such as AI Agents, Gift Cards, Loyalty, and WhatsApp stays. Agency permissions are not added. The menu link itself does not need a scope on the buyer.</p>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="ai-users-token">Fresh View Users + Edit Users token</Label>
              <Input id="ai-users-token" type="password" autoComplete="off" placeholder="Stays in this browser until you copy the code" value={usersToken} onChange={(e) => setUsersToken(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">What AI features do you want users on this preset to have access to?</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {AI_FEATURE_SCOPES.map((f) => (
                <label key={f.key} className="flex items-center gap-2 rounded-md border p-2 cursor-pointer">
                  <Checkbox checked={aiFeatures.includes(f.key)} onCheckedChange={(v) => setAiFeatures((cur) => v ? [...cur, f.key] : cur.filter((k) => k !== f.key))} />
                  <span>{f.label}</span>
                </label>
              ))}
            </div>
          </div>
          <Payload body={aiCodeDisplay} onCopy={() => copy(aiCode)} />
          {usersToken && <Button size="sm" variant="ghost" onClick={() => setUsersToken("")}>Clear users token</Button>}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TextSupport />
          </div>
        </CardContent>
      </Card>

      <Card data-tip-target="menu-automation-assignment">
        <CardHeader>
          <CardTitle className="flex items-start gap-2 text-base"><Link2 className="w-4 h-4 text-primary shrink-0 mt-1" />{assignStep}. Optional: Configure, copy, and paste into your menu link adding workflow</CardTitle>
          <CardDescription>Open your menu link adding workflow, then configure and paste the body into its Webhook action.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {!conn?.connected && <p className="text-sm text-muted-foreground">Connect HighLevel in Settings before using this option.</p>}
          <>
            <div id="assignment-how-it-works" className="space-y-4 border-l-2 border-border pl-4">
              <p className="text-xs text-muted-foreground">This action adds or removes the selected onboarding menu link for just the buyer's sub-account. Use the same secret saved in your removal workflow.</p>
              <CopyField label="Webhook URL (POST)" value={ASSIGN_WEBHOOK_URL} onCopy={copy} />
              {secretBlock}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Plan / menu link</Label>
                {planLinks.length ? (
                  <Select value={planKey} onValueChange={setPlanKey}>
                    <SelectTrigger><SelectValue placeholder="Choose a plan" /></SelectTrigger>
                    <SelectContent>{planLinks.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}</SelectContent>
                  </Select>
                ) : <p className="text-xs text-muted-foreground">No menu link saved yet — add one in your installation settings.</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Action</Label>
                <Select value={action} onValueChange={(v) => setAction(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="add">Add to sub-account</SelectItem><SelectItem value="remove">Remove from sub-account</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <Payload body={assignBody} onCopy={copy} />
            <p className="text-xs text-muted-foreground">Pick <b>location_id</b> from HighLevel's variable picker.</p>
          </>
          <div className="flex justify-end"><TextSupport /></div>
        </CardContent>
      </Card>
      <section data-tip-target="menu-automation-test" className="space-y-2 border-t border-border pt-6">
        <h3 className="font-semibold">7. Publish and test</h3>
        <p className="text-sm text-muted-foreground">Save and publish your workflows. Send a test with a real buyer sub-account ID and a fresh event ID if supplied, then refresh that sub-account in HighLevel. Confirm the selected links disappear, the correct onboarding link is assigned, and the selected AI feature opens. Also confirm AI Agents, Gift Cards, Loyalty, WhatsApp, and the buyer's other permissions are still there. Your SaaSSuite Custom CSS and JavaScript must be installed for hidden links to take effect.</p>
        <TextSupport />
      </section>
    </div>
  );
}
