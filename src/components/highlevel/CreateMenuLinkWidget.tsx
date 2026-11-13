import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ArrowRight, ArrowUp, Rocket, Star, CircleHelp, GraduationCap, BookOpen, Play, House, Zap, LifeBuoy, Info, Gift, Flag, Compass,
  Loader2, CheckCircle2, ShieldCheck,
} from "lucide-react";
import { ghl } from "./ghlApi";
import SubAccountPicker from "./SubAccountPicker";
import { cn } from "@/lib/utils";

// HighLevel icon names (Font Awesome solid) with a matching preview icon.
const ICONS = [
  { name: "arrow-right", label: "Arrow right", Icon: ArrowRight },
  { name: "arrow-up", label: "Arrow up", Icon: ArrowUp },
  { name: "rocket", label: "Rocket", Icon: Rocket },
  { name: "star", label: "Star", Icon: Star },
  { name: "circle-question", label: "Question mark", Icon: CircleHelp },
  { name: "graduation-cap", label: "Graduation cap", Icon: GraduationCap },
  { name: "book", label: "Book", Icon: BookOpen },
  { name: "play", label: "Play", Icon: Play },
  { name: "house", label: "Home", Icon: House },
  { name: "bolt", label: "Lightning", Icon: Zap },
  { name: "life-ring", label: "Support", Icon: LifeBuoy },
  { name: "circle-info", label: "Info", Icon: Info },
  { name: "gift", label: "Gift", Icon: Gift },
  { name: "flag", label: "Flag", Icon: Flag },
  { name: "compass", label: "Compass", Icon: Compass },
];

interface Props {
  agencyId: string | null;
  defaultUrl: string;
  onCreated: (menuId: string) => void;
  /** Chat installer: the URL is always their client hub link, so don't show it. */
  hideUrl?: boolean;
}

/** Creates the onboarding custom menu link in HighLevel: sub-accounts only, iframe, no camera/mic. */
export default function CreateMenuLinkWidget({ agencyId, defaultUrl, onCreated, hideUrl = false }: Props) {
  const [title, setTitle] = useState("Onboarding");
  const [url, setUrl] = useState(defaultUrl);
  const [icon, setIcon] = useState("rocket");
  const [scope, setScope] = useState<"all" | "one">("all");
  const [loc, setLoc] = useState("");
  const [busy, setBusy] = useState(false);
  const [doneId, setDoneId] = useState<string | null>(null);

  useEffect(() => { if (defaultUrl && !url) setUrl(defaultUrl); }, [defaultUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (!agencyId) return;
    setBusy(true);
    try {
      const r = await ghl<{ menu_link_id: string | null }>("create_menu", agencyId, {
        title: title.trim(), url: url.trim(), icon, scope, location_id: scope === "one" ? loc : undefined,
      });
      setDoneId(r.menu_link_id ?? "created");
      if (r.menu_link_id) onCreated(r.menu_link_id);
      toast.success("Menu link installed in HighLevel");
    } catch (e: any) {
      toast.error(e.message || "Couldn't create the menu link");
    } finally {
      setBusy(false);
    }
  };

  if (doneId) {
    return (
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium">Menu link installed in HighLevel</p>
          <p className="text-muted-foreground">It's saved below as your Menu Link ID. Refresh HighLevel to see it in the sidebar.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div>
        <h4 className="font-semibold">Install the menu link for me</h4>
        <p className="text-sm text-muted-foreground">Create the custom menu link in HighLevel right from here.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Menu name</Label>
          <Input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} />
        </div>
        {!hideUrl && <div className="space-y-1.5">
          <Label>Menu link URL</Label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} className="font-mono text-xs" />
        </div>}
      </div>

      <div className="space-y-1.5">
        <Label>Icon</Label>
        <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
          {ICONS.map(({ name, label, Icon }) => (
            <button
              key={name} type="button" title={label} aria-label={label} aria-pressed={icon === name}
              onClick={() => setIcon(name)}
              className={cn("flex items-center justify-center h-10 rounded-md border transition-colors",
                icon === name ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")}
            >
              <Icon className="w-5 h-5" />
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Who gets it</Label>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant={scope === "all" ? "default" : "outline"} onClick={() => setScope("all")}>All sub-accounts</Button>
          <Button type="button" size="sm" variant={scope === "one" ? "default" : "outline"} onClick={() => setScope("one")}>One sub-account</Button>
        </div>
        {scope === "one" && <div className="pt-2"><SubAccountPicker agencyId={agencyId} value={loc} onChange={setLoc} /></div>}
      </div>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="w-4 h-4 shrink-0" />
        Sub-accounts only (not your agency view), opens embedded inside HighLevel, no camera or microphone access, available to all user roles.
      </p>

      <Button onClick={submit} disabled={busy || !agencyId || !title.trim() || !url.trim() || (scope === "one" && !loc)} className="w-full">
        {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Install in HighLevel
      </Button>
    </div>
  );
}
