import { useEffect, type ReactNode } from "react";

/** SnapMe's loader. It mounts every `data-snapme-button` placeholder as an iframe and forwards fbclid/utm/_fbp/_fbc. */
const SNAPME_EMBED_SRC = "https://app.snapme.link/embed.js";

function loadSnapMeEmbed() {
  if (typeof document === "undefined") return;
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${SNAPME_EMBED_SRC}"]`);
  if (existing) {
    // The loader is idempotent: running it again mounts placeholders added after the first load.
    (window as unknown as { __snapmeEmbed?: () => void }).__snapmeEmbed?.();
    return;
  }
  const s = document.createElement("script");
  s.src = SNAPME_EMBED_SRC;
  s.async = true;
  document.body.appendChild(s);
}

/**
 * A SnapMe "text us" button. The button's label, look, phone and prefilled message live in SnapMe
 * (Buttons screen); SnapMe sends the tap and the real text-in to Meta through its Conversions API.
 * With no slug yet, the page's own button (children) shows instead, so no CTA is ever blank.
 */
export default function SnapMeButton({ slug, children }: { slug: string; children: ReactNode }) {
  useEffect(() => {
    if (slug) loadSnapMeEmbed();
  }, [slug]);

  if (!slug) return <>{children}</>;
  return <div data-snapme-button={slug} className="w-full" />;
}
