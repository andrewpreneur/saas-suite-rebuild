import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const SLOT_ID = "v3-preview-header-slot";

/**
 * Placed inside a view's card header. The "Live Preview of:" switcher is
 * portalled in here so it lives in the same container as the page it controls.
 */
export const PreviewHeaderHost = () => (
  <div id={SLOT_ID} className="flex items-center gap-2 min-h-9" />
);

/**
 * Renders children into the active view's card header slot. Polls on animation
 * frames because the host mounts in a sibling subtree.
 */
export const PreviewHeaderPortal = ({ children }: { children: React.ReactNode }) => {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let frame = 0;
    const find = () => {
      const el = document.getElementById(SLOT_ID);
      if (el !== host) setHost(el);
      if (!el) frame = requestAnimationFrame(find);
    };
    find();
    return () => cancelAnimationFrame(frame);
  });

  if (!host) return null;
  return createPortal(children, host);
};
