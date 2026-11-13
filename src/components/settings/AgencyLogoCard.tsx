import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, X, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SectionCard } from "@/components/premium/SectionCard";
import { MoreMenu } from "@/components/premium/MoreMenu";
import { Disclosure, FieldError } from "@/components/premium/settings/Page";

interface Props {
  email: string | null;
  logoUrl: string;
  onChange: (url: string) => void;
  /** Render only the controls, without the card around them (on its Settings page). */
  bare?: boolean;
}

/** Single agency logo (kb_logo_url) shared by Settings, Knowledge Base and Branding login page. */
export default function AgencyLogoCard({ email, logoUrl, onChange, bare }: Props) {
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(logoUrl);
  const [urlError, setUrlError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const save = async (url: string) => {
    if (!email) return;
    setSaving(true);
    const { error } = await supabase
      .from("saas_suite_users")
      .update({ kb_logo_url: url || null } as any)
      .eq("email", email.trim().toLowerCase());
    setSaving(false);
    if (error) return toast.error("Couldn't save logo: " + error.message);
    onChange(url);
    setDraft(url);
    window.dispatchEvent(new CustomEvent("agency-logo-changed", { detail: url }));
    toast.success(url ? "Logo saved" : "Logo removed");
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please upload an image");
    if (file.size > 5 * 1024 * 1024) return toast.error("File must be under 5MB");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const name = `kb-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("logos").upload(name, file);
      if (error) throw error;
      const { data } = supabase.storage.from("logos").getPublicUrl(name);
      await save(data.publicUrl);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const saveUrl = () => {
    const next = draft.trim();
    if (next && !/^https?:\/\/\S+\.\S+/i.test(next)) {
      setUrlError("Enter a full image address that starts with https://.");
      return;
    }
    setUrlError("");
    void save(next);
  };

  const controls = (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex h-24 w-full shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-muted p-3 sm:w-48">
          {logoUrl ? (
            <img src={logoUrl} alt="Agency logo" className="max-h-full max-w-full object-contain" />
          ) : (
            <ImageIcon className="size-6 text-muted-foreground/60" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p role="status" className="text-base font-semibold text-foreground">
            {logoUrl ? "Logo added" : "No logo yet"}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">PNG, JPG or SVG, up to 5MB.</p>
          <div className="mt-3 flex items-center gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            <Button
              variant="accent"
              className="h-11 flex-1 gap-2 sm:h-10 sm:flex-none"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || saving}
            >
              {uploading ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" /> Uploading logo
                </>
              ) : (
                <>
                  <Upload aria-hidden="true" /> {logoUrl ? "Replace logo" : "Upload logo"}
                </>
              )}
            </Button>
            <MoreMenu
              label="More logo actions"
              items={logoUrl ? [{ label: "Remove logo", icon: <X />, danger: true, disabled: saving, onSelect: () => void save("") }] : []}
            />
          </div>
        </div>
      </div>
      <Disclosure label="Use an image URL instead">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="agency-logo-url">Image URL</Label>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
            <Input
              id="agency-logo-url"
              className="min-w-0 flex-1"
              placeholder="https://yoursite.com/logo.png"
              inputMode="url"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setUrlError("");
              }}
              aria-invalid={!!urlError}
              aria-describedby={urlError ? "agency-logo-url-error" : undefined}
            />
            <Button variant="outline" className="h-11 sm:h-10" onClick={saveUrl} disabled={saving || draft.trim() === logoUrl}>
              {saving ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" /> Saving logo
                </>
              ) : (
                "Save logo"
              )}
            </Button>
          </div>
          <FieldError id="agency-logo-url-error">{urlError}</FieldError>
        </div>
      </Disclosure>
    </div>
  );

  if (bare) return controls;

  return (
    <SectionCard
      icon={<ImageIcon />}
      title="Agency logo"
      description="Used on your Knowledge Base and your branded login page."
    >
      {controls}
    </SectionCard>
  );
}
