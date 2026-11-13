import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CalendarClock, Send } from "lucide-react";
import { toast } from "sonner";

type Pref = {
  connected: boolean;
  enabled: boolean;
  last_sent_at: string | null;
  channel_id: string | null;
};

export default function WeeklySlackReportCard() {
  const { email } = useUser();
  const [pref, setPref] = useState<Pref | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);

  useEffect(() => {
    if (!email) return;
    let active = true;
    (async () => {
      const [{ data }, { data: versions }] = await Promise.all([
        (supabase as any).rpc("get_slack_weekly_report_pref", { user_email: email }),
        supabase.rpc("get_user_agency_versions", { user_email: email }),
      ]);
      if (!active) return;
      const row = Array.isArray(data) ? data[0] : data;
      setPref(
        row
          ? {
              connected: !!row.connected,
              enabled: !!row.enabled,
              last_sent_at: row.last_sent_at ?? null,
              channel_id: row.channel_id ?? null,
            }
          : { connected: false, enabled: false, last_sent_at: null, channel_id: null },
      );
      const v = Array.isArray(versions) ? (versions[0] as any) : null;
      setAgencyId(v?.base_id || v?.basic_id || v?.advanced_id || v?.elite_id || null);
    })();
    return () => {
      active = false;
    };
  }, [email]);

  if (!pref) return null;
  if (!pref.connected) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-4 text-sm text-muted-foreground">
          Connect Slack first (Slack → Connection) and pick a channel, then you can turn on the
          weekly support report here.
        </CardContent>
      </Card>
    );
  }

  const toggle = async (next: boolean) => {
    setSaving(true);
    setPref((p) => (p ? { ...p, enabled: next } : p));
    const { data, error } = await (supabase as any).rpc("set_slack_weekly_report_pref", {
      user_email: email,
      p_enabled: next,
    });
    setSaving(false);
    if (error || data === false) {
      setPref((p) => (p ? { ...p, enabled: !next } : p));
      toast.error("Couldn't save that setting. Please try again.");
      return;
    }
    toast.success(next ? "Weekly Slack report turned on" : "Weekly Slack report turned off");
  };

  const sendNow = async () => {
    if (!agencyId) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke("slack-weekly-report", {
      body: { agency_id: agencyId },
    });
    setSending(false);
    if (error || (data as any)?.sent === false) {
      let msg = (data as any)?.message || (data as any)?.error;
      if (!msg && error && (error as any).context?.json) {
        try { msg = (await (error as any).context.json())?.error; } catch { /* ignore */ }
      }
      toast.error(msg || "Couldn't send the report to Slack right now.");
      return;
    }
    toast.success("Report sent to your Slack channel");
  };

  return (
    <Card className="border-primary/20 bg-primary/[0.03]">
      <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <CalendarClock className="h-4 w-4 text-primary" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="weekly-slack-report" className="text-sm font-semibold">
              Weekly report to Slack
            </Label>
            <p className="text-xs text-muted-foreground max-w-md">
              Every Monday morning we'll post a summary to your connected Slack channel: open
              tickets, tickets you've responded to, ones still waiting on a reply, and anything that
              needs your attention.
              {pref.last_sent_at && (
                <> Last sent {new Date(pref.last_sent_at).toLocaleDateString()}.</>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 self-end sm:self-center">
          {pref.enabled && (
            <Button variant="outline" size="sm" onClick={sendNow} disabled={sending || !agencyId}>
              <Send className={`h-3.5 w-3.5 mr-1.5 ${sending ? "animate-pulse" : ""}`} />
              Send now
            </Button>
          )}
          <Switch
            id="weekly-slack-report"
            checked={pref.enabled}
            disabled={saving}
            onCheckedChange={toggle}
          />
        </div>
      </CardContent>
    </Card>
  );
}
