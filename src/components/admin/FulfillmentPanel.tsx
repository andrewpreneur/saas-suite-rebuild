import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Mail, ListChecks, ExternalLink } from "lucide-react";

interface WarmupRow {
  id: string;
  user_email: string;
  agency_name: string;
  sender_email: string;
  warmed_domain: string | null;
  status: string;
  created_at: string;
}

interface LeadsRow {
  id: string;
  user_email: string;
  business_keywords: string;
  city: string;
  country: string;
  leads_url: string | null;
  status: string;
  created_at: string;
}

export default function FulfillmentPanel() {
  const [warmups, setWarmups] = useState<WarmupRow[]>([]);
  const [leads, setLeads] = useState<LeadsRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [warmupDialog, setWarmupDialog] = useState<WarmupRow | null>(null);
  const [warmupDomain, setWarmupDomain] = useState("");
  const [leadsDialog, setLeadsDialog] = useState<LeadsRow | null>(null);
  const [leadsUrl, setLeadsUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const [w, l] = await Promise.all([
      supabase.from("email_warmup_requests").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("free_leads").select("*").order("created_at", { ascending: false }).limit(500),
    ]);
    if (w.data) setWarmups(w.data as any);
    if (l.data) setLeads(l.data as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const submitWarmup = async () => {
    if (!warmupDialog || !warmupDomain.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.functions.invoke("fulfill-email-warmup", {
      body: { user_email: warmupDialog.user_email, warmed_domain: warmupDomain.trim() },
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Email warmup marked complete & webhook fired");
    setWarmupDialog(null);
    setWarmupDomain("");
    load();
  };

  const submitLeads = async () => {
    if (!leadsDialog || !leadsUrl.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.functions.invoke("fulfill-free-leads", {
      body: { user_email: leadsDialog.user_email, leads_url: leadsUrl.trim() },
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Free leads delivered & webhook fired");
    setLeadsDialog(null);
    setLeadsUrl("");
    load();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Mail className="w-5 h-5" /> Email Warmup Requests</CardTitle>
              <CardDescription>Mark a warmup as complete to notify the user and fire the webhook</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={load}>Refresh</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Agency</TableHead>
                <TableHead>Sender Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Warmed Domain</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7}>Loading…</TableCell></TableRow>
              ) : warmups.length === 0 ? (
                <TableRow><TableCell colSpan={7}>No requests</TableCell></TableRow>
              ) : warmups.map(w => (
                <TableRow key={w.id}>
                  <TableCell className="font-medium">{w.user_email}</TableCell>
                  <TableCell>{w.agency_name}</TableCell>
                  <TableCell>{w.sender_email}</TableCell>
                  <TableCell>
                    <Badge variant={w.status === "complete" ? "default" : "secondary"}>{w.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{w.warmed_domain || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(w.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    {w.status !== "complete" && (
                      <Button size="sm" onClick={() => { setWarmupDialog(w); setWarmupDomain(w.sender_email || ""); }}>
                        Complete
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><ListChecks className="w-5 h-5" /> Free Leads Requests</CardTitle>
              <CardDescription>Deliver free leads to a user with a link to the leads list</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={load}>Refresh</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Keywords</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Leads URL</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7}>Loading…</TableCell></TableRow>
              ) : leads.length === 0 ? (
                <TableRow><TableCell colSpan={7}>No requests</TableCell></TableRow>
              ) : leads.map(l => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.user_email}</TableCell>
                  <TableCell className="max-w-[220px] truncate" title={l.business_keywords}>{l.business_keywords}</TableCell>
                  <TableCell>{l.city}, {l.country}</TableCell>
                  <TableCell>
                    <Badge variant={l.status === "delivered" ? "default" : "secondary"}>{l.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {l.leads_url ? (
                      <a href={l.leads_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                        Open <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{new Date(l.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    {l.status !== "delivered" && (
                      <Button size="sm" onClick={() => { setLeadsDialog(l); setLeadsUrl(""); }}>
                        Deliver
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!warmupDialog} onOpenChange={(o) => !o && setWarmupDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Email Warmup</DialogTitle>
            <DialogDescription>For {warmupDialog?.user_email}. Enter the domain that was warmed up.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Warmed Domain</Label>
            <Input value={warmupDomain} onChange={(e) => setWarmupDomain(e.target.value)} placeholder="mail.example.com" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWarmupDialog(null)}>Cancel</Button>
            <Button onClick={submitWarmup} disabled={submitting || !warmupDomain.trim()}>
              {submitting ? "Submitting…" : "Mark Complete & Notify"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!leadsDialog} onOpenChange={(o) => !o && setLeadsDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deliver Free Leads</DialogTitle>
            <DialogDescription>For {leadsDialog?.user_email}. Paste the URL to their leads list.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Leads List URL</Label>
            <Input value={leadsUrl} onChange={(e) => setLeadsUrl(e.target.value)} placeholder="https://docs.google.com/..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeadsDialog(null)}>Cancel</Button>
            <Button onClick={submitLeads} disabled={submitting || !leadsUrl.trim()}>
              {submitting ? "Submitting…" : "Deliver & Notify"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}