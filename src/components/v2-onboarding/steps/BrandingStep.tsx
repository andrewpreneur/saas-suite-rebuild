import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { TextField } from "@/components/ui/text-field";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Globe } from "lucide-react";
import { OnboardingData } from "../V2OnboardingWizard";
import {
  extractColorsFromImage,
  isValidHexColor,
  normalizeHexColor,
} from "@/utils/colorExtraction";
import { toAgencySlug } from "@/utils/agencySlug";
import { buildHubUrl } from "@/lib/hubUrl";
import { toast } from "sonner";
import { popIn, riseItem, staggerParent } from "@/lib/motion";
import { cn } from "@/lib/utils";
import AnimatedTabs from "@/components/premium/21st/animated-tabs";
import { HaloDropzone } from "@/components/premium/21st/halo-dropzone";
import { StepHeading } from "@/components/premium/onboarding/OnboardingShell";
import { SettingRow } from "@/components/premium/onboarding/pieces";

interface ColorPreset {
  name: string;
  primary: string;
  secondary: string;
  tertiary: string;
}

/** Which part of branding to show. Omit to show all three on one page. */
export type BrandingSection = "name" | "colors" | "welcome";

interface BrandingStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  colorPresets: ColorPreset[];
  section?: BrandingSection;
  /** Show the "name is required" message even before the field is blurred. */
  showErrors?: boolean;
}

