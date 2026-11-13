import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Palette, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { notifyHubThemeChanged } from "@/lib/hubUrl";
import { PreviewHeaderHost } from "@/components/client-hub/PreviewHeaderSlot";

export const THEME_NAMES: Record<number, string> = {
  1: "The Video Library",
  2: "The Client Hub",
  3: "The Split View",
  4: "Neo",
};

const ThemePickerCard = ({
  agencyId,
  showPreviewHost = true,
}: {
  agencyId: string | null;
  showPreviewHost?: boolean;
}) => {
  const navigate = useNavigate();
  const [current, setCurrent] = useState<number>(2);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);

  useEffect(() => {
    if (!agencyId) return;
    let cancelled = false;
    setLoading(true);
    (supabase as any)
      .from("agency_ui_versions")
      .select("ui_version")
      .eq("agency_id", agencyId)
      .maybeSingle()
      .then(({ data, error }: any) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to load theme", error);
        } else if (data?.ui_version) {
          setCurrent(data.ui_version);
        } else {
          setCurrent(2); // no row = default
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agencyId]);

  const choose = async (version: number) => {
    if (!agencyId || version === current) return;
    setSaving(version);
    const { error } = await (supabase as any)
      .from("agency_ui_versions")
      .upsert(
        { agency_id: agencyId, ui_version: version, updated_at: new Date().toISOString() },
        { onConflict: "agency_id" },
      );
    setSaving(null);
    if (error) {
      console.error("Failed to save theme", error);
      toast.error("Couldn't save the layout. Please try again.");
      return;
    }
    setCurrent(version);
    notifyHubThemeChanged(agencyId, version);
    toast.success(`Layout set to ${THEME_NAMES[version]}`);
  };

  if (!agencyId) return null;

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        {showPreviewHost ? (
          <div className="flex items-center justify-between gap-3 flex-wrap border-b shadow-sm pb-3 -mx-6 px-6">
            <PreviewHeaderHost />
          </div>
        ) : null}
        <div className={showPreviewHost ? "pt-3" : undefined}>
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Layouts
          </CardTitle>
          <CardDescription className="text-xs mt-1.5">
            Pick the Client Hub layout. Simplified onboarding is one of the options.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <span className="text-sm font-medium">Current layout</span>
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : (
            <Badge variant="secondary" className="text-xs font-semibold">
              {THEME_NAMES[current]}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((v) => {
            const active = v === current;
            return (
              <Button
                key={v}
                variant={active ? "default" : "outline"}
                disabled={loading || saving !== null}
                onClick={() => choose(v)}
                className={cn(
                  "justify-between h-auto py-3 transition-all",
                  active && "ring-2 ring-primary/40",
                )}
              >
                <span className="text-sm font-medium">{THEME_NAMES[v]}</span>
                {saving === v ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : active ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : null}
              </Button>
            );
          })}
          <Button
            type="button"
            variant="outline"
            className="justify-between h-auto py-3 sm:col-span-2"
            onClick={() => navigate("/app/simple-onboarding")}
          >
            <span className="text-sm font-medium">Simplified Onboarding</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ThemePickerCard;
