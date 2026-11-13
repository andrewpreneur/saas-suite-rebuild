import { TRAINING_YOUTUBE_ID } from "@/components/one-feature/videoId";

const clickBound = new WeakSet<HTMLButtonElement>();

function playFacade(el: HTMLElement) {
  const iframe = document.createElement("iframe");
  iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(TRAINING_YOUTUBE_ID)}?autoplay=1&rel=0`;
  iframe.title = "GoHighLevel One Feature training";
  iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  iframe.allowFullscreen = true;
  el.replaceChildren(iframe);
}

/**
 * The prerender snapshot already contains the hero button. Bind that button
 * without pulling checkout, Stripe, or the training library.
 * A visit that has not been snapshotted (or a client-side step change) still
 * mounts the thumbnail so the saved HTML can include the LCP image.
 */
export function bindSalesFacades(root: HTMLElement) {
  let missing = false;
  root.querySelectorAll<HTMLElement>(".video").forEach((el) => {
    const button = el.querySelector<HTMLButtonElement>("button.ofk-facade");
    const baked = el.classList.contains("ofk-yt") && button;
    if (baked && button) {
      if (!clickBound.has(button)) {
        clickBound.add(button);
        button.addEventListener("click", () => playFacade(el));
      }
      return;
    }
    if (el.textContent?.includes("sales video (VSL)")) missing = true;
  });
  if (!missing) return;
  void import("@/components/media/YouTubeFacade").then(({ mountYouTubeFacade }) => {
    root.querySelectorAll<HTMLElement>(".video").forEach((el) => {
      if (el.classList.contains("ofk-yt") && el.querySelector("button.ofk-facade")) return;
      if (!el.textContent?.includes("sales video (VSL)")) return;
      mountYouTubeFacade(el, {
        videoId: TRAINING_YOUTUBE_ID,
        title: "GoHighLevel One Feature training",
        eager: true,
        fetchPriority: "high",
      });
    });
  });
}
