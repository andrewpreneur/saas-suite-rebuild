import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Headphones, Lock } from "lucide-react";
import { toast } from "sonner";

type Mode = "self" | "managed";

/** Human chat on/off and who handles human chats. AI chat on/off lives in the AI Chat Support card. */
export default function ChatModeSettings() {
  const { email, plan } = useUser();
  const isAdvanced = String(plan || "").toUpperCase() === "ADVANCED";
  const [human, setHuman] = useState(true);
  const [mode, setMode] = useState<Mode>("self");
  const [agencyName, setAgencyName] = useState("Your Agency");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!email) return;
    (async () => {
      const { data } = await supabase
        .from("saas_suite_users")
        .select("human_chat_enabled, human_chat_mode, agency_name" as any)
        .eq("email", email)
        .maybeSingle();
      const d = data as any;
      if (d) {
        setHuman(d.human_chat_enabled ?? true);
        setMode((d.human_chat_mode as Mode) || "self");
        setAgencyName(String(d.agency_name || "Your Agency").trim());
      }
    })();
  }, [email]);

  const save = async (patch: Record<string, unknown>, ok: string, revert: () => void) => {
    if (!email) return;
    setSaving(true);
    const { error } = await supabase.from("saas_suite_users").update(patch as any).eq("email", email);
    setSaving(false);
    if (error) {
      revert();
      toast.error(error.message.includes("Advanced") ? "SaaSSuite Handles & Responds is only on the Advanced plan." : "Couldn't save that setting.");
      return;
    }
    toast.success(ok);
  };

  const pickMode = (next: Mode) => {
    if (next === mode) return;
    if (next === "managed" && !isAdvanced) {
      toast.error("SaaSSuite Handles & Responds is only on the Advanced plan.");
      return;
    }
    const prev = mode;
    setMode(next);
    save({ human_chat_mode: next }, next === "managed" ? "Our team will now handle and respond to chats" : "You'll now handle and respond to chats", () => setMode(prev));
  };

  return (
    <div className="space-y-3">
      <div className="p-4 rounded-lg bg-muted/50 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Headphones className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <Label htmlFor="human-chat-toggle" className="font-medium">Human Chat</Label>
              <p className="text-xs text-muted-foreground">Customers can reach a real person in the chat.</p>
            </div>
          </div>
          <Switch id="human-chat-toggle" checked={human} disabled={saving}
            onCheckedChange={(v) => { setHuman(v); save({ human_chat_enabled: v }, v ? "Human chat turned on" : "Human chat turned off", () => setHuman(!v)); }} />
        </div>

        {human && (
          <div className="grid gap-2 sm:grid-cols-2">
            {([
              ["self", `${agencyName} Handles & Responds`, "Your team answers. New chats and tickets go to the account owner until assigned."],
              ["managed", "SaaSSuite Handles & Responds", "Our US-based team answers your customers for you."],
            ] as const).map(([k, title, desc]) => {
              const locked = k === "managed" && !isAdvanced;
              const active = mode === k;
              return (
                <button key={k} type="button" disabled={saving} onClick={() => pickMode(k)}
                  className={`text-left rounded-lg border p-3 transition-colors ${active ? "border-primary bg-primary/5" : "bg-card hover:bg-muted/50"} ${locked ? "opacity-70" : ""}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{title}</span>
                    {locked && <Badge variant="outline" className="text-[10px] gap-1"><Lock className="w-3 h-3" />Advanced</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{desc}</p>
                </button>
              );
            })}
          </div>
        )}
        {!human && <p className="text-xs text-muted-foreground">Human chat is off, so only the AI answers your customers.</p>}
      </div>
    </div>
  );
}
