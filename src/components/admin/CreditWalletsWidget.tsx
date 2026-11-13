import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Wallet, Mail, RefreshCw, LifeBuoy, PhoneCall } from "lucide-react";

interface OwnerRow {
  email: string;
  name: string | null;
  agency_id: string | null;
  plan: string | null;
  onboarding_wallet: number;
  support_wallet: number;
  assigned_support: number;
  booked_calls: number;
}

const nudgeTemplates = {
  agency_support: {
    subject: "Your Agency Support seats are ready to assign",
    body: (name: string) =>
      `Hey ${name || "there"},\n\nYou've got Agency Support seats sitting in your SaaSSuite wallet that haven't been assigned to a client yet.\n\nAssigning takes about 30 seconds: log in at https://saassuite.ai/app/agency-support, add the client's name and email (one by one or by CSV), and we'll handle their support from there.\n\nWant me to help pick which clients to put on it? Just reply to this email.\n\n— Andrew George, Founder of SaaSSuite`,
  },
  onboarding_call: {
    subject: "Let's get your onboarding call on the calendar",
    body: (name: string) =>
      `Hey ${name || "there"},\n\nYou still have an onboarding call credit in your SaaSSuite account that hasn't been used yet.\n\nGrab a time that works for you here: https://saassuite.ai/book — we'll walk through your portal, your branding, and your install so it's fully live.\n\nIf you'd rather I just review your setup and send notes, reply here and I'll do that instead.\n\n— Andrew George, Founder of SaaSSuite`,
  },
} as const;

type NudgeKind = keyof typeof nudgeTemplates;

