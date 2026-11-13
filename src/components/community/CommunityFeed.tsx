import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { SmoothInput, SmoothTextarea } from "@/components/ui/smooth-input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Heart,
  MessageSquare,
  Pin,
  Send,
  CheckCircle2,
  Megaphone,
  Loader2,
  ThumbsUp,
  Pencil,
  Trash2,
  Search,
  PenLine,
  MessageCircle,
} from "lucide-react";
import { EmptyState, EmptyStateIllustration } from "@/components/premium/21st/empty-state";
import { AuthorLine, MemberAvatar } from "./shared";
import { GifPicker, GifPreview, MediaAttachment, type GifSelection } from "./GifPicker";
import type { CommunityProfile } from "@/hooks/useCommunityProfile";

const notifyCommunity = (body: Record<string, unknown>) => {
  void supabase.functions.invoke("community-notify", { body }).catch(() => {});
};

type Space = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
};

export const POST_CATEGORIES = ["Sales", "Beginner", "Growth", "SaaSSuite", "Other"] as const;
export type PostCategory = (typeof POST_CATEGORIES)[number];

const CATEGORY_STYLES: Record<string, string> = {
  Sales: "border-warning/40 bg-warning/10 text-warning",
  Beginner: "border-info/40 bg-info/10 text-info",
  Growth: "border-success/40 bg-success/10 text-success",
  SaaSSuite: "border-brand/40 bg-brand-subtle text-brand",
  Other: "border-border bg-muted text-muted-foreground",
};

type Post = {
  id: string;
  space_id: string;
  author_id: string;
  title: string | null;
  body: string;
  category?: string | null;
  is_pinned: boolean;
  is_answered: boolean;
  comment_count: number;
  reaction_count: number;
  created_at: string;
  edited_at?: string | null;
  media_url?: string | null;
  media_type?: string | null;
  media_width?: number | null;
  media_height?: number | null;
};

type Comment = {
  id: string;
  post_id: string;
  author_id: string;
  parent_comment_id: string | null;
  body: string;
  created_at: string;
  edited_at?: string | null;
  media_url?: string | null;
  media_type?: string | null;
  media_width?: number | null;
  media_height?: number | null;
};

type AuthorMap = Record<
  string,
  Pick<CommunityProfile, "display_name" | "avatar_url" | "role"> & {
    handle?: string | null;
    is_verified?: boolean | null;
  }
>;

interface CommunityFeedProps {
  profile: CommunityProfile | null;
  initialPostId?: string | null;
  isStaff?: boolean;
  /** Only the platform owner may post as the official SaaSSuite account. */
  canAnnounce?: boolean;
}

