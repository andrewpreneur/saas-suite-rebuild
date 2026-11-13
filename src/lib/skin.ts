import { useSyncExternalStore } from "react";

/**
 * The app has two skins over the same layout and tokens:
 * "clean" (solid white cards on a cool canvas) and "glass" (frosted cards over
 * a soft colour field). The choice is per browser and applies before paint.
 * Styles live in src/index.css under `html[data-skin="glass"]`.
 */
export type Skin = "clean" | "glass";
const KEY = "ss_skin";
const listeners = new Set<() => void>();

function read(): Skin {
  try {
    return localStorage.getItem(KEY) === "glass" ? "glass" : "clean";
  } catch {
    return "clean";
  }
}

let current: Skin = typeof window === "undefined" ? "clean" : read();

function apply(skin: Skin) {
  if (typeof document !== "undefined") document.documentElement.dataset.skin = skin;
}
apply(current);

export function getSkin(): Skin {
  return current;
}

export function setSkin(skin: Skin) {
  if (skin === current) return;
  current = skin;
  try {
    localStorage.setItem(KEY, skin);
  } catch {
    // Private windows can refuse storage; the skin still applies for this visit.
  }
  apply(skin);
  listeners.forEach((listener) => listener());
}

export function useSkin(): Skin {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSkin,
    () => "clean",
  );
}
