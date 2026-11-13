import { newUi } from "@/lib/uiVersion";
import { PageHeader } from "@/components/platform/PageHeader";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useUser } from "@/contexts/UserContext";
import { transcribeVideoOnSave, TranscribeOnSaveCheckbox } from "@/lib/transcribeOnSave";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  BookOpen,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Info,
  Pencil,
  Plus,
  Check,
  X,
  RefreshCw,
  Play,
  Save,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useGhl } from "@/components/highlevel/useGhl";
import { toast } from "sonner";
import { VIDEO_CATEGORIES } from "@/constants/videoCategories";
import { PreviewHeaderHost, PreviewHeaderPortal } from "@/components/client-hub/PreviewHeaderSlot";
import { processTrainingDocContent } from "@/utils/compileTrainingDocContent";

interface AgencyVersions {
  basic_id: string | null;
  advanced_id: string | null;
  elite_id: string | null;
}

interface V3EducationViewProps {
  selectedPlan: "plan1" | "plan2" | "plan3";
  setSelectedPlan: (p: "plan1" | "plan2" | "plan3") => void;
  agencyVersions: AgencyVersions;
  isAdvancedPlan: boolean;
  selectedPlanAgencyId: string | null;
  primaryAgencyId: string | null;
  selectedPlanUrl: string;
  hasSelectedPlanUrl: boolean;
  copyToClipboard: (s: string) => void;
  colors: { primary: string; secondary: string; tertiary: string };
  tabName: string;
  onEditTabName?: (tab: "education" | "home" | "support") => void;
  onSaveTabName: (tab: "education" | "home" | "support", value: string) => Promise<void> | void;
  onOpenCustomVideos: () => void;
  onOpenInstallationGuide: () => void;
  onOpenEditColors: (field?: "primary" | "secondary" | "tertiary") => void;
  livePreviewTab: "education" | "home" | "support" | "popup" | "theme" | "assign";
  setLivePreviewTab: (t: "education" | "home" | "support" | "popup" | "theme" | "assign") => void;
  homeTabName: string;
  supportTabName: string;
  landingPage: "home" | "education" | "support";
  landingOptions: { id: "home" | "education" | "support"; label: string }[];
  onLandingPageChange: (page: "home" | "education" | "support") => void;
  landingDeepLink: "home" | "education" | "support" | null;
  landingDisabled?: boolean;
  onSyncPlans: () => void;
  onLearnMore: () => void;
  onCreatePlanUrl: (version: "basic" | "advanced" | "elite") => void;
  onCustomizeUrl?: () => void;
  isSaving?: boolean;
}

const SUGGESTED_SETUPS: { id: string; label: string; moduleIds: string[] }[] = [
  {
    id: "crm",
    label: "CRM",
    moduleIds: [
      "new-contact",
      "import-contacts",
      "generate-leads",
      "multi-channel",
      "facebook-lead-ads",
      "voice-ai-agent",
    ],
  },
  {
    id: "payments",
    label: "Payments",
    moduleIds: ["stripe-payments", "payment-link", "invoices", "first-product"],
  },
  {
    id: "websites",
    label: "Websites & Automations",
    moduleIds: [
      "professional-website",
      "wordpress-migration",
      "drip-campaigns",
      "documents-contracts",
    ],
  },
  {
    id: "sales",
    label: "Sales",
    moduleIds: [
      "sales-pipeline",
      "email-sync",
      "live-chat",
      "social-messaging",
      "first-campaign",
      "scheduling",
      "sms-campaign",
      "a2p-registration",
      "social-media-planner",
    ],
  },
  { id: "courses", label: "Courses", moduleIds: ["online-course"] },
];

interface CustomVideo {
  id: string;
  title: string;
  description: string;
  module_type: string;
  custom_module_title: string | null;
  existing_module_id: string | null;
  lesson_order: number;
  module_order: number;
  tiers: string[] | null;
  video_url?: string;
  is_embed?: boolean;
}

interface CustomModule {
  id: string;
  agency_id: string;
  title: string;
  sort_order: number;
}

