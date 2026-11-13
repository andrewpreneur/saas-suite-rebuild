import { PageHeader } from "@/components/platform/PageHeader";
import { LoadNotice } from "@/components/platform/LoadNotice";
import { LOAD_TIMEOUT_MESSAGE, armLoadDeadline, loadErrorText } from "@/lib/loadSettle";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDown, ArrowUp, Check, Library, Link2, ListVideo, Plus, Save, Trash2, Type, Video } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { SPRING_SOFT } from "@/lib/motion";
import { SectionCard } from "@/components/premium/SectionCard";
import { Reveal, RevealItem } from "@/components/premium/Reveal";
import AnimatedTabs from "@/components/premium/21st/animated-tabs";
import { EmptyState } from "@/components/premium/21st/empty-state";
import { HubEmptyIcon } from "@/components/premium/hub/HubBits";
import { HubLinkBar } from "@/components/premium/hub/HubLinkBar";
import { HubListSkeleton, HubRow } from "@/components/premium/hub/HubBits";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { VIDEO_CATEGORIES } from "@/constants/videoCategories";
import { useGhl } from "@/components/highlevel/useGhl";
import MultiPlanConnectionNotice from "@/components/highlevel/MultiPlanConnectionNotice";

type Plan = "plan1" | "plan2" | "plan3";

interface AgencyVersions {
  basic_id: string | null;
  advanced_id: string | null;
  elite_id: string | null;
}

interface CustomVideo {
  id: string;
  title: string;
}

interface PageVideoRow {
  id: string;
  source: "standard" | "custom";
  category_id: string | null;
  module_id: string | null;
  custom_video_id: string | null;
  display_order: number;
}

const PUBLIC_BASE = "https://yoursoftwareonboarding.com/simple";

