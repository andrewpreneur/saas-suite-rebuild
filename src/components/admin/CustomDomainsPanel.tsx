import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, RotateCcw, Search } from "lucide-react";

interface Row {
  email: string;
  full_name: string | null;
  custom_domain: string | null;
  custom_domain_access: boolean;
  custom_domain_live: boolean;
  custom_domain_submitted_at: string | null;
  custom_domain_went_live_at: string | null;
}

export default function CustomDomainsPanel() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("saas_suite_users")
      .select("email, full_name, custom_domain, custom_domain_access, custom_domain_live, custom_domain_submitted_at, custom_domain_went_live_at")
      .eq("custom_domain_access", true)
      .order("custom_domain_submitted_at", { ascending: false, nullsFirst: false });
    if (error) {
      toast({ title: "Failed to load", description: error.message, variant: "destructive" });
    } else {
      setRows((data || []) as Row[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const setLive = async (email: string, live: boolean) => {
    setBusy(email);
    const { error } = await supabase
      .from("saas_suite_users")
      .update({
        custom_domain_live: live,
        custom_domain_went_live_at: live ? new Date().toISOString() : null,
      })
      .ilike("email", email);
    setBusy(null);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: live ? "Marked as live" : "Reverted to pending" });
      load();
    }
  };

  const filtered = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (r.email || "").includes(q) || (r.custom_domain || "").includes(q) || (r.full_name || "").toLowerCase().includes(q);
  });

  const pending = filtered.filter((r) => r.custom_domain && !r.custom_domain_live);
  const live = filtered.filter((r) => r.custom_domain_live);
  const awaitingSubmit = filtered.filter((r) => !r.custom_domain);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Custom Domains</CardTitle>
        <CardDescription>Users who have purchased the custom domain upgrade. Mark a domain as live once it's been configured.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by email or domain…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Refresh"}
          </Button>
        </div>

        <Section title={`Pending (${pending.length})`} rows={pending} busy={busy} onLive={(e) => setLive(e, true)} mode="pending" />
        <Section title={`Live (${live.length})`} rows={live} busy={busy} onLive={(e) => setLive(e, false)} mode="live" />
        <Section title={`Awaiting domain submission (${awaitingSubmit.length})`} rows={awaitingSubmit} busy={busy} onLive={() => {}} mode="awaiting" />
      </CardContent>
    </Card>
  );
}

function Section({ title, rows, busy, onLive, mode }: { title: string; rows: Row[]; busy: string | null; onLive: (email: string) => void; mode: "pending" | "live" | "awaiting" }) {
  return (
    <div>
      <h4 className="font-semibold mb-2">{title}</h4>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">None.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.email}>
                  <TableCell className="font-mono text-xs">{r.email}<div className="text-muted-foreground">{r.full_name}</div></TableCell>
                  <TableCell className="font-mono">{r.custom_domain || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    {r.custom_domain_live ? <Badge className="bg-green-600">Live</Badge> : r.custom_domain ? <Badge variant="secondary">Pending</Badge> : <Badge variant="outline">No domain yet</Badge>}
                  </TableCell>
                  <TableCell className="text-xs">{r.custom_domain_submitted_at ? new Date(r.custom_domain_submitted_at).toLocaleString() : "—"}</TableCell>
                  <TableCell className="text-right">
                    {mode === "pending" && (
                      <Button size="sm" onClick={() => onLive(r.email)} disabled={busy === r.email}>
                        {busy === r.email ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4 mr-1" /> Mark Live</>}
                      </Button>
                    )}
                    {mode === "live" && (
                      <Button size="sm" variant="outline" onClick={() => onLive(r.email)} disabled={busy === r.email}>
                        {busy === r.email ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RotateCcw className="w-4 h-4 mr-1" /> Revert</>}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}