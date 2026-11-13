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
import { ArrowDown, ArrowUp, Copy, ExternalLink, Save, Trash2 } from "lucide-react";
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

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Simplified Onboarding"
        subtitle='A single page with just the videos you choose. The default header is "Software Onboarding".'
      />

      {availablePlans.length > 1 && (
        <div className="flex items-center gap-2">
          <Label className="text-sm">Editing:</Label>
          <Select value={selectedPlan} onValueChange={(v) => { if (v === "plan1" || (plan === "ADVANCED" && connection.connected)) setSelectedPlan(v as Plan); }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {availablePlans.map((p) => (
                <SelectItem key={p} value={p} disabled={p !== "plan1" && (plan !== "ADVANCED" || !connection.connected)}>{planLabel(p)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!connection.connected && <MultiPlanConnectionNotice />}

      {!currentAgencyId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Create an agency URL first in the Client Hub to use Simplified Onboarding.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Public Page</CardTitle>
              <CardDescription>Share this link with your clients.</CardDescription>
            </CardHeader>
            <CardContent className="flex min-w-0 flex-col gap-2 md:flex-row">
              <Input value={publicUrl} readOnly className="min-w-0 w-full font-mono text-sm" />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Copied"); }}>
                  <Copy className="w-4 h-4 mr-1" /> Copy
                </Button>
                <Button variant="outline" onClick={() => window.open(publicUrl, "_blank")}>
                  <ExternalLink className="w-4 h-4 mr-1" /> Open
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Page Title</CardTitle>
              <CardDescription>Leave blank to use the default "Software Onboarding".</CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                value={pageTitle}
                onChange={(e) => setPageTitle(e.target.value)}
                placeholder="Software Onboarding"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Videos on this page</CardTitle>
              <CardDescription>Drag-style ordering with up/down. Add from the lists below.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {loadError ? (
                <LoadNotice error={loadError} onRetry={() => setLoadAttempt((attempt) => attempt + 1)} />
              ) : loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No videos added yet. Add some from below.</p>
              ) : (
                rows.map((r, idx) => (
                  <div key={r.id} className="flex min-w-0 items-center gap-2 rounded-lg border bg-muted/30 p-3">
                    <Badge variant={r.source === "custom" ? "default" : "secondary"} className="shrink-0 capitalize">{r.source}</Badge>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {r.source === "standard" ? moduleLabel(r.category_id, r.module_id) : customLabel(r.custom_video_id)}
                    </span>
                    <Button size="icon" aria-label="Move up" variant="ghost" onClick={() => move(idx, -1)} disabled={idx === 0}>
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <Button size="icon" aria-label="Move down" variant="ghost" onClick={() => move(idx, 1)} disabled={idx === rows.length - 1}>
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                    <Button size="icon" aria-label="Delete" variant="ghost" onClick={() => removeRow(idx)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle className="text-base">Add Standard Videos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 max-h-[500px] overflow-auto">
                {VIDEO_CATEGORIES.map((cat) => (
                  <div key={cat.id}>
                    <h4 className="font-semibold text-sm mb-2">{cat.name}</h4>
                    <div className="space-y-1">
                      {cat.modules.map((m) => {
                        const added = rows.some((r) => r.source === "standard" && r.category_id === cat.id && r.module_id === m.id);
                        return (
                          <div key={m.id} className="flex min-w-0 items-center justify-between gap-2 py-1 text-sm">
                            <span className="min-w-0 flex-1 truncate">{m.name}</span>
                            <Button size="sm" className="shrink-0" variant={added ? "secondary" : "outline"} disabled={added} onClick={() => addStandard(cat.id, m.id)}>
                              {added ? "Added" : "Add"}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader>
                <CardTitle className="text-base">Add Custom Videos</CardTitle>
                <CardDescription>Uploaded via Custom Videos in Client Hub.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 max-h-[500px] overflow-auto">
                {customVideos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No custom videos yet.</p>
                ) : (
                  customVideos.map((v) => {
                    const added = rows.some((r) => r.source === "custom" && r.custom_video_id === v.id);
                    return (
                      <div key={v.id} className="flex items-center justify-between text-sm py-1">
                        <span className="truncate flex-1">{v.title}</span>
                        <Button size="sm" variant={added ? "secondary" : "outline"} disabled={added} onClick={() => addCustom(v.id)}>
                          {added ? "Added" : "Add"}
                        </Button>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default SimpleOnboardingManager;