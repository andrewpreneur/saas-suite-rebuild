import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import matter from "gray-matter";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import {
  BlogPost,
  calcReadingMinutes,
  fetchAllPostsAdmin,
  slugify,
} from "@/lib/blog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Plus, Upload, Trash2, ExternalLink, Save, CalendarClock } from "lucide-react";

import { isPlatformAdminEmail } from "@/lib/platformAdmins";

interface DraftPost extends Partial<BlogPost> {
  id?: string;
  slug: string;
  title: string;
  body_markdown: string;
}

const emptyDraft = (): DraftPost => ({
  slug: "",
  title: "",
  excerpt: "",
  body_markdown: "",
  tldr: "",
  author_name: "Andrew Reeder",
  author_bio: "",
  meta_title: "",
  meta_description: "",
  tags: [],
  faq: [],
  howto_steps: [],
  published: false,
  cover_image_url: null,
});

const AdminBlog = () => {
  const { user } = useUser();
  const isAdmin = isPlatformAdminEmail(user?.email);

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<DraftPost | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    reload();
  }, [isAdmin]);

  async function reload() {
    setLoading(true);
    const all = await fetchAllPostsAdmin();
    setPosts(all);
    setLoading(false);
  }

  async function scheduleDripDrafts() {
    const drafts = posts.filter((p) => !p.published);
    if (!drafts.length) {
      toast.error("No drafts to schedule");
      return;
    }
    const startStr = window.prompt(
      `Drip ${drafts.length} draft(s) — one per day starting on which date? (YYYY-MM-DD)`,
      new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10),
    );
    if (!startStr) return;
    const start = new Date(`${startStr}T09:00:00`);
    if (isNaN(start.getTime())) {
      toast.error("Invalid date");
      return;
    }
    setScheduling(true);
    // Order oldest-created first so imports go out in the order they were added
    const ordered = [...drafts].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    let ok = 0;
    let fail = 0;
    for (let i = 0; i < ordered.length; i++) {
      const when = new Date(start.getTime() + i * 24 * 3600 * 1000).toISOString();
      const { error } = await supabase
        .from("blog_posts" as any)
        .update({ scheduled_publish_at: when })
        .eq("id", ordered[i].id);
      if (error) fail++;
      else ok++;
    }
    toast.success(`Scheduled ${ok} draft(s)${fail ? `, ${fail} failed` : ""}`);
    setScheduling(false);
    reload();
  }

  async function clearSchedule(post: BlogPost) {
    const { error } = await supabase
      .from("blog_posts" as any)
      .update({ scheduled_publish_at: null })
      .eq("id", post.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Schedule cleared");
      reload();
    }
  }

  if (!user) return null;
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-2xl font-bold mb-2">Admin only</h1>
          <p className="text-muted-foreground">
            You need to be signed in as the platform admin to manage the blog.
          </p>
        </div>
      </div>
    );
  }

  async function handleSave() {
    if (!draft) return;
    if (!draft.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    const slug = draft.slug?.trim() || slugify(draft.title);
    const reading = calcReadingMinutes(draft.body_markdown || "");
    const payload = {
      slug,
      title: draft.title,
      excerpt: draft.excerpt || null,
      body_markdown: draft.body_markdown || "",
      cover_image_url: draft.cover_image_url || null,
      author_name: draft.author_name || "SaaSSuite",
      author_bio: draft.author_bio || null,
      tldr: draft.tldr || null,
      faq: draft.faq || [],
      howto_steps: draft.howto_steps || [],
      tags: draft.tags || [],
      meta_title: draft.meta_title || null,
      meta_description: draft.meta_description || null,
      published: !!draft.published,
      published_at:
        draft.published && !draft.published_at
          ? new Date().toISOString()
          : draft.published_at ?? null,
      reading_minutes: reading,
    };

    let error;
    if (draft.id) {
      ({ error } = await supabase.from("blog_posts" as any).update(payload).eq("id", draft.id));
    } else {
      ({ error } = await supabase.from("blog_posts" as any).insert(payload));
    }
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(draft.id ? "Post updated" : "Post created");
    setDraft(null);
    reload();
  }

  async function handleDelete(post: BlogPost) {
    if (!confirm(`Delete "${post.title}"? This can't be undone.`)) return;
    const { error } = await supabase.from("blog_posts" as any).delete().eq("id", post.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    reload();
  }

  async function togglePublished(post: BlogPost) {
    const next = !post.published;
    const { error } = await supabase
      .from("blog_posts" as any)
      .update({
        published: next,
        published_at: next && !post.published_at ? new Date().toISOString() : post.published_at,
      })
      .eq("id", post.id);
    if (error) return toast.error(error.message);
    reload();
  }

  async function handleCoverUpload(file: File) {
    if (!draft) return;
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `covers/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("blog-covers")
      .upload(path, file, { cacheControl: "31536000", upsert: false });
    if (upErr) {
      setUploading(false);
      toast.error(upErr.message);
      return;
    }
    const { data: signed } = await supabase.storage
      .from("blog-covers")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    setUploading(false);
    if (signed?.signedUrl) {
      setDraft({ ...draft, cover_image_url: signed.signedUrl });
      toast.success("Cover uploaded");
    }
  }

  async function handleBulkImport(file: File) {
    setImporting(true);
    try {
      const isZip = file.name.toLowerCase().endsWith(".zip");
      const files: { name: string; content: string }[] = [];
      if (isZip) {
        const zip = await JSZip.loadAsync(file);
        for (const [name, entry] of Object.entries(zip.files)) {
          if (entry.dir) continue;
          if (!/\.(md|markdown|mdx)$/i.test(name)) continue;
          files.push({ name, content: await entry.async("string") });
        }
      } else {
        files.push({ name: file.name, content: await file.text() });
      }
      if (!files.length) {
        toast.error("No markdown files found");
        setImporting(false);
        return;
      }
      let ok = 0;
      let fail = 0;
      for (const f of files) {
        const parsed = matter(f.content);
        const data = parsed.data as any;
        const title =
          data.title ||
          f.name.replace(/\.(md|markdown|mdx)$/i, "").replace(/[-_]/g, " ");
        const slug = (data.slug || slugify(title)).toString();
        const body = parsed.content;
        const record = {
          slug,
          title,
          excerpt: data.excerpt || data.description || null,
          body_markdown: body,
          cover_image_url: data.cover_image_url || data.image || null,
          author_name: data.author_name || data.author || "Andrew Reeder",
          author_bio: data.author_bio || null,
          tldr: data.tldr || null,
          faq: Array.isArray(data.faq) ? data.faq : [],
          howto_steps: Array.isArray(data.howto_steps) ? data.howto_steps : [],
          tags: Array.isArray(data.tags)
            ? data.tags
            : typeof data.tags === "string"
            ? data.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
            : [],
          meta_title: data.meta_title || null,
          meta_description: data.meta_description || null,
          // Always import as draft — user drips them out manually
          published: false,
          published_at: null,
          reading_minutes: calcReadingMinutes(body),
        };
        const { error } = await supabase
          .from("blog_posts" as any)
          .upsert(record, { onConflict: "slug" });
        if (error) fail++;
        else ok++;
      }
      toast.success(`Imported ${ok} posts${fail ? `, ${fail} failed` : ""}`);
      reload();
    } catch (err: any) {
      toast.error(err?.message || "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Blog Manager</h1>
            <p className="text-muted-foreground text-sm">
              Write, import, and publish posts at /blog.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setDraft(emptyDraft())}>
              <Plus className="w-4 h-4 mr-1" /> New post
            </Button>
            <Button
              variant="outline"
              onClick={scheduleDripDrafts}
              disabled={scheduling}
            >
              {scheduling ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <CalendarClock className="w-4 h-4 mr-1" />
              )}
              Drip schedule drafts
            </Button>
            <label>
              <input
                type="file"
                accept=".md,.markdown,.mdx,.zip"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleBulkImport(f);
                  e.target.value = "";
                }}
              />
              <Button asChild variant="outline" disabled={importing}>
                <span>
                  {importing ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-1" />
                  )}
                  Bulk import (.md or .zip)
                </span>
              </Button>
            </label>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All posts ({posts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : posts.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No posts yet. Create one or bulk import.
              </p>
            ) : (
              <div className="divide-y">
                {posts.map((p) => (
                  <div key={p.id} className="py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{p.title}</span>
                        {p.published ? (
                          <Badge>Published</Badge>
                        ) : (
                          <Badge variant="outline">Draft</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        /blog/{p.slug} · {p.reading_minutes ?? 1} min
                        {p.scheduled_publish_at && !p.published && (
                          <>
                            {" · "}
                            <span className="text-primary">
                              Scheduled{" "}
                              {new Date(p.scheduled_publish_at).toLocaleString()}
                            </span>
                            <button
                              onClick={() => clearSchedule(p)}
                              className="ml-2 underline hover:text-foreground"
                            >
                              clear
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <Switch
                      checked={p.published}
                      onCheckedChange={() => togglePublished(p)}
                    />
                    {p.published && (
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`/blog/${p.slug}`} target="_blank">
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setDraft(p as any)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(p)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit post" : "New post"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <Tabs defaultValue="content">
              <TabsList>
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="seo">SEO</TabsTrigger>
                <TabsTrigger value="structured">FAQ & HowTo</TabsTrigger>
              </TabsList>

              <TabsContent value="content" className="space-y-4 pt-4">
                <div>
                  <Label>Title</Label>
                  <Input
                    value={draft.title}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        title: e.target.value,
                        slug: draft.slug || slugify(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Slug</Label>
                  <Input
                    value={draft.slug}
                    onChange={(e) => setDraft({ ...draft, slug: slugify(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Excerpt</Label>
                  <Textarea
                    rows={2}
                    value={draft.excerpt || ""}
                    onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })}
                  />
                </div>
                <div>
                  <Label>TL;DR (shown at top; helps LLM answer engines)</Label>
                  <Textarea
                    rows={2}
                    value={draft.tldr || ""}
                    onChange={(e) => setDraft({ ...draft, tldr: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Body (Markdown)</Label>
                  <Textarea
                    rows={16}
                    className="font-mono text-sm"
                    value={draft.body_markdown}
                    onChange={(e) => setDraft({ ...draft, body_markdown: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Cover image</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleCoverUpload(f);
                        e.target.value = "";
                      }}
                    />
                    {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
                  </div>
                  {draft.cover_image_url && (
                    <img
                      src={draft.cover_image_url}
                      alt=""
                      className="mt-2 rounded-md max-h-40"
                    />
                  )}
                </div>
                <div>
                  <Label>Tags (comma separated)</Label>
                  <Input
                    value={(draft.tags || []).join(", ")}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        tags: e.target.value
                          .split(",")
                          .map((t) => t.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={!!draft.published}
                    onCheckedChange={(v) => setDraft({ ...draft, published: v })}
                  />
                  <Label>Published</Label>
                </div>
              </TabsContent>

              <TabsContent value="seo" className="space-y-4 pt-4">
                <div>
                  <Label>Author name</Label>
                  <Input
                    value={draft.author_name || ""}
                    onChange={(e) => setDraft({ ...draft, author_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Author bio</Label>
                  <Textarea
                    rows={2}
                    value={draft.author_bio || ""}
                    onChange={(e) => setDraft({ ...draft, author_bio: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Meta title (defaults to Title)</Label>
                  <Input
                    value={draft.meta_title || ""}
                    onChange={(e) => setDraft({ ...draft, meta_title: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Meta description</Label>
                  <Textarea
                    rows={2}
                    value={draft.meta_description || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, meta_description: e.target.value })
                    }
                  />
                </div>
              </TabsContent>

              <TabsContent value="structured" className="space-y-4 pt-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>FAQ items</Label>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          faq: [...(draft.faq || []), { question: "", answer: "" }],
                        })
                      }
                    >
                      Add FAQ
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {(draft.faq || []).map((f, i) => (
                      <Card key={i} className="p-3 space-y-2">
                        <Input
                          placeholder="Question"
                          value={f.question}
                          onChange={(e) => {
                            const next = [...(draft.faq || [])];
                            next[i] = { ...next[i], question: e.target.value };
                            setDraft({ ...draft, faq: next });
                          }}
                        />
                        <Textarea
                          rows={2}
                          placeholder="Answer"
                          value={f.answer}
                          onChange={(e) => {
                            const next = [...(draft.faq || [])];
                            next[i] = { ...next[i], answer: e.target.value };
                            setDraft({ ...draft, faq: next });
                          }}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              faq: (draft.faq || []).filter((_, j) => j !== i),
                            })
                          }
                        >
                          Remove
                        </Button>
                      </Card>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>HowTo steps (optional)</Label>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          howto_steps: [
                            ...(draft.howto_steps || []),
                            { name: "", text: "" },
                          ],
                        })
                      }
                    >
                      Add step
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {(draft.howto_steps || []).map((s, i) => (
                      <Card key={i} className="p-3 space-y-2">
                        <Input
                          placeholder="Step name"
                          value={s.name}
                          onChange={(e) => {
                            const next = [...(draft.howto_steps || [])];
                            next[i] = { ...next[i], name: e.target.value };
                            setDraft({ ...draft, howto_steps: next });
                          }}
                        />
                        <Textarea
                          rows={2}
                          placeholder="Step text"
                          value={s.text}
                          onChange={(e) => {
                            const next = [...(draft.howto_steps || [])];
                            next[i] = { ...next[i], text: e.target.value };
                            setDraft({ ...draft, howto_steps: next });
                          }}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              howto_steps: (draft.howto_steps || []).filter(
                                (_, j) => j !== i
                              ),
                            })
                          }
                        >
                          Remove
                        </Button>
                      </Card>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBlog;