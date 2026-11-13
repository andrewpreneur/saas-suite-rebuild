export const FAVICON_MAX_BYTES = 2 * 1024 * 1024;
export function validFaviconFile(file: { name: string; size: number; type: string }): boolean {
  return file.size > 0 && file.size <= FAVICON_MAX_BYTES && /\.(png|jpe?g|webp|ico)$/i.test(file.name) &&
    (file.type === "" || ["image/png", "image/jpeg", "image/webp", "image/x-icon", "image/vnd.microsoft.icon"].includes(file.type));
}