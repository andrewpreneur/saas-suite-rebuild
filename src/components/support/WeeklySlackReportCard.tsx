import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { SectionCard } from "@/components/premium/SectionCard";
import { Link } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CalendarClock, Send } from "lucide-react";
import { toast } from "sonner";
import { ToggleRow } from "@/components/premium/settings/Field";

type Pref = {
  connected: boolean;
  enabled: boolean;
  last_sent_at: string | null;
  channel_id: string | null;
};

/** `bare`: one switch row with no card, for the Slack page in Settings. */
export default function WeeklySlackReportCard({ bare }: { bare?: boolean } = {}) {
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

  if (!pref) return bare ? <div className="px-skeleton my-3 h-11 rounded-lg" aria-busy="true" aria-label="Loading weekly report" /> : null;
  if (bare && !pref.connected) {
    return (
      <ToggleRow
        className="py-3"
        label="Weekly support report"
        htmlFor="weekly-slack-report"
        description="A Monday summary of your tickets. Connect Slack first to turn it on."
      >
        <Switch id="weekly-slack-report" checked={false} disabled />
      </ToggleRow>
    );
  }
  if (!pref.connected) {
    return (
      <SectionCard
        icon={<CalendarClock />}
        title="Weekly report to Slack"
        description="A Monday summary of open, answered and waiting tickets. Connect Slack and pick a channel to turn it on."
        actions={
          <Button variant="outline" asChild>
            <Link to="/app/slack">Connect Slack</Link>
          </Button>
        }
      />
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

  if (bare) {
    return (
      <div className="py-3">
        <ToggleRow
          label="Weekly support report"
          htmlFor="weekly-slack-report"
          description={
            <>
              A Monday summary of open, answered and waiting tickets.
              {pref.last_sent_at && <> Last sent {new Date(pref.last_sent_at).toLocaleDateString()}.</>}
            </>
          }
        >
          <Switch id="weekly-slack-report" checked={pref.enabled} disabled={saving} onCheckedChange={toggle} />
        </ToggleRow>
        {pref.enabled && (
          <Button variant="outline" size="sm" className="mt-2 h-11 sm:h-9" onClick={sendNow} disabled={sending || !agencyId}>
            <Send className={sending ? "animate-pulse" : ""} aria-hidden="true" />
            {sending ? "Sending report" : "Send this week's report now"}
          </Button>
        )}
      </div>
    );
  }

  return (
    <SectionCard
      icon={<CalendarClock />}
      title={
        <Label htmlFor="weekly-slack-report" className="text-base font-semibold">
          Weekly report to Slack
        </Label>
      }
      description={
        <>
          Every Monday morning we post a summary to your Slack channel: open tickets, tickets you
          answered, ones still waiting on a reply, and anything that needs attention.
          {pref.last_sent_at && <> Last sent {new Date(pref.last_sent_at).toLocaleDateString()}.</>}
        </>
      }
      actions={
        <>
          {pref.enabled && (
            <Button variant="outline" size="sm" onClick={sendNow} disabled={sending || !agencyId}>
              <Send className={sending ? "animate-pulse" : ""} aria-hidden="true" />
              Send now
            </Button>
          )}
          <Switch
            id="weekly-slack-report"
            checked={pref.enabled}
            disabled={saving}
            onCheckedChange={toggle}
          />
        </>
      }
    />
  );
}
