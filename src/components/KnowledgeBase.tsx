import { useEffect, useState } from "react";
import { PageHeader } from "@/components/platform/PageHeader";
import { LoadNotice } from "@/components/platform/LoadNotice";
import { LOAD_TIMEOUT_MESSAGE, armLoadDeadline, loadErrorText } from "@/lib/loadSettle";
import { PanelActions } from "@/components/premium/hub/PanelActions";
import { SettingItem, SettingList } from "@/components/premium/SettingList";
import { HubPageSkeleton, OnOffSwitch } from "@/components/premium/hub/HubBits";
import { Reveal, RevealItem } from "@/components/premium/Reveal";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, ExternalLink, Eye, Loader2, Palette, Settings2, Type } from "lucide-react";
import HiddenItemsManager from "@/components/knowledge-base/HiddenItemsManager";

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

  const copyLink = () => {
    navigator.clipboard.writeText(kbUrl);
    toast.success("Link copied");
  };
  const goTo = (tool: string) => window.dispatchEvent(new CustomEvent("tipbot-select-tool", { detail: { tool } }));

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        eyebrow="Client Hub"
        title="Knowledge Base"
        subtitle="A help center under your brand. Choose which articles your clients can read."
        actions={
          <Button variant="accent" data-testid="kb-open" onClick={() => window.open(kbUrl, "_blank", "noopener")}>
            <ExternalLink className="size-4" aria-hidden="true" />
            Open help center
          </Button>
        }
        more={[
          { label: "Copy help center link", icon: <Copy />, onSelect: copyLink },
          { label: "Change logo and name", icon: <Settings2 />, onSelect: () => goTo("settings"), separated: true },
          { label: "Change colors", icon: <Palette />, onSelect: () => goTo("branding") },
        ]}
      />

      <Reveal className="space-y-4">
        <RevealItem>
          <SettingList>
            <SettingItem
              icon={<Eye />}
              title="Show to clients"
              value={kbEnabled ? "Clients can open your help center" : "Hidden from clients"}
              toggle={
                <OnOffSwitch
                  label="Show Knowledge Base to clients"
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
              }
            />
            <SettingItem
              testId="kb-headline-row"
              icon={<Type />}
              title="Welcome headline"
              value={headline.trim() || "Default, with your agency name"}
              panel={{
                description: "The first line on your help center. Leave it empty to use the default with your agency name.",
                footer: (
                  <PanelActions>
                    <Button variant="accent" data-testid="kb-save-headline" onClick={handleSave} disabled={saving}>
                      {saving && <Loader2 className="size-4 animate-spin" />}
                      Save headline
                    </Button>
                  </PanelActions>
                ),
              }}
            >
              <Label htmlFor="kb-headline">Headline</Label>
              <Input
                id="kb-headline"
                className="mt-1.5"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Welcome to the {Agency name} Knowledge Base"
              />
            </SettingItem>
          </SettingList>
        </RevealItem>

        <RevealItem>
          <HiddenItemsManager agencyId={agencyId} />
        </RevealItem>
      </Reveal>
    </div>
  );
};

export default KnowledgeBase;
