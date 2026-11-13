import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Copy, RefreshCw, Plug, Activity } from "lucide-react";
import { toast } from "sonner";

const INGEST_BASE = "https://backend-disconnected.invalid/functions/v1/external-platform-ingest";

interface Connection {
  id: string;
  agency_id: string;
  platform_name: string;
  token: string;
  enabled: boolean;
  slack_notify: boolean;
  event_count: number;
  last_event_at: string | null;
}

interface EventRow {
  id: string;
  user_email: string | null;
  user_name: string | null;
  event_type: string;
  created_at: string;
}

const ExternalPlatformPanel = () => {
  const { effectiveEmail } = useUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [platformName, setPlatformName] = useState("");
  const [events, setEvents] = useState<EventRow[]>([]);

  const load = useCallback(async () => {
    if (!effectiveEmail) return;
    setLoading(true);
    const { data: conn } = await supabase
      .from("external_platform_connections")
      .select("*")
      .ilike("owner_email", effectiveEmail)
      .order("created_at", { ascending: true })
      .maybeSingle();

    if (conn) {
      setConnection(conn as Connection);
      setPlatformName((conn as Connection).platform_name);
      const { data: ev } = await supabase
        .from("external_platform_events")
        .select("id, user_email, user_name, event_type, created_at")
        .eq("connection_id", (conn as Connection).id)
        .order("created_at", { ascending: false })
        .limit(25);
      setEvents((ev as EventRow[]) || []);
    }
    setLoading(false);
  }, [effectiveEmail]);

  useEffect(() => {
    void load();
  }, [load]);

  const createConnection = async () => {
    if (!effectiveEmail) return;
    setSaving(true);
    const { data: userRow } = await supabase
      .from("saas_suite_users")
      .select("agency_id, agency_id_basic, agency_id_advanced")
      .ilike("email", effectiveEmail)
      .maybeSingle();

    const agencyId =
      (userRow as any)?.agency_id_advanced ||
      (userRow as any)?.agency_id ||
      (userRow as any)?.agency_id_basic;

    if (!agencyId) {
      toast.error("Finish your SaaSSuite setup first — no agency ID found.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("external_platform_connections").insert({
      owner_email: effectiveEmail,
      agency_id: agencyId,
      platform_name: platformName.trim() || "External Platform",
    });
    setSaving(false);
    if (error) {
      toast.error("Could not create the connection");
      return;
    }
    toast.success("Connection created");
    void load();
  };

  const update = async (patch: Partial<Connection>) => {
    if (!connection) return;
    setConnection({ ...connection, ...patch } as Connection);
    const { error } = await supabase
      .from("external_platform_connections")
      .update(patch)
      .eq("id", connection.id);
    if (error) toast.error("Could not save");
  };

  const rotateToken = async () => {
    if (!connection) return;
    const newToken = crypto.randomUUID().replace(/-/g, "");
    const { error } = await supabase
      .from("external_platform_connections")
      .update({ token: newToken })
      .eq("id", connection.id);
    if (error) {
      toast.error("Could not rotate the key");
      return;
    }
    setConnection({ ...connection, token: newToken });
    toast.success("New key generated — reinstall your script");
  };

  const endpoint = connection ? `${INGEST_BASE}?token=${connection.token}` : "";

  const headerScript = useMemo(
    () => `<!-- SaaSSuite Monitoring -->
<script>
(function () {
  var ENDPOINT = "${endpoint}";
  // 1. Tell SaaSSuite who is logged in.
  //    Replace these with your platform's real values (or set window.SaaSSuiteUser before this script).
  var u = window.SaaSSuiteUser || {
    email: "",   // e.g. "{{ user.email }}"
    name: "",    // e.g. "{{ user.full_name }}"
    user_id: ""  // e.g. "{{ user.id }}"
  };
  if (!u.email && !u.user_id) return;

  // 2. Only report once per session so logins are not double counted.
  try {
    if (sessionStorage.getItem("saassuite_reported") === "1") return;
    sessionStorage.setItem("saassuite_reported", "1");
  } catch (e) {}

  fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: "user_login",
      email: u.email,
      name: u.name,
      user_id: u.user_id,
      platform: "${platformName || "External Platform"}",
      page: window.location.href
    }),
    keepalive: true
  }).catch(function () {});
})();
</script>`,
    [endpoint, platformName],
  );

  const agentPrompt = useMemo(
    () => `Install SaaSSuite login monitoring on this platform.

Goal: every time a signed-in user loads a page, send that user's identity to SaaSSuite once per session so their login activity appears in the SaaSSuite dashboard and Slack.

Endpoint (POST, JSON, no auth header needed):
${endpoint}

JSON body:
{
  "event": "user_login",
  "email": "<signed-in user's email>",
  "name": "<signed-in user's full name>",
  "user_id": "<your platform's internal user id>",
  "platform": "${platformName || "External Platform"}",
  "page": "<current page URL>"
}

Requirements:
1. Fire on page load (or right after login) for authenticated users only — never for anonymous visitors.
2. Populate email/name/user_id from the real logged-in session data available in this platform.
3. Send at most one request per browser session (use sessionStorage as a guard).
4. Use fetch with keepalive and swallow all errors so the request can never break the page.
5. Place it in the global header/layout so it runs on every page.

If a raw <script> tag is the easiest install method for this platform, use exactly this snippet and only replace the placeholder user values:

${headerScript}`,
    [endpoint, platformName, headerScript],
  );

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Failed to copy");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!connection) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="w-5 h-5" />
            Connect External Platform
          </CardTitle>
          <CardDescription>
            Track logins from any software — not just HighLevel. Drop one script (or hand an AI
            agent a prompt) into your platform and every login flows into your SaaSSuite dashboard
            and Slack alerts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Platform name</Label>
            <Input
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
              placeholder="e.g., Vendasta, Webflow, my custom app"
            />
          </div>
          <Button onClick={createConnection} disabled={saving} className="w-full">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plug className="w-4 h-4 mr-2" />}
            Create connection
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Plug className="w-5 h-5" />
                Connect External Platform
              </CardTitle>
              <CardDescription>
                Install once — logins from your platform merge into your user dashboards and ping
                Slack.
              </CardDescription>
            </div>
            <Badge variant={connection.enabled ? "default" : "secondary"}>
              {connection.enabled ? "Active" : "Paused"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Platform name</Label>
            <Input
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
              onBlur={() => update({ platform_name: platformName.trim() || "External Platform" })}
            />
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
            <div>
              <Label>Monitoring enabled</Label>
              <p className="text-sm text-muted-foreground">Accept incoming login events</p>
            </div>
            <Switch checked={connection.enabled} onCheckedChange={(v) => update({ enabled: v })} />
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
            <div>
              <Label>Ping Slack on login</Label>
              <p className="text-sm text-muted-foreground">
                Send a Slack alert when someone logs into this platform
              </p>
            </div>
            <Switch
              checked={connection.slack_notify}
              onCheckedChange={(v) => update({ slack_notify: v })}
            />
          </div>

          <div className="space-y-2">
            <Label>Your endpoint</Label>
            <div className="flex items-center gap-2 bg-muted p-3 rounded border">
              <code className="text-xs flex-1 break-all font-mono">{endpoint}</code>
              <Button variant="outline" size="sm" onClick={() => copy(endpoint, "Endpoint")}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={rotateToken} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Rotate key
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="script">
        <TabsList>
          <TabsTrigger value="script">Header script</TabsTrigger>
          <TabsTrigger value="prompt">AI agent prompt</TabsTrigger>
        </TabsList>

        <TabsContent value="script" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Paste this into your platform's global header / custom code area, then swap the
            placeholder user values for your platform's logged-in user variables.
          </p>
          <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-auto max-h-80">
            <code>{headerScript}</code>
          </pre>
          <Button onClick={() => copy(headerScript, "Script")} className="gap-2">
            <Copy className="w-4 h-4" />
            Copy script
          </Button>
        </TabsContent>

        <TabsContent value="prompt" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Don't want to touch code? Copy this and send it to any AI agent (Lovable, Cursor,
            ChatGPT, your platform's own builder) and it will install the monitoring for you.
          </p>
          <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-auto max-h-80 whitespace-pre-wrap">
            <code>{agentPrompt}</code>
          </pre>
          <Button onClick={() => copy(agentPrompt, "Prompt")} className="gap-2">
            <Copy className="w-4 h-4" />
            Copy agent prompt
          </Button>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="w-4 h-4" />
            Recent activity
          </CardTitle>
          <CardDescription>
            {connection.event_count} total events
            {connection.last_event_at
              ? ` · last ${new Date(connection.last_event_at).toLocaleString()}`
              : " · nothing received yet"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No events yet. Install the script and log into your platform to test it.
            </p>
          ) : (
            <div className="divide-y">
              {events.map((e) => (
                <div key={e.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="truncate">
                    {e.user_name || e.user_email || "Unknown user"}
                    {e.user_name && e.user_email && (
                      <span className="text-muted-foreground"> · {e.user_email}</span>
                    )}
                  </span>
                  <span className="text-muted-foreground whitespace-nowrap ml-3">
                    {new Date(e.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ExternalPlatformPanel;
