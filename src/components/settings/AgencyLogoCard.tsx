import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, X, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SectionCard } from "@/components/premium/SectionCard";

interface Props {
  email: string | null;
  logoUrl: string;
  onChange: (url: string) => void;
}

/** Single agency logo (kb_logo_url) shared by Settings, Knowledge Base and Branding login page. */
export default function AgencyLogoCard({ email, logoUrl, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(logoUrl);
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

  return (
    <SectionCard
      icon={<ImageIcon />}
      title="Agency logo"
      description="Used on your Knowledge Base and your branded login page."
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex h-20 w-full shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 p-2 sm:w-40">
            {logoUrl ? (
              <img src={logoUrl} alt="Agency logo" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-xs text-muted-foreground">No logo yet</span>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            <Button variant="outline" className="h-11 gap-2 sm:h-10" onClick={() => fileRef.current?.click()} disabled={uploading || saving}>
              {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</> : <><Upload className="w-4 h-4" /> Upload logo</>}
            </Button>
            {logoUrl && (
              <Button variant="ghost" className="h-11 gap-2 text-muted-foreground sm:h-10" onClick={() => save("")} disabled={saving}>
                <X className="w-4 h-4" /> Remove logo
              </Button>
            )}
            <p className="w-full text-xs text-muted-foreground">PNG, JPG or SVG, up to 5MB.</p>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="agency-logo-url">Or use an image URL</Label>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
            <Input id="agency-logo-url" className="min-w-0 flex-1" placeholder="https://…" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <Button variant="secondary" className="h-11 sm:h-10" onClick={() => save(draft.trim())} disabled={saving || draft.trim() === logoUrl}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save logo"}
            </Button>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
