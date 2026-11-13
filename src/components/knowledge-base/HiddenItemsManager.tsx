import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Eye, EyeOff, Loader2, Search } from "lucide-react";

interface Article {
  slug: string;
  title: string;
}
interface Category {
  slug: string;
  name: string;
  articleCount: number;
}
interface HiddenRow {
  id: string;
  item_type: "category" | "article";
  category_slug: string;
  article_slug: string | null;
}

interface Props {
  agencyId: string;
}

const HiddenItemsManager = ({ agencyId }: Props) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [hidden, setHidden] = useState<HiddenRow[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [articlesByCat, setArticlesByCat] = useState<Record<string, Article[]>>({});
  const [loadingArticles, setLoadingArticles] = useState<Set<string>>(new Set());
  const [articleErrors, setArticleErrors] = useState<Record<string, string>>({});

  const loadHidden = async () => {
    const { data, error } = await supabase
      .from("kb_hidden_items")
      .select("id, item_type, category_slug, article_slug")
      .eq("agency_id", agencyId);
    if (error) {
      toast.error("Couldn't load hidden items");
      return;
    }
    setHidden((data || []) as HiddenRow[]);
  };

  const loadStructure = async (showSpinner = true) => {
    if (showSpinner) setRefreshing(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-kb-structure", {
        body: { agencyId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setCategories(((data as any)?.categories ?? []) as Category[]);
      // Reset per-category article cache so counts/articles stay in sync.
      setArticlesByCat({});
      setArticleErrors({});
    } catch (err: any) {
      setErrorMsg(err.message || "Couldn't load knowledge base content");
    } finally {
      setRefreshing(false);
    }
  };

  const loadArticles = async (categorySlug: string) => {
    if (articlesByCat[categorySlug] || loadingArticles.has(categorySlug)) return;
    setLoadingArticles((prev) => new Set(prev).add(categorySlug));
    setArticleErrors((prev) => {
      const next = { ...prev };
      delete next[categorySlug];
      return next;
    });
    try {
      const { data, error } = await supabase.functions.invoke("fetch-kb-category-articles", {
        body: { agencyId, categorySlug },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const articles = ((data as any)?.articles ?? []) as Article[];
      setArticlesByCat((prev) => ({ ...prev, [categorySlug]: articles }));
    } catch (err: any) {
      setArticleErrors((prev) => ({
        ...prev,
        [categorySlug]: err.message || "Couldn't load articles",
      }));
    } finally {
      setLoadingArticles((prev) => {
        const next = new Set(prev);
        next.delete(categorySlug);
        return next;
      });
    }
  };

  useEffect(() => {
    if (!agencyId) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      await Promise.all([loadHidden(), loadStructure(false)]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agencyId]);

  const hiddenCategorySlugs = useMemo(
    () => new Set(hidden.filter((h) => h.item_type === "category").map((h) => h.category_slug)),
    [hidden],
  );
  const hiddenArticleKeys = useMemo(
    () =>
      new Set(
        hidden
          .filter((h) => h.item_type === "article" && h.article_slug)
          .map((h) => `${h.category_slug}::${h.article_slug}`),
      ),
    [hidden],
  );

  const markPending = (key: string, on: boolean) =>
    setPending((prev) => {
      const next = new Set(prev);
      on ? next.add(key) : next.delete(key);
      return next;
    });

  const toggleCategory = async (cat: Category, makeVisible: boolean) => {
    const key = `cat:${cat.slug}`;
    markPending(key, true);
    if (makeVisible) {
      const { error } = await supabase
        .from("kb_hidden_items")
        .delete()
        .eq("agency_id", agencyId)
        .eq("item_type", "category")
        .eq("category_slug", cat.slug)
        .is("article_slug", null);
      if (error) toast.error(error.message);
      else toast.success(`"${cat.name}" is now visible`);
    } else {
      const { error } = await supabase.from("kb_hidden_items").insert({
        agency_id: agencyId,
        item_type: "category",
        category_slug: cat.slug,
        article_slug: null,
      });
      if (error && !/duplicate/i.test(error.message)) toast.error(error.message);
      else toast.success(`"${cat.name}" is now hidden`);
    }
    await loadHidden();
    markPending(key, false);
  };

  const toggleArticle = async (cat: Category, art: Article, makeVisible: boolean) => {
    const key = `art:${cat.slug}:${art.slug}`;
    markPending(key, true);
    if (makeVisible) {
      const { error } = await supabase
        .from("kb_hidden_items")
        .delete()
        .eq("agency_id", agencyId)
        .eq("item_type", "article")
        .eq("category_slug", cat.slug)
        .eq("article_slug", art.slug);
      if (error) toast.error(error.message);
    } else {
      const { error } = await supabase.from("kb_hidden_items").insert({
        agency_id: agencyId,
        item_type: "article",
        category_slug: cat.slug,
        article_slug: art.slug,
      });
      if (error && !/duplicate/i.test(error.message)) toast.error(error.message);
    }
    await loadHidden();
    markPending(key, false);
  };

  const toggleExpanded = (slug: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
        // Lazy-load articles the first time a category is expanded.
        loadArticles(slug);
      }
      return next;
    });
  };

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => {
      if (c.name.toLowerCase().includes(q)) return true;
      const arts = articlesByCat[c.slug];
      return !!arts && arts.some((a) => a.title.toLowerCase().includes(q));
    });
  }, [categories, search, articlesByCat]);

  if (!agencyId) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Save your agency settings first to manage knowledge base articles.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>Manage Articles</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Hide entire categories or individual articles from your Knowledge Base.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories or articles…"
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : errorMsg ? (
          <div className="text-sm text-destructive py-6 text-center">{errorMsg}</div>
        ) : filteredCategories.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            No categories found for this agency.
          </div>
        ) : (
          <div className="border rounded-lg divide-y">
            {filteredCategories.map((cat) => {
              const catHidden = hiddenCategorySlugs.has(cat.slug);
              const catKey = `cat:${cat.slug}`;
              const isExpanded = expanded.has(cat.slug);
              const articles = articlesByCat[cat.slug];
              const isLoadingArts = loadingArticles.has(cat.slug);
              const artErr = articleErrors[cat.slug];
              const q = search.trim().toLowerCase();
              const visibleArticles =
                q && articles
                  ? articles.filter(
                      (a) =>
                        a.title.toLowerCase().includes(q) || cat.name.toLowerCase().includes(q),
                    )
                  : articles;
              return (
                <div key={cat.slug}>
                  <div className="flex items-center gap-3 p-3">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(cat.slug)}
                      className="p-1 -ml-1 text-muted-foreground hover:text-foreground"
                      aria-label={isExpanded ? "Collapse" : "Expand"}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{cat.name}</span>
                        {catHidden && (
                          <span className="text-[10px] uppercase tracking-wide bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                            Hidden
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {cat.articleCount} article{cat.articleCount === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {catHidden ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                      <span className="hidden sm:inline">{catHidden ? "Hidden" : "Visible"}</span>
                      <Switch
                        checked={!catHidden}
                        disabled={pending.has(catKey)}
                        onCheckedChange={(checked) => toggleCategory(cat, checked)}
                      />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="bg-muted/30 border-t">
                      {isLoadingArts ? (
                        <div className="px-12 py-4 flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Loading articles…
                        </div>
                      ) : artErr ? (
                        <div className="px-12 py-3 text-xs text-destructive flex items-center gap-3">
                          <span>{artErr}</span>
                          <button
                            type="button"
                            className="underline"
                            onClick={() => loadArticles(cat.slug)}
                          >
                            Retry
                          </button>
                        </div>
                      ) : !articles || articles.length === 0 ? (
                        <div className="px-12 py-3 text-xs text-muted-foreground">
                          No articles in this category.
                        </div>
                      ) : (
                        (visibleArticles ?? articles).map((art) => {
                          const artKey = `art:${cat.slug}:${art.slug}`;
                          const artHiddenIndividually = hiddenArticleKeys.has(
                            `${cat.slug}::${art.slug}`,
                          );
                          const effectivelyHidden = catHidden || artHiddenIndividually;
                          return (
                            <div
                              key={art.slug}
                              className="flex items-center gap-3 pl-12 pr-3 py-2 border-b last:border-b-0 border-border/50"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="text-sm truncate">{art.title}</div>
                                {catHidden && (
                                  <div className="text-[11px] text-muted-foreground italic">
                                    Hidden by category
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {effectivelyHidden ? (
                                  <EyeOff className="w-3.5 h-3.5" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                                <Switch
                                  checked={!artHiddenIndividually}
                                  disabled={pending.has(artKey) || catHidden}
                                  onCheckedChange={(checked) => toggleArticle(cat, art, checked)}
                                />
                              </div>
                            </div>
                          );
                        })
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

export default HiddenItemsManager;
