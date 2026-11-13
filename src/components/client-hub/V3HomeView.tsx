import { useEffect, useRef, useState } from "react";
import { HubSection } from "@/components/premium/hub/HubSection";
import { AddRowButton, OnOffSwitch } from "@/components/premium/hub/HubBits";
import { HaloDropzone } from "@/components/premium/21st/halo-dropzone";
import { Reveal, RevealItem } from "@/components/premium/Reveal";
import { Label } from "@/components/ui/label";
import thumbPlaceholder from "@/assets/video-thumb-placeholder.png.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Megaphone,
  Video,
  Eye,
  EyeOff,
  MoreVertical,
  Plus,
  ListChecks,
  LogIn,
  Hand,
  Compass,
  CalendarCheck,
  Link as LinkIcon,
  Trash2,
  Save,
  Upload,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VIDEO_CATEGORIES, linkedVideoLabel } from "@/constants/videoCategories";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { HomeSettings } from "@/constants/homeSettingsDefaults";

interface ChecklistRow {
  id: string;
  title: string;
  description: string | null;
  item_order: number;
  link_to: "none" | "url" | "video";
  link_url: string | null;
  linked_video: string | null;
  isNew?: boolean;
}

interface CustomVideoOption {
  id: string;
  title: string;
}

interface V3HomeViewProps {
  selectedPlanAgencyId: string | null;
  homeSettings: HomeSettings;
  setHomeSettings: React.Dispatch<React.SetStateAction<HomeSettings>>;
  saveHomeSettings: () => Promise<void> | void;
  isSaving: boolean;
  onOpenLoginDialog: () => void;
  onSwitchToEducation: () => void;

  // Daily checklist
  dailyChecklistEnabled: boolean;
  toggleDailyChecklist: (enabled: boolean) => Promise<void> | void;
  dailyChecklistTitle: string;
  setDailyChecklistTitle: (v: string) => void;
  saveDailyChecklistTitle: (v: string) => Promise<void> | void;
  dailyChecklistItems: { item_1: string; item_2: string; item_3: string };
  setDailyChecklistItems: React.Dispatch<
    React.SetStateAction<{ item_1: string; item_2: string; item_3: string }>
  >;
  saveDailyChecklistItems: () => Promise<void> | void;
}

