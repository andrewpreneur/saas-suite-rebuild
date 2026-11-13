import { useEffect, useState } from "react";
import { PageHeader } from "@/components/platform/PageHeader";
import { LoadNotice } from "@/components/platform/LoadNotice";
import { LOAD_TIMEOUT_MESSAGE, armLoadDeadline, loadErrorText } from "@/lib/loadSettle";
import { HubLinkBar } from "@/components/premium/hub/HubLinkBar";
import { HubPageSkeleton } from "@/components/premium/hub/HubBits";
import { SectionCard } from "@/components/premium/SectionCard";
import { Reveal, RevealItem } from "@/components/premium/Reveal";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Type } from "lucide-react";
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

  if (loadError) {
    return (
      <LoadNotice
        loading={false}
        error={loadError}
        label="Loading knowledge base…"
        onRetry={() => setLoadAttempt((attempt) => attempt + 1)}
      />
    );
  }

  if (loading) {
    return <HubPageSkeleton />;
  }

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        eyebrow="Client Hub"
        title="Knowledge Base"
        subtitle="A help center under your brand, filled with ready-made articles. Choose which ones your clients can read."
      />

      <HubLinkBar
        label="Help center link"
        url={kbUrl}
        onCopy={() => {
          navigator.clipboard.writeText(kbUrl);
          toast.success("Link copied");
        }}
        onOpen={() => window.open(kbUrl, "_blank", "noopener")}
        extra={
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border px-3">
            <span className="text-sm font-medium">{kbEnabled ? "Visible to clients" : "Hidden from clients"}</span>
            <Switch
              aria-label="Enable Knowledge Base"
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
          </label>
        }
      />

      <Reveal className="space-y-4">
        <RevealItem>
          <SectionCard
            icon={<Type />}
            title="Welcome headline"
            description="The first line on your help center. Leave it empty to use the default with your agency name."
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <Label htmlFor="kb-headline" className="sr-only">
                Home Page Headline
              </Label>
              <Input
                id="kb-headline"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Welcome to the {Agency name} Knowledge Base"
                className="flex-1"
              />
              <Button variant="accent" onClick={handleSave} disabled={saving} className="shrink-0">
                {saving && <Loader2 className="size-4 animate-spin" />}
                Save headline
              </Button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Your logo and name come from{" "}
              <button
                type="button"
                className="font-medium text-brand hover:underline"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("tipbot-select-tool", { detail: { tool: "settings" } }),
                  )
                }
              >
                Settings
              </button>
              , and your colors from{" "}
              <button
                type="button"
                className="font-medium text-brand hover:underline"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("tipbot-select-tool", { detail: { tool: "branding" } }),
                  )
                }
              >
                Branding
              </button>
              .
            </p>
          </SectionCard>
        </RevealItem>

        <RevealItem>
          <HiddenItemsManager agencyId={agencyId} />
        </RevealItem>
      </Reveal>
    </div>
  );
};

export default KnowledgeBase;
