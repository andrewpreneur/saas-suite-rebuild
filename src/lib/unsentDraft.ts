const KEY = "ss_copilot_unsent_draft";

/** Keep a refused CoPilot message across a refresh. Never throws. */
export function rememberUnsentDraft(text: string) {
  try {
    const value = text.slice(0, 8000);
    if (!value.trim()) sessionStorage.removeItem(KEY);
    else sessionStorage.setItem(KEY, value);
  } catch {
    /* private mode */
  }
}

export function readUnsentDraft(): string {
  try {
    return sessionStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

export function clearUnsentDraft() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