const V3EducationView = ({
  selectedPlan,
  setSelectedPlan,
  agencyVersions,
  isAdvancedPlan,
  selectedPlanAgencyId,
  primaryAgencyId,
  selectedPlanUrl,
  hasSelectedPlanUrl,
  copyToClipboard,
  colors,
  tabName,
  onEditTabName,
  onSaveTabName,
  onOpenCustomVideos,
  onOpenInstallationGuide,
  onOpenEditColors,
  livePreviewTab,
  setLivePreviewTab,
  homeTabName,
  supportTabName,
  landingPage,
  landingOptions,
  onLandingPageChange,
  landingDeepLink,
  landingDisabled,
  onSyncPlans,
  onLearnMore,
  onCreatePlanUrl,
  onCustomizeUrl,
  isSaving,
}: V3EducationViewProps) => {
  const { connected: ghlConnected } = useGhl(primaryAgencyId);
  const landingLabel = (id: "home" | "education" | "support") =>
    id === "education" ? tabName : id === "home" ? homeTabName : supportTabName;
  const tier: "basic" | "advanced" | "elite" =
    selectedPlan === "plan1" ? "basic" : selectedPlan === "plan2" ? "advanced" : "elite";

  // Visibility per module
  const [hiddenModules, setHiddenModules] = useState<Set<string>>(new Set()); // key: `${categoryId}::${moduleId}`
  const [activeSetups, setActiveSetups] = useState<Set<string>>(new Set());
  // selectedCategoryId can be a built-in category id OR a custom module title prefixed with "custom::"
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(VIDEO_CATEGORIES[0].id);
  const [categoryOrder, setCategoryOrder] = useState<string[]>(VIDEO_CATEGORIES.map((c) => c.id));
  const [moduleOrder, setModuleOrder] = useState<Record<string, string[]>>(
    Object.fromEntries(VIDEO_CATEGORIES.map((c) => [c.id, c.modules.map((m) => m.id)])),
  );
  const [customVideos, setCustomVideos] = useState<CustomVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [highlightCustomVideo, setHighlightCustomVideo] = useState(false);
  const [editingTabId, setEditingTabId] = useState<"education" | "home" | "support" | null>(null);
  const [editingTabValue, setEditingTabValue] = useState("");
  const [quickSetupTipOpen, setQuickSetupTipOpen] = useState(false);

  // Inline add-custom-video form state
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const [inlineForm, setInlineForm] = useState({
    title: "",
    description: "",
    videoUrl: "",
    isEmbed: false,
  });
  const [savingInline, setSavingInline] = useState(false);
  // Which plans should the new video apply to (only meaningful for multi-plan users)
  const availablePlanTiers = useMemo(() => {
    const list: { id: "basic" | "advanced" | "elite"; label: string; agencyId: string | null }[] = [
      { id: "basic", label: "Plan 1", agencyId: (agencyVersions as any)?.basic_id ?? null },
      { id: "advanced", label: "Plan 2", agencyId: (agencyVersions as any)?.advanced_id ?? null },
      { id: "elite", label: "Plan 3", agencyId: (agencyVersions as any)?.elite_id ?? null },
    ];
    return list.filter((p) => !!p.agencyId);
  }, [agencyVersions]);
  const [inlinePlanTiers, setInlinePlanTiers] = useState<Set<string>>(new Set([tier]));
  useEffect(() => {
    setInlinePlanTiers(new Set([tier]));
  }, [tier, showInlineAdd]);

  // Add-module dialog state
  const [showAddModuleDialog, setShowAddModuleDialog] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [creatingModule, setCreatingModule] = useState(false);

  // Edit-custom-video dialog state
  const [editingVideo, setEditingVideo] = useState<CustomVideo | null>(null);
  const [editVideoForm, setEditVideoForm] = useState({
    title: "",
    description: "",
    videoUrl: "",
    isEmbed: false,
  });
  const [savingEditVideo, setSavingEditVideo] = useState(false);

  // Stored custom modules (empty or with videos)
  const [storedCustomModules, setStoredCustomModules] = useState<CustomModule[]>([]);
  // Stored sort orders for built-in modules per category
  const [moduleSortOrders, setModuleSortOrders] = useState<Record<string, number>>({}); // key `${cat}::${mod}` -> sort_order
  // Per-plan category-level order + rename overrides
  const [categoryOrders, setCategoryOrders] = useState<Record<string, number>>({}); // key = builtin id or `custom::<title>` -> sort_order
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({}); // same key -> display_name override
  // Per-plan built-in module rename overrides
  const [moduleNameOverrides, setModuleNameOverrides] = useState<Record<string, string>>({}); // key `${cat}::${mod}` -> display_name
  // Inline rename state (shared across category + module rows)
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState("");
  // Drag state for reordering left-rail categories
  const [dragCategoryKey, setDragCategoryKey] = useState<string | null>(null);

  const commitTabName = async () => {
    if (!editingTabId) return;
    const v = editingTabValue.trim();
    if (v) await onSaveTabName(editingTabId, v);
    setEditingTabId(null);
    setEditingTabValue("");
  };

  useEffect(() => {
    const handler = () => {
      setHighlightCustomVideo(true);
      setTimeout(() => setHighlightCustomVideo(false), 1800);
      // Scroll the button into view
      setTimeout(() => {
        document
          .getElementById("v3-add-custom-video")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    };
    window.addEventListener("lkx:highlight-custom-video", handler);
    return () => window.removeEventListener("lkx:highlight-custom-video", handler);
  }, []);

  // Load video settings + custom videos
  useEffect(() => {
    const load = async () => {
      if (!selectedPlanAgencyId) {
        setHiddenModules(new Set());
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const { data: settings } = await supabase
          .from("agency_video_settings")
          .select("category_id,module_id,is_visible,sort_order")
          .eq("agency_id", selectedPlanAgencyId)
          .eq("tier", tier);
        const hidden = new Set<string>();
        const orders: Record<string, number> = {};
        (settings || []).forEach((s: any) => {
          if (s.is_visible === false) hidden.add(`${s.category_id}::${s.module_id}`);
          if (typeof s.sort_order === "number")
            orders[`${s.category_id}::${s.module_id}`] = s.sort_order;
        });
        setHiddenModules(hidden);
        setModuleSortOrders(orders);

        // Category-level order + rename overrides
        const { data: catSettings } = await supabase
          .from("agency_category_settings" as any)
          .select("category_key,sort_order,display_name")
          .eq("agency_id", selectedPlanAgencyId)
          .eq("tier", tier);
        const catOrders: Record<string, number> = {};
        const catNames: Record<string, string> = {};
        (catSettings as any[] | null | undefined)?.forEach((s: any) => {
          if (typeof s.sort_order === "number") catOrders[s.category_key] = s.sort_order;
          if (s.display_name) catNames[s.category_key] = s.display_name;
        });
        setCategoryOrders(catOrders);
        setCategoryNames(catNames);

        // Built-in module rename overrides
        const { data: nameOverrides } = await supabase
          .from("agency_module_name_overrides" as any)
          .select("category_id,module_id,display_name")
          .eq("agency_id", selectedPlanAgencyId)
          .eq("tier", tier);
        const overrides: Record<string, string> = {};
        (nameOverrides as any[] | null | undefined)?.forEach((s: any) => {
          overrides[`${s.category_id}::${s.module_id}`] = s.display_name;
        });
        setModuleNameOverrides(overrides);

        const { data: videos } = await supabase
          .from("custom_onboarding_videos")
          .select("*")
          .eq("agency_id", primaryAgencyId || "__none__")
          .order("lesson_order", { ascending: true });
        if (videos) {
          const filtered = (videos as CustomVideo[]).filter((v) => (v.tiers || []).includes(tier));
          setCustomVideos(filtered);
        }

        if (primaryAgencyId) {
          const { data: mods } = await supabase
            .from("custom_modules" as any)
            .select("*")
            .eq("agency_id", primaryAgencyId)
            .order("sort_order", { ascending: true });
          setStoredCustomModules((mods as any) || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [selectedPlanAgencyId, tier, primaryAgencyId]);

  const isModuleVisible = (categoryId: string, moduleId: string) =>
    !hiddenModules.has(`${categoryId}::${moduleId}`);

  const scheduleRag = () => {
    if (!selectedPlanAgencyId) return;
    clearTimeout((window as any).__v3RagTimer);
    (window as any).__v3RagTimer = setTimeout(() => {
      processTrainingDocContent(selectedPlanAgencyId, tier);
    }, 2000);
  };

  const setModuleVisibility = async (categoryId: string, moduleId: string, visible: boolean) => {
    if (!selectedPlanAgencyId) {
      toast.error("Create this plan's URL first");
      return;
    }
    try {
      if (visible) {
        await supabase.rpc("delete_agency_video_setting", {
          agency_id_param: selectedPlanAgencyId,
          category_id_param: categoryId,
          module_id_param: moduleId,
          tier_param: tier,
        });
      } else {
        await supabase.rpc("save_agency_video_setting", {
          agency_id_param: selectedPlanAgencyId,
          category_id_param: categoryId,
          module_id_param: moduleId,
          is_visible_param: false,
          tier_param: tier,
        });
      }
      setHiddenModules((prev) => {
        const next = new Set(prev);
        const key = `${categoryId}::${moduleId}`;
        if (visible) next.delete(key);
        else next.add(key);
        return next;
      });
      scheduleRag();
    } catch (e) {
      console.error(e);
      toast.error("Failed to update video");
    }
  };

  const toggleCategory = async (categoryId: string) => {
    const cat = VIDEO_CATEGORIES.find((c) => c.id === categoryId)!;
    const allVisible = cat.modules.every((m) => isModuleVisible(categoryId, m.id));
    for (const m of cat.modules) {
      const currentlyVisible = isModuleVisible(categoryId, m.id);
      if (allVisible && currentlyVisible) await setModuleVisibility(categoryId, m.id, false);
      else if (!allVisible && !currentlyVisible) await setModuleVisibility(categoryId, m.id, true);
    }
  };

  const handleSetupToggle = async (setupId: string) => {
    const next = new Set(activeSetups);
    const setup = SUGGESTED_SETUPS.find((s) => s.id === setupId)!;
    // Local working copy so awaited iterations see up-to-date visibility
    const working = new Set(hiddenModules);
    const visibleNow = (catId: string, modId: string) => !working.has(`${catId}::${modId}`);
    const setVis = async (catId: string, modId: string, vis: boolean) => {
      const key = `${catId}::${modId}`;
      if (vis) working.delete(key);
      else working.add(key);
      await setModuleVisibility(catId, modId, vis);
    };

    if (next.has(setupId)) {
      next.delete(setupId);
      setActiveSetups(next);
      if (next.size === 0) {
        for (const cat of VIDEO_CATEGORIES) {
          for (const m of cat.modules) {
            if (!visibleNow(cat.id, m.id)) await setVis(cat.id, m.id, true);
          }
        }
      } else {
        const otherIds = new Set<string>();
        for (const sid of next) {
          SUGGESTED_SETUPS.find((s) => s.id === sid)!.moduleIds.forEach((id) => otherIds.add(id));
        }
        for (const moduleId of setup.moduleIds) {
          if (!otherIds.has(moduleId)) {
            for (const cat of VIDEO_CATEGORIES) {
              const mod = cat.modules.find((m) => m.id === moduleId);
              if (mod && visibleNow(cat.id, mod.id)) await setVis(cat.id, mod.id, false);
            }
          }
        }
      }
    } else {
      const isFirst = next.size === 0;
      next.add(setupId);
      setActiveSetups(next);
      if (isFirst) {
        for (const cat of VIDEO_CATEGORIES) {
          for (const m of cat.modules) {
            if (visibleNow(cat.id, m.id)) await setVis(cat.id, m.id, false);
          }
        }
      }
      for (const moduleId of setup.moduleIds) {
        for (const cat of VIDEO_CATEGORIES) {
          const mod = cat.modules.find((m) => m.id === moduleId);
          if (mod && !visibleNow(cat.id, mod.id)) await setVis(cat.id, mod.id, true);
        }
      }
    }
  };

  // Unified left-rail category list (built-in + custom, interleaved by sort_order)
  interface CategoryRow {
    key: string; // built-in id OR `custom::<title>`
    kind: "builtin" | "custom";
    defaultName: string;
    displayName: string;
    builtinId?: string;
    customTitle?: string;
  }

  const customTitlesForList = useMemo(() => {
    const fromVideos = customVideos
      .filter((v) => v.module_type === "custom" && v.custom_module_title)
      .map((v) => v.custom_module_title!);
    const fromStored = storedCustomModules.map((m) => m.title);
    return Array.from(new Set([...fromStored, ...fromVideos]));
  }, [customVideos, storedCustomModules]);

  const orderedCategories = useMemo<CategoryRow[]>(() => {
    const rows: CategoryRow[] = [];
    VIDEO_CATEGORIES.forEach((c, i) => {
      const key = c.id;
      rows.push({
        key,
        kind: "builtin",
        defaultName: c.name,
        displayName: categoryNames[key] ?? c.name,
        builtinId: c.id,
      });
    });
    customTitlesForList.forEach((title) => {
      const key = `custom::${title}`;
      rows.push({
        key,
        kind: "custom",
        defaultName: title,
        displayName: categoryNames[key] ?? title,
        customTitle: title,
      });
    });
    // Assign a fallback sort_order: built-ins first (0..N-1) then customs (N..)
    rows.sort((a, b) => {
      const ao = categoryOrders[a.key];
      const bo = categoryOrders[b.key];
      if (ao != null && bo != null) return ao - bo;
      if (ao != null) return -1;
      if (bo != null) return 1;
      // both unset → keep declared order (built-ins before customs)
      return 0;
    });
    return rows;
  }, [customTitlesForList, categoryNames, categoryOrders]);

  const [dragCustomId, setDragCustomId] = useState<string | null>(null);
  const [dragBuiltinId, setDragBuiltinId] = useState<string | null>(null);

  const persistCategoryOrder = async (rows: CategoryRow[]) => {
    if (!selectedPlanAgencyId) return;
    try {
      await Promise.all(
        rows.map((r, idx) =>
          supabase.from("agency_category_settings" as any).upsert(
            {
              agency_id: selectedPlanAgencyId,
              tier,
              category_key: r.key,
              sort_order: idx,
              display_name: categoryNames[r.key] ?? null,
            },
            { onConflict: "agency_id,tier,category_key" } as any,
          ),
        ),
      );
      const next: Record<string, number> = {};
      rows.forEach((r, idx) => {
        next[r.key] = idx;
      });
      setCategoryOrders(next);
    } catch (e) {
      console.error(e);
      toast.error("Failed to save category order");
    }
  };

  const onDropCategory = (targetKey: string) => {
    if (!dragCategoryKey || dragCategoryKey === targetKey) return;
    const rows = [...orderedCategories];
    const fromIdx = rows.findIndex((r) => r.key === dragCategoryKey);
    const toIdx = rows.findIndex((r) => r.key === targetKey);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = rows.splice(fromIdx, 1);
    rows.splice(toIdx, 0, moved);
    setDragCategoryKey(null);
    persistCategoryOrder(rows);
  };

  const beginRename = (key: string, currentValue: string) => {
    setRenamingKey(key);
    setRenamingValue(currentValue);
  };

  const commitCategoryRename = async (row: CategoryRow) => {
    const raw = renamingValue.trim();
    setRenamingKey(null);
    if (!raw || raw === row.displayName) return;
    if (row.kind === "builtin") {
      if (!selectedPlanAgencyId) {
        toast.error("Create this plan's URL first");
        return;
      }
      try {
        await supabase.from("agency_category_settings" as any).upsert(
          {
            agency_id: selectedPlanAgencyId,
            tier,
            category_key: row.key,
            sort_order:
              categoryOrders[row.key] ?? orderedCategories.findIndex((r) => r.key === row.key),
            display_name: raw,
          },
          { onConflict: "agency_id,tier,category_key" } as any,
        );
        setCategoryNames((prev) => ({ ...prev, [row.key]: raw }));
        toast.success("Category renamed");
      } catch (e) {
        console.error(e);
        toast.error("Failed to rename category");
      }
    } else {
      // Custom module: rename the module across all rows + reflect in category_key
      if (!primaryAgencyId) return;
      const oldTitle = row.customTitle!;
      if (raw === oldTitle) return;
      try {
        await supabase
          .from("custom_modules" as any)
          .update({ title: raw })
          .eq("agency_id", primaryAgencyId)
          .eq("title", oldTitle);
        await supabase
          .from("custom_onboarding_videos")
          .update({ custom_module_title: raw })
          .eq("agency_id", primaryAgencyId)
          .eq("custom_module_title", oldTitle);
        setStoredCustomModules((prev) =>
          prev.map((m) => (m.title === oldTitle ? { ...m, title: raw } : m)),
        );
        setCustomVideos((prev) =>
          prev.map((v) =>
            v.custom_module_title === oldTitle ? { ...v, custom_module_title: raw } : v,
          ),
        );
        // Migrate any per-plan overrides (order/name) from old key to new key
        const oldKey = `custom::${oldTitle}`;
        const newKey = `custom::${raw}`;
        setCategoryOrders((prev) => {
          if (!(oldKey in prev)) return prev;
          const next = { ...prev };
          next[newKey] = next[oldKey];
          delete next[oldKey];
          return next;
        });
        setCategoryNames((prev) => {
          const next = { ...prev };
          if (oldKey in next) {
            next[newKey] = next[oldKey];
            delete next[oldKey];
          }
          return next;
        });
        if (selectedCategoryId === oldKey) setSelectedCategoryId(newKey);
        toast.success("Module renamed");
        scheduleRag();
      } catch (e) {
        console.error(e);
        toast.error("Failed to rename module");
      }
    }
  };

  const commitModuleRename = async (categoryId: string, moduleId: string, defaultName: string) => {
    const raw = renamingValue.trim();
    setRenamingKey(null);
    if (!raw) return;
    if (!selectedPlanAgencyId) {
      toast.error("Create this plan's URL first");
      return;
    }
    try {
      if (raw === defaultName) {
        await supabase
          .from("agency_module_name_overrides" as any)
          .delete()
          .eq("agency_id", selectedPlanAgencyId)
          .eq("tier", tier)
          .eq("category_id", categoryId)
          .eq("module_id", moduleId);
        setModuleNameOverrides((prev) => {
          const next = { ...prev };
          delete next[`${categoryId}::${moduleId}`];
          return next;
        });
      } else {
        await supabase.from("agency_module_name_overrides" as any).upsert(
          {
            agency_id: selectedPlanAgencyId,
            tier,
            category_id: categoryId,
            module_id: moduleId,
            display_name: raw,
          },
          { onConflict: "agency_id,tier,category_id,module_id" } as any,
        );
        setModuleNameOverrides((prev) => ({ ...prev, [`${categoryId}::${moduleId}`]: raw }));
      }
      scheduleRag();
    } catch (e) {
      console.error(e);
      toast.error("Failed to rename module");
    }
  };

  const persistCustomVideoOrder = async (ordered: CustomVideo[]) => {
    try {
      await Promise.all(
        ordered.map((v, idx) =>
          supabase
            .from("custom_onboarding_videos")
            .update({ lesson_order: idx + 1 })
            .eq("id", v.id),
        ),
      );
    } catch (e) {
      console.error(e);
      toast.error("Failed to save video order");
    }
  };

  const onDropCustomVideo = (targetId: string) => {
    if (!dragCustomId || dragCustomId === targetId) return;
    const list = [...customVideos];
    const fromIdx = list.findIndex((v) => v.id === dragCustomId);
    const toIdx = list.findIndex((v) => v.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    setCustomVideos(list);
    setDragCustomId(null);
    persistCustomVideoOrder(list);
  };

  const isCustomSelection = selectedCategoryId.startsWith("custom::");
  const selectedCustomTitle = isCustomSelection
    ? selectedCategoryId.slice("custom::".length)
    : null;
  const selectedCategory = isCustomSelection
    ? null
    : VIDEO_CATEGORIES.find((c) => c.id === selectedCategoryId);
  const selectedCategoryModules = useMemo(() => {
    if (!selectedCategory) return [];
    const mods = [...selectedCategory.modules];
    mods.sort((a, b) => {
      const sa =
        moduleSortOrders[`${selectedCategoryId}::${a.id}`] ??
        selectedCategory.modules.findIndex((x) => x.id === a.id);
      const sb =
        moduleSortOrders[`${selectedCategoryId}::${b.id}`] ??
        selectedCategory.modules.findIndex((x) => x.id === b.id);
      return sa - sb;
    });
    return mods;
  }, [selectedCategory, selectedCategoryId, moduleSortOrders]);

  const customVideosForCategory = isCustomSelection
    ? customVideos.filter(
        (v) => v.module_type === "custom" && v.custom_module_title === selectedCustomTitle,
      )
    : customVideos.filter(
        (v) => v.module_type === "existing" && v.existing_module_id === selectedCategoryId,
      );

  const selectedPanelTitle = (() => {
    const overridden = categoryNames[selectedCategoryId];
    if (overridden) return overridden;
    return isCustomSelection ? selectedCustomTitle : selectedCategory?.name;
  })();
  const customModulesList = useMemo(() => {
    const fromVideos = customVideos
      .filter((v) => v.module_type === "custom" && v.custom_module_title)
      .map((v) => v.custom_module_title!);
    const fromStored = storedCustomModules.map((m) => m.title);
    return Array.from(new Set([...fromStored, ...fromVideos]));
  }, [customVideos, storedCustomModules]);

  const { email } = useUser();
  const [autoTranscribe, setAutoTranscribe] = useState(true);
  const saveInlineVideo = async () => {
    if (!primaryAgencyId) {
      toast.error("Create this plan's URL first");
      return;
    }
    if (!inlineForm.title.trim() || !inlineForm.videoUrl.trim()) {
      toast.error("Title and video URL are required");
      return;
    }
    setSavingInline(true);
    try {
      const existing_module_id = isCustomSelection ? null : selectedCategoryId;
      const custom_module_title = isCustomSelection ? selectedCustomTitle : null;
      const module_type = isCustomSelection ? "custom" : "existing";
      const maxOrder = customVideosForCategory.reduce(
        (acc, v) => Math.max(acc, v.lesson_order || 0),
        0,
      );
      const { data, error } = await supabase
        .from("custom_onboarding_videos")
        .insert({
          agency_id: primaryAgencyId,
          module_type,
          custom_module_title,
          existing_module_id,
          lesson_order: maxOrder + 1,
          module_order: 1,
          title: inlineForm.title.trim(),
          description: inlineForm.description.trim(),
          video_url: inlineForm.videoUrl.trim(),
          is_embed: inlineForm.isEmbed,
          tiers: Array.from(inlinePlanTiers.size > 0 ? inlinePlanTiers : new Set([tier])),
        })
        .select()
        .single();
      if (error) throw error;
      setCustomVideos((prev) => [...prev, data as any]);
      setInlineForm({ title: "", description: "", videoUrl: "", isEmbed: false });
      setShowInlineAdd(false);
      toast.success("Video added");
      if (autoTranscribe && data) {
        const d: any = data;
        transcribeVideoOnSave(d.id, d.title, email, !!d.is_embed).then((ok) => {
          if (ok) scheduleRag();
        });
      }
      scheduleRag();
    } catch (e) {
      console.error(e);
      toast.error("Failed to add video");
    } finally {
      setSavingInline(false);
    }
  };

  const openEditCustomVideo = (v: CustomVideo) => {
    setEditingVideo(v);
    setEditVideoForm({
      title: v.title || "",
      description: v.description || "",
      videoUrl: v.video_url || "",
      isEmbed: !!v.is_embed,
    });
  };

  const saveEditCustomVideo = async () => {
    if (!editingVideo) return;
    if (!editVideoForm.title.trim() || !editVideoForm.videoUrl.trim()) {
      toast.error("Title and video URL are required");
      return;
    }
    setSavingEditVideo(true);
    try {
      const updates = {
        title: editVideoForm.title.trim(),
        description: editVideoForm.description.trim(),
        video_url: editVideoForm.videoUrl.trim(),
        is_embed: editVideoForm.isEmbed,
      };
      const { error } = await supabase
        .from("custom_onboarding_videos")
        .update(updates)
        .eq("id", editingVideo.id);
      if (error) throw error;
      setCustomVideos((prev) =>
        prev.map((x) => (x.id === editingVideo.id ? ({ ...x, ...updates } as any) : x)),
      );
      toast.success("Video updated");
      const edited = editingVideo;
      setEditingVideo(null);
      if (autoTranscribe) {
        transcribeVideoOnSave(edited.id, updates.title, email, updates.is_embed).then((ok) => {
          if (ok) scheduleRag();
        });
      }
      scheduleRag();
    } catch (e) {
      console.error(e);
      toast.error("Failed to update video");
    } finally {
      setSavingEditVideo(false);
    }
  };

  const deleteCustomVideo = async (id: string) => {
    try {
      const { error } = await supabase.from("custom_onboarding_videos").delete().eq("id", id);
      if (error) throw error;
      setCustomVideos((prev) => prev.filter((v) => v.id !== id));
      toast.success("Video removed");
      scheduleRag();
    } catch (e) {
      console.error(e);
      toast.error("Failed to remove video");
    }
  };

  const toggleCustomVideoVisibility = async (v: CustomVideo, visible: boolean) => {
    const currentTiers = (v.tiers || []).filter((t) => t !== tier);
    const newTiers = visible ? [...currentTiers, tier] : currentTiers;
    try {
      const { error } = await supabase
        .from("custom_onboarding_videos")
        .update({ tiers: newTiers })
        .eq("id", v.id);
      if (error) throw error;
      setCustomVideos((prev) => prev.map((x) => (x.id === v.id ? { ...x, tiers: newTiers } : x)));
      scheduleRag();
    } catch (e) {
      console.error(e);
      toast.error("Failed to update video");
    }
  };

  const persistBuiltinOrder = async (catId: string, orderedIds: string[]) => {
    if (!selectedPlanAgencyId) return;
    try {
      await Promise.all(
        orderedIds.map((modId, idx) =>
          supabase.from("agency_video_settings").upsert(
            {
              agency_id: selectedPlanAgencyId,
              category_id: catId,
              module_id: modId,
              tier,
              is_visible: !hiddenModules.has(`${catId}::${modId}`),
              sort_order: idx,
            },
            { onConflict: "agency_id,category_id,module_id,tier" } as any,
          ),
        ),
      );
      const next: Record<string, number> = { ...moduleSortOrders };
      orderedIds.forEach((modId, idx) => {
        next[`${catId}::${modId}`] = idx;
      });
      setModuleSortOrders(next);
    } catch (e) {
      console.error(e);
      toast.error("Failed to save order");
    }
  };

  const onDropBuiltinModule = (targetId: string) => {
    if (!dragBuiltinId || dragBuiltinId === targetId || isCustomSelection) return;
    const ids = selectedCategoryModules.map((m) => m.id);
    const fromIdx = ids.indexOf(dragBuiltinId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, moved);
    setDragBuiltinId(null);
    persistBuiltinOrder(selectedCategoryId, ids);
  };

  const createCustomModule = async () => {
    const title = newModuleTitle.trim();
    if (!title) {
      toast.error("Enter a module name");
      return;
    }
    if (!primaryAgencyId) {
      toast.error("Create this plan's URL first");
      return;
    }
    if (customModulesList.includes(title)) {
      toast.error("A module with that name already exists");
      return;
    }
    setCreatingModule(true);
    try {
      const maxOrder = storedCustomModules.reduce((a, m) => Math.max(a, m.sort_order || 0), 0);
      const { data, error } = await supabase
        .from("custom_modules" as any)
        .insert({ agency_id: primaryAgencyId, title, sort_order: maxOrder + 1 })
        .select()
        .single();
      if (error) throw error;
      setStoredCustomModules((prev) => [...prev, data as any]);
      setSelectedCategoryId(`custom::${title}`);
      setShowAddModuleDialog(false);
      setNewModuleTitle("");
      toast.success("Module created");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to create module");
    } finally {
      setCreatingModule(false);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-4">
      {/* Title stays full width through tablet. Actions wrap underneath it. */}
      <div className="flex w-full min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex w-full min-w-0 items-start gap-3">
          <BookOpen className="mt-1 h-6 w-6 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <PageHeader
              title={newUi ? "Hub Pages" : "Edit Pages"}
              subtitle="Turn training videos on or off for each plan, reorder them, and add your own."
            />
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:max-w-md lg:justify-end">
          <Button variant="outline" size="sm" onClick={onSyncPlans} disabled={!isAdvancedPlan || !ghlConnected}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Sync Plans
          </Button>
          <Button variant="outline" size="sm" onClick={onLearnMore}>
            <Play className="w-4 h-4 mr-1" />
            Learn more
          </Button>
          <Button variant="outline" size="sm" onClick={onOpenInstallationGuide}>
            <BookOpen className="w-4 h-4 mr-1" />
            Installation Guide
          </Button>
        </div>
      </div>

      {/* URL bar */}
      <div
        className="flex w-full min-w-0 flex-wrap items-center gap-2 rounded-lg border bg-white p-3"
        data-tip-target="v3-edu-plan-url"
      >
        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
          Client Hub URL:
        </span>
        <Select value={selectedPlan} onValueChange={(v) => setSelectedPlan(v as any)}>
          <SelectTrigger className="h-8 w-[140px] bg-background text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="plan1">Plan 1</SelectItem>
            <SelectItem value="plan2" disabled={!isAdvancedPlan || !ghlConnected}>
              Plan 2
            </SelectItem>
            <SelectItem value="plan3" disabled={!isAdvancedPlan || !ghlConnected}>
              Plan 3
            </SelectItem>
          </SelectContent>
        </Select>
        {hasSelectedPlanUrl ? (
          <>
            <Input
              value={selectedPlanUrl}
              readOnly
              className="h-8 w-full min-w-0 basis-full cursor-not-allowed bg-muted font-mono text-xs lg:w-auto lg:flex-1 lg:basis-0"
            />
            <Button
              variant="outline"
              size="icon"
              aria-label="Copy"
              className="h-8 w-8 shrink-0"
              onClick={() => copyToClipboard(selectedPlanUrl)}
            >
              <Copy className="w-3.5 h-3.5" />
            </Button>
          </>
        ) : (
          <span className="min-w-0 flex-1 text-xs text-muted-foreground">Setting up your URL…</span>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-8 shrink-0"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent("tipbot-select-tool", { detail: { tool: "settings" } }),
            )
          }
        >
          Agency name
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 shrink-0"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent("tipbot-select-tool", { detail: { tool: "branding" } }),
            )
          }
        >
          Brand colors
        </Button>
      </div>

      {/* Live Preview switcher — portalled into the active page's card header */}
      <PreviewHeaderPortal>
        <div
          className="flex items-center gap-2"
          data-tip-target="v3-edu-tab-names"
          data-testid="hub-open-page"
          data-page={livePreviewTab}
        >
          <span className="text-sm font-medium whitespace-nowrap">Now Editing:</span>
          {editingTabId ? (
            <span className="inline-flex items-center gap-1">
              <Input
                autoFocus
                value={editingTabValue}
                onChange={(e) => setEditingTabValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitTabName();
                  }
                  if (e.key === "Escape") {
                    setEditingTabId(null);
                    setEditingTabValue("");
                  }
                }}
                className="h-9 text-sm w-40 px-2 py-0 bg-white rounded-md"
                style={{ color: "#4F39F6" }}
              />
              <Button
                type="button"
                size="icon"
                className="h-9 w-9"
                onClick={commitTabName}
                aria-label="Save tab name"
              >
                <Save className="w-3.5 h-3.5" />
              </Button>
            </span>
          ) : (
            <>
              {/* Pages are laid out as a segmented control so Education, Home
                  and Support are one click away instead of hidden in a dropdown. */}
              <div className="flex flex-wrap items-center gap-1 rounded-md bg-muted p-1">
                {(
                  [
                    { id: "education", label: tabName },
                    { id: "home", label: homeTabName },
                    { id: "support", label: supportTabName },
                    ...(ghlConnected ? [{ id: "assign", label: "Assign to Sub Account" }] : []),
                  ] as const
                ).map((page) => (
                  <button
                    key={page.id}
                    type="button"
                    aria-pressed={livePreviewTab === page.id}
                    onClick={() => setLivePreviewTab(page.id as any)}
                    className={`h-7 rounded px-3 text-sm transition-colors duration-150 ${
                      livePreviewTab === page.id
                        ? "bg-background text-foreground font-medium shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {page.label}
                  </button>
                ))}
              </div>
              {livePreviewTab !== "popup" &&
                livePreviewTab !== "theme" &&
                livePreviewTab !== "assign" && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    aria-label="Rename this page"
                    onClick={() => {
                      setEditingTabId(livePreviewTab);
                      setEditingTabValue(
                        livePreviewTab === "education"
                          ? tabName
                          : livePreviewTab === "home"
                            ? homeTabName
                            : supportTabName,
                      );
                    }}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                )}
            </>
          )}
        </div>
      </PreviewHeaderPortal>

      {/* Software Onboarding card */}
      {livePreviewTab === "education" && (
        <div className="border rounded-lg bg-background" data-tip-target="v3-edu-video-list">
          <div className="px-4 py-3 border-b shadow-sm flex items-center justify-between gap-3 flex-wrap">
            <PreviewHeaderHost />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr]">
            {/* LEFT: Quick Setup + Learning Modules */}
            <div className="border-r p-4 space-y-5">
              {/* Quick Set Up */}
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <h3 className="text-sm font-semibold text-foreground">Quick Set Up</h3>
                  <TooltipProvider delayDuration={100}>
                    <Tooltip open={quickSetupTipOpen} onOpenChange={setQuickSetupTipOpen}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setQuickSetupTipOpen((o) => !o)}
                          onMouseEnter={() => setQuickSetupTipOpen(true)}
                          onMouseLeave={() => setQuickSetupTipOpen(false)}
                          className="inline-flex items-center justify-center"
                          aria-label="About quick set up"
                        >
                          <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs">
                          Click a preset to instantly enable only the videos relevant to that
                          workflow. Combine multiple presets to build a tailored experience for your
                          clients.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTED_SETUPS.map((setup) => {
                    const isActive = activeSetups.has(setup.id);
                    return (
                      <button
                        key={setup.id}
                        onClick={() => handleSetupToggle(setup.id)}
                        disabled={!hasSelectedPlanUrl}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                          isActive
                            ? "border-purple-400 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 text-purple-700 ring-1 ring-purple-400/50"
                            : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                        } ${!hasSelectedPlanUrl ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        {setup.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Learning Modules */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Learning Modules</h3>
                <div className="space-y-2">
                  {orderedCategories.map((row) => {
                    const isSelected = selectedCategoryId === row.key;
                    const isRenaming = renamingKey === `cat::${row.key}`;
                    let dots: React.ReactNode = null;
                    let allHidden = false;
                    if (row.kind === "builtin") {
                      const cat = VIDEO_CATEGORIES.find((c) => c.id === row.builtinId!)!;
                      const visibleCount = cat.modules.filter((m) =>
                        isModuleVisible(cat.id, m.id),
                      ).length;
                      allHidden = visibleCount === 0;
                      dots = cat.modules.map((m) => (
                        <span
                          key={m.id}
                          className={`w-1.5 h-1.5 rounded-full ${
                            isModuleVisible(cat.id, m.id)
                              ? "bg-green-500"
                              : "bg-muted-foreground/30"
                          }`}
                        />
                      ));
                    } else {
                      const titleVideos = customVideos.filter(
                        (v) =>
                          v.module_type === "custom" && v.custom_module_title === row.customTitle,
                      );
                      const visibleCount = titleVideos.filter((v) =>
                        (v.tiers || []).includes(tier),
                      ).length;
                      allHidden = titleVideos.length > 0 && visibleCount === 0;
                      dots = titleVideos.map((v) => (
                        <span
                          key={v.id}
                          className={`w-1.5 h-1.5 rounded-full ${
                            (v.tiers || []).includes(tier)
                              ? "bg-green-500"
                              : "bg-muted-foreground/30"
                          }`}
                        />
                      ));
                    }
                    return (
                      <div
                        key={row.key}
                        draggable={!isRenaming}
                        onDragStart={() => setDragCategoryKey(row.key)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => onDropCategory(row.key)}
                        onClick={() => !isRenaming && setSelectedCategoryId(row.key)}
                        className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? "border-purple-400 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 shadow-[0_0_18px_rgba(139,92,246,0.35)] ring-1 ring-purple-400/50"
                            : "border-border bg-muted/30 hover:bg-muted/50"
                        } ${allHidden ? "opacity-60" : ""}`}
                      >
                        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50 cursor-grab shrink-0" />
                        {row.kind === "builtin" ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCategory(row.builtinId!);
                            }}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {allHidden ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4 text-primary" />
                            )}
                          </button>
                        ) : null}
                        <div className="flex-1 min-w-0">
                          {isRenaming ? (
                            <div
                              className="flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Input
                                autoFocus
                                value={renamingValue}
                                onChange={(e) => setRenamingValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    commitCategoryRename(row);
                                  }
                                  if (e.key === "Escape") {
                                    setRenamingKey(null);
                                  }
                                }}
                                className="h-6 text-xs px-2"
                              />
                              <Button
                                type="button"
                                size="icon"
                                aria-label="Confirm"
                                className="h-6 w-6"
                                onClick={() => commitCategoryRename(row)}
                              >
                                <Check className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-semibold truncate">{row.displayName}</p>
                              {row.kind === "custom" && (
                                <Badge variant="outline" className="text-[10px]">
                                  Custom
                                </Badge>
                              )}
                            </div>
                          )}
                          {!isRenaming && dots && (
                            <div className="flex items-center gap-0.5 mt-1">{dots}</div>
                          )}
                        </div>
                        {!isRenaming && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              beginRename(`cat::${row.key}`, row.displayName);
                            }}
                            className="text-muted-foreground/60 hover:text-foreground"
                            aria-label="Rename category"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <Button
                  className="w-full mt-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0 shadow-[0_0_20px_rgba(139,92,246,0.45)] hover:opacity-90"
                  size="sm"
                  onClick={() => {
                    setNewModuleTitle("");
                    setShowAddModuleDialog(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Module
                </Button>
              </div>
            </div>

            {/* RIGHT: Selected category videos */}
            <div className="px-2 py-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">{selectedPanelTitle}</h3>

              {!showInlineAdd ? (
                <button
                  type="button"
                  id="v3-add-custom-video"
                  data-tip-target="v3-edu-add-custom-video"
                  onClick={() => setShowInlineAdd(true)}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-dashed text-sm text-primary hover:bg-primary/5 transition-colors ${
                    highlightCustomVideo
                      ? "border-primary ring-2 ring-primary ring-offset-2 animate-pulse"
                      : "border-border"
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  Add Custom Video
                </button>
              ) : (
                <div className="p-3 rounded-lg border-2 border-dashed border-primary/60 bg-primary/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-primary">New custom video</p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowInlineAdd(false);
                        setInlineForm({ title: "", description: "", videoUrl: "", isEmbed: false });
                      }}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-start">
                    <div className="space-y-2">
                      <Input
                        placeholder="Video title"
                        value={inlineForm.title}
                        onChange={(e) => setInlineForm((f) => ({ ...f, title: e.target.value }))}
                        className="h-8 text-sm"
                      />
                      <Textarea
                        placeholder="Short description"
                        value={inlineForm.description}
                        onChange={(e) =>
                          setInlineForm((f) => ({ ...f, description: e.target.value }))
                        }
                        rows={2}
                        className="text-sm resize-none"
                      />
                      <Input
                        placeholder={
                          inlineForm.isEmbed
                            ? "Paste embed code"
                            : "Video URL (YouTube, Vimeo, etc.)"
                        }
                        value={inlineForm.videoUrl}
                        onChange={(e) => setInlineForm((f) => ({ ...f, videoUrl: e.target.value }))}
                        className="h-8 text-sm"
                      />
                      <div className="flex items-center gap-2">
                        <Switch
                          id="inline-is-embed"
                          checked={inlineForm.isEmbed}
                          onCheckedChange={(c) => setInlineForm((f) => ({ ...f, isEmbed: c }))}
                        />
                        <Label htmlFor="inline-is-embed" className="text-xs text-muted-foreground">
                          This is an embed code
                        </Label>
                      </div>
                      {availablePlanTiers.length > 1 && (
                        <div className="pt-2 border-t border-border/50 space-y-1.5">
                          <p className="text-[11px] font-semibold text-foreground">
                            Apply this video to:
                          </p>
                          {availablePlanTiers.map((p) => {
                            const checked = inlinePlanTiers.has(p.id);
                            return (
                              <label
                                key={p.id}
                                className="flex items-center gap-2 text-xs cursor-pointer"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(v) => {
                                    setInlinePlanTiers((prev) => {
                                      const next = new Set(prev);
                                      if (v) next.add(p.id);
                                      else next.delete(p.id);
                                      if (next.size === 0) next.add(tier);
                                      return next;
                                    });
                                  }}
                                />
                                <span>{p.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <TranscribeOnSaveCheckbox
                      id="inline-auto-transcribe"
                      checked={autoTranscribe}
                      onChange={setAutoTranscribe}
                    />
                    <Button
                      type="button"
                      size="icon"
                      className="h-8 w-8"
                      onClick={saveInlineVideo}
                      disabled={savingInline}
                      aria-label="Save video"
                    >
                      <Save className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}

              {isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedCategoryModules.map((m) => {
                    const visible = isModuleVisible(selectedCategoryId, m.id);
                    const nameKey = `${selectedCategoryId}::${m.id}`;
                    const displayName = moduleNameOverrides[nameKey] ?? m.name;
                    const isRenaming = renamingKey === `mod::${nameKey}`;
                    return (
                      <div
                        key={m.id}
                        draggable={!isRenaming}
                        onDragStart={() => setDragBuiltinId(m.id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => onDropBuiltinModule(m.id)}
                        className={`flex items-center gap-3 p-3 rounded-lg border bg-background ${
                          visible ? "" : "opacity-60"
                        }`}
                      >
                        <Switch
                          checked={visible}
                          onCheckedChange={(v) => setModuleVisibility(selectedCategoryId, m.id, v)}
                          className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-muted-foreground/40"
                          aria-label={visible ? "Hide video" : "Show video"}
                        />
                        <div className="flex-1 min-w-0">
                          {isRenaming ? (
                            <div className="flex items-center gap-1">
                              <Input
                                autoFocus
                                value={renamingValue}
                                onChange={(e) => setRenamingValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    commitModuleRename(selectedCategoryId, m.id, m.name);
                                  }
                                  if (e.key === "Escape") {
                                    setRenamingKey(null);
                                  }
                                }}
                                className="h-7 text-sm px-2"
                              />
                              <Button
                                type="button"
                                size="icon"
                                aria-label="Confirm"
                                className="h-7 w-7"
                                onClick={() => commitModuleRename(selectedCategoryId, m.id, m.name)}
                              >
                                <Check className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <p className="text-sm font-semibold truncate">{displayName}</p>
                          )}
                        </div>
                        {!isRenaming && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              beginRename(`mod::${nameKey}`, displayName);
                            }}
                            className="text-muted-foreground/60 hover:text-foreground"
                            aria-label="Rename module"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <GripVertical className="w-4 h-4 text-muted-foreground/50 cursor-grab" />
                      </div>
                    );
                  })}

                  {customVideosForCategory.map((v) => (
                    <div
                      key={v.id}
                      draggable
                      onDragStart={() => setDragCustomId(v.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => onDropCustomVideo(v.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg border bg-background ${
                        (v.tiers || []).includes(tier) ? "" : "opacity-60"
                      }`}
                    >
                      <Switch
                        checked={(v.tiers || []).includes(tier)}
                        onCheckedChange={(c) => toggleCustomVideoVisibility(v, c)}
                        className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-muted-foreground/40"
                        aria-label="Toggle video visibility"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold truncate">{v.title}</p>
                          <Badge variant="outline" className="text-[10px]">
                            Custom
                          </Badge>
                        </div>
                        {v.description && (
                          <p className="text-xs text-muted-foreground truncate">{v.description}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => openEditCustomVideo(v)}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Edit video"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCustomVideo(v.id)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Delete video"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <GripVertical className="w-4 h-4 text-muted-foreground/50 cursor-grab" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Module Dialog */}
      <Dialog open={showAddModuleDialog} onOpenChange={setShowAddModuleDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create custom module</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-module-title" className="text-sm">
              Module name
            </Label>
            <Input
              id="new-module-title"
              autoFocus
              value={newModuleTitle}
              onChange={(e) => setNewModuleTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createCustomModule();
              }}
              placeholder="e.g. Advanced Workflows"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModuleDialog(false)}>
              Cancel
            </Button>
            <Button variant="accent"
              onClick={createCustomModule}
              disabled={creatingModule || !newModuleTitle.trim()}
            >
              <Save className="w-4 h-4 mr-1" /> Save module
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Custom Video Dialog */}
      <Dialog open={!!editingVideo} onOpenChange={(o) => !o && setEditingVideo(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit custom video</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="edit-video-title" className="text-xs">
                Title
              </Label>
              <Input
                id="edit-video-title"
                value={editVideoForm.title}
                onChange={(e) => setEditVideoForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-video-desc" className="text-xs">
                Description
              </Label>
              <Textarea
                id="edit-video-desc"
                rows={3}
                value={editVideoForm.description}
                onChange={(e) => setEditVideoForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-video-url" className="text-xs">
                {editVideoForm.isEmbed ? "Embed code" : "Video URL"}
              </Label>
              <Input
                id="edit-video-url"
                value={editVideoForm.videoUrl}
                onChange={(e) => setEditVideoForm((f) => ({ ...f, videoUrl: e.target.value }))}
                placeholder={
                  editVideoForm.isEmbed ? "Paste embed code" : "Video URL (YouTube, Vimeo, etc.)"
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="edit-video-is-embed"
                checked={editVideoForm.isEmbed}
                onCheckedChange={(c) => setEditVideoForm((f) => ({ ...f, isEmbed: !!c }))}
              />
              <Label htmlFor="edit-video-is-embed" className="text-xs text-muted-foreground">
                This is an embed code
              </Label>
            </div>
            <TranscribeOnSaveCheckbox
              id="edit-auto-transcribe"
              checked={autoTranscribe}
              onChange={setAutoTranscribe}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingVideo(null)}>
              Cancel
            </Button>
            <Button variant="accent" onClick={saveEditCustomVideo} disabled={savingEditVideo}>
              <Save className="w-4 h-4 mr-1" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default V3EducationView;