const V3HomeView = ({
  selectedPlanAgencyId,
  homeSettings,
  setHomeSettings,
  saveHomeSettings,
  isSaving,
  onOpenLoginDialog,
  onSwitchToEducation,
  dailyChecklistEnabled,
  toggleDailyChecklist,
  dailyChecklistTitle,
  setDailyChecklistTitle,
  saveDailyChecklistTitle,
  dailyChecklistItems,
  setDailyChecklistItems,
  saveDailyChecklistItems,
}: V3HomeViewProps) => {
  const [editingHeadline, setEditingHeadline] = useState(false);
  const [editingSub, setEditingSub] = useState(false);
  const [checklistItems, setChecklistItems] = useState<ChecklistRow[]>([]);
  const [savingChecklistId, setSavingChecklistId] = useState<string | null>(null);
  const [customVideos, setCustomVideos] = useState<CustomVideoOption[]>([]);

  const announcementRef = useRef<HTMLDivElement>(null);
  const checklistRef = useRef<HTMLDivElement>(null);
  const newChecklistInputRef = useRef<HTMLInputElement>(null);
  const customLinksRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dailyChecklistRef = useRef<HTMLDivElement>(null);
  const welcomeVideoRef = useRef<HTMLDivElement>(null);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [tempImageUrl, setTempImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [videoPreviewOpen, setVideoPreviewOpen] = useState(false);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  const [highlight, setHighlight] = useState<string | null>(null);
  const flash = (key: string) => {
    setHighlight(key);
    setTimeout(() => setHighlight((h) => (h === key ? null : h)), 1800);
  };

  useEffect(() => {
    const load = async () => {
      if (!selectedPlanAgencyId) {
        setChecklistItems([]);
        setCustomVideos([]);
        return;
      }
      const [{ data }, cvRes] = await Promise.all([
        supabase.rpc("get_agency_onboarding_checklist", {
          lookup_agency_id: selectedPlanAgencyId,
        }),
        supabase
          .from("custom_onboarding_videos")
          .select("id, title")
          .eq("agency_id", selectedPlanAgencyId),
      ]);
      setChecklistItems(
        ((data as any[]) || []).map((i: any) => ({
          id: i.id,
          title: i.title,
          description: i.description,
          item_order: i.item_order,
          link_to: (i.link_to as "none" | "url" | "video") || "none",
          link_url: i.link_url ?? null,
          linked_video: i.linked_video ?? null,
        }))
      );
      setCustomVideos(((cvRes.data as any[]) || []).map((v) => ({ id: v.id, title: v.title })));
    };
    load();
  }, [selectedPlanAgencyId]);

  const update = (patch: Partial<HomeSettings>) =>
    setHomeSettings((prev) => ({ ...prev, ...patch }));

  const addAnnouncement = () => {
    update({
      announcements_enabled: true,
      announcements_headline: homeSettings.announcements_headline || "What's new",
      announcements_paragraph:
        homeSettings.announcements_paragraph || "Share an update with your clients.",
    });
  };

  const addWelcomeVideo = () => update({ welcome_video_enabled: true });

  const getYoutubeEmbed = (url: string | null): string | null => {
    if (!url) return null;
    const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
    if (m) return `https://www.youtube.com/embed/${m[1]}`;
    if (url.match(/vimeo\.com\/(\d+)/)) {
      const vid = url.match(/vimeo\.com\/(\d+)/)![1];
      return `https://player.vimeo.com/video/${vid}`;
    }
    return null;
  };

  const linkSlots: Array<{ idx: 1 | 2 | 3 }> = [{ idx: 1 }, { idx: 2 }, { idx: 3 }];
  const hasAnyLink = !!(
    homeSettings.custom_link_1_text ||
    homeSettings.custom_link_2_text ||
    homeSettings.custom_link_3_text
  );

  // Checklist inline add
  const addChecklistItem = async () => {
    if (!selectedPlanAgencyId) {
      toast.error("Select a plan first");
      return;
    }
    const newOrder =
      checklistItems.length > 0
        ? Math.max(...checklistItems.map((i) => i.item_order)) + 1
        : 1;
    const tempId = `new-${Date.now()}`;
    setChecklistItems((prev) => [
      ...prev,
      {
        id: tempId,
        title: "",
        description: null,
        item_order: newOrder,
        link_to: "none",
        link_url: null,
        linked_video: null,
        isNew: true,
      },
    ]);
    // scroll + focus + flash
    setTimeout(() => {
      checklistRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      newChecklistInputRef.current?.focus();
      flash("checklist-title");
    }, 80);
  };

  const persistChecklistItem = async (item: ChecklistRow) => {
    if (!selectedPlanAgencyId) return;
    if (!item.title.trim()) return;
    setSavingChecklistId(item.id);
    try {
      if (item.isNew) {
        const { data, error } = await supabase
          .from("agency_onboarding_checklist")
          .insert({
            agency_id: selectedPlanAgencyId,
            title: item.title,
            description: item.description || null,
            item_order: item.item_order,
            link_to: item.link_to,
            link_url: item.link_url,
            linked_video: item.linked_video,
          })
          .select()
          .single();
        if (error) throw error;
        setChecklistItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  id: data.id,
                  title: data.title,
                  description: data.description,
                  item_order: data.item_order,
                  link_to: (data.link_to as "none" | "url" | "video") || "none",
                  link_url: data.link_url ?? null,
                  linked_video: data.linked_video ?? null,
                }
              : i
          )
        );
      } else {
        const { error } = await supabase
          .from("agency_onboarding_checklist")
          .update({
            title: item.title,
            description: item.description,
            link_to: item.link_to,
            link_url: item.link_url,
            linked_video: item.linked_video,
          })
          .eq("id", item.id);
        if (error) throw error;
      }
      toast.success("Checklist saved");
    } catch (e) {
      console.error(e);
      toast.error("Failed to save checklist item");
    } finally {
      setSavingChecklistId(null);
    }
  };

  const deleteChecklistItem = async (id: string, isNew?: boolean) => {
    if (isNew) {
      setChecklistItems((prev) => prev.filter((i) => i.id !== id));
      return;
    }
    try {
      const { error } = await supabase
        .from("agency_onboarding_checklist")
        .delete()
        .eq("id", id);
      if (error) throw error;
      setChecklistItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      toast.error("Failed to delete item");
    }
  };

  const QuickAction = ({
    icon: Icon,
    label,
    onClick,
  }: {
    icon: any;
    label: string;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted/60 transition text-left text-sm font-medium text-foreground"
    >
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="flex-1 truncate">{label}</span>
    </button>
  );

  // Quick action handlers
  const handleAddAnnouncement = () => {
    addAnnouncement();
    setTimeout(() => {
      announcementRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      flash("announcement");
    }, 80);
  };

  const openImageDialog = () => {
    setTempImageUrl(homeSettings.announcements_image_url || "");
    setImageDialogOpen(true);
  };

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Max 5MB"); return; }
    setUploadingImage(true);
    try {
      const ext = file.name.split(".").pop();
      const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("logos").upload(name, file);
      if (error) throw error;
      const { data } = supabase.storage.from("logos").getPublicUrl(name);
      update({ announcements_image_url: data.publicUrl });
      setImageDialogOpen(false);
      toast.success("Image uploaded");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Reusable 3-dot menu (Hide/Show + Delete)
  const SectionMenu = ({
    enabled,
    onToggle,
    onDelete,
  }: {
    enabled: boolean;
    onToggle: () => void;
    onDelete: () => void;
  }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-9" aria-label="More options">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onToggle}>
          {enabled ? (
            <>
              <EyeOff className="w-4 h-4 mr-2" /> Hide section
            </>
          ) : (
            <>
              <Eye className="w-4 h-4 mr-2" /> Show section
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDelete} className="text-destructive">
          <Trash2 className="w-4 h-4 mr-2" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const ringClass = (key: string) =>
    highlight === key ? "ring-2 ring-brand ring-offset-2 animate-pulse" : "";

  return (
    <div className="min-w-0">
      <Reveal className="space-y-4">
        <RevealItem className="space-y-4">
          {/* Welcome Section */}
          <HubSection
            data-tip-target="v3-home-welcome"
            icon={<Hand />}
            title="Welcome message"
            description="The headline clients read first."
            off={!homeSettings.welcome_enabled}
            actions={
              <>
                <OnOffSwitch
                  checked={!!homeSettings.welcome_enabled}
                  onCheckedChange={() => update({ welcome_enabled: !homeSettings.welcome_enabled })}
                  label="Show the welcome message"
                />
                <SectionMenu
                  enabled={homeSettings.welcome_enabled}
                  onToggle={() => update({ welcome_enabled: !homeSettings.welcome_enabled })}
                  onDelete={() =>
                    update({
                      welcome_enabled: false,
                      welcome_headline: "",
                      welcome_subheadline: "",
                    })
                  }
                />
              </>
            }
          >
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="home-welcome-headline">Headline</Label>
                <Input
                  id="home-welcome-headline"
                  value={homeSettings.welcome_headline}
                  onChange={(e) => update({ welcome_headline: e.target.value })}
                  className="font-semibold"
                  placeholder="Welcome headline"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="home-welcome-sub">Subheadline</Label>
                <Textarea
                  id="home-welcome-sub"
                  value={homeSettings.welcome_subheadline}
                  onChange={(e) => update({ welcome_subheadline: e.target.value })}
                  rows={2}
                  className="text-sm"
                  placeholder="Welcome subheadline"
                />
              </div>
            </div>
          </HubSection>

          {/* Add buttons for sections not yet present */}
          <div className="flex flex-col gap-3 empty:hidden sm:flex-row [&>*]:flex-1" data-tip-target="v3-home-add-sections">
            {homeSettings.announcements_headline === null && (
              <AddRowButton
                onClick={handleAddAnnouncement}
                data-tip-target="v3-home-add-announcement"
                icon={<Megaphone className="size-4" aria-hidden="true" />}
              >
                Add an announcement
              </AddRowButton>
            )}
            {!homeSettings.welcome_video_url && !homeSettings.welcome_video_enabled && (
              <AddRowButton onClick={addWelcomeVideo} icon={<Video className="size-4" aria-hidden="true" />}>
                Add a welcome video
              </AddRowButton>
            )}
          </div>

          {/* Announcement Bar */}
          {homeSettings.announcements_headline !== null && (
            <HubSection
              ref={announcementRef}
              data-tip-target="v3-home-announcement"
              icon={<Megaphone />}
              title="Announcement"
              description="A highlighted note with an optional image."
              off={!homeSettings.announcements_enabled}
              className={ringClass("announcement")}
              actions={
                <>
                  <OnOffSwitch
                    checked={!!homeSettings.announcements_enabled}
                    onCheckedChange={() =>
                      update({ announcements_enabled: !homeSettings.announcements_enabled })
                    }
                    label="Show the announcement"
                  />
                  <SectionMenu
                    enabled={!!homeSettings.announcements_enabled}
                    onToggle={() =>
                      update({ announcements_enabled: !homeSettings.announcements_enabled })
                    }
                    onDelete={() =>
                      update({
                        announcements_enabled: false,
                        announcements_headline: null,
                        announcements_paragraph: null,
                        announcements_image_url: null,
                      })
                    }
                  />
                </>
              }
            >
              <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-start">
                <button
                  type="button"
                  onClick={openImageDialog}
                  className="flex aspect-video w-full shrink-0 flex-col items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-muted/40 text-muted-foreground transition-colors duration-150 hover:border-brand/50 hover:bg-brand-subtle hover:text-brand sm:w-48"
                  title="Click to set image"
                >
                  {homeSettings.announcements_image_url ? (
                    <img
                      src={homeSettings.announcements_image_url}
                      alt="Announcement"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <>
                      <Upload className="w-5 h-5 mb-1" />
                      <span className="text-xs">Add image</span>
                    </>
                  )}
                </button>
                <div className="flex-1 min-w-0 space-y-2 text-left">
                  <Input
                    value={homeSettings.announcements_headline || ""}
                    onChange={(e) => update({ announcements_headline: e.target.value })}
                    placeholder="Announcement headline"
                    className="text-sm font-semibold"
                  />
                  <Textarea
                    value={homeSettings.announcements_paragraph || ""}
                    onChange={(e) => update({ announcements_paragraph: e.target.value })}
                    placeholder="Paragraph..."
                    rows={3}
                    className="text-sm"
                  />
                </div>
              </div>
            </HubSection>
          )}

          {/* Welcome Video */}
          {(homeSettings.welcome_video_enabled || homeSettings.welcome_video_url) && (
            <HubSection
              ref={welcomeVideoRef}
              data-tip-target="v3-home-welcome-video"
              icon={<Video />}
              title="Welcome video"
              description="One video at the top of Home. Paste a link or pick one of your lessons."
              off={!homeSettings.welcome_video_enabled}
              className={ringClass("welcome-video")}
              actions={
                <>
                  <OnOffSwitch
                    checked={!!homeSettings.welcome_video_enabled}
                    onCheckedChange={() =>
                      update({ welcome_video_enabled: !homeSettings.welcome_video_enabled })
                    }
                    label="Show the welcome video"
                  />
                  <SectionMenu
                    enabled={!!homeSettings.welcome_video_enabled}
                    onToggle={() =>
                      update({ welcome_video_enabled: !homeSettings.welcome_video_enabled })
                    }
                    onDelete={() =>
                      update({ welcome_video_enabled: false, welcome_video_url: null })
                    }
                  />
                </>
              }
            >
              <div className="flex flex-col sm:flex-row gap-4">
                {/* LEFT: thumbnail uploader */}
                 <div className="space-y-1.5 sm:w-48 sm:shrink-0" data-tip-target="v3-home-video-thumbnail">
                  <span className="block text-sm font-medium">Thumbnail <span className="font-normal text-muted-foreground">(optional)</span></span>
                  <div className="relative group">
                    <button
                      type="button"
                      disabled={uploadingThumbnail}
                      onClick={() => thumbnailInputRef.current?.click()}
                      aria-label={
                        homeSettings.welcome_video_thumbnail_url
                          ? "Replace video thumbnail"
                          : "Upload video thumbnail"
                      }
                      className="group/thumb flex aspect-video w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-md border border-dashed border-border bg-muted/40 text-xs text-muted-foreground transition-colors duration-150 hover:border-brand/50 hover:bg-brand-subtle hover:text-brand disabled:opacity-60"
                    >
                      {homeSettings.welcome_video_thumbnail_url ? (
                        <>
                          <img
                            src={homeSettings.welcome_video_thumbnail_url}
                            alt="Welcome video thumbnail"
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute inset-0 hidden group-hover:flex items-center justify-center bg-background/70 text-xs font-medium text-primary">
                            {uploadingThumbnail ? "Uploading..." : "Replace thumbnail"}
                          </span>
                        </>
                      ) : (
                        <span className="flex flex-col items-center gap-1">
                          <Upload className="w-5 h-5" />
                          <span>{uploadingThumbnail ? "Uploading..." : "Click to upload"}</span>
                        </span>
                      )}
                    </button>
                    {homeSettings.welcome_video_thumbnail_url && (
                      <button
                        type="button"
                        aria-label="Remove thumbnail"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full border bg-background text-destructive shadow-sm flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition"
                        onClick={async () => {
                          update({ welcome_video_thumbnail_url: null });
                          if (!selectedPlanAgencyId) return;
                          const { error } = await supabase
                            .from("v2_home_settings")
                            .update({ welcome_video_thumbnail_url: null } as any)
                            .eq("agency_id", selectedPlanAgencyId);
                          if (error) toast.error("Failed to remove thumbnail");
                          else toast.success("Thumbnail removed");
                        }}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* RIGHT: source toggle + input + preview */}
                <div className="flex-1 min-w-0 space-y-2">
                  <span className="block text-sm font-medium">Video source</span>
                  {(() => {
                    const source = homeSettings.welcome_video_source || "url";
                    const mode =
                      source === "library" ? "library" : source === "custom" ? "custom" : homeSettings.welcome_video_is_embed ? "embed" : "url";
                    const opts: { key: string; label: string; apply: Partial<HomeSettings> }[] = [
                      { key: "url", label: "URL", apply: { welcome_video_source: "url", welcome_video_is_embed: false } },
                      { key: "embed", label: "Embed Code", apply: { welcome_video_source: "url", welcome_video_is_embed: true } },
                      { key: "library", label: "Training Video", apply: { welcome_video_source: "library" } },
                      { key: "custom", label: "My Videos", apply: { welcome_video_source: "custom" } },
                    ];
                    return (
                      <div className="inline-flex max-w-full flex-wrap gap-1 rounded-md bg-muted p-1" role="group" aria-label="Video source">
                        {opts.map((o) => (
                          <button
                            key={o.key}
                            type="button"
                            aria-pressed={mode === o.key}
                            className={`min-h-9 rounded-sm px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                              mode === o.key
                                ? "bg-background text-foreground shadow-card"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                            onClick={() => update(o.apply)}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                  {homeSettings.welcome_video_source === "library" ? (
                    <div className="space-y-1">
                      <Select
                        value={
                          homeSettings.welcome_video_library_category_id && homeSettings.welcome_video_library_module_id
                            ? `${homeSettings.welcome_video_library_category_id}::${homeSettings.welcome_video_library_module_id}`
                            : undefined
                        }
                        onValueChange={(v) => {
                          const [cat, mod] = v.split("::");
                          update({ welcome_video_library_category_id: cat, welcome_video_library_module_id: mod });
                        }}
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Choose a training video" />
                        </SelectTrigger>
                        <SelectContent className="max-h-80">
                          {VIDEO_CATEGORIES.map((cat) => (
                            <div key={cat.id}>
                              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{cat.name}</div>
                              {cat.modules.map((m) => (
                                <SelectItem key={m.id} value={`${cat.id}::${m.id}`}>
                                  {m.name}
                                </SelectItem>
                              ))}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Always plays the latest version of this training video. Your thumbnail still shows first.
                      </p>
                    </div>
                  ) : homeSettings.welcome_video_source === "custom" ? (
                    <div className="space-y-1">
                      <Select
                        value={homeSettings.welcome_video_custom_video_id || undefined}
                        onValueChange={(v) => update({ welcome_video_custom_video_id: v })}
                        disabled={customVideos.length === 0}
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue
                            placeholder={customVideos.length === 0 ? "No uploaded videos yet" : "Choose one of your videos"}
                          />
                        </SelectTrigger>
                        <SelectContent className="max-h-80">
                          {customVideos.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Pick from the lessons you uploaded in Education. Your thumbnail still shows first.
                      </p>
                    </div>
                  ) : !homeSettings.welcome_video_is_embed ? (
                    <Input
                      value={homeSettings.welcome_video_url || ""}
                      onChange={(e) => update({ welcome_video_url: e.target.value || null })}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="text-sm"
                    />
                  ) : (
                    <Textarea
                      value={homeSettings.welcome_video_url || ""}
                      onChange={(e) => update({ welcome_video_url: e.target.value || null })}
                      placeholder="<iframe ... />"
                      rows={3}
                      className="text-xs font-mono"
                    />
                  )}
                  {(homeSettings.welcome_video_source || "url") === "url" && homeSettings.welcome_video_url && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setVideoPreviewOpen(true)}
                      className="w-auto self-start"
                    >
                      Preview Video
                    </Button>
                  )}
                </div>

                <input
                  ref={thumbnailInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (!selectedPlanAgencyId) {
                      toast.error("Select a plan first");
                      return;
                    }
                    setUploadingThumbnail(true);
                    try {
                      const ext = file.name.split(".").pop() || "jpg";
                      const path = `${selectedPlanAgencyId}/${Date.now()}.${ext}`;
                      const { error: upErr } = await supabase.storage
                        .from("welcome-video-thumbnails")
                        .upload(path, file, { upsert: true, contentType: file.type });
                      if (upErr) throw upErr;
                      // Bucket is private (workspace blocks public buckets),
                      // so use a long-lived signed URL that guests can load.
                      const { data: signed, error: signErr } = await supabase.storage
                        .from("welcome-video-thumbnails")
                        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10); // ~10 years
                      if (signErr || !signed?.signedUrl) throw signErr || new Error("Failed to sign URL");
                      const signedUrl = signed.signedUrl;
                      update({ welcome_video_thumbnail_url: signedUrl });
                      // Autosave immediately so users don't have to hit Save
                      const { error: saveErr } = await supabase
                        .from("v2_home_settings")
                        .update({ welcome_video_thumbnail_url: signedUrl } as any)
                        .eq("agency_id", selectedPlanAgencyId);
                      if (saveErr) throw saveErr;
                      toast.success("Thumbnail uploaded & saved");
                    } catch (err: any) {
                      toast.error(err?.message || "Upload failed");
                    } finally {
                      setUploadingThumbnail(false);
                      if (thumbnailInputRef.current) thumbnailInputRef.current.value = "";
                    }
                  }}
                />
              </div>
            </HubSection>
          )}
        </RevealItem>

        <RevealItem className="space-y-4">
          {/* Daily Checklist (inline) */}
          <HubSection
            ref={checklistRef}
            data-tip-target="v3-home-checklist"
            icon={<ListChecks />}
            title="Onboarding checklist"
            description="Steps a new client ticks off once. Each step can link to a video. Items save as you type."
            className={ringClass("checklist-title")}
            actions={
              <span className="text-xs tabular-nums text-muted-foreground">
                {checklistItems.length} item{checklistItems.length === 1 ? "" : "s"}
              </span>
            }
          >

            <div className="space-y-2">
              {checklistItems.map((item, idx) => (
                <div
                  key={item.id}
                  className="rounded-md bg-muted/20 border px-2 py-1.5 space-y-1.5"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/40 shrink-0" />
                    <Input
                      ref={item.isNew ? newChecklistInputRef : undefined}
                      value={item.title}
                      onChange={(e) =>
                        setChecklistItems((prev) =>
                          prev.map((i) => (i.id === item.id ? { ...i, title: e.target.value } : i))
                        )
                      }
                      onBlur={() => persistChecklistItem(item)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      placeholder="Checklist item title"
                      className="h-8 text-sm border-0 bg-transparent focus-visible:ring-1"
                    />
                    <Select
                      value={item.link_to}
                      onValueChange={(value) => {
                        const newItem: ChecklistRow = {
                          ...item,
                          link_to: value as "none" | "url" | "video",
                          link_url: value === "url" ? item.link_url : null,
                          linked_video: value === "video" ? item.linked_video : null,
                        };
                        setChecklistItems((prev) =>
                          prev.map((i) => (i.id === item.id ? newItem : i))
                        );
                        if (!item.isNew) persistChecklistItem(newItem);
                      }}
                    >
                      <SelectTrigger className="h-8 w-[110px] text-xs shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          <span className="flex items-center gap-2"><X className="w-3 h-3" /> None</span>
                        </SelectItem>
                        <SelectItem value="url">
                          <span className="flex items-center gap-2"><LinkIcon className="w-3 h-3" /> URL</span>
                        </SelectItem>
                        <SelectItem value="video">
                          <span className="flex items-center gap-2"><Video className="w-3 h-3" /> Video</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon" aria-label="Delete"
                      className="h-7 w-7 text-destructive shrink-0"
                      onClick={() => deleteChecklistItem(item.id, item.isNew)}
                      disabled={savingChecklistId === item.id}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="pl-5 pr-9">
                    <Textarea
                      value={item.description || ""}
                      onChange={(e) =>
                        setChecklistItems((prev) =>
                          prev.map((i) =>
                            i.id === item.id ? { ...i, description: e.target.value } : i
                          )
                        )
                      }
                      onBlur={() => persistChecklistItem(item)}
                      placeholder="Add an optional description for this step…"
                      rows={2}
                      className="text-xs resize-none w-full"
                    />
                  </div>
                  {item.link_to === "url" && (
                    <div className="pl-5 pr-9">
                      <Input
                        value={item.link_url || ""}
                        onChange={(e) =>
                          setChecklistItems((prev) =>
                            prev.map((i) => (i.id === item.id ? { ...i, link_url: e.target.value } : i))
                          )
                        }
                        onBlur={() => persistChecklistItem(item)}
                        placeholder="https://example.com"
                        type="url"
                        className="h-8 text-xs w-full"
                      />
                    </div>
                  )}
                  {item.link_to === "video" && (
                    <div className="pl-5 pr-9">
                    <Select
                      value={item.linked_video || ""}
                      onValueChange={(value) => {
                        const newItem = { ...item, linked_video: value };
                        setChecklistItems((prev) =>
                          prev.map((i) => (i.id === item.id ? newItem : i))
                        );
                        persistChecklistItem(newItem);
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs w-full">
                        <SelectValue placeholder="Select a video">
                          {item.linked_video ? (linkedVideoLabel(item.linked_video) || item.linked_video) : "Select a video"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {customVideos.length > 0 && (
                          <>
                            <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground bg-muted">
                              Custom Videos
                            </div>
                            {customVideos.map((v) => (
                              <SelectItem key={v.id} value={v.id}>{v.title}</SelectItem>
                            ))}
                          </>
                        )}
                        {VIDEO_CATEGORIES.map((category) => (
                          <div key={category.id}>
                            <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground bg-muted">
                              {category.name}
                            </div>
                            {category.modules.map((m) => (
                              <SelectItem key={`${category.id}:${m.id}`} value={`${category.id}:${m.id}`}>
                                {m.name}
                              </SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <AddRowButton className={checklistItems.length ? "mt-3" : ""} onClick={addChecklistItem}>
              Add checklist item
            </AddRowButton>
          </HubSection>

          {/* What to do next */}
          <HubSection
            icon={<Compass />}
            title="What to do next"
            description="A nudge on Home that points each client to their next step."
            off={!homeSettings.next_steps_enabled}
            actions={
                <OnOffSwitch
                  id="next-steps-toggle-v3"
                  label="Show What to do next"
                  checked={!!homeSettings.next_steps_enabled}
                  onCheckedChange={async (checked) => {
                    update({ next_steps_enabled: checked });
                    if (!selectedPlanAgencyId) return;
                    const { error } = await supabase
                      .from('v2_home_settings')
                      .update({ next_steps_enabled: checked } as any)
                      .eq('agency_id', selectedPlanAgencyId);
                    if (error) toast.error('Failed to save');
                  }}
                />
            }
          >
            {homeSettings.next_steps_enabled && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Send clients to</Label>
                  <Select
                    value={homeSettings.next_steps_priority}
                    onValueChange={async (v) => {
                      const priority = v as HomeSettings['next_steps_priority'];
                      update({ next_steps_priority: priority });
                      if (!selectedPlanAgencyId) return;
                      const { error } = await supabase
                        .from('v2_home_settings')
                        .update({ next_steps_priority: priority } as any)
                        .eq('agency_id', selectedPlanAgencyId);
                      if (error) toast.error('Failed to save');
                    }}
                  >
                    <SelectTrigger className="sm:max-w-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="onboarding_videos">Onboarding videos</SelectItem>
                      <SelectItem value="checklist">Checklist items</SelectItem>
                      <SelectItem value="custom_text">Custom text</SelectItem>
                      <SelectItem value="custom_url">Custom URL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {homeSettings.next_steps_priority === 'custom_text' && (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Custom text</label>
                    <Textarea
                      value={homeSettings.next_steps_custom_text || ''}
                      onChange={(e) => update({ next_steps_custom_text: e.target.value })}
                      onBlur={() => saveHomeSettings()}
                      placeholder="Tell clients what they should do next..."
                      rows={3}
                      className="text-sm resize-none"
                    />
                  </div>
                )}

                {homeSettings.next_steps_priority === 'custom_url' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Button label</label>
                      <Input
                        value={homeSettings.next_steps_custom_url_label || ''}
                        onChange={(e) => update({ next_steps_custom_url_label: e.target.value })}
                        onBlur={() => saveHomeSettings()}
                        placeholder="e.g., Book your call"
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">URL</label>
                      <Input
                        value={homeSettings.next_steps_custom_url || ''}
                        onChange={(e) => update({ next_steps_custom_url: e.target.value })}
                        onBlur={() => saveHomeSettings()}
                        placeholder="https://example.com"
                        type="url"
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </HubSection>

          {/* Daily Checklist (plan-specific) */}
          <HubSection
            ref={dailyChecklistRef}
            data-tip-target="v3-home-daily"
            icon={<CalendarCheck />}
            title="Daily checklist"
            description="Three habits that reset every day for each client."
            off={!dailyChecklistEnabled}
            className={ringClass("daily-checklist")}
            actions={
              <OnOffSwitch
                id="daily-toggle-v3"
                label="Show the daily checklist"
                checked={dailyChecklistEnabled}
                onCheckedChange={(c) => toggleDailyChecklist(c)}
              />
            }
          >
            <div className="mb-3 space-y-1.5">
              <Label htmlFor="daily-checklist-title">Title clients see</Label>
              <Input
                id="daily-checklist-title"
                value={dailyChecklistTitle}
                onChange={(e) => setDailyChecklistTitle(e.target.value)}
                onBlur={(e) => saveDailyChecklistTitle(e.target.value)}
                className="sm:max-w-sm"
                placeholder="Daily Checklist title"
              />
            </div>
            <div className="space-y-2">
              {(["item_1", "item_2", "item_3"] as const).map((key, idx) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-4 text-sm tabular-nums text-muted-foreground">{idx + 1}.</span>
                  <Input
                    value={dailyChecklistItems[key]}
                    onChange={(e) =>
                      setDailyChecklistItems((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    placeholder={`Daily task ${idx + 1}`}
                    aria-label={`Daily task ${idx + 1}`}
                  />
                </div>
              ))}
            </div>
          </HubSection>

          {/* Custom Buttons & Links */}
          <HubSection
            ref={customLinksRef}
            data-tip-target="v3-home-custom-links"
            icon={<LinkIcon />}
            title="Buttons and links"
            description="Up to three buttons that send clients anywhere you choose."
            off={!homeSettings.custom_links_enabled && hasAnyLink}
            className={ringClass("custom-links")}
            actions={
              <>
                {hasAnyLink ? (
                  <OnOffSwitch
                    checked={!!homeSettings.custom_links_enabled}
                    onCheckedChange={() =>
                      update({ custom_links_enabled: !homeSettings.custom_links_enabled })
                    }
                    label="Show buttons and links"
                  />
                ) : null}
                <SectionMenu
                  enabled={!!homeSettings.custom_links_enabled}
                  onToggle={() =>
                    update({ custom_links_enabled: !homeSettings.custom_links_enabled })
                  }
                  onDelete={() =>
                    update({
                      custom_links_enabled: false,
                      custom_link_1_text: null,
                      custom_link_1_url: null,
                      custom_link_2_text: null,
                      custom_link_2_url: null,
                      custom_link_3_text: null,
                      custom_link_3_url: null,
                    } as any)
                  }
                />
              </>
            }
          >
            <div className="space-y-3">
              {linkSlots.map(({ idx }) => {
                const text = (homeSettings as any)[`custom_link_${idx}_text`] as string | null;
                const url = (homeSettings as any)[`custom_link_${idx}_url`] as string | null;
                const color = (homeSettings as any)[`custom_link_${idx}_color`] as string | null;
                const openAsPopup = !!(homeSettings as any)[`custom_link_${idx}_open_as_popup`];
                if (!text && !url) return null;
                return (
                  <div key={idx} className="space-y-2 rounded-md border border-border p-3">
                    <div className="grid grid-cols-[1fr_44px_44px] items-center gap-2 sm:grid-cols-[1fr_1fr_44px_44px] [&>input:nth-child(2)]:order-last [&>input:nth-child(2)]:col-span-3 sm:[&>input:nth-child(2)]:order-none sm:[&>input:nth-child(2)]:col-span-1">
                    <Input
                      value={text || ""}
                      onChange={(e) =>
                        update({ [`custom_link_${idx}_text`]: e.target.value } as any)
                      }
                      placeholder="Button label"
                      aria-label="Button label"
                    />
                    <Input
                      value={url || ""}
                      onChange={(e) =>
                        update({ [`custom_link_${idx}_url`]: e.target.value } as any)
                      }
                      placeholder="https://..."
                      aria-label="Button link"
                    />
                    <input
                      type="color"
                      aria-label="Button color"
                      value={color || "#3b82f6"}
                      onChange={(e) =>
                        update({ [`custom_link_${idx}_color`]: e.target.value } as any)
                      }
                      className="h-11 w-full cursor-pointer rounded-md border border-border bg-transparent p-1"
                      title="Button color"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-11 text-muted-foreground hover:text-destructive"
                      aria-label="Delete button"
                      onClick={() =>
                        update({
                          [`custom_link_${idx}_text`]: null,
                          [`custom_link_${idx}_url`]: null,
                        } as any)
                      }
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer pl-1">
                      <input
                        type="checkbox"
                        checked={openAsPopup}
                        onChange={(e) =>
                          update({ [`custom_link_${idx}_open_as_popup`]: e.target.checked } as any)
                        }
                        className="h-3.5 w-3.5 accent-primary"
                      />
                      {openAsPopup ? "Opens as popup iframe" : "Opens in new tab"}
                    </label>
                  </div>
                );
              })}

              {(() => {
                const nextEmpty = linkSlots.find(
                  ({ idx }) =>
                    !(homeSettings as any)[`custom_link_${idx}_text`] &&
                    !(homeSettings as any)[`custom_link_${idx}_url`]
                );
                if (!nextEmpty) return null;
                return (
                  <AddRowButton
                    onClick={() =>
                      update({
                        custom_links_enabled: true,
                        [`custom_link_${nextEmpty.idx}_text`]: "New button",
                        [`custom_link_${nextEmpty.idx}_url`]: "https://",
                        [`custom_link_${nextEmpty.idx}_color`]: "#3b82f6",
                      } as any)
                    }
                  >
                    Add a button or link
                  </AddRowButton>
                );
              })()}
            </div>
          </HubSection>

          {/* Client login: shared by every plan, so it sits apart from the page sections */}
          <HubSection
            icon={<LogIn />}
            title="Client login"
            description="How clients sign in, and which page opens first. Shared by all plans."
            actions={
              <Button variant="outline" onClick={onOpenLoginDialog}>
                Customize login
              </Button>
            }
          />
        </RevealItem>
      </Reveal>

      {/* Save bar: the one primary action of the Home page */}
      <div className="px-glass sticky bottom-3 z-10 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 shadow-raised">
        <p className="min-w-0 flex-1 basis-48 text-sm text-muted-foreground">
          Saves the welcome message, announcement, video, daily checklist and buttons for this plan.
        </p>
        <Button
          variant="accent"
          onClick={async () => {
            await saveDailyChecklistItems();
            await saveHomeSettings();
          }}
          disabled={isSaving}
        >
          <Save className="size-4" />
          {isSaving ? "Saving…" : "Save Home page"}
        </Button>
      </div>

      {/* Announcement image dialog */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Announcement Image</DialogTitle>
            <DialogDescription>Upload an image or paste an image URL.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImageUpload(f);
                }}
              />
              <HaloDropzone
                accept="image/*"
                disabled={uploadingImage}
                emptyLabel={uploadingImage ? "Uploading…" : "Drop an image, or click to choose"}
                formatHint="PNG or JPG, 16:9 looks best"
                successLabel="Image added"
                showSuccessThumbnails={false}
                successResetMs={1800}
                onFiles={(files) => {
                  if (files[0]) handleImageUpload(files[0]);
                }}
              />
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">Image URL</label>
              <Input
                value={tempImageUrl}
                onChange={(e) => setTempImageUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            {tempImageUrl && (
              <div className="rounded-md border overflow-hidden aspect-video bg-muted/20">
                <img src={tempImageUrl} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setImageDialogOpen(false)}>Cancel</Button>
            <Button variant="accent"
              onClick={() => {
                update({ announcements_image_url: tempImageUrl || null });
                setImageDialogOpen(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Welcome video preview dialog */}
      <Dialog open={videoPreviewOpen} onOpenChange={setVideoPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Welcome Video Preview</DialogTitle>
            <DialogDescription>Preview how your welcome video will render.</DialogDescription>
          </DialogHeader>
          {homeSettings.welcome_video_url && (
            <div className="rounded-md overflow-hidden border bg-muted/30">
              {homeSettings.welcome_video_is_embed ? (
                <div dangerouslySetInnerHTML={{ __html: homeSettings.welcome_video_url }} />
              ) : getYoutubeEmbed(homeSettings.welcome_video_url) ? (
                <div className="aspect-video">
                  <iframe
                    src={getYoutubeEmbed(homeSettings.welcome_video_url)!}
                    title="Welcome video"
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <video
                  src={homeSettings.welcome_video_url}
                  controls
                  className="w-full"
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default V3HomeView;
