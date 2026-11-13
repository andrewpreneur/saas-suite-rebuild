import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Mail, Hash, ShieldCheck } from "lucide-react";

const ITEMS: { key: string; label: string; desc: string }[] = [
  { key: "alert_assigned_chat", label: "Chat assigned", desc: "When a chat is assigned to you." },
  { key: "alert_assigned_ticket", label: "Ticket assigned", desc: "When a ticket is assigned to you." },
  { key: "alert_assigned_updates", label: "Updates on assigned chats & tickets", desc: "Customer sends a message, or a ticket is updated." },
  { key: "alert_new_unassigned_chats", label: "New unassigned chats", desc: "A new chat that nobody is assigned to yet." },
  { key: "alert_new_unassigned_tickets", label: "New unassigned tickets", desc: "A new ticket that nobody is assigned to yet." },
];

const boxClass =
  "h-5 w-5 rounded-[4px] border-2 border-[hsl(var(--brand-purple))] data-[state=checked]:bg-[hsl(var(--brand-purple))] data-[state=checked]:border-[hsl(var(--brand-purple))] data-[state=checked]:text-primary-foreground";

type Settings = { role: string; mode: string; email: Record<string, boolean>; slack: Record<string, boolean> & { connected?: boolean } };

/** Per-alert channel picker. Only applies when the agency handles support itself ("You Handle & Respond"). */
export default function NotificationChannelsCard() {
  const { email } = useUser();
  const [s, setS] = useState<Settings | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!email) return;
    (async () => {
      const { data, error } = await (supabase as any).rpc("get_support_notification_settings", { p_owner_email: email.trim().toLowerCase() });
      if (error || !data) { setFailed(true); return; }
      setS(data as Settings);
    })();
  }, [email]);

  if (failed) return <Card><CardContent className="p-4 text-sm text-muted-foreground">Couldn't load notification settings.</CardContent></Card>;
  if (!s) return null;

  const managed = s.mode === "managed";
  const slackOn = !!s.slack?.connected;

  const toggle = async (channel: "email" | "slack", key: string, next: boolean) => {
    setS((p) => p && { ...p, [channel]: { ...p[channel], [key]: next } });
    const { data, error } = channel === "email"
      ? await (supabase as any).rpc("set_support_email_alert_pref_for", { p_owner_email: email.trim().toLowerCase(), p_key: key, p_enabled: next })
      : await (supabase as any).rpc("set_slack_support_alert_pref", { user_email: email.trim().toLowerCase(), p_key: key, p_enabled: next });
    if (error || data !== true) {
      setS((p) => p && { ...p, [channel]: { ...p[channel], [key]: !next } });
      toast.error("Couldn't save that setting.");
    } else {
      toast.success("Saved");
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold">Support notifications</p>
          <p className="text-xs text-muted-foreground">
            {slackOn ? "Choose where each alert goes: email, Slack, both, or neither." : "Choose which alerts you get by email."}
            {s.role === "admin" ? " Email choices are just for you." : ""}
          </p>
          {managed && <p className="text-xs text-muted-foreground mt-1">SaaSSuite handles and responds to your support, so alerts go to the SaaSSuite team and these email choices don't apply.</p>}
        </div>
        <div className={`grid ${slackOn ? "grid-cols-[1fr_auto_auto]" : "grid-cols-[1fr_auto]"} gap-x-6 gap-y-1 items-center`}>
          <span />
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1 justify-center"><Mail className="w-3.5 h-3.5" />Email</span>
          {slackOn && <span className="text-xs font-medium text-muted-foreground flex items-center gap-1 justify-center"><Hash className="w-3.5 h-3.5" />Slack</span>}
          {ITEMS.map((i) => (
            <div key={i.key} className="contents">
              <div className="py-2 border-t">
                <p className="text-sm">{i.label}</p>
                <p className="text-xs text-muted-foreground">{i.desc}</p>
              </div>
              <div className="py-2 border-t h-full flex items-center justify-center">
                <Checkbox className={boxClass} checked={s.email?.[i.key] !== false}
                  disabled={managed} onCheckedChange={(v) => toggle("email", i.key, v === true)} aria-label={`${i.label} email`} />
              </div>
              {slackOn && (
                <div className="py-2 border-t h-full flex items-center justify-center">
                  <Checkbox className={boxClass} checked={s.slack?.[i.key] !== false}
                    onCheckedChange={(v) => toggle("slack", i.key, v === true)} aria-label={`${i.label} slack`} />
                </div>
              )}
            </div>
          ))}
        </div>
        {slackOn
          ? <p className="text-xs text-muted-foreground">Slack alerts post to your team's connected channel, so Slack choices apply to the whole team.</p>
          : <p className="text-xs text-muted-foreground">Want alerts in Slack too? Connect Slack from the Slack page and Slack options will show up here.</p>}
      </CardContent>
    </Card>
  );
}
