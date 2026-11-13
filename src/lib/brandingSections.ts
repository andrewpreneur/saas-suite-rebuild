export type BrandingPart = "sidebar" | "login" | "buttons" | "favicon";
export type BrandingSections = Record<Exclude<BrandingPart, "favicon">, string> & { favicon?: string };

export function splitBrandingCSS(css: string): BrandingSections {
  const parts: BrandingSections = { sidebar: "", login: "", buttons: "" };
  const marked = /\/\* SS-PART:(sidebar|login|buttons|favicon) START \*\/([\s\S]*?)\/\* SS-PART:\1 END \*\//g;
  if (css.includes("/* SS-PART:")) {
    let match;
    while ((match = marked.exec(css))) parts[match[1] as BrandingPart] = match[2].trim();
    return parts;
  }
  // Legacy stylesheets append login and buttons after the sidebar.
  const chunks = css.split(/(?=\/\* === (?:Login Page|Top Button) Customization === \*\/)/);
  for (const chunk of chunks) {
    const value = chunk.trim();
    if (value.startsWith("/* === Login Page")) parts.login = value;
    else if (value.startsWith("/* === Top Button")) parts.buttons = value;
    else parts.sidebar += value;
  }
  return parts;
}

export function updateBrandingPart(css: string, part: BrandingPart, content: string): string {
  const extra = css.includes("/* SS-PART:") ? css.replace(/\/\* SS-PART:(sidebar|login|buttons|favicon) START \*\/[\s\S]*?\/\* SS-PART:\1 END \*\//g, "").trim() : "";
  const parts = splitBrandingCSS(css);
  parts[part] = content;
  const managed = (Object.keys(parts) as BrandingPart[])
    .filter((key) => parts[key]?.trim() || (key === "sidebar" && !!extra))
    .map((key) => `/* SS-PART:${key} START */\n${parts[key]}\n/* SS-PART:${key} END */`)
    .join("\n\n");
  return [managed, extra].filter(Boolean).join("\n\n");
}