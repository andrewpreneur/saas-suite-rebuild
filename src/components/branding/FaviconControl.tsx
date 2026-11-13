import { useRef, useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { validFaviconFile } from "@/lib/faviconUpload";

export function FaviconControl({ value, onChange, disabled }: { value: string; onChange: (url: string) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return <section className="flex flex-wrap items-center gap-3 border-t pt-4">
    <div className="min-w-0 flex-1"><p className="text-sm font-medium">Browser tab icon</p><p className="text-xs text-muted-foreground">PNG, JPEG, WebP or ICO · up to 2 MB</p></div>
    {value && <img src={value} alt="Browser tab icon" className="size-8 object-contain" />}
    <input ref={input} type="file" aria-label="Upload favicon" className="hidden" accept="image/png,image/jpeg,image/webp,image/x-icon,image/vnd.microsoft.icon,.ico" onChange={async event => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      if (disabled || busy) return;
      if (!validFaviconFile(file)) { toast.error("Choose a PNG, JPEG, WebP or ICO under 2 MB"); return; }
      setBusy(true);
      try {
        const path = `favicons/${crypto.randomUUID()}.${file.name.split(".").pop()?.toLowerCase()}`;
        const { error } = await supabase.storage.from("logos").upload(path, file);
        if (error) throw error;
        onChange(supabase.storage.from("logos").getPublicUrl(path).data.publicUrl);
      } catch { toast.error("Could not upload your tab icon"); } finally { setBusy(false); }
    }} />
    <Button variant="outline" disabled={disabled || busy} onClick={() => input.current?.click()}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}{value ? "Replace icon" : "Upload icon"}</Button>
    {value && <Button variant="ghost" size="icon" aria-label="Remove favicon" disabled={disabled || busy} onClick={() => onChange("")}><X className="size-4" /></Button>}
  </section>;
}