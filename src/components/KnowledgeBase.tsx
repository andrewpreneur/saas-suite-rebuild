import { useEffect, useState } from "react";
import { PageHeader } from "@/components/platform/PageHeader";
import { LoadNotice } from "@/components/platform/LoadNotice";
import { LOAD_TIMEOUT_MESSAGE, armLoadDeadline, loadErrorText } from "@/lib/loadSettle";
import { HubLinkBar } from "@/components/platform/HubLinkBar";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BookOpen, Loader2 } from "lucide-react";
import HiddenItemsManager from "@/components/knowledge-base/HiddenItemsManager";
import { Switch } from "@/components/ui/switch";

const KB_BASE_URL = "https://help.yoursoftwareonboarding.com";

const KnowledgeBase = () => {
  const { email } = useUser();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saving, setSaving] = useState(false);

  const [agencyId, setAgencyId] = useState<string>("");
  const [headline, setHeadline] = useState("");
  const [kbEnabled, setKbEnabled] = useState(true);

  useEffect(() => {
    let alive = true;
    const stop = armLoadDeadline(() => {
      if (!alive) return;
      setLoading(false);
      setLoadError(LOAD_TIMEOUT_MESSAGE);
    });
    if (!email) {
      stop();
      setLoading(false);
      setLoadError(null);
      return;
    }
    (async () => {
      try {
      const { data } = await supabase
        .from("saas_suite_users")
        .select(
          "agency_id, agency_id_basic, agency_id_advanced, agency_id_elite, kb_headline, knowledge_base_enabled",
        )
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();
      if (data) {
        const id =
          (data as any).agency_id ||
          (data as any).agency_id_basic ||
          (data as any).agency_id_advanced ||
          (data as any).agency_id_elite ||
          "";
        setAgencyId(id);
        setHeadline((data as any).kb_headline ?? "");
        setKbEnabled((data as any).knowledge_base_enabled ?? true);
      }
      if (alive) setLoadError(null);
      } catch (error) {
        if (alive) setLoadError(loadErrorText(error, "Couldn't load the knowledge base."));
      } finally {
        stop();
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
      stop();
    };
  }, [email, loadAttempt]);

  const kbUrl = `${KB_BASE_URL}/${agencyId || "your-agency-id"}`;

  const handleSave = async () => {
    if (!email) return;
    setSaving(true);
    const { error } = await supabase
      .from("saas_suite_users")
      .update({
        kb_headline: headline.trim() || null,
        knowledge_base_enabled: kbEnabled,
      } as any)
      .eq("email", email.trim().toLowerCase());
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Knowledge Base settings saved");
  };

  if (loadError || loading) {
    return (
      <LoadNotice
        loading={loading}
        error={loadError}
        label="Loading knowledge base…"
        onRetry={() => setLoadAttempt((attempt) => attempt + 1)}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <BookOpen className="w-6 h-6 text-primary" />
        </div>
        <PageHeader title="Knowledge Base" subtitle="White-label help center for your clients." />
      </div>

      {/* Enable/Disable Card */}
      <Card>
        <CardContent className="pt-6 flex items-center justify-between gap-4">
          <div>
            <Label className="text-sm font-semibold">Enable Knowledge Base</Label>
            <p className="text-xs text-muted-foreground mt-1">
              When disabled, your white-label Knowledge Base will be hidden from your clients.
            </p>
          </div>
          <Switch
            checked={kbEnabled}
            onCheckedChange={async (checked) => {
              setKbEnabled(checked);
              if (!email) return;
              const { error } = await supabase
                .from("saas_suite_users")
                .update({ knowledge_base_enabled: checked } as any)
                .eq("email", email.trim().toLowerCase());
              if (error) {
                toast.error(error.message);
                setKbEnabled(!checked);
              } else {
                toast.success(checked ? "Knowledge Base enabled" : "Knowledge Base disabled");
              }
            }}
          />
        </CardContent>
      </Card>

      {/* URL Card */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="pt-6">
          <HubLinkBar label="Knowledge Base URL" url={kbUrl} previewLabel="Open" />
        </CardContent>
      </Card>

      {/* Customization */}
      <Card>
        <CardHeader>
          <CardTitle>Customize Your Knowledge Base</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("tipbot-select-tool", { detail: { tool: "settings" } }),
                )
              }
            >
              Agency name and logo are in Settings
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("tipbot-select-tool", { detail: { tool: "branding" } }),
                )
              }
            >
              Brand colors are on Design
            </Button>
          </div>

          {/* Headline */}
          <div className="space-y-2">
            <Label htmlFor="kb-headline">Home Page Headline</Label>
            <Input
              id="kb-headline"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Welcome to the {Agency name} Knowledge Base"
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to use the default welcome that includes your agency name.
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="accent" onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      <HiddenItemsManager agencyId={agencyId} />
    </div>
  );
};

export default KnowledgeBase;
