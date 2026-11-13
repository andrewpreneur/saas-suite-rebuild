import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Upload, Palette } from "lucide-react";
import { OnboardingData } from "../V2OnboardingWizard";
import { extractColorsFromImage, isValidHexColor, normalizeHexColor } from "@/utils/colorExtraction";
import { toast } from "sonner";

interface ColorPreset {
  name: string;
  primary: string;
  secondary: string;
  tertiary: string;
}

interface BrandingStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  colorPresets: ColorPreset[];
}

const BrandingStep = ({ data, updateData, colorPresets }: BrandingStepProps) => {
  const [colorMode, setColorMode] = useState<"presets" | "custom">("presets");
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [tempColors, setTempColors] = useState({
    primary: data.primaryColor,
    secondary: data.secondaryColor,
    tertiary: data.tertiaryColor,
  });

  const handlePresetSelect = (preset: ColorPreset) => {
    setSelectedPreset(preset.name);
    setTempColors({
      primary: preset.primary,
      secondary: preset.secondary,
      tertiary: preset.tertiary,
    });
    updateData({
      primaryColor: preset.primary,
      secondaryColor: preset.secondary,
      tertiaryColor: preset.tertiary,
    });
  };

  const handleColorInputChange = (
    color: "primary" | "secondary" | "tertiary",
    value: string
  ) => {
    setTempColors(prev => ({ ...prev, [color]: value }));
    if (isValidHexColor(value)) {
      const normalized = normalizeHexColor(value);
      updateData({
        [`${color}Color`]: normalized,
      });
    }
  };

  const handleColorPickerChange = (
    color: "primary" | "secondary" | "tertiary",
    value: string
  ) => {
    setTempColors(prev => ({ ...prev, [color]: value }));
    updateData({
      [`${color}Color`]: value,
    });
    setSelectedPreset(null);
  };

  const handleImageUpload = async (file: File) => {
    try {
      const extractedColors = await extractColorsFromImage(file);
      const colorObj = {
        primary: extractedColors[0] || "#3b82f6",
        secondary: extractedColors[1] || "#10b981",
        tertiary: extractedColors[2] || "#f59e0b",
      };
      setTempColors(colorObj);
      updateData({
        primaryColor: colorObj.primary,
        secondaryColor: colorObj.secondary,
        tertiaryColor: colorObj.tertiary,
      });
      setSelectedPreset(null);
      toast.success("Colors extracted from image!");
    } catch (error) {
      toast.error("Failed to extract colors from image");
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Brand Your SaaS Suite</h2>
        <p className="text-muted-foreground mt-2">
          Customize the look and feel of the dashboard your clients will see.
        </p>
      </div>

      {/* Agency Name */}
      <div className="space-y-2">
        <Label htmlFor="agencyName">Agency Name</Label>
        <p className="text-sm text-muted-foreground">
          This name will be used to generate your unique onboarding URL.
        </p>
        <Input
          id="agencyName"
          value={data.agencyName}
          onChange={(e) => updateData({ agencyName: e.target.value })}
          placeholder="e.g., My Agency"
        />
      </div>

      {/* Color Theme */}
      <div className="space-y-4">
        <div>
          <Label>Color Theme</Label>
          <p className="text-sm text-muted-foreground">
            This will be your agency and client dashboard's theme color.
          </p>
        </div>

        <Tabs value={colorMode} onValueChange={(v) => setColorMode(v as "presets" | "custom")}>
          <TabsList>
            <TabsTrigger value="presets">Presets</TabsTrigger>
            <TabsTrigger value="custom">Choose Own</TabsTrigger>
          </TabsList>

          <TabsContent value="presets" className="mt-4">
            <div className="grid grid-cols-7 gap-3">
              {colorPresets.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => handlePresetSelect(preset)}
                  className={`w-10 h-10 rounded-full transition-all ${
                    selectedPreset === preset.name
                      ? "ring-2 ring-offset-2 ring-primary"
                      : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: preset.primary }}
                  title={preset.name}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="custom" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(["primary", "secondary", "tertiary"] as const).map((color) => (
                <div key={color}>
                  <Label className="capitalize">{color} Color</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={tempColors[color]}
                      onChange={(e) => handleColorInputChange(color, e.target.value)}
                      placeholder={tempColors[color]}
                    />
                    <input
                      type="color"
                      value={tempColors[color]}
                      onChange={(e) => handleColorPickerChange(color, e.target.value)}
                      className="w-10 h-10 rounded border-2 cursor-pointer"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <Palette className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-3">
                Or upload your logo to automatically extract brand colors
              </p>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file);
                }}
                className="hidden"
                id="logo-upload"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => document.getElementById("logo-upload")?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Image
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* Color Preview */}
        <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
          <span className="text-sm text-muted-foreground mr-2">Preview:</span>
          <div
            className="w-8 h-8 rounded-full border-2 border-white shadow"
            style={{ backgroundColor: data.primaryColor }}
          />
          <div
            className="w-8 h-8 rounded-full border-2 border-white shadow"
            style={{ backgroundColor: data.secondaryColor }}
          />
          <div
            className="w-8 h-8 rounded-full border-2 border-white shadow"
            style={{ backgroundColor: data.tertiaryColor }}
          />
        </div>
      </div>

      {/* Welcome Section (conditional) */}
      {data.features.welcomeSection && (
        <div className="space-y-4 pt-6 border-t border-border">
          <div>
            <h3 className="text-lg font-semibold">Welcome Section</h3>
            <p className="text-sm text-muted-foreground">
              Configure how you welcome your users.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="welcomeHeadline">Welcome Headline</Label>
              <Input
                id="welcomeHeadline"
                value={data.welcomeHeadline}
                onChange={(e) => updateData({ welcomeHeadline: e.target.value })}
                placeholder="Welcome to your custom software solution"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="welcomeSubheadline">Welcome Subheadline</Label>
              <Textarea
                id="welcomeSubheadline"
                value={data.welcomeSubheadline}
                onChange={(e) => updateData({ welcomeSubheadline: e.target.value })}
                placeholder="Get started with the tools and resources below."
                rows={2}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Welcome Video</Label>
                  <p className="text-sm text-muted-foreground">
                    Add an optional welcome video
                  </p>
                </div>
                <Switch
                  checked={data.welcomeVideoUrl !== undefined && data.welcomeVideoUrl !== null}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      updateData({ welcomeVideoUrl: "" });
                    } else {
                      updateData({ welcomeVideoUrl: undefined, welcomeVideoIsEmbed: false });
                    }
                  }}
                />
              </div>

              {data.welcomeVideoUrl !== undefined && data.welcomeVideoUrl !== null && (
                <>
                  <Input
                    value={data.welcomeVideoUrl}
                    onChange={(e) => updateData({ welcomeVideoUrl: e.target.value })}
                    placeholder="Enter video URL or embed code"
                  />
                  <div className="flex items-center gap-2">
                    <Switch
                      id="isEmbed"
                      checked={data.welcomeVideoIsEmbed}
                      onCheckedChange={(checked) => updateData({ welcomeVideoIsEmbed: checked })}
                    />
                    <Label htmlFor="isEmbed" className="text-sm">
                      This is an embed code
                    </Label>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BrandingStep;
