import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Upload, Trash2, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { csvToPromptEdits } from "./copilotExport";

interface PromptEdit {
  id: string;
  instruction: string;
  trigger_question: string | null;
  ideal_answer: string | null;
  enabled: boolean;
  created_at: string;
}

export default function CopilotPromptEditsCard() {
  const [edits, setEdits] = useState<PromptEdit[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const db = supabase as any;

  const load = async () => {
    const { data, error } = await db.from("copilot_prompt_edits").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setEdits(data || []);
  };
  useEffect(() => { load(); }, []);

  const onFile = async (f: File) => {
    setBusy(true);
    try {
      const rows = csvToPromptEdits(await f.text());
      if (!rows.length) throw new Error("No filled-in rows found. Fill the instruction or ideal_answer column.");
      const { error } = await db.from("copilot_prompt_edits").insert(rows.map((r) => ({ ...r, source: f.name })));
      if (error) throw error;
      toast.success(`Uploaded ${rows.length} prompt edit${rows.length === 1 ? "" : "s"} — the Copilot uses them now`);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const toggle = async (e: PromptEdit) => {
    const { error } = await db.from("copilot_prompt_edits").update({ enabled: !e.enabled }).eq("id", e.id);
    if (error) return toast.error(error.message);
    setEdits((p) => p.map((x) => (x.id === e.id ? { ...x, enabled: !x.enabled } : x)));
  };
  const remove = async (id: string) => {
    const { error } = await db.from("copilot_prompt_edits").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setEdits((p) => p.filter((x) => x.id !== id));
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <ListChecks className="w-5 h-5 flex-shrink-0" /> Prompt Edits
            </CardTitle>
            <CardDescription>
              Export chats, fill in the "instruction" and/or "ideal_answer" columns, then upload the file. Enabled edits are added to the Copilot's instructions.
            </CardDescription>
          </div>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          <Button size="sm" onClick={() => fileRef.current?.click()} disabled={busy} className="w-full sm:w-auto flex-shrink-0">
            <Upload className="w-4 h-4 mr-2" /> {busy ? "Uploading..." : "Upload prompt edits"}
          </Button>
        </div>
      </CardHeader>
      {edits.length > 0 && (
        <CardContent className="space-y-2 max-h-96 overflow-y-auto">
          {edits.map((e) => (
            <div key={e.id} className="rounded-lg border p-3 flex gap-3 items-start">
              <Switch checked={e.enabled} onCheckedChange={() => toggle(e)} />
              <div className="min-w-0 flex-1 text-sm space-y-1 break-words">
                <div>{e.instruction}</div>
                {e.trigger_question && <div className="text-xs text-muted-foreground">Q: {e.trigger_question}</div>}
                {e.ideal_answer && <div className="text-xs text-muted-foreground">Ideal: {e.ideal_answer}</div>}
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(e.id)} aria-label="Delete prompt edit">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
