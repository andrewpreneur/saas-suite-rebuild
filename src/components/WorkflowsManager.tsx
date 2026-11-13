import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Workflow,
  ArrowRight,
  Webhook,
  AlertTriangle,
  Save,
  Settings as SettingsIcon,
  Plus,
  Trash2,
  Send,
  Sparkles,
  Check,
  Copy,
  RefreshCw,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";
import { SectionCard } from "@/components/premium/SectionCard";
import { Reveal, RevealItem } from "@/components/premium/Reveal";
import { EmptyState } from "@/components/premium/21st/empty-state";
import { HubEmptyIcon } from "@/components/premium/hub/HubBits";
import { TextShimmer } from "@/components/premium/21st/text-shimmer";
import { CopyButton } from "@/components/premium/hub/CopyButton";
import { HubListSkeleton, OnOffSwitch } from "@/components/premium/hub/HubBits";
import { toast } from "sonner";
import { PageHeader } from "@/components/platform/PageHeader";
import { LoadNotice } from "@/components/platform/LoadNotice";
import { LOAD_TIMEOUT_MESSAGE, armLoadDeadline, loadErrorText } from "@/lib/loadSettle";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import slackLogoAsset from "@/assets/slack-logo.webp.asset.json";

const SLACK_LOGO = slackLogoAsset.url;
const SUPABASE_FUNCTIONS_BASE = "https://backend-disconnected.invalid/functions/v1";

type Plan = "plan1" | "plan2" | "plan3";

const TRIGGERS: { id: string; label: string; description: string }[] = [
  {
    id: "video_completed",
    label: "User completed video",
    description: "Fires whenever a user finishes any onboarding video.",
  },
  {
    id: "existing_user_login",
    label: "Existing user logged in",
    description: "Fires when a returning user logs into the hub.",
  },
  {
    id: "new_user_login",
    label: "New user logged in",
    description: "Fires the very first time a user logs into the hub.",
  },
  {
    id: "onboarding_checklist_completed",
    label: "Onboarding checklist completed",
    description: "Fires once the user finishes the onboarding checklist.",
  },
  {
    id: "ai_support_engaged",
    label: "Engaged with AI Support",
    description: "Fires when a user sends a message to the AI support chat.",
  },
  {
    id: "human_handover",
    label: "Requested Human Handover",
    description: "Fires when a user explicitly asks for a human.",
  },
];

interface AgencyVersions {
  primary_id: string | null;
  basic_id: string | null;
  advanced_id: string | null;
  elite_id: string | null;
}

interface WorkflowRow {
  trigger_type: string;
  webhook_url: string;
  enabled: boolean;
  slack_enabled?: boolean;
  isNew?: boolean;
}

interface SlackInstallRow {
  agency_id: string;
  inbound_webhook_token: string | null;
}

