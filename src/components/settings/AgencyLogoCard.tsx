import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, X, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
    <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-3">
      <div className="flex items-center gap-2">
        <ImageIcon className="w-4 h-4 text-muted-foreground" />
        <div>
          <Label>Agency logo</Label>
          <p className="text-xs text-muted-foreground">Used on your Knowledge Base and your branded login page.</p>
        </div>
      </div>
      {logoUrl && (
        <div className="flex items-center gap-2 p-2 bg-background rounded-md border border-border">
          <img src={logoUrl} alt="Agency logo" className="h-10 max-w-[140px] object-contain" />
          <span className="text-xs text-muted-foreground truncate flex-1">{logoUrl}</span>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => save("")} disabled={saving}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <Button variant="outline" className="w-full gap-2" onClick={() => fileRef.current?.click()} disabled={uploading || saving}>
        {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</> : <><Upload className="w-4 h-4" /> Upload logo</>}
      </Button>
      <div className="flex min-w-0 gap-2">
        <Input className="min-w-0 flex-1" placeholder="…or paste an image URL" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <Button onClick={() => save(draft.trim())} disabled={saving || draft.trim() === logoUrl}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
        </Button>
      </div>
    </div>
  );
}
