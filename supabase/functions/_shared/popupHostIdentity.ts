// Identity HighLevel writes onto the Custom JS tag ({{user.id}}, {{user.email}}, {{user.name}}).
// The popup may skip its login screen only when this returns a person. A blank tag,
// an unfilled {{merge}} field, or a name with no email and no id stays on the login screen.

export type PopupHostUser = { id?: string; email?: string; name?: string };

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  let out = "";
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 31 || code === 127) continue;
    out += value[i];
  }
  const text = out.trim();
  if (!text || text.includes("{{") || text.includes("}}") || text.length > max) return "";
  if (/[<>]/.test(text)) return "";
  return text;
}

export function trustedPopupHostUser(
  raw: { id?: unknown; email?: unknown; name?: unknown } | null | undefined,
): PopupHostUser | null {
  if (!raw || typeof raw !== "object") return null;
  const id = /^[A-Za-z0-9_-]{1,80}$/.test(clean(raw.id, 80)) ? clean(raw.id, 80) : "";
  const email = clean(raw.email, 254);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
  const name = clean(raw.name, 120);
  if (!validEmail && !(id && name)) return null;
  const user: PopupHostUser = {};
  if (id) user.id = id;
  if (validEmail) user.email = validEmail;
  if (name) user.name = name;
  return user;
}

/** Injected into HighLevel. Reads window.__SS_THEME_USER and returns the same shape as trustedPopupHostUser. */
export function popupHostUserRuntimeJS(): string {
  return `function ssPopupHostUser() {
    var raw = window.__SS_THEME_USER || {};
    function clean(value, max) {
      var text = value == null ? "" : String(value);
      var out = "";
      for (var i = 0; i < text.length; i++) {
        var code = text.charCodeAt(i);
        if (code <= 31 || code === 127) continue;
        out += text.charAt(i);
      }
      text = out.trim();
      if (!text || text.indexOf("{{") !== -1 || text.indexOf("}}") !== -1 || text.length > max) return "";
      if (/[<>]/.test(text)) return "";
      return text;
    }
    var id = clean(raw.id, 80);
    var email = clean(raw.email, 254);
    var name = clean(raw.name, 120);
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) id = "";
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) email = "";
    if (!email && !(id && name)) return null;
    var user = {};
    if (id) user.id = id;
    if (email) user.email = email;
    if (name) user.name = name;
    return user;
  }`;
}