const BrandingStep = ({
  data,
  updateData,
  colorPresets,
  section,
  showErrors = false,
}: BrandingStepProps) => {
  const [nameTouched, setNameTouched] = useState(false);
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

  const handleColorInputChange = (color: "primary" | "secondary" | "tertiary", value: string) => {
    setTempColors((prev) => ({ ...prev, [color]: value }));
    if (isValidHexColor(value)) {
      const normalized = normalizeHexColor(value);
      updateData({
        [`${color}Color`]: normalized,
      });
    }
  };

  const handleColorPickerChange = (color: "primary" | "secondary" | "tertiary", value: string) => {
    setTempColors((prev) => ({ ...prev, [color]: value }));
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
      toast.success("Colors pulled from your logo");
    } catch (error) {
      toast.error("Could not read colors from that image. Try a PNG or JPG.");
    }
  };

  const show = (s: BrandingSection) => !section || section === s;
  const Heading = section ? "h1" : "h2";
  const nameError =
    (nameTouched || showErrors) && !data.agencyName.trim()
      ? "Enter your agency name to continue."
      : undefined;
  const slug = toAgencySlug(data.agencyName);
  const videoOn = data.welcomeVideoUrl !== undefined && data.welcomeVideoUrl !== null;

  const preview = (
    <div className="px-surface self-start overflow-hidden" aria-hidden="true">
      <div className="flex h-36">
        <div
          className="flex w-1/4 flex-col gap-2 p-3"
          style={{ backgroundColor: data.primaryColor }}
        >
          <span className="h-2 w-3/4 rounded-full bg-white/80" />
          <span className="h-2 w-1/2 rounded-full bg-white/40" />
          <span className="h-2 w-2/3 rounded-full bg-white/40" />
        </div>
        <div className="flex flex-1 flex-col gap-3 bg-card p-4">
          <span className="truncate text-small font-semibold text-foreground">
            {data.agencyName.trim() || "Your agency"}
          </span>
          <span className="h-2 w-2/3 rounded-full bg-muted" />
          <span className="h-2 w-1/2 rounded-full bg-muted" />
          <span className="mt-auto flex gap-2">
            <span
              className="h-7 w-20 rounded-sm"
              style={{ backgroundColor: data.secondaryColor }}
            />
            <span className="h-7 w-12 rounded-sm" style={{ backgroundColor: data.tertiaryColor }} />
          </span>
        </div>
      </div>
      <p className="border-t border-border px-4 py-2 text-caption text-muted-foreground">
        Preview of your client dashboard
      </p>
    </div>
  );

  return (
    <div className="space-y-12">
      {show("name") && (
        <section>
          <StepHeading
            as={Heading}
            title="What is your agency called?"
            subtitle="Clients see this name, and we use it to build your client portal link."
          />
          <TextField
            id="agencyName"
            label="Agency name"
            value={data.agencyName}
            onChange={(e) => updateData({ agencyName: e.target.value })}
            onBlur={() => setNameTouched(true)}
            placeholder="e.g. Bright Marketing"
            autoComplete="organization"
            error={nameError}
            className="h-14 px-4 text-body-lg shadow-card sm:h-14 sm:text-body-lg"
          />
          <AnimatePresence initial={false}>
            {slug ? (
              <motion.div
                key="url"
                variants={popIn}
                initial="hidden"
                animate="show"
                exit="exit"
                className="px-brand-wash mt-4 flex items-center gap-3 rounded-lg p-4"
              >
                <span className="px-icon-chip shrink-0" aria-hidden="true">
                  <Globe className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="px-eyebrow block">Your client portal</span>
                  <span className="block truncate font-mono text-small text-foreground">
                    {buildHubUrl(slug).replace(/^https:\/\//, "")}
                  </span>
                </span>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </section>
      )}

      {show("colors") && (
        <section>
          <StepHeading
            as={Heading}
            title="Pick your colors"
            subtitle="This is the theme for your agency and client dashboards. You can change it any time."
          />
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_16rem]">
            <div className="min-w-0 space-y-4">
              <AnimatedTabs
                variant="segment"
                activeTab={colorMode}
                onChange={(v) => setColorMode(v as "presets" | "custom")}
                tabs={[
                  { id: "presets", label: "Presets" },
                  { id: "custom", label: "My own colors" },
                ]}
                className="[&_button]:whitespace-nowrap"
              />

              {colorMode === "presets" ? (
                <motion.div
                  key="presets"
                  variants={staggerParent}
                  initial="hidden"
                  animate="show"
                  role="radiogroup"
                  aria-label="Color presets"
                  className="grid grid-cols-2 gap-2 sm:grid-cols-3"
                >
                  {colorPresets.map((preset) => {
                    const selected = selectedPreset === preset.name;
                    return (
                      <motion.button
                        key={preset.name}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        variants={riseItem}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handlePresetSelect(preset)}
                        title={preset.name}
                        className={cn(
                          "flex min-h-[2.75rem] items-center gap-2 rounded-md border bg-card p-2 text-left shadow-card",
                          "transition-[border-color,box-shadow] duration-150 ease-out",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          selected
                            ? "border-brand ring-1 ring-brand"
                            : "border-border hover:border-brand/40",
                        )}
                      >
                        <span className="flex shrink-0 overflow-hidden rounded-sm">
                          <span className="h-7 w-3.5" style={{ backgroundColor: preset.primary }} />
                          <span
                            className="h-7 w-3.5"
                            style={{ backgroundColor: preset.secondary }}
                          />
                          <span
                            className="h-7 w-3.5"
                            style={{ backgroundColor: preset.tertiary }}
                          />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-small font-medium text-foreground">
                          {preset.name}
                        </span>
                        {selected ? (
                          <Check className="size-4 shrink-0 text-brand" aria-hidden="true" />
                        ) : null}
                      </motion.button>
                    );
                  })}
                </motion.div>
              ) : (
                <motion.div
                  key="custom"
                  variants={riseItem}
                  initial="hidden"
                  animate="show"
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {(["primary", "secondary", "tertiary"] as const).map((color) => (
                      <div key={color}>
                        <Label htmlFor={`color-${color}`} className="capitalize">
                          {color}
                        </Label>
                        <div className="mt-1.5 flex gap-2">
                          <input
                            type="color"
                            value={tempColors[color]}
                            onChange={(e) => handleColorPickerChange(color, e.target.value)}
                            aria-label={`Pick ${color} color`}
                            className="size-11 shrink-0 cursor-pointer rounded-md border border-border bg-card p-1 sm:size-10"
                          />
                          <Input
                            id={`color-${color}`}
                            value={tempColors[color]}
                            onChange={(e) => handleColorInputChange(color, e.target.value)}
                            placeholder={tempColors[color]}
                            aria-invalid={!isValidHexColor(tempColors[color]) || undefined}
                            className="min-w-0 font-mono"
                          />
                        </div>
                        {!isValidHexColor(tempColors[color]) ? (
                          <p className="mt-1 text-caption text-destructive">
                            Use a hex code like #6043EF.
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <HaloDropzone
                    accept="image/*"
                    translucent={false}
                    emptyLabel="Drop your logo to match its colors"
                    successLabel="Colors pulled from your logo"
                    formatHint="PNG or JPG. We only read the colors."
                    showSuccessThumbnails={false}
                    onFiles={(files) => {
                      const file = files[0];
                      if (file) handleImageUpload(file);
                    }}
                  />
                </motion.div>
              )}
            </div>
            {preview}
          </div>
        </section>
      )}

      {show("welcome") && data.features.welcomeSection && (
        <section>
          <StepHeading
            as={Heading}
            title="How do you want to greet clients?"
            subtitle="This sits at the top of their dashboard. We wrote a first draft for you."
          />
          <div className="space-y-4">
            <TextField
              id="welcomeHeadline"
              label="Headline"
              value={data.welcomeHeadline}
              onChange={(e) => updateData({ welcomeHeadline: e.target.value })}
              placeholder="Welcome to your custom software solution"
            />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="welcomeSubheadline">Subheadline</Label>
              <Textarea
                id="welcomeSubheadline"
                value={data.welcomeSubheadline}
                onChange={(e) => updateData({ welcomeSubheadline: e.target.value })}
                placeholder="Get started with the tools and resources below."
                rows={2}
              />
            </div>

            <SettingRow
              htmlFor="welcomeVideo"
              title="Add a welcome video"
              description="Optional. A short hello builds trust fast."
              control={
                <Switch
                  id="welcomeVideo"
                  checked={videoOn}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      updateData({ welcomeVideoUrl: "" });
                    } else {
                      updateData({ welcomeVideoUrl: undefined, welcomeVideoIsEmbed: false });
                    }
                  }}
                />
              }
            />

            <AnimatePresence initial={false}>
              {videoOn && (
                <motion.div
                  key="video"
                  variants={popIn}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  className="space-y-3"
                >
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="welcomeVideoUrl">Video link or embed code</Label>
                    <Input
                      id="welcomeVideoUrl"
                      value={data.welcomeVideoUrl}
                      onChange={(e) => updateData({ welcomeVideoUrl: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="isEmbed"
                      checked={data.welcomeVideoIsEmbed}
                      onCheckedChange={(checked) => updateData({ welcomeVideoIsEmbed: checked })}
                    />
                    <Label htmlFor="isEmbed" className="text-small">
                      I pasted an embed code
                    </Label>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      )}
    </div>
  );
};

export default BrandingStep;