export default function CommunityFeed({
  profile,
  initialPostId,
  isStaff,
  canAnnounce,
}: CommunityFeedProps) {
  const { toast } = useToast();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [activeSpace, setActiveSpace] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [authors, setAuthors] = useState<AuthorMap>({});
  const [myReactions, setMyReactions] = useState<Set<string>>(new Set());
  const [openPostId, setOpenPostId] = useState<string | null>(initialPostId ?? null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<string>("Other");
  const [composerOpen, setComposerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [gif, setGif] = useState<GifSelection | null>(null);
  const [posting, setPosting] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPostBody, setEditPostBody] = useState("");

  const startEditPost = (post: Post) => {
    setEditingPostId(post.id);
    setEditTitle(post.title || "");
    setEditPostBody(post.body);
  };

  const savePostEdit = async (postId: string) => {
    if (!editPostBody.trim()) return;
    const editedAt = new Date().toISOString();
    const { error } = await supabase
      .from("community_posts")
      .update({ title: editTitle.trim() || null, body: editPostBody.trim(), edited_at: editedAt })
      .eq("id", postId);
    if (error) {
      toast({ title: "Could not update post", description: error.message, variant: "destructive" });
      return;
    }
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, title: editTitle.trim() || null, body: editPostBody.trim(), edited_at: editedAt }
          : p,
      ),
    );
    setEditingPostId(null);
  };

  const deletePost = async (postId: string) => {
    const { error } = await supabase.from("community_posts").delete().eq("id", postId);
    if (error) {
      toast({ title: "Could not delete post", description: error.message, variant: "destructive" });
      return;
    }
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    toast({ title: "Post deleted" });
  };

  const loadAuthors = useCallback(async (ids: string[]) => {
    const unique = Array.from(new Set(ids)).filter(Boolean);
    if (unique.length === 0) return;
    const { data } = await supabase
      .from("community_profiles")
      .select("id, display_name, avatar_url, role, handle, is_verified")
      .in("id", unique);
    if (data) {
      setAuthors((prev) => {
        const next = { ...prev };
        data.forEach((p: any) => {
          next[p.id] = {
            display_name: p.display_name,
            avatar_url: p.avatar_url,
            role: p.role,
            handle: p.handle,
            is_verified: p.is_verified,
          };
        });
        return next;
      });
    }
  }, []);

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase
        .from("community_spaces")
        .select("id, slug, name, description, sort_order")
        .order("sort_order");
      if (data) {
        setSpaces(data as Space[]);
        setActiveSpace((prev) => prev ?? (data[0]?.id ?? null));
      }
    };
    void run();
  }, []);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    const query = supabase
      .from("community_posts")
      .select("*")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);
    const { data } = await query;
    const rows = (data || []) as Post[];
    setPosts(rows);
    await loadAuthors(rows.map((p) => p.author_id));
    setLoading(false);
  }, [loadAuthors]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    if (!profile) return;
    const run = async () => {
      const { data } = await supabase
        .from("community_reactions")
        .select("post_id")
        .eq("user_id", profile.id)
        .not("post_id", "is", null);
      if (data) setMyReactions(new Set(data.map((r: any) => r.post_id)));
    };
    void run();
  }, [profile]);

  const createPost = async () => {
    if (!profile || !activeSpace || !body.trim()) return;
    setPosting(true);
    const { data: newPost, error } = await supabase.from("community_posts").insert({
      space_id: activeSpace,
      author_id: profile.id,
      title: title.trim() || null,
      body: body.trim(),
      category,
      media_url: gif?.media_url ?? null,
      media_type: gif?.media_type ?? null,
      media_width: gif?.media_width ?? null,
      media_height: gif?.media_height ?? null,
    }).select("id").single();
    setPosting(false);
    if (!error && newPost) notifyCommunity({ event: "new_post", post_id: (newPost as any).id });
    if (error) {
      toast({ title: "Could not post", description: error.message, variant: "destructive" });
      return;
    }
    setTitle("");
    setBody("");
    setGif(null);
    setCategory("Other");
    setComposerOpen(false);
    void loadPosts();
  };

  const toggleReaction = async (postId: string) => {
    if (!profile) return;
    const liked = myReactions.has(postId);
    setMyReactions((prev) => {
      const next = new Set(prev);
      liked ? next.delete(postId) : next.add(postId);
      return next;
    });
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, reaction_count: Math.max(0, p.reaction_count + (liked ? -1 : 1)) }
          : p,
      ),
    );
    if (liked) {
      await supabase
        .from("community_reactions")
        .delete()
        .eq("user_id", profile.id)
        .eq("post_id", postId);
    } else {
      await supabase
        .from("community_reactions")
        .insert({ user_id: profile.id, post_id: postId, type: "like" });
      notifyCommunity({ event: "post_like", post_id: postId });
    }
  };

  const openPost = useMemo(() => posts.find((p) => p.id === openPostId) || null, [posts, openPostId]);

  const visiblePosts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter((p) => {
      const cat = p.category || "Other";
      if (categoryFilter !== "All" && cat !== categoryFilter) return false;
      if (!q) return true;
      const author = authors[p.author_id]?.display_name || "";
      return (
        (p.title || "").toLowerCase().includes(q) ||
        p.body.toLowerCase().includes(q) ||
        author.toLowerCase().includes(q)
      );
    });
  }, [posts, authors, search, categoryFilter]);

  if (openPostId) {
    return (
      <PostDetail
        postId={openPostId}
        post={openPost}
        profile={profile}
        authors={authors}
        loadAuthors={loadAuthors}
        isStaff={isStaff}
        onBack={() => {
          setOpenPostId(null);
          void loadPosts();
        }}
      />
    );
  }

  return (
    <div>
      <div className="space-y-4">
        {canAnnounce && <AnnouncementComposer onPosted={() => void loadPosts()} />}

        {/* Composer */}
        <Card className="px-surface border-0">
          <CardContent className="p-3 sm:p-4">
            {!composerOpen ? (
              <button
                type="button"
                onClick={() => setComposerOpen(true)}
                className="group flex w-full items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <MemberAvatar name={profile?.display_name} avatarUrl={profile?.avatar_url} />
                <span className="flex h-11 min-w-0 flex-1 items-center truncate rounded-md border border-border bg-muted/40 px-4 text-sm text-muted-foreground transition-colors group-hover:border-brand/40 group-hover:bg-card">
                  <span className="truncate">
                    Share a win or ask a question
                    {profile?.display_name ? `, ${profile.display_name.split(" ")[0]}` : ""}
                  </span>
                </span>
                <span className="px-brand-fill hidden h-10 shrink-0 items-center gap-2 rounded-md px-4 text-sm font-semibold sm:inline-flex">
                  <PenLine className="size-4" aria-hidden="true" />
                  Write a post
                </span>
              </button>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3"
              >
                <MemberAvatar name={profile?.display_name} avatarUrl={profile?.avatar_url} />
                <div className="flex-1 space-y-2">
                  <SmoothInput
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Title (optional)"
                  />
                  <SmoothTextarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={3}
                    autoFocus
                    placeholder="Share something with the community..."
                  />
                  {gif && <GifPreview gif={gif} onClear={() => setGif(null)} />}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {POST_CATEGORIES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCategory(c)}
                        className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                          category === c
                            ? CATEGORY_STYLES[c]
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <GifPicker onSelect={setGif} />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setComposerOpen(false);
                        setGif(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button size="sm" className="gap-2" disabled={!body.trim() || posting} onClick={createPost}>
                      {posting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Post
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>

        {/* Search + category filter */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search posts"
              aria-label="Search posts"
              className="h-11 w-full rounded-md border border-input bg-card pl-9 pr-3 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 sm:h-10 sm:text-sm"
            />
          </div>
          <div
            role="radiogroup"
            aria-label="Filter posts by topic"
            className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
          >
            {["All", ...POST_CATEGORIES].map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={categoryFilter === c}
                onClick={() => setCategoryFilter(c)}
                className={`inline-flex h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors sm:h-9 sm:px-3 ${
                  categoryFilter === c
                    ? "border-brand bg-brand-subtle text-brand"
                    : "border-border bg-card text-muted-foreground hover:border-brand/40 hover:text-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading posts">
            <div className="px-skeleton h-32 rounded-lg" />
            <div className="px-skeleton h-32 rounded-lg" />
            <div className="px-skeleton h-32 rounded-lg" />
          </div>
        ) : visiblePosts.length === 0 ? (
          <div className="px-surface">
            {posts.length === 0 ? (
              <EmptyState
                icon={
                  <EmptyStateIllustration className="rounded-lg border-border bg-muted text-muted-foreground">
                    <MessageCircle className="size-7" aria-hidden="true" />
                  </EmptyStateIllustration>
                }
                title="No posts yet"
                description="Be the first to start a conversation. Share a win or ask the group a question."
                action={
                  <Button variant="accent" onClick={() => setComposerOpen(true)}>
                    <PenLine /> Write the first post
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={
                  <EmptyStateIllustration className="rounded-lg border-border bg-muted text-muted-foreground">
                    <Search className="size-7" aria-hidden="true" />
                  </EmptyStateIllustration>
                }
                title="No posts match"
                description="Try a different word or topic."
                action={
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearch("");
                      setCategoryFilter("All");
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            )}
          </div>
        ) : (
          <AnimatePresence initial={false}>
          {visiblePosts.map((post) => {
            const author = authors[post.author_id];
            const liked = myReactions.has(post.id);
            const isMine = !!profile && post.author_id === profile.id;
            const canManage = isMine || !!isStaff;
            const isEditing = editingPostId === post.id;
            return (
              <motion.div
                key={post.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
              <Card
                className={`border-0 ${isEditing ? "px-surface" : "px-surface-interactive cursor-pointer"}`}
                onClick={isEditing ? undefined : () => setOpenPostId(post.id)}
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <MemberAvatar
                      name={author?.display_name}
                      avatarUrl={author?.avatar_url}
                      authorId={post.author_id}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <AuthorLine
                          name={author?.display_name}
                          handle={author?.handle}
                          verified={author?.is_verified}
                          role={author?.role}
                          when={post.created_at}
                        />
                        {post.edited_at && (
                          <span className="text-[10px] text-muted-foreground">(edited)</span>
                        )}
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-medium leading-none ${
                            CATEGORY_STYLES[post.category || "Other"]
                          }`}
                        >
                          {post.category || "Other"}
                        </span>
                        {post.is_pinned && (
                          <Badge variant="outline" className="h-5 gap-1 px-1.5 text-xs leading-none">
                            <Pin className="w-3 h-3" /> Pinned
                          </Badge>
                        )}
                        {post.is_answered && (
                          <Badge variant="secondary" className="h-5 gap-1 px-1.5 text-xs leading-none">
                            <CheckCircle2 className="w-3 h-3" /> Answered
                          </Badge>
                        )}
                        {canManage && !isEditing && (
                          <div className="ml-auto flex items-center gap-1">
                            <button
                              className="text-muted-foreground transition-colors hover:text-foreground"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditPost(post);
                              }}
                              aria-label="Edit post"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              className="text-muted-foreground transition-colors hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                void deletePost(post.id);
                              }}
                              aria-label="Delete post"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                      {isEditing ? (
                        <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                          <SmoothInput
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            placeholder="Title (optional)"
                          />
                          <SmoothTextarea
                            value={editPostBody}
                            onChange={(e) => setEditPostBody(e.target.value)}
                            rows={4}
                          />
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => setEditingPostId(null)}>
                              Cancel
                            </Button>
                            <Button variant="accent" size="sm" disabled={!editPostBody.trim()} onClick={() => void savePostEdit(post.id)}>
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                      <>
                      {post.title && (
                        <h3 className="mt-1 text-base font-semibold text-foreground">{post.title}</h3>
                      )}
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                        {post.body}
                      </p>
                      <MediaAttachment
                        url={post.media_url}
                        width={post.media_width}
                        height={post.media_height}
                      />
                      </>
                      )}
                      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                        <motion.button
                          onClick={(e) => {
                            e.stopPropagation();
                            void toggleReaction(post.id);
                          }}
                          whileTap={{ scale: 0.9 }}
                          className={`flex items-center gap-1.5 transition-colors hover:text-foreground ${
                            liked ? "text-heart" : ""
                          }`}
                          aria-pressed={liked}
                        >
                          <motion.span
                            className="relative flex items-center justify-center"
                            animate={
                              liked
                                ? { scale: [1, 1.45, 0.9, 1.15, 1] }
                                : { scale: 1 }
                            }
                            transition={{ duration: 0.45, ease: "easeOut" }}
                          >
                            <Heart
                              className={`w-3.5 h-3.5 ${liked ? "fill-heart text-heart" : ""}`}
                            />
                            <AnimatePresence>
                              {liked && (
                                <motion.span
                                  key="burst"
                                  aria-hidden
                                  className="pointer-events-none absolute inset-0 rounded-full border border-heart"
                                  initial={{ scale: 0.6, opacity: 0.8 }}
                                  animate={{ scale: 2.4, opacity: 0 }}
                                  exit={{ opacity: 0 }}
                                  transition={{ duration: 0.55, ease: "easeOut" }}
                                />
                              )}
                            </AnimatePresence>
                          </motion.span>
                          {post.reaction_count}
                        </motion.button>
                        <span className="flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5" />
                          {post.comment_count}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              </motion.div>
            );
          })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

function PostDetail({
  postId,
  post,
  profile,
  authors,
  loadAuthors,
  isStaff,
  onBack,
}: {
  postId: string;
  post: Post | null;
  profile: CommunityProfile | null;
  authors: AuthorMap;
  loadAuthors: (ids: string[]) => Promise<void>;
  isStaff?: boolean;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const [detail, setDetail] = useState<Post | null>(post);
  const [editingPost, setEditingPost] = useState(false);
  const [postTitle, setPostTitle] = useState("");
  const [postBody, setPostBody] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [reply, setReply] = useState("");
  const [replyGif, setReplyGif] = useState<GifSelection | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [nestedGif, setNestedGif] = useState<GifSelection | null>(null);
  const [loading, setLoading] = useState(true);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [myLikes, setMyLikes] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: postRow }, { data: commentRows }] = await Promise.all([
      supabase.from("community_posts").select("*").eq("id", postId).maybeSingle(),
      supabase.from("community_comments").select("*").eq("post_id", postId).order("created_at"),
    ]);
    if (postRow) setDetail(postRow as Post);
    const rows = (commentRows || []) as Comment[];
    setComments(rows);
    if (rows.length > 0) {
      const { data: reactions } = await supabase
        .from("community_reactions")
        .select("comment_id, user_id")
        .in(
          "comment_id",
          rows.map((c) => c.id),
        );
      const counts: Record<string, number> = {};
      const mine = new Set<string>();
      (reactions || []).forEach((r: any) => {
        counts[r.comment_id] = (counts[r.comment_id] || 0) + 1;
        if (profile && r.user_id === profile.id) mine.add(r.comment_id);
      });
      setLikeCounts(counts);
      setMyLikes(mine);
    }
    await loadAuthors([...(postRow ? [(postRow as Post).author_id] : []), ...rows.map((c) => c.author_id)]);
    setLoading(false);
  }, [postId, loadAuthors, profile]);

  const toggleCommentLike = async (commentId: string) => {
    if (!profile) return;
    const liked = myLikes.has(commentId);
    setMyLikes((prev) => {
      const next = new Set(prev);
      liked ? next.delete(commentId) : next.add(commentId);
      return next;
    });
    setLikeCounts((prev) => ({
      ...prev,
      [commentId]: Math.max(0, (prev[commentId] || 0) + (liked ? -1 : 1)),
    }));
    if (liked) {
      await supabase
        .from("community_reactions")
        .delete()
        .eq("user_id", profile.id)
        .eq("comment_id", commentId);
    } else {
      await supabase
        .from("community_reactions")
        .insert({ user_id: profile.id, comment_id: commentId, type: "like" });
      notifyCommunity({ event: "comment_like", post_id: postId, comment_id: commentId });
    }
  };

  useEffect(() => {
    void load();
  }, [load]);

  const addComment = async (body: string, parentId: string | null, media?: GifSelection | null) => {
    if (!profile || !body.trim()) return;
    const { data: newComment, error } = await supabase.from("community_comments").insert({
      post_id: postId,
      author_id: profile.id,
      parent_comment_id: parentId,
      body: body.trim(),
      media_url: media?.media_url ?? null,
      media_type: media?.media_type ?? null,
      media_width: media?.media_width ?? null,
      media_height: media?.media_height ?? null,
    }).select("id").single();
    if (!error && newComment) {
      notifyCommunity({
        event: parentId ? "comment_reply" : "post_comment",
        post_id: postId,
        comment_id: (newComment as any).id,
        parent_comment_id: parentId,
      });
    }
    if (error) {
      toast({ title: "Could not comment", description: error.message, variant: "destructive" });
      return;
    }
    setReply("");
    setReplyBody("");
    setReplyGif(null);
    setNestedGif(null);
    setReplyTo(null);
    void load();
  };

  const saveCommentEdit = async (commentId: string) => {
    if (!editBody.trim()) return;
    const editedAt = new Date().toISOString();
    const { error } = await supabase
      .from("community_comments")
      .update({ body: editBody.trim(), edited_at: editedAt })
      .eq("id", commentId);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, body: editBody.trim(), edited_at: editedAt } : c)),
    );
    setEditingId(null);
    setEditBody("");
  };

  const deleteComment = async (commentId: string) => {
    const { error } = await supabase.from("community_comments").delete().eq("id", commentId);
    if (error) {
      toast({ title: "Could not delete", description: error.message, variant: "destructive" });
      return;
    }
    setComments((prev) => prev.filter((c) => c.id !== commentId && c.parent_comment_id !== commentId));
  };

  const commentActions = (c: Comment) =>
    (profile && c.author_id === profile.id) || isStaff ? (
      <>
        <button
          className="flex items-center gap-1 hover:text-foreground"
          onClick={() => {
            setEditingId(c.id);
            setEditBody(c.body);
          }}
        >
          <Pencil className="h-3 w-3" /> Edit
        </button>
        <button
          className="flex items-center gap-1 hover:text-destructive"
          onClick={() => void deleteComment(c.id)}
        >
          <Trash2 className="h-3 w-3" /> Delete
        </button>
      </>
    ) : null;

  const editBox = (c: Comment) => (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="mt-2 space-y-2"
    >
      <SmoothTextarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={2} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
          Cancel
        </Button>
        <Button variant="accent" size="sm" disabled={!editBody.trim()} onClick={() => void saveCommentEdit(c.id)}>
          Save
        </Button>
      </div>
    </motion.div>
  );

  const topLevel = comments.filter((c) => !c.parent_comment_id);
  const repliesOf = (id: string) => comments.filter((c) => c.parent_comment_id === id);
  const author = detail ? authors[detail.author_id] : undefined;
  const canManagePost = !!detail && (!!isStaff || (!!profile && detail.author_id === profile.id));

  const savePostEdit = async () => {
    if (!detail || !postBody.trim()) return;
    const editedAt = new Date().toISOString();
    const { error } = await supabase
      .from("community_posts")
      .update({ title: postTitle.trim() || null, body: postBody.trim(), edited_at: editedAt })
      .eq("id", detail.id);
    if (error) {
      toast({ title: "Could not update post", description: error.message, variant: "destructive" });
      return;
    }
    setDetail({ ...detail, title: postTitle.trim() || null, body: postBody.trim(), edited_at: editedAt });
    setEditingPost(false);
  };

  const deleteThisPost = async () => {
    if (!detail) return;
    const { error } = await supabase.from("community_posts").delete().eq("id", detail.id);
    if (error) {
      toast({ title: "Could not delete post", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Post deleted" });
    onBack();
  };

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <Button variant="ghost" size="sm" className="gap-2 -ml-2" onClick={onBack}>
        <ArrowLeft className="w-4 h-4" /> Back to feed
      </Button>

      {loading && !detail ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : !detail ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            This post is no longer available.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <MemberAvatar
                  name={author?.display_name}
                  avatarUrl={author?.avatar_url}
                  authorId={detail.author_id}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <AuthorLine
                      name={author?.display_name}
                      handle={author?.handle}
                      verified={author?.is_verified}
                      role={author?.role}
                      when={detail.created_at}
                    />
                    {detail.edited_at && (
                      <span className="text-[10px] text-muted-foreground">(edited)</span>
                    )}
                    {canManagePost && !editingPost && (
                      <div className="ml-auto flex items-center gap-1">
                        <button
                          className="text-muted-foreground transition-colors hover:text-foreground"
                          onClick={() => {
                            setPostTitle(detail.title || "");
                            setPostBody(detail.body);
                            setEditingPost(true);
                          }}
                          aria-label="Edit post"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          className="text-muted-foreground transition-colors hover:text-destructive"
                          onClick={() => void deleteThisPost()}
                          aria-label="Delete post"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  {editingPost ? (
                    <div className="mt-2 space-y-2">
                      <SmoothInput
                        value={postTitle}
                        onChange={(e) => setPostTitle(e.target.value)}
                        placeholder="Title (optional)"
                      />
                      <SmoothTextarea
                        value={postBody}
                        onChange={(e) => setPostBody(e.target.value)}
                        rows={5}
                      />
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setEditingPost(false)}>
                          Cancel
                        </Button>
                        <Button variant="accent" size="sm" disabled={!postBody.trim()} onClick={() => void savePostEdit()}>
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                  <>
                  {detail.title && (
                    <h2 className="mt-1 text-lg font-semibold text-foreground">{detail.title}</h2>
                  )}
                  <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">{detail.body}</p>
                  <MediaAttachment
                    url={detail.media_url}
                    width={detail.media_width}
                    height={detail.media_height}
                  />
                  </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-start gap-3">
                <MemberAvatar
                  name={profile?.display_name}
                  avatarUrl={profile?.avatar_url}
                  className="h-8 w-8"
                />
                <div className="flex-1 space-y-2">
                  <SmoothTextarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={2}
                    placeholder="Write a comment..."
                  />
                  {replyGif && <GifPreview gif={replyGif} onClear={() => setReplyGif(null)} />}
                  <div className="flex items-center justify-end gap-2">
                    <GifPicker onSelect={setReplyGif} />
                    <Button size="sm" disabled={!reply.trim()} onClick={() => addComment(reply, null, replyGif)}>
                      Comment
                    </Button>
                  </div>
                </div>
              </div>

              {topLevel.length > 0 && <Separator />}

              <div className="space-y-4">
                <AnimatePresence initial={false}>
                {topLevel.map((comment) => {
                  const cAuthor = authors[comment.author_id];
                  return (
                    <motion.div
                      key={comment.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className="space-y-3"
                    >
                      <div className="flex items-start gap-3">
                        <MemberAvatar
                          name={cAuthor?.display_name}
                          avatarUrl={cAuthor?.avatar_url}
                          authorId={comment.author_id}
                          className="h-8 w-8"
                        />
                        <div className="min-w-0 flex-1">
                          <AuthorLine
                            name={cAuthor?.display_name}
                            handle={cAuthor?.handle}
                            verified={cAuthor?.is_verified}
                            role={cAuthor?.role}
                            when={comment.created_at}
                          />
                          {editingId === comment.id ? (
                            editBox(comment)
                          ) : (
                            <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">
                              {comment.body}
                              {comment.edited_at && (
                                <span className="ml-1.5 text-[11px] text-muted-foreground">(edited)</span>
                              )}
                            </p>
                          )}
                          <MediaAttachment
                            url={comment.media_url}
                            width={comment.media_width}
                            height={comment.media_height}
                            className="max-h-56"
                          />
                          <div className="mt-1.5 flex items-center gap-4 text-xs text-muted-foreground">
                            <button
                              className={`flex items-center gap-1.5 transition-colors hover:text-foreground ${
                                myLikes.has(comment.id) ? "text-brand" : ""
                              }`}
                              onClick={() => void toggleCommentLike(comment.id)}
                            >
                              <ThumbsUp
                                className={`h-3.5 w-3.5 ${myLikes.has(comment.id) ? "fill-current" : ""}`}
                              />
                              {likeCounts[comment.id] || 0}
                            </button>
                            <button
                              className="hover:text-foreground"
                              onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                            >
                              Reply
                            </button>
                            {commentActions(comment)}
                          </div>
                        </div>
                      </div>

                      {/* one nesting level only */}
                      <AnimatePresence initial={false}>
                      {repliesOf(comment.id).map((child) => {
                        const rAuthor = authors[child.author_id];
                        return (
                          <motion.div
                            key={child.id}
                            layout
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="ml-11 flex items-start gap-3 border-l border-border pl-4"
                          >
                            <MemberAvatar
                              name={rAuthor?.display_name}
                              avatarUrl={rAuthor?.avatar_url}
                              className="h-7 w-7"
                            />
                            <div className="min-w-0 flex-1">
                              <AuthorLine
                                name={rAuthor?.display_name}
                                handle={rAuthor?.handle}
                                verified={rAuthor?.is_verified}
                                role={rAuthor?.role}
                                when={child.created_at}
                              />
                              {editingId === child.id ? (
                                editBox(child)
                              ) : (
                                <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">
                                  {child.body}
                                  {child.edited_at && (
                                    <span className="ml-1.5 text-[11px] text-muted-foreground">(edited)</span>
                                  )}
                                </p>
                              )}
                              <MediaAttachment
                                url={child.media_url}
                                width={child.media_width}
                                height={child.media_height}
                                className="max-h-48"
                              />
                              <div className="mt-1.5 flex items-center gap-4 text-xs text-muted-foreground">
                                <button
                                  className={`flex items-center gap-1.5 transition-colors hover:text-foreground ${
                                    myLikes.has(child.id) ? "text-brand" : ""
                                  }`}
                                  onClick={() => void toggleCommentLike(child.id)}
                                >
                                  <ThumbsUp
                                    className={`h-3.5 w-3.5 ${myLikes.has(child.id) ? "fill-current" : ""}`}
                                  />
                                  {likeCounts[child.id] || 0}
                                </button>
                                {commentActions(child)}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                      </AnimatePresence>

                      <AnimatePresence initial={false}>
                      {replyTo === comment.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="ml-11 space-y-2 overflow-hidden border-l border-border pl-4"
                        >
                          <SmoothTextarea
                            value={replyBody}
                            onChange={(e) => setReplyBody(e.target.value)}
                            rows={2}
                            placeholder="Write a reply..."
                          />
                          {nestedGif && <GifPreview gif={nestedGif} onClear={() => setNestedGif(null)} />}
                          <div className="flex items-center justify-end gap-2">
                            <GifPicker onSelect={setNestedGif} />
                            <Button variant="ghost" size="sm" onClick={() => setReplyTo(null)}>
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              disabled={!replyBody.trim()}
                              onClick={() => addComment(replyBody, comment.id, nestedGif)}
                            >
                              Reply
                            </Button>
                          </div>
                        </motion.div>
                      )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </motion.div>
  );
}

const STARTER_ANNOUNCEMENTS: { title: string; body: string }[] = [
  {
    title: "Welcome to the SaaSSuite Community 🎉",
    body:
      "This is your home base: share wins, grab snapshots, take the Academy courses, and message our team directly. Introduce yourself below!",
  },
  {
    title: "New: Client Hub module reordering",
    body:
      "You can now drag to reorder and rename every module in your Client Hub — built-in and custom. Changes apply instantly to your clients.",
  },
  {
    title: "New: Slack integration for all plans",
    body:
      "Connect your workspace in Settings to get instant alerts for new onboardings, AI support conversations, and ticket updates.",
  },
  {
    title: "New: Respond to tickets with attachments",
    body:
      "Support replies now polish your message and can include screenshots. Your client gets a clean email update automatically.",
  },
  {
    title: "New: Welcome video thumbnails",
    body:
      "Upload a custom thumbnail for your Client Hub welcome video so the first thing clients see looks intentional.",
  },
];

/** Staff-only tool for posting (and seeding) announcements as the SaaSSuite account. */
function AnnouncementComposer({ onPosted }: { onPosted: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pin, setPin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const post = async () => {
    if (!body.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc("community_post_announcement", {
      _body: body.trim(),
      _title: title.trim() || null,
      _pin: pin,
    });
    setBusy(false);
    if (error) {
      toast({ title: "Could not post", description: error.message, variant: "destructive" });
      return;
    }
    setTitle("");
    setBody("");
    setPin(false);
    onPosted();
  };

  const seed = async () => {
    setSeeding(true);
    let ok = 0;
    let lastError: string | null = null;
    for (const item of STARTER_ANNOUNCEMENTS) {
      const { error } = await supabase.rpc("community_post_announcement", {
        _body: item.body,
        _title: item.title,
        _pin: false,
      });
      if (error) {
        lastError = error.message;
      } else {
        ok += 1;
      }
    }
    setSeeding(false);
    if (ok === 0) {
      toast({
        title: "Seeding failed",
        description: lastError || "No announcements could be published.",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Announcements added",
      description: lastError
        ? `${ok} published, some skipped (${lastError})`
        : `${ok} posts published.`,
    });
    onPosted();
  };

  return (
    <Card className="border-brand/30 bg-brand-subtle">
      <CardContent className="space-y-3 pt-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Megaphone className="h-4 w-4 text-brand" /> Post as SaaSSuite
        </div>
        <SmoothInput
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Announcement title"
        />
        <SmoothTextarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Short and sweet — what shipped?"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={pin}
              onChange={(e) => setPin(e.target.checked)}
              className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
            />
            Pin to top of feed
          </label>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={seeding} onClick={seed}>
              {seeding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Preload starter posts"}
            </Button>
            <Button size="sm" disabled={!body.trim() || busy} onClick={post}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Publish"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}