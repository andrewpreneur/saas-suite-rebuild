import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { BookOpen, ChevronRight, Loader2, Search } from "lucide-react";
import { SectionCard } from "@/components/premium/SectionCard";
import { EmptyState } from "@/components/premium/21st/empty-state";
import { HubEmptyIcon } from "@/components/premium/hub/HubBits";
import { HubListSkeleton, OnOffSwitch } from "@/components/premium/hub/HubBits";

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
      <div className="px-surface">
        <EmptyState
          icon={<HubEmptyIcon><BookOpen className="size-6" /></HubEmptyIcon>}
          title="Create your hub link first"
          description="Once your agency has a hub link, your help center articles show up here."
        />
      </div>
    );
  }

  return (
    <SectionCard
      icon={<BookOpen />}
      title="Articles"
      description="Switch off a whole category, or open it to hide single articles. Changes save as you go."
      actions={
        !loading && !errorMsg && categories.length > 0 ? (
          <span className="text-xs tabular-nums text-muted-foreground">
            {categories.length - hiddenCategorySlugs.size} of {categories.length} categories shown
          </span>
        ) : null
      }
    >
      <div className="space-y-4">
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
          <HubListSkeleton rows={5} />
        ) : errorMsg ? (
          <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {errorMsg}
          </div>
        ) : filteredCategories.length === 0 ? (
          <EmptyState
            className="py-8"
            icon={<HubEmptyIcon><Search className="size-6" /></HubEmptyIcon>}
            title={search.trim() ? "Nothing matches that search" : "No articles yet"}
            description={
              search.trim()
                ? "Try a shorter word, or clear the search to see every category."
                : "Articles appear here as soon as your help center has content."
            }
            action={
              search.trim() ? (
                <Button variant="outline" onClick={() => setSearch("")}>
                  Clear search
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-md border border-border">
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
                  <div className="flex min-h-[60px] items-center gap-2 px-3 py-2 transition-colors hover:bg-muted/40">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(cat.slug)}
                      className="flex size-9 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={isExpanded ? "Collapse" : "Expand"}
                      aria-expanded={isExpanded}
                    >
                      <ChevronRight className={`size-4 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                    </button>
                    <div className={`min-w-0 flex-1 cursor-pointer ${catHidden ? "opacity-55" : ""}`} onClick={() => toggleExpanded(cat.slug)}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{cat.name}</span>

                      </div>
                      <div className="text-xs text-muted-foreground">
                        {cat.articleCount} article{cat.articleCount === 1 ? "" : "s"}
                      </div>
                    </div>
                    <OnOffSwitch
                      checked={!catHidden}
                      disabled={pending.has(catKey)}
                      onCheckedChange={(checked) => toggleCategory(cat, checked)}
                      label={`Show the ${cat.name} category`}
                    />
                  </div>

                  {isExpanded && (
                    <div className="bg-muted/30 border-t">
                      {isLoadingArts ? (
                        <div className="pl-14 pr-3 py-4 flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Loading articles…
                        </div>
                      ) : artErr ? (
                        <div className="pl-14 pr-3 py-3 text-sm text-destructive flex items-center gap-3">
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
                        <div className="pl-14 pr-3 py-3 text-sm text-muted-foreground">
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
                              className="flex min-h-11 items-center gap-3 border-b border-border/50 py-2 pl-14 pr-3 last:border-b-0"
                            >
                              <div className={`min-w-0 flex-1 ${effectivelyHidden ? "opacity-55" : ""}`}>
                                <div className="text-sm truncate">{art.title}</div>
                                {catHidden && (
                                  <div className="text-xs text-muted-foreground">
                                    Hidden with its category
                                  </div>
                                )}
                              </div>
                              <OnOffSwitch
                                checked={!artHiddenIndividually}
                                disabled={pending.has(artKey) || catHidden}
                                onCheckedChange={(checked) => toggleArticle(cat, art, checked)}
                                label={`Show the article ${art.title}`}
                              />
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
      </div>
    </SectionCard>
  );
};

export default HiddenItemsManager;
