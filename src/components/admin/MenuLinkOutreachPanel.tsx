import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Loader2, Send, Link2Off } from "lucide-react";
import { toast } from "sonner";

interface OutreachUser {
  email: string;
  name: string | null;
  phone: string | null;
  agency_name: string | null;
  agency_id: string | null;
  plan: string | null;
  approval: string | null;
  billing_state: string | null;
  created_at: string | null;
  onboarding_url: string | null;
  has_menu_link: boolean;
  has_custom_css: boolean;
}

const MenuLinkOutreachPanel = () => {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [users, setUsers] = useState<OutreachUser[]>([]);
  const [search, setSearch] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("menu-link-outreach", {
        body: { action: "list" },
      });
      if (error) throw error;
      setUsers((data as any)?.users ?? []);
      setSelected(new Set());
    } catch (e: any) {
      toast.error(e?.message || "Failed to load menu link data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (onlyMissing && u.has_menu_link) return false;
      if (!q) return true;
      return (
        u.email.includes(q) ||
        (u.agency_name ?? "").toLowerCase().includes(q) ||
        (u.agency_id ?? "").toLowerCase().includes(q) ||
        (u.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [users, search, onlyMissing]);

  const missingCount = users.filter((u) => !u.has_menu_link).length;

  const toggle = (email: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(email) ? next.delete(email) : next.add(email);
      return next;
    });
  };

  const allShownSelected = filtered.length > 0 && filtered.every((u) => selected.has(u.email));

  const send = async () => {
    const emails = Array.from(selected);
    if (emails.length === 0) {
      toast.error("Select at least one user");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("menu-link-outreach", {
        body: { action: "send", emails },
      });
      if (error) throw error;
      const res = data as any;
      toast.success(`Sent ${res?.sent ?? 0} to webhook${res?.failed ? `, ${res.failed} failed` : ""}`);
      if (res?.failed) console.warn("menu-link-outreach failures", res.results);
    } catch (e: any) {
      toast.error(e?.message || "Failed to send to webhook");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Link2Off className="h-5 w-5" />
              Menu Link Install Outreach
            </CardTitle>
            <CardDescription>
              Users with no custom menu link ID on file. Sends name, email, phone, onboarding URL, agency
              name, install status and their full CSS + JS scripts to the LeadConnector webhook.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Refresh</span>
            </Button>
            <Button size="sm" onClick={send} disabled={sending || selected.size === 0}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="ml-2">Send {selected.size || ""} to webhook</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="destructive">{missingCount} not installed</Badge>
          <Badge variant="secondary">{users.length} total accounts</Badge>
          <Input
            placeholder="Search email, name, agency…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={onlyMissing} onCheckedChange={(v) => setOnlyMissing(!!v)} />
            Only missing menu link
          </label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setSelected(allShownSelected ? new Set() : new Set(filtered.map((u) => u.email)))
            }
          >
            {allShownSelected ? "Clear selection" : `Select all (${filtered.length})`}
          </Button>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Agency</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Menu link</TableHead>
                <TableHead>Onboarding URL</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.email}>
                  <TableCell>
                    <Checkbox checked={selected.has(u.email)} onCheckedChange={() => toggle(u.email)} />
                  </TableCell>
                  <TableCell className="font-medium">{u.email}</TableCell>
                  <TableCell>{u.name ?? "—"}</TableCell>
                  <TableCell>{u.agency_name ?? u.agency_id ?? "—"}</TableCell>
                  <TableCell>{u.plan ?? "—"}</TableCell>
                  <TableCell>{u.phone ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={u.has_menu_link ? "secondary" : "destructive"}>
                      {u.has_menu_link ? "yes" : "no"}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[280px] truncate text-xs">
                    {u.onboarding_url ? (
                      <a href={u.onboarding_url} target="_blank" rel="noreferrer" className="underline">
                        {u.onboarding_url}
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No matching users
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default MenuLinkOutreachPanel;
