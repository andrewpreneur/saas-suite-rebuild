import { useEffect, useState } from "react";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export default function SnapshotImportActions() {
  const [url, setUrl] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email?.trim().toLowerCase();
      if (!email) {
        if (!cancelled) setChecked(true);
        return;
      }
      const { data } = await supabase.functions.invoke("chat-copilot", {
        body: { action: "snapshot_link", userEmail: email },
      });
      if (!cancelled) {
        setUrl(typeof data?.url === "string" && data.url ? data.url : null);
        setChecked(true);
      }
    })().catch(() => {
      if (!cancelled) setChecked(true);
    });
    return () => { cancelled = true; };
  }, []);

  const copyLink = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Snapshot link copied");
    } catch {
      toast.error("Couldn't copy the snapshot link. Right-click the import button to copy its link.");
    }
  };

  if (!checked) return <p className="text-sm text-muted-foreground">Checking snapshot access…</p>;
  if (!url) {
    return <p className="text-sm text-muted-foreground">The Standard Snapshot is included with Basic ($27/month) and higher. A free Starter account does not include it.</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild className="gap-2 whitespace-normal h-auto min-h-10">
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Download className="h-4 w-4 shrink-0" />Install Standard Snapshot
        </a>
      </Button>
      <Button type="button" variant="outline" className="gap-2" onClick={copyLink}>
        <Copy className="h-4 w-4 shrink-0" />Copy link
      </Button>
    </div>
  );
}
