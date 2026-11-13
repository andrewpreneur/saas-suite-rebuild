import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Play, Webhook } from "lucide-react";

/**
 * Second inbound webhook: fires on ticket updates (status changes and new messages).
 * Self-contained so it can drop into both the Client Hub support tab and the Support tool.
 */
export default function SupportUpdatesWebhookPanel({ compact = false }: { compact?: boolean }) {
  const { email, effectiveEmail } = useUser();
  const ownerEmail = (effectiveEmail || email || "").toLowerCase();

  const [saved, setSaved] = useState("");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!ownerEmail) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("saas_suite_users")
        .select("support_updates_webhook_url")
        .ilike("email", ownerEmail)
        .maybeSingle();
      if (cancelled) return;
      const url = ((data as { support_updates_webhook_url?: string | null } | null)?.support_updates_webhook_url) ?? "";
      setSaved(url);
      setValue(url);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [ownerEmail]);

  const save = async () => {
    if (!ownerEmail) return;
    setSaving(true);
    const { error } = await supabase
      .from("saas_suite_users")
      .update({ support_updates_webhook_url: value.trim() || null } as never)
      .ilike("email", ownerEmail);
    setSaving(false);
    if (error) {
      toast.error("Could not save that webhook");
      return;
    }
    setSaved(value.trim());
    toast.success("Ticket updates webhook saved");
  };

  const test = async () => {
    if (!saved) return;
    setTesting(true);
    try {
      const res = await fetch(saved, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: "ticket_status_updated",
          test: true,
          ticket: {
            ticket_number: 0,
            customer_name: "Test Customer",
            customer_email: "test@example.com",
            issue_category: "Test",
            request_text: "This is a test ticket update payload.",
            status: "Responded",
            updated_at: new Date().toISOString(),
          },
          previous_status: "Open",
        }),
      });
      toast[res.ok ? "success" : "error"](res.ok ? "Test sent" : `Test failed (${res.status})`);
    } catch {
      toast.error("Test could not reach that URL");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className={compact ? "space-y-3" : "rounded-lg border p-5 space-y-3"}>
      <div className="flex items-center gap-2">
        <Webhook className="w-5 h-5 text-muted-foreground" />
        <Label className="font-semibold text-base">Inbound Webhook URL (Ticket Updates)</Label>
      </div>
      <p className="text-xs text-muted-foreground">
        A separate URL that fires whenever a ticket changes — status updates, replies and new messages — including the
        customer's email and the message body. Leave blank to send everything to your first webhook.
      </p>
      <div className="flex gap-2">
        <Input
          type="url"
          placeholder="https://hooks.example.com/ticket-updates..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1"
          disabled={loading}
        />
        <Button onClick={() => void save()} disabled={saving || loading || value.trim() === saved}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
        </Button>
        <Button variant="outline" onClick={() => void test()} disabled={testing || !saved} title="Send a test payload">
          <Play className="w-4 h-4 mr-1" />
          {testing ? "Testing..." : "Test"}
        </Button>
      </div>
      {saved && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-green-500" /> Ticket updates webhook configured
        </p>
      )}
    </div>
  );
}
