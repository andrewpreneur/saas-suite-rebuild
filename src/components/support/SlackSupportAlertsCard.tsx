import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const ITEMS: { key: string; label: string; desc: string; selfOnly?: boolean }[] = [
  { key: "alert_assigned_chat", label: "Chat assigned", desc: "When someone is assigned to a chat." },
  { key: "alert_assigned_ticket", label: "Ticket assigned", desc: "When someone is assigned to a ticket." },
  { key: "alert_assigned_updates", label: "Updates on assigned chats & tickets", desc: "Customer sends a message, or a ticket is updated." },
  { key: "alert_new_unassigned_chats", label: "New unassigned chats", desc: "A new chat that nobody is assigned to yet.", selfOnly: true },
  { key: "alert_new_unassigned_tickets", label: "New unassigned tickets", desc: "A new ticket that nobody is assigned to yet.", selfOnly: true },
];

export default function SlackSupportAlertsCard() {
  const { email } = useUser();
  const [prefs, setPrefs] = useState<Record<string, boolean> | null>(null);
  const [connected, setConnected] = useState(false);
  const [mode, setMode] = useState("self");

  useEffect(() => {
    if (!email) return;
    (async () => {
      const [{ data }, { data: u }] = await Promise.all([
        (supabase as any).rpc("get_slack_support_alert_prefs", { user_email: email }),
        supabase.from("saas_suite_users").select("human_chat_mode" as any).eq("email", email).maybeSingle(),
      ]);
      setConnected(!!data?.connected);
      setPrefs(data || {});
      setMode((u as any)?.human_chat_mode || "self");
    })();
  }, [email]);

  if (!prefs) return null;
  if (!connected) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-4 text-sm text-muted-foreground">
          Connect Slack first (Slack → Connection), then you can choose which support alerts post to your channel.
        </CardContent>
      </Card>
    );
  }

  const toggle = async (key: string, next: boolean) => {
    setPrefs((p) => ({ ...(p || {}), [key]: next }));
    const { data, error } = await (supabase as any).rpc("set_slack_support_alert_pref", { user_email: email, p_key: key, p_enabled: next });
    if (error || data === false) {
      setPrefs((p) => ({ ...(p || {}), [key]: !next }));
      toast.error("Couldn't save that setting.");
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-1">
        <p className="text-sm font-semibold">Support alerts in Slack</p>
        <p className="text-xs text-muted-foreground pb-2">Choose what posts to your connected Slack channel.</p>
        {ITEMS.filter((i) => !i.selfOnly || mode === "self").map((i) => (
          <div key={i.key} className="flex items-center justify-between gap-3 py-2 border-t first:border-t-0">
            <div>
              <Label htmlFor={i.key} className="text-sm">{i.label}</Label>
              <p className="text-xs text-muted-foreground">{i.desc}</p>
            </div>
            <Switch id={i.key} checked={prefs[i.key] !== false} onCheckedChange={(v) => toggle(i.key, v)} />
          </div>
        ))}
        {mode !== "self" && (
          <p className="text-xs text-muted-foreground pt-2">New unassigned chat and ticket alerts are hidden because our team handles your chats.</p>
        )}
      </CardContent>
    </Card>
  );
}
