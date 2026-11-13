import type { ReactNode } from "react";

type AttachmentLike = {
  url?: string;
  name?: string;
  type?: string;
  mimeType?: string;
};

const URL_RE = /(https?:\/\/[^\s<>"']+)/gi;
const IMAGE_EXTENSION_RE = /\.(?:png|jpe?g|gif|webp|bmp|svg|heic|heif)(?:$|[?#])/i;
const UPLOAD_PATH_RE = /\/(?:media|medias|image|images|attachment|attachments|upload|uploads|file|files|storage|screenshots?)\b/i;

const stripTrailingPunctuation = (url: string) => url.replace(/[),.;!?]+$/g, "");

const extractUrls = (text: string) => {
  const urls: string[] = [];
  for (const match of text.matchAll(URL_RE)) {
    const raw = match[0] || "";
    const clean = stripTrailingPunctuation(raw);
    if (clean) urls.push(clean);
  }
  return urls;
};

const normalizeAttachments = (attachments?: unknown): AttachmentLike[] => {
  if (!Array.isArray(attachments)) return [];
  return attachments
    .map((item) => (item && typeof item === "object" ? (item as AttachmentLike) : null))
    .filter((item): item is AttachmentLike => !!item?.url);
};

const isLikelyImageUrl = (url: string) => {
  if (!url) return false;
  if (url.startsWith("data:image/")) return true;
  if (IMAGE_EXTENSION_RE.test(url)) return true;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    const query = parsed.search.toLowerCase();

    if (path.includes("/hooks/")) return false;
    if (query.includes("image") || query.includes("content-type=image")) return true;
    if (host.includes("filesafe.space")) return true;
    if (UPLOAD_PATH_RE.test(path)) return true;
    if (
      (host.includes("storage.googleapis.com") ||
        host.includes("amazonaws.com") ||
        host.includes("cloudfront.net") ||
        host.includes("supabase.co") ||
        host.endsWith("saassuite.ai") ||
        host.includes("msgsndr.com") ||
        host.includes("leadconnectorhq.com")) &&
      !path.includes("/webhook")
    ) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
};

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

interface RenderMessageContentOptions {
  attachments?: unknown;
  imageClassName?: string;
}

export const renderMessageContent = (
  text: string | null | undefined,
  options: RenderMessageContentOptions = {},
) => {
  const content = text || "";
  const attachments = normalizeAttachments(options.attachments);
  const linkedUrls = extractUrls(content);
  const attachmentUrls = attachments.map((a) => a.url!).filter(Boolean);
  const imageUrls = unique([
    ...attachmentUrls.filter((url, index) => {
      const attachment = attachments[index];
      return attachment?.type?.startsWith("image/") || attachment?.mimeType?.startsWith("image/") || isLikelyImageUrl(url);
    }),
    ...linkedUrls.filter(isLikelyImageUrl),
  ]);

  const parts: ReactNode[] = [];
  let lastIdx = 0;
  let key = 0;

  for (const match of content.matchAll(URL_RE)) {
    const raw = match[0] || "";
    const offset = match.index ?? 0;
    const clean = stripTrailingPunctuation(raw);
    const trailing = raw.slice(clean.length);

    if (offset > lastIdx) parts.push(content.slice(lastIdx, offset));
    if (clean) {
      parts.push(
        <a key={`l-${key++}`} href={clean} target="_blank" rel="noopener noreferrer" className="underline break-all">
          {clean}
        </a>,
      );
    }
    if (trailing) parts.push(trailing);
    lastIdx = offset + raw.length;
  }

  if (lastIdx < content.length) parts.push(content.slice(lastIdx));

  return (
    <>
      {parts.length > 0 ? <div className="whitespace-pre-wrap break-words">{parts}</div> : null}
      {imageUrls.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {imageUrls.map((src, i) => (
            <a key={`i-${i}`} href={src} target="_blank" rel="noopener noreferrer" className="block max-w-full">
              <img
                src={src}
                alt={attachments.find((a) => a.url === src)?.name || "attachment"}
                className={options.imageClassName || "max-h-48 max-w-full rounded border border-border/40 object-contain bg-background"}
                loading="lazy"
                onError={(event) => {
                  const wrapper = event.currentTarget.closest("a");
                  if (wrapper instanceof HTMLElement) wrapper.style.display = "none";
                }}
              />
            </a>
          ))}
        </div>
      )}
    </>
  );
};