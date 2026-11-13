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
} from "lucide-react";
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
    <div className="space-y-6">
      <PageHeader
        title="Workflows"
        subtitle="Send a webhook to your automation whenever a user does something in your hub."
      />

      {loginOk ? (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Check className="w-3 h-3 text-primary" /> Login method <strong>{loginWith}</strong>{" "}
          identifies users, so triggers will work.
        </p>
      ) : (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertTitle>Switch your login method</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              Triggers need Email or Email + Name login to identify users. Current:{" "}
              <strong>{loginWith}</strong>.
            </p>
            <Button size="sm" variant="outline" onClick={goToLoginSettings}>
              <SettingsIcon className="w-3 h-3 mr-1" /> Open login settings
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {availablePlans.length > 1 && (
        <div className="flex items-center gap-2">
          <Label className="text-sm">Editing:</Label>
          <Select value={selectedPlan} onValueChange={(v) => setSelectedPlan(v as Plan)}>
            <SelectTrigger className="w-40">
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
        </div>
      )}

      {loadError && <LoadNotice error={loadError} onRetry={() => setLoadAttempt((attempt) => attempt + 1)} />}
      {!versionsLoaded || loading ? (
        <LoadNotice loading label="Loading workflows…" />
      ) : !currentAgencyId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Create an agency URL first in Client Hub to configure workflows.
          </CardContent>
        </Card>
      ) : (
        <>
          {activeTriggers.length === 0 && (
            <p className="text-sm text-muted-foreground">
              These are the triggers you can turn on. Pick one to send that user's details to your
              webhook.
            </p>
          )}

          <div className="grid gap-4">
            {activeTriggers.map((t) => {
              const row = rows[t.id];
              const isHighlighted = highlightId === t.id;
              return (
                <Card
                  key={t.id}
                  className={`${row?.enabled ? "" : "opacity-60"} transition-all duration-300 ${row?.isNew ? "animate-scale-in" : "animate-fade-in"}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <CardTitle className="text-base">{t.label}</CardTitle>
                        <CardDescription>{t.description}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={row?.enabled ?? true}
                          onCheckedChange={(v) => updateRow(t.id, { enabled: v })}
                        />
                        <Button
                          size="icon"
                          aria-label="Delete"
                          variant="ghost"
                          onClick={() => removeTrigger(t.id)}
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col sm:flex-row items-stretch gap-2 rounded-lg border bg-muted/30 p-3">
                      <div className="flex flex-col items-center justify-center px-3 py-2 rounded-md bg-primary/10 border border-primary/20 min-w-[140px]">
                        <Workflow className="w-4 h-4 text-primary mb-1" />
                        <span className="text-xs font-medium text-center">Trigger</span>
                        <span className="text-[10px] text-muted-foreground text-center mt-0.5 line-clamp-2">
                          {t.label}
                        </span>
                      </div>
                      <div className="hidden sm:flex items-center text-muted-foreground">
                        <ArrowRight className="w-5 h-5" />
                      </div>
                      <div className="flex-1 flex flex-col gap-1">
                        <Label className="text-xs flex items-center gap-1">
                          <Webhook className="w-3 h-3" /> Inbound webhook URL
                        </Label>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Input
                            id={`wf-input-${t.id}`}
                            value={row?.webhook_url || ""}
                            onChange={(e) => updateRow(t.id, { webhook_url: e.target.value })}
                            placeholder="https://services.leadconnectorhq.com/hooks/..."
                            className={`font-mono text-xs transition-all ${isHighlighted ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => sendTest(t.id)}
                            disabled={testingId === t.id || !row?.webhook_url?.trim()}
                          >
                            <Send className="w-3 h-3 mr-1" />
                            {testingId === t.id ? "Sending…" : "Send test"}
                          </Button>
                        </div>
                        <div className="flex items-center gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (!slackConnected) {
                                toast.error("Connect Slack in Settings → Slack Integration first.");
                                return;
                              }
                              updateRow(t.id, { slack_enabled: !row?.slack_enabled });
                            }}
                            className={`relative flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-all ${
                              row?.slack_enabled
                                ? "border-green-500/60 bg-green-500/10 text-green-700 dark:text-green-400"
                                : "border-border bg-background hover:bg-accent"
                            } ${!slackConnected ? "opacity-60" : ""}`}
                            title={
                              slackConnected
                                ? "Also send this trigger to Slack"
                                : "Slack not connected"
                            }
                          >
                            <img src={SLACK_LOGO} alt="" className="h-4 w-4" />
                            Send to Slack
                            {row?.slack_enabled && (
                              <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                            )}
                          </button>
                          {!slackConnected && (
                            <span className="text-[10px] text-muted-foreground">
                              Connect Slack in Settings to enable
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {availableTriggers.length > 0 && (
            <Card className="animate-fade-in border-primary/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Pick a trigger</CardTitle>
                <CardDescription>Choose what should fire your webhook.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 md:grid-cols-2">
                {availableTriggers.length === 0 && (
                  <p className="text-sm text-muted-foreground col-span-2">
                    All triggers are already added.
                  </p>
                )}
                {availableTriggers.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => addTrigger(t.id)}
                    className="text-left p-3 rounded-lg border bg-card hover:bg-accent hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Workflow className="w-4 h-4 text-primary" />
                      <span className="font-medium text-sm">{t.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving || loading}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving…" : "Save Workflows"}
            </Button>
          </div>

          <details className="group rounded-lg border">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium">
              <img src={SLACK_LOGO} alt="" className="h-4 w-4" />
              Custom Slack messages (advanced)
              <span className="ml-auto text-xs text-muted-foreground group-open:hidden">Show</span>
              <span className="ml-auto text-xs text-muted-foreground hidden group-open:inline">
                Hide
              </span>
            </summary>
            <Card className="border-0 shadow-none">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <img src={SLACK_LOGO} alt="" className="h-6 w-6 mt-0.5" />
                    <div>
                      <CardTitle className="text-base">SaaSSuite Custom Slack Messages</CardTitle>
                      <CardDescription>
                        A private inbound webhook URL. Anything you POST here is delivered to your
                        Slack channel as a custom message.
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {!slackConnected ? (
                  <p className="text-sm text-muted-foreground">
                    Connect Slack in <strong>Settings → Slack Integration</strong> to activate your
                    custom webhook URL.
                  </p>
                ) : !inboundToken ? (
                  <p className="text-sm text-muted-foreground">Generating your webhook URL…</p>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <Input
                        value={inboundUrl}
                        readOnly
                        className="font-mono text-xs"
                        onFocus={(e) => e.currentTarget.select()}
                      />
                      <Button size="sm" variant="outline" onClick={copyInbound}>
                        <Copy className="w-3 h-3 mr-1" /> Copy
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={rotateInbound}
                        disabled={rotatingToken}
                      >
                        <RefreshCw
                          className={`w-3 h-3 mr-1 ${rotatingToken ? "animate-spin" : ""}`}
                        />
                        {rotatingToken ? "…" : "Regenerate"}
                      </Button>
                    </div>
                    <div className="rounded-md border bg-muted/40 p-3 space-y-2">
                      <p className="text-xs font-medium">POST a JSON body like this:</p>
                      <pre className="text-[11px] font-mono whitespace-pre-wrap break-all bg-background rounded p-2 border">
                        {`{
  "title": "Website form submission",
  "message": "Someone requested a demo.",
  "source": "landing-page",
  "fields": { "Name": "Jane Doe", "Email": "jane@acme.com" }
}`}
                      </pre>
                      <p className="text-[11px] text-muted-foreground">
                        All fields are optional — include at least a <code>title</code>,{" "}
                        <code>message</code>, or <code>fields</code>. Any HighLevel workflow, Zapier
                        action, or custom code can hit this URL.
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </details>
        </>
      )}
    </div>
  );
};

export default WorkflowsManager;
