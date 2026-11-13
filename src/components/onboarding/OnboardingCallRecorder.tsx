import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExternalLink, Plus, Video, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  /** Fixed account email. When omitted, an account email field is shown (admin use). */
  ownerEmail?: string;
  title?: string;
  onChanged?: () => void;
}

const empty = { owner: "", name: "", email: "", date: "", meeting: "", transcript: "", recording: "" };

const OnboardingCallRecorder = ({ ownerEmail, title = "Your Onboarding Calls", onChanged }: Props) => {
  const { toast } = useToast();
  const [lookup, setLookup] = useState(ownerEmail || "");
  const owner = (ownerEmail || lookup).trim().toLowerCase();
  const [calls, setCalls] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [transcriptView, setTranscriptView] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!owner) return setCalls([]);
    const { data } = await supabase
      .from("onboarding_calls" as any)
      .select("*")
      .ilike("owner_email", owner)
      .order("scheduled_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    setCalls((data as any[]) ?? []);
  }, [owner]);

  useEffect(() => {
    if (ownerEmail) load();
  }, [ownerEmail, load]);

  const save = async (consume: boolean) => {
    const target = (ownerEmail || form.owner || lookup).trim().toLowerCase();
    if (!target) return toast({ title: "Enter the account email", variant: "destructive" });
    setSaving(true);
    const { data: id, error } = await supabase.rpc("record_manual_onboarding_call" as any, {
      p_owner_email: target,
      p_name: form.name.trim(),
      p_email: form.email.trim().toLowerCase(),
      p_scheduled_at: form.date ? new Date(form.date).toISOString() : null,
      p_meeting_link: form.meeting.trim(),
      p_transcript: form.transcript,
      p_recording_link: form.recording.trim(),
    });
    if (error) {
      setSaving(false);
      return toast({ title: "Could not save call", description: error.message, variant: "destructive" });
    }
    if (consume && id) await consume_(id as string, true);
    setSaving(false);
    setOpen(false);
    setForm(empty);
    if (!ownerEmail) setLookup(target);
    toast({ title: consume ? "Call recorded and consumed" : "Call recorded" });
    load();
    onChanged?.();
  };

  const consume_ = async (id: string, silent = false) => {
    setBusyId(id);
    const { data, error } = await supabase.rpc("consume_recorded_onboarding_call" as any, { p_call_id: id });
    setBusyId(null);
    if (error) return toast({ title: "Could not consume", description: error.message, variant: "destructive" });
    if (!silent) toast({ title: "Call consumed", description: `Calls left: ${data ?? 0}` });
    load();
    onChanged?.();
  };

  const set = (k: keyof typeof empty) => (e: any) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const fmt = (d?: string) => (d ? new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button size="sm" className="gap-1" onClick={() => { setForm({ ...empty, owner: lookup }); setOpen(true); }}>
          <Plus className="w-4 h-4" /> Record a call
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {!ownerEmail && (
          <div className="flex gap-2">
            <Input placeholder="Account email (e.g. owner@agency.com)" value={lookup} onChange={(e) => setLookup(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()} />
            <Button variant="outline" onClick={load}>Load calls</Button>
          </div>
        )}
        {calls.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No onboarding calls yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Links</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calls.map((b) => {
                  const done = b.consumed_at || b.charge_status === "charged";
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="whitespace-nowrap">{fmt(b.scheduled_at)}</TableCell>
                      <TableCell>{b.name || "—"}{b.is_manual && <Badge variant="outline" className="ml-2 text-[10px]">Manual</Badge>}</TableCell>
                      <TableCell className="whitespace-nowrap">{b.email || "—"}</TableCell>
                      <TableCell className="space-x-3 whitespace-nowrap">
                        {b.meeting_link && <a href={b.meeting_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">Meeting <ExternalLink className="w-3 h-3" /></a>}
                        {b.recording_link && <a href={b.recording_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><Video className="w-3 h-3" /> Recording</a>}
                        {b.transcript && <button type="button" onClick={() => setTranscriptView(b.transcript)} className="inline-flex items-center gap-1 text-primary hover:underline"><FileText className="w-3 h-3" /> Transcript</button>}
                        {!b.meeting_link && !b.recording_link && !b.transcript && "—"}
                      </TableCell>
                      <TableCell>
                        {done ? (
                          <Badge variant="secondary">{b.charge_status === "charged" ? "Charged $60" : "Consumed"}</Badge>
                        ) : (
                          <Button size="sm" variant="outline" disabled={busyId === b.id} onClick={() => consume_(b.id)}>
                            {busyId === b.id ? "…" : "Consume"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Record an onboarding call</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {!ownerEmail && (
              <div><Label>Account email</Label><Input value={form.owner} onChange={set("owner")} placeholder="owner@agency.com" /></div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Name</Label><Input value={form.name} onChange={set("name")} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={set("email")} /></div>
            </div>
            <div><Label>Date & time</Label><Input type="datetime-local" value={form.date} onChange={set("date")} /></div>
            <div><Label>Meeting link</Label><Input value={form.meeting} onChange={set("meeting")} placeholder="https://" /></div>
            <div><Label>Recording URL</Label><Input value={form.recording} onChange={set("recording")} placeholder="https://" /></div>
            <div><Label>Transcript</Label><Textarea rows={5} value={form.transcript} onChange={set("transcript")} /></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={saving} onClick={() => save(false)}>Save only</Button>
            <Button disabled={saving} onClick={() => save(true)}>{saving ? "Saving…" : "Save & consume call"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!transcriptView} onOpenChange={(v) => !v && setTranscriptView(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Transcript</DialogTitle></DialogHeader>
          <p className="text-sm whitespace-pre-wrap">{transcriptView}</p>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default OnboardingCallRecorder;
