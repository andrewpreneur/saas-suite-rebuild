import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyButton } from "@/components/premium/hub/CopyButton";
import { MoreMenu } from "@/components/premium/MoreMenu";
import { ToggleRow } from "@/components/premium/settings/Field";
import { Disclosure, PageSection, StatusRow } from "@/components/premium/settings/Page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Loader2, Copy, RefreshCw, Plug } from "lucide-react";
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
      toast.error("Finish your SaaSSuite setup first. No agency ID was found.");
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
    toast.success("New key generated. Reinstall your script.");
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
      <div className="space-y-3" role="status" aria-label="Loading connection">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    );
  }

  if (!connection) {
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void createConnection();
        }}
      >
        <StatusRow tone="off" label="No connection yet" detail="Name your platform and we give you one script to install." />
        <PageSection>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="external-platform-name">Platform name</Label>
            <Input
              id="external-platform-name"
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
              placeholder="Vendasta, Webflow, my custom app"
              className="sm:max-w-md"
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="submit" variant="accent" className="h-11 w-full sm:h-10 sm:w-auto" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plug aria-hidden="true" />}
              {saving ? "Creating connection" : "Create connection"}
            </Button>
          </div>
        </PageSection>
      </form>
    );
  }

  const codeBox =
    "max-h-56 overflow-auto rounded-md border border-border bg-muted p-4 font-mono text-xs leading-relaxed text-foreground";

  return (
    <div>
      <StatusRow
        tone={connection.enabled ? "on" : "off"}
        label={connection.enabled ? `Listening for ${connection.platform_name || "your platform"}` : "Paused"}
        detail={
          <>
            {connection.event_count} login{connection.event_count === 1 ? "" : "s"} received
            {connection.last_event_at ? `, last on ${new Date(connection.last_event_at).toLocaleDateString()}.` : " so far."}
          </>
        }
      >
        <Button variant="accent" className="h-11 flex-1 sm:h-10 sm:flex-none" onClick={() => copy(headerScript, "Script")}>
          <Copy aria-hidden="true" />
          Copy script
        </Button>
        <MoreMenu
          label="More connection actions"
          items={[
            { label: "Copy AI agent prompt", icon: <Bot />, onSelect: () => void copy(agentPrompt, "Prompt") },
            { label: "Copy endpoint", icon: <Copy />, onSelect: () => void copy(endpoint, "Endpoint") },
            { label: "Rotate key", icon: <RefreshCw />, danger: true, separated: true, onSelect: () => void rotateToken() },
          ]}
        />
      </StatusRow>

      <PageSection>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="external-platform-name">Platform name</Label>
          <Input
            id="external-platform-name"
            value={platformName}
            onChange={(e) => setPlatformName(e.target.value)}
            onBlur={() => update({ platform_name: platformName.trim() || "External Platform" })}
            className="sm:max-w-md"
          />
          <p className="text-xs text-muted-foreground">Saves when you leave the field.</p>
        </div>
        <div className="mt-4 divide-y divide-border/70">
          <ToggleRow
            className="py-3"
            label="Monitoring"
            htmlFor="external-monitoring"
            description="Accept login events from this platform."
          >
            <Switch
              id="external-monitoring"
              checked={connection.enabled}
              onCheckedChange={(v) => update({ enabled: v })}
            />
          </ToggleRow>
          <ToggleRow
            className="py-3"
            label="Slack alert on login"
            htmlFor="external-slack-notify"
            description="Post in Slack when someone logs in."
          >
            <Switch
              id="external-slack-notify"
              checked={connection.slack_notify}
              onCheckedChange={(v) => update({ slack_notify: v })}
            />
          </ToggleRow>
        </div>
      </PageSection>

      <PageSection title="Install it" description="Paste the script in your platform's global header, or give the prompt to an AI agent.">
        <Tabs defaultValue="script">
          <TabsList>
            <TabsTrigger value="script">Header script</TabsTrigger>
            <TabsTrigger value="prompt">AI agent prompt</TabsTrigger>
          </TabsList>

          <TabsContent value="script" className="space-y-3">
            <pre className={codeBox}>
              <code>{headerScript}</code>
            </pre>
            <p className="text-xs text-muted-foreground">
              Swap the placeholder user values for your platform's logged-in user variables.
            </p>
          </TabsContent>

          <TabsContent value="prompt" className="space-y-3">
            <pre className={`${codeBox} whitespace-pre-wrap`}>
              <code>{agentPrompt}</code>
            </pre>
            <Button variant="outline" className="h-11 sm:h-10" onClick={() => copy(agentPrompt, "Prompt")}>
              <Copy aria-hidden="true" />
              Copy agent prompt
            </Button>
          </TabsContent>
        </Tabs>
      </PageSection>

      <Disclosure label="Your endpoint">
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 break-all rounded-md border border-border bg-muted px-3 py-2.5 font-mono text-xs text-foreground">
            {endpoint}
          </code>
          <CopyButton label="Copy endpoint" onCopy={() => void copy(endpoint, "Endpoint")} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Rotating the key in the menu above replaces this address.</p>
      </Disclosure>

      <Disclosure label={`Recent activity (${events.length})`} className="mt-0">
        {events.length === 0 ? (
          <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
            No events yet. Install the script, then log into your platform to test it.
          </p>
        ) : (
          <ul className="divide-y divide-border/70">
            {events.map((e) => (
              <li key={e.id} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate text-foreground">
                  {e.user_name || e.user_email || "Unknown user"}
                  {e.user_name && e.user_email && (
                    <span className="text-muted-foreground"> · {e.user_email}</span>
                  )}
                </span>
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {new Date(e.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Disclosure>
    </div>
  );
};

export default ExternalPlatformPanel;