const WorkflowsManager = () => {
  const { email } = useUser();
  const navigate = useNavigate();
  const [versions, setVersions] = useState<AgencyVersions>({
    primary_id: null,
    basic_id: null,
    advanced_id: null,
    elite_id: null,
  });
  const [selectedPlan, setSelectedPlan] = useState<Plan>("plan1");
  const [loginWith, setLoginWith] = useState<string>("EMAIL");
  const [rows, setRows] = useState<Record<string, WorkflowRow>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [versionsLoaded, setVersionsLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [slackConnected, setSlackConnected] = useState(false);
  const [slackConnectedAgencyId, setSlackConnectedAgencyId] = useState<string | null>(null);
  const [inboundToken, setInboundToken] = useState<string | null>(null);
  const [rotatingToken, setRotatingToken] = useState(false);

  const currentAgencyId = useMemo(() => {
    if (selectedPlan === "plan1") return versions.basic_id;
    if (selectedPlan === "plan2") return versions.advanced_id;
    return versions.elite_id;
  }, [selectedPlan, versions]);

  const allAgencyIds = useMemo(
    () =>
      Array.from(
        new Set(
          [versions.primary_id, versions.basic_id, versions.advanced_id, versions.elite_id].filter(
            Boolean,
          ) as string[],
        ),
      ),
    [versions],
  );

  useEffect(() => {
    let alive = true;
    const stop = armLoadDeadline(() => {
      if (!alive) return;
      setVersionsLoaded(true);
      setLoadError(LOAD_TIMEOUT_MESSAGE);
    });
    if (!email) {
      stop();
      setVersionsLoaded(true);
      setLoadError(null);
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase
          .from("saas_suite_users")
          .select("agency_id_basic, agency_id_advanced, agency_id_elite, agency_id, login_with")
          .eq("email", email)
          .maybeSingle();
        if (error) throw error;
        if (data && alive) {
          setVersions({
            primary_id: data.agency_id || null,
            basic_id: data.agency_id_basic || data.agency_id || null,
            advanced_id: data.agency_id_advanced || null,
            elite_id: data.agency_id_elite || null,
          });
          setLoginWith(data.login_with || "EMAIL");
        }
        if (alive) setLoadError(null);
      } catch (error) {
        if (alive) setLoadError(loadErrorText(error, "Couldn't load workflows."));
      } finally {
        stop();
        if (alive) setVersionsLoaded(true);
      }
    })();
    return () => {
      alive = false;
      stop();
    };
  }, [email, loadAttempt]);

  useEffect(() => {
    if (!versionsLoaded) return;
    if (!currentAgencyId) {
      setRows({});
      setLoading(false);
      return;
    }
    let alive = true;
    const stop = armLoadDeadline(() => {
      if (!alive) return;
      setLoading(false);
      setLoadError(LOAD_TIMEOUT_MESSAGE);
    });
    setLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from("workflows")
          .select("trigger_type, webhook_url, enabled, slack_enabled")
          .eq("agency_id", currentAgencyId);
        if (error) throw error;
        const map: Record<string, WorkflowRow> = {};
        (data || []).forEach((r: any) => {
          map[r.trigger_type] = {
            trigger_type: r.trigger_type,
            webhook_url: r.webhook_url || "",
            enabled: r.enabled ?? true,
            slack_enabled: r.slack_enabled ?? false,
          };
        });
        if (alive) {
          setRows(map);
          setLoadError(null);
        }
      } catch (error) {
        if (alive) setLoadError(loadErrorText(error, "Couldn't load workflows."));
      } finally {
        stop();
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
      stop();
    };
  }, [currentAgencyId, versionsLoaded, loadAttempt]);

  useEffect(() => {
    if (allAgencyIds.length === 0) {
      setSlackConnected(false);
      setSlackConnectedAgencyId(null);
      setInboundToken(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("slack_channel_agency_map")
        .select("agency_id, inbound_webhook_token, installed_at, updated_at")
        .in("agency_id", allAgencyIds)
        .eq("is_active", true)
        .order("installed_at", { ascending: false, nullsFirst: false })
        .order("updated_at", { ascending: false, nullsFirst: false })
        .limit(1);
      const install = data?.[0] as SlackInstallRow | undefined;
      setSlackConnected(!!install);
      setSlackConnectedAgencyId(install?.agency_id ?? null);
      setInboundToken(install?.inbound_webhook_token ?? null);
    })();
  }, [allAgencyIds]);

  const inboundUrl = inboundToken
    ? `${SUPABASE_FUNCTIONS_BASE}/slack-inbound-webhook/${inboundToken}`
    : "";

  const copyInbound = async () => {
    if (!inboundUrl) return;
    try {
      await navigator.clipboard.writeText(inboundUrl);
      toast.success("Webhook URL copied");
    } catch {
      toast.error("Could not copy — select and copy manually");
    }
  };

  const rotateInbound = async () => {
    if (!slackConnectedAgencyId) return;
    if (!confirm("Regenerate the webhook URL? The old one will stop working immediately.")) return;
    setRotatingToken(true);
    try {
      // Generate a client-side token (48 hex chars)
      const bytes = new Uint8Array(24);
      crypto.getRandomValues(bytes);
      const newToken = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      const { error } = await supabase
        .from("slack_channel_agency_map")
        .update({ inbound_webhook_token: newToken })
        .eq("agency_id", slackConnectedAgencyId)
        .eq("is_active", true);
      if (error) throw error;
      setInboundToken(newToken);
      toast.success("New webhook URL generated");
    } catch (err: any) {
      toast.error(err.message || "Failed to regenerate");
    } finally {
      setRotatingToken(false);
    }
  };

  const updateRow = (id: string, patch: Partial<WorkflowRow>) => {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const addTrigger = (id: string) => {
    if (rows[id]) {
      toast.info("That trigger is already added");
      return;
    }
    setRows((prev) => ({
      ...prev,
      [id]: { trigger_type: id, webhook_url: "", enabled: true, slack_enabled: false, isNew: true },
    }));
    setTimeout(() => {
      setHighlightId(id);
      setRows((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], isNew: false } } : prev));
      const el = document.getElementById(`wf-input-${id}`);
      el?.focus();
      setTimeout(() => setHighlightId((cur) => (cur === id ? null : cur)), 1800);
    }, 450);
  };

  const removeTrigger = async (id: string) => {
    setRows((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (currentAgencyId) {
      await supabase
        .from("workflows")
        .delete()
        .eq("agency_id", currentAgencyId)
        .eq("trigger_type", id);
    }
  };

  const sendTest = async (id: string) => {
    const url = rows[id]?.webhook_url?.trim();
    if (!url) {
      toast.error("Add a webhook URL first");
      return;
    }
    setTestingId(id);
    try {
      const { data, error } = await supabase.functions.invoke("test-workflow-webhook", {
        body: {
          webhook_url: url,
          trigger_type: id,
          agency_id: currentAgencyId,
          owner_email: email,
        },
      });
      if (error) throw error;
      if (!data?.ok) {
        toast.error(
          `Webhook responded with ${data?.status ?? "error"}${data?.error ? `: ${data.error}` : ""}`,
        );
      } else {
        toast.success(`Test sent ✓ (${data.status}). Example payload delivered.`);
      }
      console.log("Test webhook payload sent:", data?.payload);
      console.log("Test webhook response:", data?.response);
    } catch (err: any) {
      toast.error(err.message || "Failed to send test");
    } finally {
      setTestingId(null);
    }
  };

  const save = async () => {
    if (!currentAgencyId) return;
    setSaving(true);
    try {
      const activeIds = Object.keys(rows);
      if (activeIds.length === 0) {
        await supabase.from("workflows").delete().eq("agency_id", currentAgencyId);
      } else {
        const payload = activeIds.map((id) => ({
          agency_id: currentAgencyId,
          trigger_type: id,
          webhook_url: rows[id]?.webhook_url?.trim() || null,
          enabled: rows[id]?.enabled ?? true,
          slack_enabled: rows[id]?.slack_enabled ?? false,
        }));
        const { error } = await supabase
          .from("workflows")
          .upsert(payload, { onConflict: "agency_id,trigger_type" });
        if (error) throw error;
        await supabase
          .from("workflows")
          .delete()
          .eq("agency_id", currentAgencyId)
          .not("trigger_type", "in", `(${activeIds.map((i) => `"${i}"`).join(",")})`);
      }
      toast.success("Workflows saved");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const goToLoginSettings = () => {
    navigate("/app/client-hub");
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("tipbot-navigate", {
          detail: { openPanel: "home-customize", selectTab: "login" },
        }),
      );
    }, 150);
  };

  const planLabel = (p: Plan) => (p === "plan1" ? "Plan 1" : p === "plan2" ? "Plan 2" : "Plan 3");
  const availablePlans: Plan[] = (["plan1", "plan2", "plan3"] as Plan[]).filter((p) => {
    if (p === "plan1") return !!versions.basic_id;
    if (p === "plan2") return !!versions.advanced_id;
    return !!versions.elite_id;
  });

  const loginOk = loginWith === "EMAIL" || loginWith === "BOTH";
  const activeTriggers = TRIGGERS.filter((t) => rows[t.id]);
  const availableTriggers = TRIGGERS.filter((t) => !rows[t.id]);

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        eyebrow="Client Hub"
        title="Workflows"
        subtitle="Tell your automations when a client does something in your hub. Each trigger posts that client's details to a webhook you choose."
      />

      <div className="px-surface flex min-w-0 flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-center">
        {availablePlans.length > 1 && (
          <Select value={selectedPlan} onValueChange={(v) => setSelectedPlan(v as Plan)}>
            <SelectTrigger className="h-11 w-full lg:w-[150px]" aria-label="Plan you are editing">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availablePlans.map((p) => (
                <SelectItem key={p} value={p}>
                  {planLabel(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {loginOk ? (
          <p className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" />
            <span>
              Ready. Clients sign in with <strong className="font-medium text-foreground">{loginWith === "BOTH" ? "email and name" : "email"}</strong>, so
              every trigger knows who they are.
            </span>
          </p>
        ) : (
          <div role="alert" className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
            <p className="flex min-w-0 flex-1 basis-64 items-start gap-2 text-sm text-foreground">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              <span>
                Triggers cannot tell clients apart yet. Switch client login to Email, or Email and Name. Current:{" "}
                <strong>{loginWith}</strong>.
              </span>
            </p>
            <Button size="sm" variant="outline" onClick={goToLoginSettings}>
              <SettingsIcon className="size-3.5" /> Open login settings
            </Button>
          </div>
        )}
      </div>

      {loadError && <LoadNotice error={loadError} onRetry={() => setLoadAttempt((attempt) => attempt + 1)} />}
      {!versionsLoaded || loading ? (
        <div className="px-surface p-4 sm:p-6">
          <div className="px-skeleton mb-4 h-5 w-40 rounded-sm" />
          <HubListSkeleton rows={3} />
        </div>
      ) : !currentAgencyId ? (
        <div className="px-surface">
          <EmptyState
            icon={<HubEmptyIcon><Workflow className="size-6" /></HubEmptyIcon>}
            title="Create your hub link first"
            description="Workflows fire from your hub. Set up the hub link in Hub Pages, then come back."
            action={
              <Button variant="accent" onClick={() => navigate("/app/client-hub")}>
                Open Hub Pages
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <Reveal className="space-y-4">
            <RevealItem>
              <SectionCard
                icon={<Workflow />}
                title="Your triggers"
                description="Each one sends a webhook the moment it happens."
                actions={
                  activeTriggers.length > 0 ? (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {activeTriggers.filter((t) => rows[t.id]?.enabled ?? true).length} of {activeTriggers.length} on
                    </span>
                  ) : null
                }
              >
                {activeTriggers.length === 0 ? (
                  <EmptyState
                    className="py-8"
                    icon={<HubEmptyIcon><Webhook className="size-6" /></HubEmptyIcon>}
                    title="No triggers yet"
                    description="Pick a trigger below, paste your webhook link, and send a test."
                  />
                ) : (
                  <div className="space-y-3">
                    {activeTriggers.map((t) => {
                      const row = rows[t.id];
                      const isHighlighted = highlightId === t.id;
                      const on = row?.enabled ?? true;
                      return (
                        <div
                          key={t.id}
                          className={`rounded-md border border-border p-4 transition-colors duration-200 ${on ? "bg-card" : "bg-muted/40"} ${row?.isNew ? "animate-scale-in" : ""}`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className={`min-w-0 flex-1 basis-56 ${on ? "" : "opacity-60"}`}>
                              <h3 className="text-sm font-semibold text-foreground">{t.label}</h3>
                              <p className="text-sm text-muted-foreground">{t.description}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <OnOffSwitch
                                checked={on}
                                onCheckedChange={(v) => updateRow(t.id, { enabled: v })}
                                label={`Turn ${t.label} on or off`}
                              />
                              <Button
                                size="icon"
                                aria-label="Delete"
                                variant="ghost"
                                className="text-muted-foreground hover:text-destructive"
                                onClick={() => removeTrigger(t.id)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="mt-3 space-y-1.5">
                            <Label htmlFor={`wf-input-${t.id}`}>Webhook link</Label>
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <Input
                                id={`wf-input-${t.id}`}
                                value={row?.webhook_url || ""}
                                onChange={(e) => updateRow(t.id, { webhook_url: e.target.value })}
                                placeholder="https://services.leadconnectorhq.com/hooks/..."
                                className={`font-mono text-xs transition-all ${isHighlighted ? "ring-2 ring-brand ring-offset-2 ring-offset-background" : ""}`}
                              />
                              <Button
                                variant="outline"
                                className="shrink-0"
                                onClick={() => sendTest(t.id)}
                                disabled={testingId === t.id || !row?.webhook_url?.trim()}
                              >
                                <Send className="size-4" />
                                {testingId === t.id ? "Sending…" : "Send test"}
                              </Button>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              aria-pressed={!!row?.slack_enabled}
                              onClick={() => {
                                if (!slackConnected) {
                                  toast.error("Connect Slack in Settings → Slack Integration first.");
                                  return;
                                }
                                updateRow(t.id, { slack_enabled: !row?.slack_enabled });
                              }}
                              className={`flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors duration-150 ${
                                row?.slack_enabled
                                  ? "border-brand/40 bg-brand-subtle text-brand"
                                  : "border-border bg-card text-muted-foreground hover:text-foreground"
                              } ${!slackConnected ? "opacity-60" : ""}`}
                              title={slackConnected ? "Also send this trigger to Slack" : "Slack not connected"}
                            >
                              <img src={SLACK_LOGO} alt="" className="size-4" />
                              {row?.slack_enabled ? "Also posts to Slack" : "Also post to Slack"}
                              {row?.slack_enabled && <Check className="size-3.5" />}
                            </button>
                            {!slackConnected && (
                              <span className="text-xs text-muted-foreground">
                                Connect Slack in Settings to use this.
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </SectionCard>
            </RevealItem>

            {availableTriggers.length > 0 && (
              <RevealItem>
                <SectionCard
                  icon={<Plus />}
                  title="Add a trigger"
                  description="Choose the moment that should fire your webhook."
                >
                  <div className="grid gap-2 md:grid-cols-2">
                    {availableTriggers.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => addTrigger(t.id)}
                        className="group flex min-h-[60px] items-center gap-3 rounded-md border border-border bg-card p-3 text-left transition-colors duration-150 hover:border-brand/40 hover:bg-brand-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-foreground">{t.label}</span>
                          <span className="block text-sm text-muted-foreground">{t.description}</span>
                        </span>
                        <Plus className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-brand" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </SectionCard>
              </RevealItem>
            )}

            <RevealItem>
              <details className="group px-surface">
                <summary className="flex cursor-pointer list-none items-center gap-3 p-4 sm:p-6 [&::-webkit-details-marker]:hidden">
                  <span className="px-icon-chip shrink-0" aria-hidden="true">
                    <img src={SLACK_LOGO} alt="" className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold text-foreground">Custom Slack messages</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      Advanced. Post anything to your Slack channel from a private webhook.
                    </span>
                  </span>
                  <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="space-y-3 border-t border-border p-4 sm:p-6">
                  {!slackConnected ? (
                    <p className="text-sm text-muted-foreground">
                      Connect Slack in <strong>Settings → Slack Integration</strong> to activate your
                      custom webhook URL.
                    </p>
                  ) : !inboundToken ? (
                    <TextShimmer className="text-sm">Generating your webhook URL…</TextShimmer>
                  ) : (
                    <>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                          value={inboundUrl}
                          readOnly
                          aria-label="Your private Slack webhook link"
                          className="font-mono text-xs"
                          onFocus={(e) => e.currentTarget.select()}
                        />
                        <div className="flex gap-2">
                          <CopyButton onCopy={copyInbound} showLabel />
                          <Button variant="outline" onClick={rotateInbound} disabled={rotatingToken}>
                            <RefreshCw className={`size-4 ${rotatingToken ? "animate-spin" : ""}`} />
                            {rotatingToken ? "…" : "Regenerate"}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
                        <p className="text-sm font-medium">POST a JSON body like this:</p>
                        <pre className="whitespace-pre-wrap break-all rounded-sm border border-border bg-background p-3 font-mono text-xs">
                          {`{
  "title": "Website form submission",
  "message": "Someone requested a demo.",
  "source": "landing-page",
  "fields": { "Name": "Jane Doe", "Email": "jane@acme.com" }
}`}
                        </pre>
                        <p className="text-xs text-muted-foreground">
                          All fields are optional. Include at least a <code>title</code>,{" "}
                          <code>message</code>, or <code>fields</code>. Any HighLevel workflow, Zapier
                          action, or custom code can hit this URL.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </details>
            </RevealItem>
          </Reveal>

          <div className="px-glass sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 shadow-raised">
            <p className="min-w-0 flex-1 basis-48 text-sm text-muted-foreground">
              Saves every trigger and webhook link for {planLabel(selectedPlan)}.
            </p>
            <Button variant="accent" onClick={save} disabled={saving || loading}>
              <Save className="size-4" />
              {saving ? "Saving…" : "Save workflows"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default WorkflowsManager;
