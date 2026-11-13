/**
 * Converts an agency name to a URL-safe slug format.
 * Example: "Link Marketing" -> "link-marketing"
 */
export function toAgencySlug(name: string | null | undefined): string | null {
  if (!name) return null;
  
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')        // Replace spaces with dashes
    .replace(/[^a-z0-9-]/g, '')  // Remove special characters
    .replace(/-+/g, '-')         // Replace multiple dashes with single dash
    .replace(/^-|-$/g, '');      // Remove leading/trailing dashes
}

/**
 * Checks if two agency identifiers are equivalent (ignoring case and spaces).
 * Used to validate if an agency name matches its agency_id.
 * Example: "Link Marketing" matches "link-marketing" -> true
 */
export function agencyIdentifiersMatch(name: string | null | undefined, id: string | null | undefined): boolean {
  if (!name && !id) return true;
  if (!name || !id) return false;
  
  const normalizedName = toAgencySlug(name);
  const normalizedId = toAgencySlug(id);
  
  return normalizedName === normalizedId;
}
