import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Lock,
  LockOpen,
  RefreshCw,
} from "lucide-react";

export interface AgencySupportClientRow {
  id: string;
  client_email: string;
  client_name: string | null;
  client_phone: string | null;
  client_company: string | null;
  location_id: string | null;
  active: boolean;
  assigned_at: string | null;
  locked_until: string | null;
  created_at: string;
}

export interface AgencySupportOwnerRow {
  owner_email: string;
  owner_name: string | null;
  plan: string | null;
  agency_id: string | null;
  white_label_domain: string | null;
  seats: number;
  assigned: number;
  clients: AgencySupportClientRow[];
}

export const subAccountUrl = (domain: string | null, locationId: string | null) => {
  if (!domain || !locationId) return null;
  const host = domain.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  return `https://${host}/v2/location/${locationId}`;
};

const fmtDate = (v: string | null) =>
  v ? new Date(v).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "—";

interface Props {
  /** Compact mode is used inside the admin support page. */
  compact?: boolean;
}

const AgencySupportAccountsPanel = ({ compact = false }: Props) => {
  const [owners, setOwners] = useState<AgencySupportOwnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_list_agency_support_accounts" as any);
      if (error) throw error;
      const rows = ((data as any[]) ?? []).map((r) => ({
        ...r,
        clients: (Array.isArray(r.clients) ? r.clients : []) as AgencySupportClientRow[],
      })) as AgencySupportOwnerRow[];
      setOwners(rows);
      if (compact) setOpen({});
    } catch (err: any) {
      console.error("[AgencySupportAccounts]", err);
      toast.error(err?.message || "Could not load agency support accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return owners;
    return owners
      .map((o) => {
        const ownerMatch = [o.owner_email, o.owner_name, o.agency_id, o.white_label_domain]
          .filter(Boolean)
          .some((f) => String(f).toLowerCase().includes(q));
        const clients = o.clients.filter((c) =>
          [c.client_email, c.client_name, c.client_company, c.location_id, c.client_phone]
            .filter(Boolean)
            .some((f) => String(f).toLowerCase().includes(q)),
        );
        if (ownerMatch) return o;
        if (clients.length) return { ...o, clients };
        return null;
      })
      .filter(Boolean) as AgencySupportOwnerRow[];
  }, [owners, search]);

  const totals = useMemo(() => {
    let seats = 0;
    let assigned = 0;
    owners.forEach((o) => {
      seats += o.seats || 0;
      assigned += o.assigned || 0;
    });
    return { seats, assigned, unassigned: Math.max(0, seats - assigned) };
  }, [owners]);

  const renderClient = (o: AgencySupportOwnerRow, c: AgencySupportClientRow) => {
    const url = subAccountUrl(o.white_label_domain, c.location_id);
    const locked = !!c.locked_until && new Date(c.locked_until) > new Date();
    return (
      <div key={c.id} className="rounded-lg border bg-card p-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {c.client_company || c.client_name || c.client_email}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {c.client_name ? `${c.client_name} · ` : ""}
              {c.client_email}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {c.client_phone || "no phone"} · location {c.location_id || "not provided"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {c.active ? `Assigned ${fmtDate(c.assigned_at)}` : "Not assigned"}
              {locked ? ` · locked until ${fmtDate(c.locked_until)}` : ""}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant={c.active ? "default" : "secondary"} className="text-[10px]">
              {c.active ? "Active" : "Off"}
            </Badge>
            {c.active && (
              <Badge variant={locked ? "destructive" : "outline"} className="text-[10px]">
                {locked ? <Lock className="w-3 h-3 mr-1" /> : <LockOpen className="w-3 h-3 mr-1" />}
                {locked ? "30-day lock" : "Unlocked"}
              </Badge>
            )}
          </div>
        </div>
        <div className="mt-2">
          {url ? (
            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex">
              <Button size="sm" variant="outline" className="h-7 text-xs">
                <ExternalLink className="w-3 h-3 mr-1" /> Open sub-account
              </Button>
            </a>
          ) : (
            <p className="text-xs text-muted-foreground">
              {!o.white_label_domain
                ? "Owner has not added their white-label domain yet."
                : "This client has no location ID yet."}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            Agency support accounts
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={load} className="h-7 px-2">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 pt-1 text-xs text-muted-foreground">
          <span className="rounded bg-muted px-2 py-0.5">{owners.length} owners</span>
          <span className="rounded bg-muted px-2 py-0.5">{totals.assigned} of {totals.seats} accounts assigned</span>
          <span className="rounded bg-muted px-2 py-0.5">{totals.unassigned} unassigned</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          placeholder="Search owner, client, company or location ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 text-sm"
        />

        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No agency support accounts found.</p>
        ) : (
          <div className={compact ? "space-y-2 max-h-[520px] overflow-y-auto pr-1" : "space-y-3"}>
            {visible.map((o) => {
              const expanded = open[o.owner_email] ?? (!compact && search.trim().length > 0);
              return (
                <div key={o.owner_email} className="rounded-lg border">
                  <button
                    type="button"
                    className="w-full text-left p-3 flex items-start justify-between gap-3"
                    onClick={() => setOpen((p) => ({ ...p, [o.owner_email]: !expanded }))}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate flex items-center gap-1">
                        {expanded ? (
                          <ChevronDown className="w-4 h-4 shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 shrink-0" />
                        )}
                        {o.owner_name || o.owner_email}
                      </p>
                      <p className="text-xs text-muted-foreground truncate pl-5">{o.owner_email}</p>
                      <p className="text-xs text-muted-foreground truncate pl-5">
                        {o.plan || "—"} · agency {o.agency_id || "not set"} ·{" "}
                        {o.white_label_domain || "no white-label domain"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant="secondary" className="text-[10px]">
                        {o.assigned}/{o.seats} assigned
                      </Badge>
                      {o.seats - o.assigned > 0 && (
                        <Badge variant="destructive" className="text-[10px]">
                          {o.seats - o.assigned} unassigned
                        </Badge>
                      )}
                    </div>
                  </button>
                  {expanded && (
                    <div className="px-3 pb-3 space-y-2">
                      {o.clients.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No clients added yet.</p>
                      ) : (
                        o.clients.map((c) => renderClient(o, c))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AgencySupportAccountsPanel;
