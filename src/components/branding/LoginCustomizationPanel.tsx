import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Upload, Link, X, LogIn, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const BACKGROUND_COLORS = [
  { name: "Black", value: "black", hex: "#000000", textColor: "white", url: "https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/69d3313913bef1fb2595a48b.png" },
  { name: "White", value: "white", hex: "#FFFFFF", textColor: "black", url: "https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/69d3313984c045c274810f14.png" },
  { name: "Grey", value: "grey", hex: "#6B7280", textColor: "white", url: "https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/69d3313913bef1fb2595a48a.png" },
  { name: "Purple", value: "purple", hex: "#7C3AED", textColor: "white", url: "https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/69d33139a7dcb4cff0cd8cd3.png" },
  { name: "Yellow", value: "yellow", hex: "#EAB308", textColor: "black", url: "https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/69d3313984c045c274810f13.png" },
  { name: "Green", value: "green", hex: "#16A34A", textColor: "white", url: "https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/69d331390361f3199bca0cb5.png" },
  { name: "Blue", value: "blue", hex: "#2563EB", textColor: "white", url: "https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/69d32fa4746fefeff890246a.jpg" },
  { name: "Teal", value: "teal", hex: "#0D9488", textColor: "white", url: "https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/69d33139059003c790863393.png" },
  { name: "Orange", value: "orange", hex: "#EA580C", textColor: "white", url: "https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/69d331394cde4bbc2af0268d.png" },
  { name: "Red", value: "red", hex: "#DC2626", textColor: "white", url: "https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/69d33139e19ba66828833d5a.png" },
  { name: "Magenta", value: "magenta", hex: "#D946EF", textColor: "white", url: "https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/69d331393d829c73b25e7762.png" },
];

interface LoginCustomizationPanelProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  selectedBackground: string | null;
  onBackgroundChange: (bg: string | null) => void;
  logoUrl: string;
  onLogoUrlChange: (url: string) => void;
  backgroundImageUrls?: Record<string, string>;
  /** The Design page draws the switch in its own row. */
  hideHeader?: boolean;
}

const LoginCustomizationPanel = ({
  enabled,
  onToggle,
  selectedBackground,
  onBackgroundChange,
  logoUrl,
  onLogoUrlChange,
  hideHeader = false,
}: LoginCustomizationPanelProps) => {
  const [logoInputMode, setLogoInputMode] = useState<"url" | "upload">("url");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File must be under 5MB");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("logos")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("logos")
        .getPublicUrl(fileName);

      onLogoUrlChange(urlData.publicUrl);
      toast.success("Logo uploaded successfully!");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };
  return (
    <Card className={hideHeader ? "border-0 shadow-none" : "border-2 border-border"}>
      <CardContent className={hideHeader ? "flex flex-col gap-4 p-0" : "pt-4 space-y-4"}>
        {hideHeader ? null : (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LogIn className="w-5 h-5 text-primary" />
            <div>
              <Label className="text-base font-semibold">Login Page Customization</Label>
              <p className="text-xs text-muted-foreground">Custom background, logo & styled login form</p>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={onToggle} />
        </div>
        )}

        {enabled && (
          <div className="space-y-5 pt-2 border-t border-border">
            {/* Background Color Selection */}
            <div className="space-y-2 pt-3">
              <Label className="text-sm font-medium">Login Background</Label>
              <div className="grid grid-cols-4 gap-2">
                {BACKGROUND_COLORS.map((bg) => (
                  <button
                    key={bg.value}
                    onClick={() => onBackgroundChange(selectedBackground === bg.value ? null : bg.value)}
                    className={`relative rounded-lg p-2 text-xs font-medium transition-all border-2 ${
                      selectedBackground === bg.value
                        ? "border-primary ring-2 ring-primary/20 scale-105"
                        : "border-border hover:border-primary/40"
                    }`}
                    style={{ backgroundColor: bg.hex, color: bg.textColor }}
                  >
                    {bg.name}
                    {selectedBackground === bg.value && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                        <span className="text-[8px] text-primary-foreground">✓</span>
                      </div>
                    )}
                  </button>
                ))}
                {/* None option */}
                <button
                  onClick={() => onBackgroundChange(null)}
                  className={`rounded-lg p-2 text-xs font-medium transition-all border-2 bg-muted text-muted-foreground ${
                    selectedBackground === null
                      ? "border-primary ring-2 ring-primary/20 scale-105"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  None
                </button>
              </div>
            </div>

            {/* Logo Input */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Login Page Logo</Label>
              <div className="flex gap-2 mb-2">
                <Button
                  variant={logoInputMode === "url" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLogoInputMode("url")}
                  className="gap-1"
                >
                  <Link className="w-3 h-3" />
                  Paste URL
                </Button>
                <Button
                  variant={logoInputMode === "upload" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLogoInputMode("upload")}
                  className="gap-1"
                >
                  <Upload className="w-3 h-3" />
                  Upload
                </Button>
              </div>

              {logoInputMode === "url" ? (
                <Input
                  placeholder="https://example.com/logo.png"
                  value={logoUrl}
                  onChange={(e) => onLogoUrlChange(e.target.value)}
                />
              ) : (
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                    ) : (
                      <><Upload className="w-4 h-4" /> Choose Logo Image</>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">PNG, JPG or SVG — max 5MB</p>
                </div>
              )}

              {logoUrl && (
                <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                  <img
                    src={logoUrl}
                    alt="Logo preview"
                    className="h-10 max-w-[120px] object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <span className="text-xs text-muted-foreground truncate flex-1">{logoUrl}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onLogoUrlChange("")}
                    className="h-6 w-6 p-0"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export { BACKGROUND_COLORS };
export default LoginCustomizationPanel;
