import { useEffect, useState } from "react";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import TopNavWidgetCard from "@/components/client-hub/TopNavWidgetCard";

/** Popup launcher settings. They live on Design, with brand colors. */
export function PopupSettingsCard({
  email,
  colors,
}: {
  email: string | null | undefined;
  colors: { primary: string; secondary: string; tertiary: string };
}) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!email) return;
    supabase
      .from("saas_suite_users")
      .select("popup_enabled")
      .ilike("email", email.trim().toLowerCase())
      .maybeSingle()
      .then(({ data }) =>
        setEnabled(Boolean((data as { popup_enabled?: boolean } | null)?.popup_enabled)),
      );
  }, [email]);

  const toggle = async (next: boolean) => {
    if (!email) return;
    setEnabled(next);
    const { error } = await supabase
      .from("saas_suite_users")
      .update({ popup_enabled: next } as never)
      .ilike("email", email.trim().toLowerCase());
    if (error) {
      setEnabled(!next);
      toast.error("Could not save popup settings");
      return;
    }
    toast.success(next ? "Popup turned on" : "Popup turned off");
  };

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div>
        <h2 className="text-base font-semibold">Popup</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A chat-style launcher that opens your Client Hub. It shows up in sub-accounts that have
          your installation code.
        </p>
      </div>
      <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Bottom right chat popup</span>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(value) => void toggle(value)}
          aria-label="Bottom right chat popup"
        />
      </div>
      {enabled ? (
        <div className="flex items-start gap-2 rounded-lg border border-green-500/20 bg-green-500/10 p-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
          <p className="text-xs text-green-700">
            The popup appears in any sub-account that already has your installation code.
          </p>
        </div>
      ) : null}
      <TopNavWidgetCard email={email} colors={colors} />
    </section>
  );
}
