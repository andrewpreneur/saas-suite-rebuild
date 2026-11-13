import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PanelTop,
  HelpCircle,
  BookOpen,
  MessageCircle,
  Ticket,
  Video,
  Phone,
  Mail,
  Link2,
  Calendar,
  Star,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  DEFAULT_CARD_SUBTITLE,
  DEFAULT_CARD_TITLE,
  EMBED_TAB_BY_ID,
  EMBED_TAB_LABELS,
  TOP_NAV_WIDGET_ICONS,
  TOP_NAV_WIDGET_ICON_LABELS,
  resolveTopNavWidgetColor,
  sanitizeTopNavWidgetConfig,
  sanitizeTopNavWidgetOptions,
  targetError,
  type TopNavWidgetIcon,
  type TopNavWidgetOption,
  type TopNavWidgetShowOn,
} from "@/lib/topNavWidgetOptions";
import type { TopNavEditorState } from "@/lib/designPageModel";

type Mode = "primary" | "secondary" | "tertiary" | "custom";
type Target = "button" | "icon" | "tile";

interface Props {
  email: string | null | undefined;
  colors: { primary: string; secondary: string; tertiary: string };
  /** Design page holds the draft and saves with the rest of the page. */
  controlled?: {
    state: TopNavEditorState;
    onChange: (next: TopNavEditorState) => void;
  };
  /** The Design page draws the enable switch itself. */
  hideToggle?: boolean;
}

type UserUpdate = Database["public"]["Tables"]["saas_suite_users"]["Update"];

const COLS = {
  button: {
    mode: "top_nav_widget_color_mode",
    custom: "top_nav_widget_custom_color",
    title: "Button color",
  },
  icon: {
    mode: "top_nav_widget_icon_color_mode",
    custom: "top_nav_widget_icon_custom_color",
    title: "Question mark icon color",
  },
  tile: {
    mode: "top_nav_widget_tile_color_mode",
    custom: "top_nav_widget_tile_custom_color",
    title: "Menu icon & box color",
  },
} as const;

const SETTINGS_COLUMNS =
  "top_nav_widget_enabled, top_nav_widget_label, top_nav_widget_color_mode, top_nav_widget_custom_color, top_nav_widget_icon_color_mode, top_nav_widget_icon_custom_color, top_nav_widget_tile_color_mode, top_nav_widget_tile_custom_color" as const;

const HEX6 = /^#[0-9a-f]{6}$/i;

const OPTION_ICONS: Record<TopNavWidgetIcon, typeof BookOpen> = {
  book: BookOpen,
  chat: MessageCircle,
  ticket: Ticket,
  help: HelpCircle,
  video: Video,
  phone: Phone,
  mail: Mail,
  link: Link2,
  calendar: Calendar,
  star: Star,
};

