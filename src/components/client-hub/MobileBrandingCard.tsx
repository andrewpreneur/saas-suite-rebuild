import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Smartphone, Loader2 } from "lucide-react";
import { toast } from "sonner";
import ColorPicker from "@/components/ColorPicker";
import { Switch } from "@/components/ui/switch";

interface Props {
  email: string | null | undefined;
  colors: { primary: string; secondary: string; tertiary: string };
  /** Design page holds the draft and saves with the rest of the page. */
  controlled?: {
    enabled: boolean;
    menuColor: string;
    zoomEnabled: boolean;
    onChange: (next: { enabled: boolean; menuColor: string; zoomEnabled: boolean }) => void;
  };
  /** Hide the title and the per-section apply buttons. */
  hideChrome?: boolean;
}

const MobileBrandingCard = ({ email, controlled, hideChrome = false }: Props) => {
  const [localEnabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!controlled);
  const [localZoom, setZoomEnabled] = useState(true);
  const [localColor, setMenuColor] = useState("#3b82f6");
  const deferred = Boolean(controlled);
  const enabled = controlled ? controlled.enabled : localEnabled;
  const zoomEnabled = controlled ? controlled.zoomEnabled : localZoom;
  const menuColor = controlled ? controlled.menuColor : localColor;

  useEffect(() => {
    if (deferred || !email) return;
    let active = true;
    setLoading(true);
    supabase
      .from("saas_suite_users")
      .select("mobile_branding_enabled, mobile_menu_color, mobile_zoom_enabled" as any)
      .ilike("email", email.trim().toLowerCase())
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setEnabled(!!(data as any)?.mobile_branding_enabled);
        setMenuColor((data as any)?.mobile_menu_color || "#3b82f6");
        setZoomEnabled((data as any)?.mobile_zoom_enabled !== false);
        setLoading(false);
      });
    return () => { active = false; };
  }, [email, deferred]);

  const toggle = async (next = !enabled, nextZoom = zoomEnabled) => {
    if (!email) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("saas_suite_users")
      .update({ mobile_branding_enabled: next, mobile_menu_color: menuColor, mobile_zoom_enabled: nextZoom } as any)
      .ilike("email", email.trim().toLowerCase())
      .select("agency_id, agency_id_basic, agency_id_advanced, agency_id_elite");
    if (error || !data?.length) {
      setSaving(false);
      toast.error("Could not update mobile branding");
      return;
    }
    const row: any = data[0];
    const ids = Array.from(new Set([row.agency_id, row.agency_id_basic, row.agency_id_advanced, row.agency_id_elite].filter(Boolean)));
    const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dynamic-styles`;
    await Promise.all(
      ids.flatMap((id) =>
        ["css", "js"].map((type) =>
          fetch(`${base}?agency_id=${encodeURIComponent(id as string)}&type=${type}&force=1`, { cache: "no-store" }).catch(() => {}),
        ),
      ),
    );
    setEnabled(next);
    setZoomEnabled(nextZoom);
    setSaving(false);
    toast.success(nextZoom !== zoomEnabled
      ? `Mobile zoom controls ${nextZoom ? "enabled" : "disabled"} — refresh HighLevel on your phone`
      : next ? "Mobile branding applied — refresh HighLevel on your phone" : "Mobile branding removed");
  };

  const setColor = (color: string) => {
    if (controlled) controlled.onChange({ enabled, menuColor: color, zoomEnabled });
    else setMenuColor(color);
  };
  const setZoom = (value: boolean) => {
    if (controlled) controlled.onChange({ enabled, menuColor, zoomEnabled: value });
    else void toggle(enabled, value);
  };

  return (
    <div className={hideChrome ? "flex flex-col gap-3" : "rounded-xl border border-border bg-card p-5 space-y-3"}>
      {hideChrome ? null : (
      <div className="flex items-center gap-2">
        <Smartphone className="w-5 h-5 text-brand" />
        <h3 className="font-semibold">Mobile Branding</h3>
        <Badge variant="secondary">Beta</Badge>
        {enabled && <Badge>On</Badge>}
      </div>
      )}
      {hideChrome ? null : (
      <p className="text-sm text-muted-foreground">
        Improves the mobile experience of HighLevel: a full-screen menu with a branded menu button, full-width pages,
        smoother scrolling, easier tapping, and zoom controls. Only the menu widget uses your chosen color;
        your existing sidebar, page and login branding stay unchanged.
      </p>
      )}
      <ColorPicker label="Menu Widget Color" color={menuColor} onChange={setColor} />
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="mobile-zoom-controls" className="text-sm font-medium">Zoom Controls (+ / − / %)</label>
        <Switch id="mobile-zoom-controls" checked={zoomEnabled} onCheckedChange={setZoom} disabled={!controlled && (loading || saving || !email)} />
      </div>
      {hideChrome ? null : (
        <>
          {enabled && <Button variant="accent" onClick={() => void toggle(true)} disabled={loading || saving || !email}>Save Menu Widget Color</Button>}
          <Button onClick={() => void toggle()} disabled={loading || saving || !email} variant={enabled ? "outline" : "default"}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {enabled ? "Remove Mobile Branding" : "Apply Mobile Branding"}
          </Button>
        </>
      )}
    </div>
  );
};

export default MobileBrandingCard;
