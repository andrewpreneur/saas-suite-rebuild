import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import { ENTITY_LINKS } from "@/lib/blog";

interface MarkdownContentProps {
  markdown: string;
  entityLinks?: boolean;
}

/**
 * Injects entity links only on the FIRST occurrence of each keyword
 * (helps LLM entity recognition without keyword-stuffing).
 */
function autoLinkEntities(md: string): string {
  let out = md;
  const linked = new Set<string>();
  for (const { keyword, href, label } of ENTITY_LINKS) {
    if (linked.has(label)) continue;
    // Avoid injecting inside existing links or code blocks — cheap guard
    const match = out.match(keyword);
    if (!match) continue;
    const idx = match.index ?? -1;
    if (idx < 0) continue;
    // Skip if inside a markdown link or code fence
    const before = out.slice(0, idx);
    const openLinks = (before.match(/\[/g) || []).length;
    const closeLinks = (before.match(/\]/g) || []).length;
    const insideLink = openLinks > closeLinks;
    const codeFences = (before.match(/```/g) || []).length;
    const insideCode = codeFences % 2 === 1;
    if (insideLink || insideCode) continue;
    const original = match[0];
    out = out.slice(0, idx) + `[${original}](${href})` + out.slice(idx + original.length);
    linked.add(label);
  }
  return out;
}

export function MarkdownContent({ markdown, entityLinks = true }: MarkdownContentProps) {
  const source = entityLinks ? autoLinkEntities(markdown) : markdown;
  return (
    <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:scroll-mt-24 prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug, [rehypeAutolinkHeadings, { behavior: "wrap" }]]}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}

export default MarkdownContent;