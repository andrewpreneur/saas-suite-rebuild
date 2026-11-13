import { useCallback, useEffect, useState } from "react";

/**
 * Owner-only "Edit mode" switch. Purely a presentation preference: it hides the
 * pencil buttons and drag grips when off. All real authorization stays in RLS,
 * so turning it on gives nobody extra access.
 */
const KEY = "community_edit_mode";
const EVENT = "community-edit-mode";

function read(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function useEditMode() {
  const [editMode, setState] = useState<boolean>(read);

  useEffect(() => {
    const sync = () => setState(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setEditMode = useCallback((next: boolean) => {
    try {
      localStorage.setItem(KEY, next ? "on" : "off");
    } catch {
      /* ignore private-mode failures */
    }
    setState(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { editMode, setEditMode };
}
