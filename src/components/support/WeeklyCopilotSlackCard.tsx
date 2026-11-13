import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bot } from "lucide-react";
import { toast } from "sonner";

export default function WeeklyCopilotSlackCard() {
  const { email } = useUser();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [lastSent, setLastSent] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!email) return;
    let active = true;
    (async () => {
      const { data } = await (supabase as any).rpc("get_copilot_nudge_pref", {
        user_email: email.trim().toLowerCase(),
      });
      if (!active) return;
      const row = Array.isArray(data) ? data[0] : data;
      setEnabled(!!row?.enabled);
      setLastSent(row?.last_sent_at ?? null);
    })();
    return () => {
      active = false;
    };
  }, [email]);

  const toggle = async (next: boolean) => {
    if (!email) return;
    setSaving(true);
    setEnabled(next);
    const { data, error } = await (supabase as any).rpc("set_copilot_nudge_pref", {
      user_email: email.trim().toLowerCase(),
      p_enabled: next,
    });
    setSaving(false);
    if (error || data === false) {
      setEnabled(!next);
      toast.error("Couldn't save that setting. Please try again.");
      return;
    }
    toast.success(next ? "Weekly AI Copilot check-in turned on" : "Weekly AI Copilot check-in turned off");
  };

  return (
    <Card className="border-primary/20 bg-primary/[0.03]">
      <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="weekly-copilot-slack" className="text-sm font-semibold">
              Weekly AI Copilot check-in
            </Label>
            <p className="text-xs text-muted-foreground max-w-md">
              Once a week the AI Copilot messages you in Slack with a suggestion to grow your SaaS.
              Reply right in Slack and it will help you get it done.
              {lastSent && <> Last sent {new Date(lastSent).toLocaleDateString()}.</>}
            </p>
          </div>
        </div>
        <Switch
          id="weekly-copilot-slack"
          className="self-end sm:self-center"
          checked={!!enabled}
          disabled={saving || enabled === null}
          onCheckedChange={toggle}
        />
      </CardContent>
    </Card>
  );
}
