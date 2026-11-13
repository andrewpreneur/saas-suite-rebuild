// Host size for the Software Onboarding popup iframe.
// The loader asks for 400x640 via { type: "lvb-popup-preferred-size", width, height }.
// The iframe is that size, capped so it stays inside the viewport.

export const POPUP_FRAME_WIDTH = 400;
export const POPUP_FRAME_HEIGHT = 640;
export const POPUP_FRAME_MARGIN = 40;
const POPUP_ORIGIN = "https://yoursoftwareonboarding.com";

export function capPopupFrame(
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
): { width: number; height: number } {
  const maxW = Math.max(1, viewportWidth - POPUP_FRAME_MARGIN);
  const maxH = Math.max(1, viewportHeight - POPUP_FRAME_MARGIN);
  const wantW = Number.isFinite(width) && width > 0 ? width : POPUP_FRAME_WIDTH;
  const wantH = Number.isFinite(height) && height > 0 ? height : POPUP_FRAME_HEIGHT;
  return {
    width: Math.round(Math.min(wantW, maxW)),
    height: Math.round(Math.min(wantH, maxH)),
  };
}

/** Browser helpers injected with the popup. `applyPopupFrameSize(panel)` reads data-ss-popup-w/h. */
export function popupFrameRuntimeJS(): string {
  return `
  function popupFrameSize(panelEl) {
    var wantW = Number(panelEl && panelEl.getAttribute('data-ss-popup-w')) || ${POPUP_FRAME_WIDTH};
    var wantH = Number(panelEl && panelEl.getAttribute('data-ss-popup-h')) || ${POPUP_FRAME_HEIGHT};
    var maxW = Math.max(1, window.innerWidth - ${POPUP_FRAME_MARGIN});
    var maxH = Math.max(1, window.innerHeight - ${POPUP_FRAME_MARGIN});
    return { width: Math.round(Math.min(wantW, maxW)), height: Math.round(Math.min(wantH, maxH)) };
  }
  function applyPopupFrameSize(panelEl) {
    if (!panelEl) return null;
    if (!panelEl.getAttribute('data-ss-popup-w')) panelEl.setAttribute('data-ss-popup-w', '${POPUP_FRAME_WIDTH}');
    if (!panelEl.getAttribute('data-ss-popup-h')) panelEl.setAttribute('data-ss-popup-h', '${POPUP_FRAME_HEIGHT}');
    var box = popupFrameSize(panelEl);
    panelEl.style.setProperty('width', box.width + 'px', 'important');
    panelEl.style.setProperty('height', box.height + 'px', 'important');
    panelEl.style.setProperty('max-width', 'calc(100vw - ${POPUP_FRAME_MARGIN}px)', 'important');
    panelEl.style.setProperty('max-height', 'calc(100vh - ${POPUP_FRAME_MARGIN}px)', 'important');
    panelEl.style.setProperty('box-sizing', 'border-box', 'important');
    var frame = panelEl.querySelector('iframe');
    if (frame) {
      frame.style.setProperty('display', 'block', 'important');
      frame.style.setProperty('width', '100%', 'important');
      frame.style.setProperty('height', '100%', 'important');
      frame.style.setProperty('max-width', 'none', 'important');
      frame.style.setProperty('max-height', 'none', 'important');
      frame.style.setProperty('border', '0', 'important');
      frame.setAttribute('width', String(box.width));
      frame.setAttribute('height', String(box.height));
    }
    return box;
  }
  function rememberPopupSize(data, event, panelEl) {
    if (!data || data.type !== 'lvb-popup-preferred-size' || !panelEl || !event) return false;
    var frame = panelEl.querySelector('iframe');
    var fromFrame = !!(frame && event.source && event.source === frame.contentWindow);
    if (!fromFrame && event.origin !== '${POPUP_ORIGIN}') return false;
    var w = Number(data.width);
    var h = Number(data.height);
    if (!(w >= 200 && w <= 1400) || !(h >= 240 && h <= 1600)) return false;
    panelEl.setAttribute('data-ss-popup-w', String(w));
    panelEl.setAttribute('data-ss-popup-h', String(h));
    applyPopupFrameSize(panelEl);
    return true;
  }
  if (!window.__ssPopupFrameResize) {
    window.__ssPopupFrameResize = true;
    window.addEventListener('resize', function () {
      var nodes = document.querySelectorAll('.lvb-panel');
      for (var i = 0; i < nodes.length; i++) {
        try { applyPopupFrameSize(nodes[i]); } catch (err) {}
      }
    });
  }
`;
}