const SimpleOnboardingManager = () => {
  const { email, plan } = useUser();
  const [agencyVersions, setAgencyVersions] = useState<AgencyVersions>({ basic_id: null, advanced_id: null, elite_id: null });
  const [selectedPlan, setSelectedPlan] = useState<Plan>("plan1");
  const connection = useGhl(agencyVersions.basic_id);
  useEffect(() => { if (!connection.loading && !connection.connected) setSelectedPlan("plan1"); }, [connection.loading, connection.connected]);
  const [pageTitle, setPageTitle] = useState("");
  const [savedTitle, setSavedTitle] = useState("");
  const [rows, setRows] = useState<PageVideoRow[]>([]);
  const [customVideos, setCustomVideos] = useState<CustomVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saving, setSaving] = useState(false);

  const currentAgencyId = useMemo(() => {
    if (selectedPlan === "plan1") return agencyVersions.basic_id;
    if (selectedPlan === "plan2") return agencyVersions.advanced_id;
    return agencyVersions.elite_id;
  }, [selectedPlan, agencyVersions]);

  // Load user agency ids
  useEffect(() => {
    let alive = true;
    const stop = armLoadDeadline(() => {
      if (!alive) return;
      setLoadError(LOAD_TIMEOUT_MESSAGE);
    });
    if (!email) {
      stop();
      setLoadError(null);
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase
          .from("saas_suite_users")
          .select("agency_id_basic, agency_id_advanced, agency_id_elite, agency_id")
          .ilike("email", email)
          .maybeSingle();
        if (error) throw error;
        if (data && alive) {
          setAgencyVersions({
            basic_id: data.agency_id_basic || data.agency_id || null,
            advanced_id: data.agency_id_advanced || null,
            elite_id: data.agency_id_elite || null,
          });
        }
        if (alive) setLoadError(null);
      } catch (error) {
        if (alive) setLoadError(loadErrorText(error, "Couldn't load the simple page."));
      } finally {
        stop();
      }
    })();
    return () => {
      alive = false;
      stop();
    };
  }, [email, loadAttempt]);

  // Load settings + videos for current agency
  useEffect(() => {
    if (!currentAgencyId) {
      setRows([]);
      setPageTitle("");
      setSavedTitle("");
      setCustomVideos([]);
      setLoading(false);
      return;
    }
    let alive = true;
    const stop = armLoadDeadline(() => {
      if (!alive) return;
      setLoading(false);
      setLoadError(LOAD_TIMEOUT_MESSAGE);
    });
    setLoading(true);
    (async () => {
      try {
        const [settings, videos, customs] = await Promise.all([
          supabase.from("simple_page_settings").select("page_title").eq("agency_id", currentAgencyId).maybeSingle(),
          supabase
            .from("simple_page_videos")
            .select("id, source, category_id, module_id, custom_video_id, display_order")
            .eq("agency_id", currentAgencyId)
            .order("display_order", { ascending: true }),
          supabase
            .from("custom_onboarding_videos")
            .select("id, title")
            .eq("agency_id", currentAgencyId)
            .order("created_at", { ascending: false }),
        ]);
        if (settings.error) throw settings.error;
        if (videos.error) throw videos.error;
        if (customs.error) throw customs.error;
        const title = settings.data?.page_title || "";
        if (!alive) return;
        setPageTitle(title);
        setSavedTitle(title);
        setRows((videos.data || []) as PageVideoRow[]);
        setCustomVideos((customs.data || []) as CustomVideo[]);
        setLoadError(null);
      } catch (error) {
        if (alive) setLoadError(loadErrorText(error, "Couldn't load the simple page."));
      } finally {
        stop();
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
      stop();
    };
  }, [currentAgencyId, loadAttempt]);

  const moduleLabel = (categoryId: string | null, moduleId: string | null) => {
    if (!categoryId || !moduleId) return "Unknown module";
    const cat = VIDEO_CATEGORIES.find((c) => c.id === categoryId);
    const mod = cat?.modules.find((m) => m.id === moduleId);
    return mod ? `${cat?.name} → ${mod.name}` : `${categoryId} / ${moduleId}`;
  };

  const customLabel = (id: string | null) => customVideos.find((v) => v.id === id)?.title || "Custom video";

  const move = (idx: number, dir: -1 | 1) => {
    const newRows = [...rows];
    const target = idx + dir;
    if (target < 0 || target >= newRows.length) return;
    [newRows[idx], newRows[target]] = [newRows[target], newRows[idx]];
    setRows(newRows.map((r, i) => ({ ...r, display_order: i + 1 })));
  };

  const removeRow = (idx: number) => {
    const newRows = rows.filter((_, i) => i !== idx).map((r, i) => ({ ...r, display_order: i + 1 }));
    setRows(newRows);
  };

  const addStandard = (categoryId: string, moduleId: string) => {
    if (rows.some((r) => r.source === "standard" && r.category_id === categoryId && r.module_id === moduleId)) {
      toast.info("Video already added");
      return;
    }
    setRows([
      ...rows,
      {
        id: `new-${Date.now()}`,
        source: "standard",
        category_id: categoryId,
        module_id: moduleId,
        custom_video_id: null,
        display_order: rows.length + 1,
      },
    ]);
  };

  const addCustom = (customVideoId: string) => {
    if (rows.some((r) => r.source === "custom" && r.custom_video_id === customVideoId)) {
      toast.info("Video already added");
      return;
    }
    setRows([
      ...rows,
      {
        id: `new-${Date.now()}`,
        source: "custom",
        category_id: null,
        module_id: null,
        custom_video_id: customVideoId,
        display_order: rows.length + 1,
      },
    ]);
  };

  const save = async () => {
    if (!currentAgencyId) return;
    setSaving(true);
    try {
      // Upsert title
      if (pageTitle !== savedTitle) {
        const { data: existing } = await supabase
          .from("simple_page_settings")
          .select("id")
          .eq("agency_id", currentAgencyId)
          .maybeSingle();
        if (existing) {
          await supabase
            .from("simple_page_settings")
            .update({ page_title: pageTitle || null })
            .eq("agency_id", currentAgencyId);
        } else {
          await supabase.from("simple_page_settings").insert({
            agency_id: currentAgencyId,
            page_title: pageTitle || null,
          });
        }
        setSavedTitle(pageTitle);
      }

      // Replace videos
      await supabase.from("simple_page_videos").delete().eq("agency_id", currentAgencyId);
      if (rows.length > 0) {
        const insertRows = rows.map((r, i) => ({
          agency_id: currentAgencyId,
          source: r.source,
          category_id: r.source === "standard" ? r.category_id : null,
          module_id: r.source === "standard" ? r.module_id : null,
          custom_video_id: r.source === "custom" ? r.custom_video_id : null,
          display_order: i + 1,
        }));
        const { error } = await supabase.from("simple_page_videos").insert(insertRows);
        if (error) throw error;
      }
      toast.success("Saved!");
      // refresh ids
      const { data } = await supabase
        .from("simple_page_videos")
        .select("id, source, category_id, module_id, custom_video_id, display_order")
        .eq("agency_id", currentAgencyId)
        .order("display_order", { ascending: true });
      setRows((data || []) as PageVideoRow[]);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const publicUrl = currentAgencyId ? `${PUBLIC_BASE}/${currentAgencyId}` : "";

  const planLabel = (p: Plan) => (p === "plan1" ? "Plan 1" : p === "plan2" ? "Plan 2" : "Plan 3");
  const availablePlans: Plan[] = (["plan1", "plan2", "plan3"] as Plan[]).filter((p) => {
    if (p === "plan1") return !!agencyVersions.basic_id;
    if (p === "plan2") return !!agencyVersions.advanced_id;
    return !!agencyVersions.elite_id;
  });

  const [libraryTab, setLibraryTab] = useState<"standard" | "custom">("standard");

  const planSelect =
    availablePlans.length > 1 ? (
      <Select value={selectedPlan} onValueChange={(v) => { if (v === "plan1" || (plan === "ADVANCED" && connection.connected)) setSelectedPlan(v as Plan); }}>
        <SelectTrigger className="h-11 w-full lg:w-[150px]" aria-label="Plan you are editing"><SelectValue /></SelectTrigger>
        <SelectContent>
          {availablePlans.map((p) => (
            <SelectItem key={p} value={p} disabled={p !== "plan1" && (plan !== "ADVANCED" || !connection.connected)}>{planLabel(p)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    ) : undefined;

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        eyebrow="Client Hub"
        title="Simplified Onboarding"
        subtitle="One page with only the videos you pick. Use it instead of Hub Pages when a client just needs to watch a few videos, without Home or Support."
      />

      {!connection.connected && <MultiPlanConnectionNotice />}

      {!currentAgencyId ? (
        <div className="px-surface">
          <EmptyState
            icon={<HubEmptyIcon><Link2 className="size-6" /></HubEmptyIcon>}
            title="Create your hub link first"
            description="Simplified Onboarding uses the same link as your hub. Set it up in Hub Pages, then come back."
            action={
              <Button
                variant="accent"
                onClick={() => window.dispatchEvent(new CustomEvent("tipbot-select-tool", { detail: { tool: "client-hub" } }))}
              >
                Open Hub Pages
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <HubLinkBar
            label="Page link"
            url={publicUrl}
            planSelect={planSelect}
            onCopy={() => { navigator.clipboard.writeText(publicUrl); toast.success("Copied"); }}
            onOpen={() => window.open(publicUrl, "_blank")}
          />

          <Reveal className="grid min-w-0 items-start gap-4 lg:grid-cols-2">
            <RevealItem className="space-y-4">
              <SectionCard
                icon={<Type />}
                title="Page title"
                description='Shown at the top of the page. Leave it blank to use "Software Onboarding".'
              >
                <Label htmlFor="simple-page-title" className="sr-only">Page title</Label>
                <Input
                  id="simple-page-title"
                  value={pageTitle}
                  onChange={(e) => setPageTitle(e.target.value)}
                  placeholder="Software Onboarding"
                />
              </SectionCard>

              <SectionCard
                icon={<ListVideo />}
                title="Videos on this page"
                description="Clients watch them top to bottom. Use the arrows to reorder."
                actions={
                  !loading && !loadError && rows.length > 0 ? (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {rows.length} video{rows.length === 1 ? "" : "s"}
                    </span>
                  ) : null
                }
              >
                {loadError ? (
                  <LoadNotice error={loadError} onRetry={() => setLoadAttempt((attempt) => attempt + 1)} />
                ) : loading ? (
                  <HubListSkeleton rows={4} />
                ) : rows.length === 0 ? (
                  <EmptyState
                    className="py-8"
                    icon={<HubEmptyIcon><ListVideo className="size-6" /></HubEmptyIcon>}
                    title="No videos yet"
                    description="Add videos from the library and they line up here in the order clients will watch them."
                  />
                ) : (
                  <ol className="space-y-2">
                    <AnimatePresence initial={false}>
                      {rows.map((r, idx) => (
                        <motion.li
                          key={r.id}
                          layout
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          transition={SPRING_SOFT}
                        >
                          <HubRow
                            leading={
                              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
                                {idx + 1}
                              </span>
                            }
                            title={r.source === "standard" ? (moduleLabel(r.category_id, r.module_id).split(" → ")[1] ?? moduleLabel(r.category_id, r.module_id)) : customLabel(r.custom_video_id)}
                            meta={r.source === "custom" ? "Your video" : (moduleLabel(r.category_id, r.module_id).split(" → ")[1] ? moduleLabel(r.category_id, r.module_id).split(" → ")[0] : "Standard video")}
                            trailing={
                              <>
                                <Button size="icon" aria-label="Move up" variant="ghost" className="size-9" onClick={() => move(idx, -1)} disabled={idx === 0}>
                                  <ArrowUp className="size-4" />
                                </Button>
                                <Button size="icon" aria-label="Move down" variant="ghost" className="size-9" onClick={() => move(idx, 1)} disabled={idx === rows.length - 1}>
                                  <ArrowDown className="size-4" />
                                </Button>
                                <Button size="icon" aria-label="Delete" variant="ghost" className="size-9 text-muted-foreground hover:text-destructive" onClick={() => removeRow(idx)}>
                                  <Trash2 className="size-4" />
                                </Button>
                              </>
                            }
                          />
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ol>
                )}
              </SectionCard>
            </RevealItem>

            <RevealItem>
              <SectionCard
                icon={<Library />}
                title="Video library"
                description="Add any video to the page. Your own videos come from Education in Hub Pages."
              >
                <AnimatedTabs
                  variant="segment"
                  layoutId="simple-onboarding-library"
                  className="mb-3 flex w-full"
                  activeTab={libraryTab}
                  onChange={(id) => setLibraryTab(id as "standard" | "custom")}
                  tabs={[
                    { id: "standard", label: "Standard" },
                    { id: "custom", label: `Yours (${customVideos.length})` },
                  ]}
                />
                <div className="-mr-2 max-h-[520px] space-y-4 overflow-auto pr-2">
                  {libraryTab === "standard" ? (
                    VIDEO_CATEGORIES.map((cat) => (
                      <div key={cat.id}>
                        <h3 className="px-eyebrow mb-1">{cat.name}</h3>
                        <div className="divide-y divide-border">
                          {cat.modules.map((m) => {
                            const added = rows.some((r) => r.source === "standard" && r.category_id === cat.id && r.module_id === m.id);
                            return (
                              <div key={m.id} className="flex min-h-11 min-w-0 items-center justify-between gap-2 py-1.5 text-sm">
                                <span className="min-w-0 flex-1 truncate">{m.name}</span>
                                <Button size="sm" className="shrink-0" variant={added ? "ghost" : "outline"} disabled={added} onClick={() => addStandard(cat.id, m.id)}>
                                  {added ? <><Check className="size-3.5" /> Added</> : <><Plus className="size-3.5" /> Add</>}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  ) : customVideos.length === 0 ? (
                    <EmptyState
                      className="py-8"
                      icon={<HubEmptyIcon><Video className="size-6" /></HubEmptyIcon>}
                      title="No videos of your own yet"
                      description="Upload a custom video in Hub Pages, under Education, and it appears here."
                      action={
                        <Button
                          variant="outline"
                          onClick={() => window.dispatchEvent(new CustomEvent("tipbot-select-tool", { detail: { tool: "client-hub" } }))}
                        >
                          Open Hub Pages
                        </Button>
                      }
                    />
                  ) : (
                    <div className="divide-y divide-border">
                      {customVideos.map((v) => {
                        const added = rows.some((r) => r.source === "custom" && r.custom_video_id === v.id);
                        return (
                          <div key={v.id} className="flex min-h-11 min-w-0 items-center justify-between gap-2 py-1.5 text-sm">
                            <span className="min-w-0 flex-1 truncate">{v.title}</span>
                            <Button size="sm" className="shrink-0" variant={added ? "ghost" : "outline"} disabled={added} onClick={() => addCustom(v.id)}>
                              {added ? <><Check className="size-3.5" /> Added</> : <><Plus className="size-3.5" /> Add</>}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </SectionCard>
            </RevealItem>
          </Reveal>

          <div className="px-glass sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 shadow-raised">
            <p className="min-w-0 flex-1 basis-48 text-sm text-muted-foreground">
              Saves the title and video order for {planLabel(selectedPlan)}.
            </p>
            <Button variant="accent" onClick={save} disabled={saving}>
              <Save className="size-4" />
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default SimpleOnboardingManager;