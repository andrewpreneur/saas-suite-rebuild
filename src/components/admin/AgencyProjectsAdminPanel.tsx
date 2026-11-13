import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, KanbanSquare } from "lucide-react";
import AgencyProjectsBoard from "@/components/agency-projects/AgencyProjectsBoard";

interface OwnerSummary {
  owner_email: string;
  total: number;
  open: number;
}

export default function AgencyProjectsAdminPanel() {
  const [owners, setOwners] = useState<OwnerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("agency_projects")
        .select("owner_email, stage")
        .order("updated_at", { ascending: false });
      if (cancelled) return;
      const rows = (data ?? []) as { owner_email: string; stage: string }[];
      const map = new Map<string, OwnerSummary>();
      for (const r of rows) {
        const key = (r.owner_email || "").toLowerCase();
        const entry = map.get(key) ?? { owner_email: key, total: 0, open: 0 };
        entry.total += 1;
        if (r.stage !== "Closed") entry.open += 1;
        map.set(key, entry);
      }
      const list = [...map.values()].sort((a, b) => b.open - a.open || b.total - a.total);
      setOwners(list);
      setSelected((cur) => cur ?? list[0]?.owner_email ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term ? owners.filter((o) => o.owner_email.includes(term)) : owners;
  }, [owners, q]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <KanbanSquare className="w-4 h-4" /> Agency requests &amp; projects
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Every project an agency owner submitted. Pick an owner, drag their cards through the stages and reply in the
          card's thread.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading projects…
          </div>
        ) : owners.length === 0 ? (
          <p className="text-sm text-muted-foreground">No agency projects submitted yet.</p>
        ) : (
          <>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search owner email…"
              className="max-w-xs"
            />
            <div className="flex flex-wrap gap-2">
              {filtered.map((o) => (
                <Button
                  key={o.owner_email}
                  size="sm"
                  variant={selected === o.owner_email ? "default" : "outline"}
                  onClick={() => setSelected(o.owner_email)}
                  className="gap-2"
                >
                  <span className="truncate max-w-[220px]">{o.owner_email}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {o.open}/{o.total}
                  </Badge>
                </Button>
              ))}
            </div>
            {selected && (
              <AgencyProjectsBoard
                key={selected}
                ownerEmail={selected}
                isAdmin
                title={`Projects — ${selected}`}
                description="Drag cards between stages and reply inside a card to message the agency owner."
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
