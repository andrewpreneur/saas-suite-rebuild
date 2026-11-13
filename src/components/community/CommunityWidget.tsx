import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HelpCircle, Loader2, MessageSquare, Package, Users } from "lucide-react";
import { relativeTime } from "./shared";
import type { CommunityTab } from "./CommunityHub";

type RecentPost = { id: string; title: string | null; body: string; created_at: string };

export default function CommunityWidget({
  onNavigate,
}: {
  onNavigate?: (tab: CommunityTab) => void;
}) {
  const [posts, setPosts] = useState<RecentPost[]>([]);
  const [unanswered, setUnanswered] = useState(0);
  const [snapshot, setSnapshot] = useState<{ id: string; title: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      const [postRes, threadRes, snapRes] = await Promise.all([
        supabase
          .from("community_posts")
          .select("id, title, body, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("community_threads")
          .select("id", { count: "exact", head: true })
          .eq("status", "open"),
        supabase
          .from("community_snapshots")
          .select("id, title")
          .order("created_at", { ascending: false })
          .limit(1),
      ]);
      setPosts((postRes.data || []) as RecentPost[]);
      setUnanswered(threadRes.count || 0);
      setSnapshot(((snapRes.data || [])[0] as any) || null);
      setLoading(false);
    };
    void run();
  }, []);

  const go = (tab: CommunityTab) => {
    if (onNavigate) onNavigate(tab);
    else window.location.href = `/app?tool=community`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="w-4 h-4 text-brand" />
          Community
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => go("feed")}>
          Open
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {posts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No community posts yet.</p>
              ) : (
                posts.map((post) => (
                  <button
                    key={post.id}
                    onClick={() => go("feed")}
                    className="flex w-full items-start gap-2 rounded-md p-2 text-left transition-colors hover:bg-accent/60"
                  >
                    <MessageSquare className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-foreground">
                        {post.title || post.body}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {relativeTime(post.created_at)}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                onClick={() => go("ask")}
                className="flex items-center gap-2 rounded-md border border-border p-3 text-left transition-colors hover:border-brand/40"
              >
                <HelpCircle className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-foreground">Unanswered</span>
                <Badge variant="secondary" className="ml-auto">
                  {unanswered}
                </Badge>
              </button>
              <button
                onClick={() => go("snapshots")}
                className="flex items-center gap-2 rounded-md border border-border p-3 text-left transition-colors hover:border-brand/40"
              >
                <Package className="w-4 h-4 text-muted-foreground" />
                <span className="min-w-0 truncate text-sm text-foreground">
                  {snapshot?.title || "No snapshots yet"}
                </span>
              </button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}