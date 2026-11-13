import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MousePointerClick } from "lucide-react";

interface ButtonCustomizationPanelProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  primaryColor: string;
  /** The Design page draws the switch in its own row. */
  hideHeader?: boolean;
}

const ButtonCustomizationPanel = ({
  enabled,
  onToggle,
  primaryColor,
  hideHeader = false,
}: ButtonCustomizationPanelProps) => {
  return (
    <Card className={hideHeader ? "border-0 shadow-none" : "border-2 border-border"}>
      <CardContent className={hideHeader ? "p-0" : "pt-4 space-y-4"}>
        {hideHeader ? null : (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MousePointerClick className="w-5 h-5 text-primary" />
            <div>
              <Label className="text-base font-semibold">Top Button Customization</Label>
              <p className="text-xs text-muted-foreground">Styled navigation buttons with gradient hover effects</p>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={onToggle} />
        </div>
        )}

        {enabled && (
          <div className={hideHeader ? "" : "border-t border-border pt-4"}>
            <div className="flex flex-col gap-3 rounded-md bg-muted/60 p-3">
              <p className="text-sm text-muted-foreground">
                Adds a polished gradient to your top navigation buttons, using your highlight color.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-eyebrow mr-1">Preview</span>
                <span
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-white shadow-card"
                  style={{
                    background: `linear-gradient(270deg, ${primaryColor} 0%, ${darkenColor(primaryColor, 0.35)} 100%)`,
                  }}
                >
                  Active tab
                </span>
                <span className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium shadow-card">
                  Normal tab
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Helper: darken a hex color by a ratio (0-1)
function darkenColor(hex: string, ratio: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;
  const r = Math.round(parseInt(result[1], 16) * (1 - ratio));
  const g = Math.round(parseInt(result[2], 16) * (1 - ratio));
  const b = Math.round(parseInt(result[3], 16) * (1 - ratio));
  return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
}

export { darkenColor };
export default ButtonCustomizationPanel;