const CreditWalletsWidget = () => {
  const [rows, setRows] = useState<OwnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"unassigned" | "all">("unassigned");
  const [search, setSearch] = useState("");
  const [nudge, setNudge] = useState<{ row: OwnerRow; kind: NudgeKind; subject: string; body: string } | null>(null);
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [usersRes, clientsRes, callsRes] = await Promise.all([
        supabase
          .from("saas_suite_users")
          .select("email, full_name, agency_id, plan, onboarding_call_wallet, agency_support_wallet")
          .or("onboarding_call_wallet.gt.0,agency_support_wallet.gt.0")
          .limit(1000),
        supabase.from("agency_support_clients").select("owner_email, active").limit(2000),
        supabase.from("onboarding_calls").select("owner_email, email").limit(2000),
      ]);
      if (usersRes.error) throw usersRes.error;

      const assigned = new Map<string, number>();
      (clientsRes.data || []).forEach((c: any) => {
        if (c.active === false) return;
        const key = (c.owner_email || "").toLowerCase();
        assigned.set(key, (assigned.get(key) || 0) + 1);
      });
      const booked = new Map<string, number>();
      (callsRes.data || []).forEach((c: any) => {
        [c.owner_email, c.email].forEach((e: string | null) => {
          if (!e) return;
          const key = e.toLowerCase();
          booked.set(key, (booked.get(key) || 0) + 1);
        });
      });

      setRows(
        (usersRes.data || []).map((u: any) => {
          const key = (u.email || "").toLowerCase();
          return {
            email: u.email,
            name: u.full_name,
            agency_id: u.agency_id,
            plan: u.plan,
            onboarding_wallet: u.onboarding_call_wallet || 0,
            support_wallet: u.agency_support_wallet || 0,
            assigned_support: assigned.get(key) || 0,
            booked_calls: booked.get(key) || 0,
          } as OwnerRow;
        }),
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to load credit holders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => {
        const unassigned =
          (r.support_wallet > 0 && r.assigned_support < r.support_wallet) ||
          (r.onboarding_wallet > 0 && r.booked_calls === 0);
        if (filter === "unassigned" && !unassigned) return false;
        if (!q) return true;
        return [r.email, r.name, r.agency_id, r.plan].filter(Boolean).some((f) => String(f).toLowerCase().includes(q));
      })
      .sort(
        (a, b) =>
          b.support_wallet - b.assigned_support - (a.support_wallet - a.assigned_support) ||
          b.onboarding_wallet - a.onboarding_wallet,
      );
  }, [rows, filter, search]);

  const totals = useMemo(() => {
    let seats = 0;
    let unassignedSeats = 0;
    let calls = 0;
    let unbooked = 0;
    rows.forEach((r) => {
      seats += r.support_wallet;
      unassignedSeats += Math.max(0, r.support_wallet - r.assigned_support);
      calls += r.onboarding_wallet;
      if (r.onboarding_wallet > 0 && r.booked_calls === 0) unbooked += r.onboarding_wallet;
    });
    return { seats, unassignedSeats, calls, unbooked };
  }, [rows]);

  const openNudge = (row: OwnerRow, kind: NudgeKind) => {
    const tpl = nudgeTemplates[kind];
    setNudge({ row, kind, subject: tpl.subject, body: tpl.body(row.name?.split(" ")[0] || "") });
  };

  const sendNudge = async () => {
    if (!nudge) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-admin-email", {
        body: { recipients: [nudge.row.email], subject: nudge.subject, body: nudge.body },
      });
      if (error) throw error;
      toast.success(`Email sent to ${nudge.row.email}`);
      setNudge(null);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="w-4 h-4 text-amber-500" />
            Paid credits · calls &amp; agency support
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant={filter === "unassigned" ? "default" : "outline"}
              onClick={() => setFilter("unassigned")}
              className="h-7 text-xs"
            >
              Needs action
            </Button>
            <Button
              size="sm"
              variant={filter === "all" ? "default" : "outline"}
              onClick={() => setFilter("all")}
              className="h-7 text-xs"
            >
              All
            </Button>
            <Button size="sm" variant="ghost" onClick={load} className="h-7 px-2">
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1 text-xs text-muted-foreground">
          <span className="rounded bg-muted px-2 py-0.5">
            {totals.unassignedSeats} of {totals.seats} support seats unassigned
          </span>
          <span className="rounded bg-muted px-2 py-0.5">
            {totals.unbooked} of {totals.calls} call credits unbooked
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <Input
          placeholder="Search credit holders…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm"
        />
        <ScrollArea className="h-[340px] pr-2">
          {loading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {filter === "unassigned" ? "Every paid credit is assigned. Nice." : "No credit holders found."}
            </p>
          ) : (
            <div className="space-y-2">
              {visible.map((r) => {
                const seatGap = Math.max(0, r.support_wallet - r.assigned_support);
                const callGap = r.onboarding_wallet > 0 && r.booked_calls === 0;
                return (
                  <div key={r.email} className="rounded-lg border bg-card p-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{r.name || r.email}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.plan || "—"} · agency {r.agency_id || "not set"}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {r.support_wallet > 0 && (
                          <Badge variant={seatGap > 0 ? "destructive" : "secondary"} className="text-[10px]">
                            <LifeBuoy className="w-3 h-3 mr-1" />
                            {r.assigned_support}/{r.support_wallet} seats assigned
                          </Badge>
                        )}
                        {r.onboarding_wallet > 0 && (
                          <Badge variant={callGap ? "destructive" : "secondary"} className="text-[10px]">
                            <PhoneCall className="w-3 h-3 mr-1" />
                            {r.onboarding_wallet} call credit{r.onboarding_wallet > 1 ? "s" : ""}
                            {callGap ? " · not booked" : ""}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {r.support_wallet > 0 && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openNudge(r, "agency_support")}>
                          <Mail className="w-3 h-3 mr-1" /> Email about seats
                        </Button>
                      )}
                      {r.onboarding_wallet > 0 && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openNudge(r, "onboarding_call")}>
                          <Mail className="w-3 h-3 mr-1" /> Email about call
                        </Button>
                      )}
                      <a href={`mailto:${r.email}`} className="inline-flex">
                        <Button size="sm" variant="ghost" className="h-7 text-xs">
                          Open in mail app
                        </Button>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>

      <Dialog open={!!nudge} onOpenChange={(o) => { if (!o) setNudge(null); }}>
        <DialogContent className="max-w-xl">
          {nudge && (
            <>
              <DialogHeader>
                <DialogTitle>Email {nudge.row.name || nudge.row.email}</DialogTitle>
                <DialogDescription>
                  Sends to <span className="font-medium">{nudge.row.email}</span> through the SaaSSuite email webhook.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Input value={nudge.subject} onChange={(e) => setNudge({ ...nudge, subject: e.target.value })} />
                <Textarea rows={12} value={nudge.body} onChange={(e) => setNudge({ ...nudge, body: e.target.value })} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNudge(null)} disabled={sending}>
                  Cancel
                </Button>
                <Button onClick={sendNudge} disabled={sending || !nudge.subject.trim() || !nudge.body.trim()}>
                  <Mail className="w-4 h-4 mr-1" /> {sending ? "Sending…" : "Send email"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default CreditWalletsWidget;
