/** Phones may open the app. Desktop web must stay on an https address. */
export function shouldAutoOpenNativeApp(userAgent: string): boolean {
  return /Android|iPhone|iPad|iPod/i.test(userAgent);
}

export function webAuthContinueUrl(search: string, hash: string, origin = "https://saassuite.ai"): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (hash.startsWith("#") && hash.length > 1) {
    new URLSearchParams(hash.slice(1)).forEach((value, key) => {
      if (!params.has(key)) params.append(key, value);
    });
  }
  const query = params.toString();
  return `${origin}/app${query ? `?${query}` : ""}`;
}
