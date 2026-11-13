import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Hammer, RefreshCw, ThumbsUp } from "lucide-react";

const STATUSES = ["submitted", "planned", "in_progress", "completed", "declined"];

interface FeatureRequest {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: string | null;
  upvotes: number | null;
  created_by: string | null;
  created_at: string | null;
}

const rank = (s: string | null) => {
  const v = (s || "submitted").toLowerCase();
  if (v === "submitted") return 0;
  if (v === "planned") return 1;
  if (v === "in_progress") return 2;
  if (v === "completed") return 3;
  return 4;
};

const BuildRequestsWidget = () => {
  const [rows, setRows] = useState<FeatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDone, setShowDone] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("feature_requests")
        .select("id, title, description, category, status, upvotes, created_by, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      setRows((data || []) as FeatureRequest[]);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load build requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => {
    return rows
      .filter((r) => (showDone ? true : !["completed", "declined"].includes((r.status || "").toLowerCase())))
      .sort((a, b) => rank(a.status) - rank(b.status) || (b.upvotes || 0) - (a.upvotes || 0));
  }, [rows, showDone]);

  const openCount = rows.filter((r) => !["completed", "declined"].includes((r.status || "").toLowerCase())).length;

  const updateStatus = async (id: string, status: string) => {
    const prev = rows.find((r) => r.id === id)?.status;
    setRows((list) => list.map((r) => (r.id === id ? { ...r, status } : r)));
    const { error } = await supabase.from("feature_requests").update({ status }).eq("id", id);
    if (error) {
      console.error(error);
      toast.error("Failed to update request");
      setRows((list) => list.map((r) => (r.id === id ? { ...r, status: prev ?? null } : r)));
      return;
    }
    toast.success(`Request set to ${status.replace("_", " ")}`);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Hammer className="w-4 h-4 text-brand" />
            Build requests
            {openCount > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                {openCount} open
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowDone((s) => !s)}>
              {showDone ? "Hide closed" : "Show closed"}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={load}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-2">
          {loading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No build requests.</p>
          ) : (
            <div className="space-y-2">
              {visible.map((r) => (
                <div key={r.id} className="rounded-lg border bg-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{r.title}</p>
                      {r.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{r.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {r.category} · {r.created_by || "unknown"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <Badge variant="secondary" className="text-[10px]">
                        <ThumbsUp className="w-3 h-3 mr-1" />
                        {r.upvotes || 0}
                      </Badge>
                      <Select value={(r.status || "submitted").toLowerCase()} onValueChange={(v) => updateStatus(r.id, v)}>
                        <SelectTrigger className="h-7 w-[130px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => (
                            <SelectItem key={s} value={s} className="text-xs">
                              {s.replace("_", " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default BuildRequestsWidget;