const TopNavWidgetCard = ({ email, colors, controlled, hideToggle = false }: Props) => {
  const [localEnabled, setEnabled] = useState(false);
  const [localLabel, setLabel] = useState("Help & Support");
  const [localOptions, setOptions] = useState<TopNavWidgetOption[]>(() =>
    sanitizeTopNavWidgetOptions(null),
  );
  const [localTitle, setCardTitle] = useState(DEFAULT_CARD_TITLE);
  const [localSubtitle, setCardSubtitle] = useState(DEFAULT_CARD_SUBTITLE);
  const [localShowOn, setShowOn] = useState<TopNavWidgetShowOn>("both");
  const [localModes, setModes] = useState<Record<Target, Mode>>({
    button: "primary",
    icon: "primary",
    tile: "primary",
  });
  const [localCustoms, setCustoms] = useState<Record<Target, string>>({
    button: "#000000",
    icon: "#000000",
    tile: "#000000",
  });
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);
  const enabled = controlled ? controlled.state.enabled : localEnabled;
  const label = controlled ? controlled.state.label : localLabel;
  const options = controlled ? controlled.state.options : localOptions;
  const cardTitle = controlled ? controlled.state.cardTitle : localTitle;
  const cardSubtitle = controlled ? controlled.state.cardSubtitle : localSubtitle;
  const showOn = controlled ? controlled.state.showOn : localShowOn;
  const modes = controlled ? controlled.state.modes : localModes;
  const customs = controlled ? controlled.state.customs : localCustoms;

  const update = (partial: Partial<TopNavEditorState>, persist?: UserUpdate) => {
    if (controlled) {
      controlled.onChange({ ...controlled.state, ...partial });
      return;
    }
    if (partial.enabled !== undefined) setEnabled(partial.enabled);
    if (partial.label !== undefined) setLabel(partial.label);
    if (partial.options !== undefined) setOptions(partial.options);
    if (partial.cardTitle !== undefined) setCardTitle(partial.cardTitle);
    if (partial.cardSubtitle !== undefined) setCardSubtitle(partial.cardSubtitle);
    if (partial.showOn !== undefined) setShowOn(partial.showOn);
    if (partial.modes !== undefined) setModes(partial.modes);
    if (partial.customs !== undefined) setCustoms(partial.customs);
    if (persist) void save(persist);
  };

  useEffect(() => {
    if (controlled || !email) return;
    supabase
      .from("saas_suite_users")
      .select(SETTINGS_COLUMNS)
      .ilike("email", email.trim().toLowerCase())
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setEnabled(!!data.top_nav_widget_enabled);
        setLabel(data.top_nav_widget_label || "Help & Support");
        const m = { ...modes };
        const c = { ...customs };
        (Object.keys(COLS) as Target[]).forEach((t) => {
          const mode = data[COLS[t].mode];
          const custom = data[COLS[t].custom];
          m[t] = (typeof mode === "string" ? mode : "primary") as Mode;
          if (typeof custom === "string" && custom) c[t] = custom;
        });
        setModes(m);
        setCustoms(c);
      });
    // Options live in their own column. A missing column (migration not applied)
    // must not block the rest of this card.
    supabase
      .from("saas_suite_users")
      .select("top_nav_widget_options")
      .ilike("email", email.trim().toLowerCase())
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) return;
        const menu = sanitizeTopNavWidgetConfig(data.top_nav_widget_options);
        setOptions(menu.options);
        setCardTitle(menu.title);
        setCardSubtitle(menu.subtitle);
        setShowOn(menu.showOn);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const save = async (patch: UserUpdate) => {
    if (!email) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("saas_suite_users")
      .update(patch)
      .ilike("email", email.trim().toLowerCase())
      .select("agency_id, agency_id_basic, agency_id_advanced, agency_id_elite");
    setSaving(false);
    if (error || !data?.length) {
      toast.error("Could not save the help widget");
      return;
    }
    toast.success("Help widget saved");
    const row = data[0];
    const ids = [
      row.agency_id,
      row.agency_id_basic,
      row.agency_id_advanced,
      row.agency_id_elite,
    ].filter((id): id is string => typeof id === "string" && id.length > 0);
    const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dynamic-styles`;
    await Promise.all(
      Array.from(new Set(ids)).map((id) =>
        fetch(`${base}?agency_id=${encodeURIComponent(id)}&type=js&force=1`, {
          cache: "no-store",
        }).catch(() => {}),
      ),
    );
  };

  const resolved = (t: Target) =>
    resolveTopNavWidgetColor(modes[t], customs[t], colors, colors.primary || "#1d1d1f");

  const patchOption = (id: TopNavWidgetOption["id"], patch: Partial<TopNavWidgetOption>) => {
    update({
      options: options.map((option) => (option.id === id ? { ...option, ...patch } : option)),
    });
  };

  const moveOption = (index: number, direction: -1 | 1) => {
    const next = options.slice();
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    update({ options: next });
  };

  const saveOptions = () => {
    const invalid = options.find((option) => targetError(option.target));
    if (invalid) {
      toast.error(targetError(invalid.target) || "Check the option links");
      return;
    }
    void save({
      top_nav_widget_options: {
        title: cardTitle.trim() || DEFAULT_CARD_TITLE,
        subtitle: cardSubtitle.trim() || DEFAULT_CARD_SUBTITLE,
        showOn,
        options: sanitizeTopNavWidgetOptions(options),
      } as unknown as Json,
    });
  };

  const ColorGroup = ({ target }: { target: Target }) => {
    const swatches: { mode: Mode; label: string; color: string }[] = [
      { mode: "primary", label: "Primary", color: colors.primary },
      { mode: "secondary", label: "Color 2", color: colors.secondary },
      { mode: "tertiary", label: "Color 3", color: colors.tertiary || colors.secondary || "#ffffff" },
      { mode: "custom", label: "Custom", color: customs[target] },
    ];
    const cfg = COLS[target];
    const saveCustom = () => {
      if (!HEX6.test(customs[target])) return;
      update({ customs: { ...customs } }, { [cfg.custom]: customs[target] });
    };
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">{cfg.title}</Label>
        <div className="grid grid-cols-4 gap-2">
          {swatches.map((s) => (
            <button
              key={s.mode}
              type="button"
              onClick={() => {
                update({ modes: { ...modes, [target]: s.mode } }, { [cfg.mode]: s.mode });
              }}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-md border text-[11px] transition-colors",
                modes[target] === s.mode
                  ? "border-brand bg-brand-subtle"
                  : "border-border hover:bg-muted",
              )}
            >
              <span
                className="w-6 h-6 rounded-full border border-border"
                style={{ backgroundColor: s.color }}
              />
              {s.label}
            </button>
          ))}
        </div>
        {modes[target] === "custom" && (
          <div className="flex items-center gap-2 pt-1">
            <input
              type="color"
              value={HEX6.test(customs[target]) ? customs[target] : "#000000"}
              onChange={(e) => update({ customs: { ...customs, [target]: e.target.value } })}
              onBlur={saveCustom}
              className="h-9 w-12 rounded border border-border bg-transparent"
            />
            <Input
              value={customs[target]}
              onChange={(e) => update({ customs: { ...customs, [target]: e.target.value } })}
              onBlur={saveCustom}
              placeholder="#000000"
              className="w-28"
            />
          </div>
        )}
      </div>
    );
  };

  const btn = resolved("button");
  const icon = resolved("icon");
  const tile = resolved("tile");
  const previewRows = options.filter((option) => option.visible);

  return (
    <div className="space-y-3">
      {hideToggle ? null : (
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
        <div className="flex items-center gap-2">
          <PanelTop className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Top Navigation Help Widget</span>
        </div>
        <Switch
          checked={enabled}
          disabled={saving}
          onCheckedChange={(v) => {
            update({ enabled: v }, { top_nav_widget_enabled: v });
          }}
          aria-label="Top navigation help widget"
        />
      </div>
      )}

      {enabled && (
        <div className="space-y-4 p-3 rounded-lg border border-border">
          <div className="space-y-1.5">
            <Label className="text-xs">Preview</Label>
            <div className="rounded-lg border border-border bg-muted/40 p-3 overflow-hidden">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setPreviewOpen((o) => !o)}
                  className="h-9 pl-3 pr-4 rounded-full inline-flex items-center gap-2 text-sm font-medium shadow-md transition-transform hover:scale-[1.03]"
                  style={{ backgroundColor: btn, color: "#fff" }}
                >
                  <HelpCircle className="w-[18px] h-[18px]" style={{ color: icon }} />
                  <span className="truncate max-w-[180px]">{label || "Help & Support"}</span>
                </button>
              </div>
              <div
                className={cn(
                  "ml-auto mt-2.5 w-full max-w-[340px] rounded-2xl border p-2 shadow-lg transition-all duration-300",
                  previewOpen
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 -translate-y-2 pointer-events-none h-0 p-0 mt-0 overflow-hidden",
                )}
                style={{
                  background: "rgba(255,255,255,.95)",
                  color: "#1d1d1f",
                  borderColor: "rgba(0,0,0,.06)",
                }}
              >
                <div className="flex items-start justify-between pl-3 pr-2 py-3">
                  <div>
                    <p className="text-[17px] font-semibold leading-tight">
                      {cardTitle || DEFAULT_CARD_TITLE}
                    </p>
                    <p className="text-[13px]" style={{ color: "#6e6e73" }}>
                      {cardSubtitle || DEFAULT_CARD_SUBTITLE}
                    </p>
                  </div>
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: "#f5f5f7", color: "#6e6e73" }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </span>
                </div>
                {previewRows.length ? (
                  previewRows.map((option) => {
                    const Icon = OPTION_ICONS[option.icon] || BookOpen;
                    return (
                      <div
                        key={option.id}
                        className="flex items-center gap-3.5 rounded-xl px-3 py-2.5 min-h-[64px]"
                      >
                        <span
                          className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0"
                          style={{ background: `${tile}22` }}
                        >
                          <Icon className="w-5 h-5" style={{ color: tile }} />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[15px] font-semibold truncate">
                            {option.label}
                          </span>
                          {option.description ? (
                            <span
                              className="block text-[13px] truncate"
                              style={{ color: "#6e6e73" }}
                            >
                              {option.description}
                            </span>
                          ) : null}
                        </span>
                        <ChevronRight className="w-4 h-4" style={{ color: "#aeaeb2" }} />
                      </div>
                    );
                  })
                ) : (
                  <p className="px-3 pb-3 text-[13px]" style={{ color: "#6e6e73" }}>
                    No help options are turned on.
                  </p>
                )}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Open in a new tab leaves HighLevel. Open embed opens the same bottom-right chat popup,
              on that option's topic when the popup supports it.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Button text</Label>
            <div className="flex gap-2">
              <Input
                value={label}
                onChange={(e) => update({ label: e.target.value })}
                maxLength={40}
                placeholder="Help & Support"
              />
              {controlled ? null : (
              <Button
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => save({ top_nav_widget_label: label.trim() || "Help & Support" })}
              >
                Save
              </Button>
              )}
            </div>
          </div>
          <ColorGroup target="button" />
          <ColorGroup target="icon" />
          <ColorGroup target="tile" />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tnw-card-title" className="text-xs">
                Card title
              </Label>
              <Input
                id="tnw-card-title"
                value={cardTitle}
                maxLength={60}
                onChange={(e) => update({ cardTitle: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tnw-card-subtitle" className="text-xs">
                Card subtitle
              </Label>
              <Input
                id="tnw-card-subtitle"
                value={cardSubtitle}
                maxLength={80}
                onChange={(e) => update({ cardSubtitle: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Show on</Label>
            <Select
              value={showOn}
              onValueChange={(value) => update({ showOn: value as TopNavWidgetShowOn })}
            >
              <SelectTrigger aria-label="Where the help button shows">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Sub-accounts and agency view</SelectItem>
                <SelectItem value="sub-accounts">Sub-accounts only</SelectItem>
                <SelectItem value="agency">Agency view only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-xs">Menu options</Label>
              <p className="text-[11px] text-muted-foreground mt-1">
                Rename each option, pick an icon, choose where it goes, show or hide it, and change
                the order.
              </p>
            </div>
            {options.map((option, index) => {
              const linkError = targetError(option.target);
              return (
                <div
                  key={option.id}
                  className={cn(
                    "space-y-3 rounded-lg border border-border p-3",
                    !option.visible && "opacity-60",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">Option {index + 1}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        disabled={index === 0}
                        aria-label={`Move option ${index + 1} up`}
                        onClick={() => moveOption(index, -1)}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        disabled={index === options.length - 1}
                        aria-label={`Move option ${index + 1} down`}
                        onClick={() => moveOption(index, 1)}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <div className="ml-2 flex items-center gap-2">
                        <Label
                          htmlFor={`tnw-show-${option.id}`}
                          className="text-xs text-muted-foreground"
                        >
                          Show
                        </Label>
                        <Switch
                          id={`tnw-show-${option.id}`}
                          checked={option.visible}
                          onCheckedChange={(value) => patchOption(option.id, { visible: value })}
                          aria-label={`Show option ${index + 1}`}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor={`tnw-label-${option.id}`} className="text-xs">
                        Label
                      </Label>
                      <Input
                        id={`tnw-label-${option.id}`}
                        value={option.label}
                        maxLength={40}
                        onChange={(e) => patchOption(option.id, { label: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Icon</Label>
                      <Select
                        value={option.icon}
                        onValueChange={(value) =>
                          patchOption(option.id, { icon: value as TopNavWidgetIcon })
                        }
                      >
                        <SelectTrigger aria-label={`Icon for option ${index + 1}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TOP_NAV_WIDGET_ICONS.map((iconName) => (
                            <SelectItem key={iconName} value={iconName}>
                              {TOP_NAV_WIDGET_ICON_LABELS[iconName]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`tnw-desc-${option.id}`} className="text-xs">
                      Subtitle
                    </Label>
                    <Input
                      id={`tnw-desc-${option.id}`}
                      value={option.description}
                      maxLength={80}
                      onChange={(e) => patchOption(option.id, { description: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`tnw-target-${option.id}`} className="text-xs">
                      URL or popup tab
                    </Label>
                    <Input
                      id={`tnw-target-${option.id}`}
                      value={option.target}
                      maxLength={300}
                      placeholder="/education or https://"
                      onChange={(e) => patchOption(option.id, { target: e.target.value })}
                    />
                    {linkError ? (
                      <p className="text-[11px] text-destructive">{linkError}</p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        A path like /support-chat opens your Client Hub in a new tab. Open embed
                        opens the {EMBED_TAB_LABELS[EMBED_TAB_BY_ID[option.id]]} tab in the chat
                        popup.
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => patchOption(option.id, { openMode: "tab" })}
                      className={cn(
                        "rounded-md border px-2 py-2 text-xs font-medium",
                        option.openMode === "tab"
                          ? "border-brand bg-brand-subtle"
                          : "border-border hover:bg-muted",
                      )}
                    >
                      Open in new tab
                    </button>
                    <button
                      type="button"
                      onClick={() => patchOption(option.id, { openMode: "embed" })}
                      className={cn(
                        "rounded-md border px-2 py-2 text-xs font-medium",
                        option.openMode === "embed"
                          ? "border-brand bg-brand-subtle"
                          : "border-border hover:bg-muted",
                      )}
                    >
                      Open embed
                    </button>
                  </div>
                </div>
              );
            })}
            {controlled ? null : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={saveOptions}
            >
              Save menu
            </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TopNavWidgetCard;
