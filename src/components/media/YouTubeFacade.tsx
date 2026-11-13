import { useState, type CSSProperties } from "react";
import { createRoot, type Root } from "react-dom/client";
import { TRAINING_YOUTUBE_ID } from "@/components/one-feature/videoId";

const mounted = new Set<Root>();
const clickBound = new WeakSet<HTMLButtonElement>();

export type YouTubeFacadeProps = {
  videoId: string;
  title: string;
  /**
   * Load the thumbnail immediately and at high priority.
   * Set this when the video sits above the fold so it can be the LCP image.
   */
  eager?: boolean;
  fetchPriority?: "high" | "low" | "auto";
  sizes?: string;
  /** Turn on English captions and show a caption bar on the poster. */
  captions?: boolean;
};

function embedSrc(videoId: string, captions?: boolean) {
  const base = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`;
  return captions ? `${base}&cc_load_policy=1&cc_lang_pref=en` : base;
}

const HERO_SIZES = "(max-width: 900px) 100vw, 640px";

function thumbnails(videoId: string) {
  if (videoId === TRAINING_YOUTUBE_ID) {
    return {
      avif: "/assets/ofk/yt-480.avif 480w, /assets/ofk/yt-960.avif 960w",
      webp: "/assets/ofk/yt-480.webp 480w, /assets/ofk/yt-960.webp 960w",
      fallback: "/assets/ofk/yt-960.jpg",
    };
  }
  return {
    avif: "",
    webp: "",
    fallback: `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`,
  };
}

/**
 * Click-to-play YouTube. The iframe is not created until the button is pressed.
 * The box keeps a 16:9 ratio so the swap does not shift the layout.
 */
export function YouTubeFacade({
  videoId,
  title,
  eager = false,
  fetchPriority,
  sizes = HERO_SIZES,
  captions = false,
}: YouTubeFacadeProps) {
  const [playing, setPlaying] = useState(false);
  const priority = fetchPriority ?? (eager ? "high" : "auto");
  const thumbs = thumbnails(videoId);
  if (playing) {
    return (
      <iframe
        src={embedSrc(videoId, captions)}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    );
  }
  const imgStyle: CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" };
  return (
    <button type="button" className="ofk-facade" aria-label={`Play video: ${title}`} onClick={() => setPlaying(true)}>
      <picture>
        {thumbs.avif ? <source type="image/avif" srcSet={thumbs.avif} sizes={sizes} /> : null}
        {thumbs.webp ? <source type="image/webp" srcSet={thumbs.webp} sizes={sizes} /> : null}
        <img
          src={thumbs.fallback}
          alt=""
          width={960}
          height={540}
          sizes={sizes}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={priority}
          decoding={eager ? "auto" : "async"}
          style={imgStyle}
        />
      </picture>
      <span className="play" aria-hidden="true" />
      {captions ? <span className="ofk-caption-bar">Captions</span> : null}
    </button>
  );
}

function playFacade(el: HTMLElement, props: YouTubeFacadeProps) {
  const iframe = document.createElement("iframe");
  iframe.src = embedSrc(props.videoId, props.captions);
  iframe.title = props.title;
  iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  iframe.allowFullscreen = true;
  el.replaceChildren(iframe);
}

/**
 * Mount the facade into a funnel `.video` placeholder.
 * A prerendered button is left in place (that image is the LCP element) and only
 * gets a click listener. Unmount with unmountYouTubeFacades.
 */
export function mountYouTubeFacade(el: HTMLElement, props: YouTubeFacadeProps) {
  const existing = el.querySelector<HTMLButtonElement>("button.ofk-facade");
  if (el.classList.contains("ofk-yt") && existing) {
    if (!clickBound.has(existing)) {
      clickBound.add(existing);
      existing.addEventListener("click", () => playFacade(el, props));
    }
    return;
  }
  el.classList.add("ofk-yt");
  el.replaceChildren();
  const root = createRoot(el);
  mounted.add(root);
  root.render(<YouTubeFacade {...props} />);
}

export function unmountYouTubeFacades() {
  for (const root of mounted) root.unmount();
  mounted.clear();
}
