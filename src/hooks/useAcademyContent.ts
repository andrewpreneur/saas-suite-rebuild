import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ACADEMY_LESSONS,
  ACADEMY_PROMPTS,
  ACADEMY_SKILLS,
  TECH_LIBRARY,
  type Stage,
} from "@/constants/academyContent";

export type AcademyKind = "lesson" | "prompt" | "skill" | "tech";

export type AcademyRow = {
  id: string;
  kind: AcademyKind;
  slug: string | null;
  stage: Stage | null;
  title: string;
  description: string | null;
  category: string | null;
  video_url: string | null;
  external_url: string | null;
  thumbnail_url: string | null;
  duration_minutes: number | null;
  format: string | null;
  prompt_text: string | null;
  file_url: string | null;
  file_label: string | null;
  is_new: boolean;
  owner_only: boolean;
  is_published: boolean;
  sort_order: number;
};

export const ACADEMY_BUCKET = "academy-assets";
/** Marker kept for the original storage-managed Claude + GHL skill pack. */
export const LEGACY_SKILL_PACK = "legacy-skill-pack";
export const STORAGE_PREFIX = "storage:";

/** Static content used only if the database is unreachable/empty. */
function fallbackRows(): AcademyRow[] {
  const base = {
    category: null,
    video_url: null,
    external_url: null,
    thumbnail_url: null,
    duration_minutes: null,
    format: null,
    prompt_text: null,
    file_url: null,
    file_label: null,
    is_new: false,
    owner_only: false,
    is_published: true,
  };
  return [
    ...ACADEMY_LESSONS.map((l, i) => ({
      ...base,
      id: `fallback-${l.id}`,
      kind: "lesson" as const,
      slug: l.id,
      stage: l.stage,
      title: l.title,
      description: l.description ?? null,
      video_url: l.videoUrl,
      external_url: l.externalUrl ?? null,
      thumbnail_url: l.thumbnailUrl ?? null,
      duration_minutes: l.durationMinutes,
      format: l.format,
      sort_order: i,
    })),
    ...ACADEMY_PROMPTS.map((p, i) => ({
      ...base,
      id: `fallback-${p.id}`,
      kind: "prompt" as const,
      slug: p.id,
      stage: p.stage,
      title: p.title,
      description: p.description,
      category: p.category,
      prompt_text: p.prompt,
      sort_order: i,
    })),
    ...ACADEMY_SKILLS.map((s, i) => ({
      ...base,
      id: `fallback-${s.id}`,
      kind: "skill" as const,
      slug: s.id,
      stage: s.stage,
      title: s.title,
      description: s.description,
      file_url: s.fileUrl ?? null,
      file_label: s.fileLabel ?? null,
      external_url: s.externalUrl ?? null,
      is_new: Boolean(s.isNew),
      owner_only: Boolean(s.ownerOnly),
      sort_order: i,
    })),
    ...TECH_LIBRARY.map((t, i) => ({
      ...base,
      id: `fallback-${t.id}`,
      kind: "tech" as const,
      slug: t.id,
      stage: null,
      title: t.name,
      description: t.description,
      external_url: t.url,
      sort_order: i,
    })),
  ];
}

/**
 * Module-level cache so re-entering the Academy (tab switches, deep links)
 * renders instantly instead of waiting on a round trip every mount.
 */
let cachedRows: AcademyRow[] | null = null;
let inflight: Promise<AcademyRow[]> | null = null;

async function fetchAcademyRows(): Promise<AcademyRow[]> {
  if (inflight) return inflight;
  inflight = (async () => {
    const { data, error } = await supabase
      .from("academy_content")
      .select("*")
      .order("kind", { ascending: true })
      .order("sort_order", { ascending: true });
    inflight = null;
    if (error || !data || data.length === 0) return fallbackRows();
    return data as unknown as AcademyRow[];
  })();
  return inflight;
}

export function useAcademyContent(isOwner: boolean) {
  const visible = useCallback(
    (all: AcademyRow[]) => (isOwner ? all : all.filter((r) => r.is_published)),
    [isOwner],
  );
  const [rows, setRows] = useState<AcademyRow[]>(() => (cachedRows ? visible(cachedRows) : []));
  const [isLoading, setIsLoading] = useState(!cachedRows);

  const load = useCallback(
    async (force = false) => {
      if (cachedRows && !force) {
        setRows(visible(cachedRows));
        setIsLoading(false);
        if (!force) return;
      }
      const all = force ? await refetchAcademyRows() : await fetchAcademyRows();
      cachedRows = all;
      setRows(visible(all));
      setIsLoading(false);
    },
    [visible],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return { rows, isLoading, refetch: () => load(true) };
}

async function refetchAcademyRows(): Promise<AcademyRow[]> {
  inflight = null;
  return fetchAcademyRows();
}

/** Warm the cache ahead of time (e.g. from the Community hub shell). */
export function prefetchAcademyContent() {
  if (cachedRows || inflight) return;
  void fetchAcademyRows().then((all) => {
    cachedRows = all;
    // Sign + warm the browser cache for every thumbnail so the grid paints instantly.
    const refs = all.map((r) => r.thumbnail_url).filter((r): r is string => Boolean(r));
    if (refs.length) {
      void resolveAcademyImageUrls(refs).then((map) => preloadImages(Object.values(map)));
    }
  });
}

/** Resolves once every image is in the browser cache (errors resolve too). */
export function preloadImages(urls: string[]): Promise<void> {
  return Promise.all(
    urls.map(
      (url) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = url;
        }),
    ),
  ).then(() => undefined);
}


export async function saveAcademyItem(item: Partial<AcademyRow> & { kind: AcademyKind }) {
  const payload = {
    kind: item.kind,
    slug: item.slug || null,
    stage: item.stage || null,
    title: item.title ?? "",
    description: item.description || null,
    category: item.category || null,
    video_url: item.video_url || null,
    external_url: item.external_url || null,
    thumbnail_url: item.thumbnail_url || null,
    duration_minutes: item.duration_minutes ?? null,
    format: item.format || null,
    prompt_text: item.prompt_text || null,
    file_url: item.file_url || null,
    file_label: item.file_label || null,
    is_new: Boolean(item.is_new),
    owner_only: Boolean(item.owner_only),
    is_published: item.is_published ?? true,
    sort_order: item.sort_order ?? 0,
  };
  if (item.id && !item.id.startsWith("fallback-")) {
    const { error } = await supabase.from("academy_content").update(payload).eq("id", item.id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("academy_content").insert(payload);
  if (error) throw error;
}

export async function deleteAcademyItem(id: string) {
  const { error } = await supabase.from("academy_content").delete().eq("id", id);
  if (error) throw error;
}

/** Uploads an asset (skill file, thumbnail, video) and returns the stored reference. */
export async function uploadAcademyAsset(file: File, folder: string): Promise<string> {
  const safe = file.name.replace(/[^A-Za-z0-9._-]/g, "-");
  const path = `${folder}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage
    .from(ACADEMY_BUCKET)
    .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: true });
  if (error) throw error;
  return `${STORAGE_PREFIX}${path}`;
}

/** Turns a stored reference into something the browser can open. */
export async function resolveAcademyUrl(reference: string | null): Promise<string | null> {
  if (!reference) return null;
  if (!reference.startsWith(STORAGE_PREFIX)) return reference;
  const path = reference.slice(STORAGE_PREFIX.length);
  const { data, error } = await supabase.storage
    .from(ACADEMY_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}

/** Loads a private image as a local browser URL so it renders reliably in <img>. */
export async function resolveAcademyImageUrl(reference: string | null): Promise<string | null> {
  if (!reference) return null;
  if (!reference.startsWith(STORAGE_PREFIX)) return reference;
  const path = reference.slice(STORAGE_PREFIX.length);
  const { data, error } = await supabase.storage.from(ACADEMY_BUCKET).download(path);
  if (error || !data) return null;
  return URL.createObjectURL(data);
}

/**
 * Batch-signs every storage thumbnail in ONE request and caches the results,
 * so a grid of lessons no longer fires a download per image on every mount.
 */
const signedThumbCache = new Map<string, { url: string; expires: number }>();

export async function resolveAcademyImageUrls(
  references: string[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const now = Date.now();
  const missing: string[] = [];
  for (const ref of new Set(references)) {
    if (!ref) continue;
    if (!ref.startsWith(STORAGE_PREFIX)) {
      out[ref] = ref;
      continue;
    }
    const hit = signedThumbCache.get(ref);
    if (hit && hit.expires > now) out[ref] = hit.url;
    else missing.push(ref);
  }
  if (!missing.length) return out;
  const paths = missing.map((r) => r.slice(STORAGE_PREFIX.length));
  const { data, error } = await supabase.storage
    .from(ACADEMY_BUCKET)
    .createSignedUrls(paths, 60 * 60 * 6);
  if (error || !data) return out;
  data.forEach((entry, i) => {
    const ref = missing[i];
    if (!entry?.signedUrl) return;
    out[ref] = entry.signedUrl;
    signedThumbCache.set(ref, { url: entry.signedUrl, expires: now + 1000 * 60 * 60 * 5 });
  });
  return out;
}


/** Original file name for a stored reference (strips the upload timestamp prefix). */
export function academyFileName(reference: string | null, label?: string | null): string {
  if (label?.trim()) return label.trim();
  if (!reference) return "download";
  const raw = reference.replace(STORAGE_PREFIX, "").split("/").pop() || "download";
  return raw.replace(/^\d{10,}-/, "");
}

/** Downloads a skill/asset file with its original name (works for private storage refs). */
export async function downloadAcademyFile(
  reference: string | null,
  label?: string | null,
): Promise<boolean> {
  if (!reference) return false;
  const name = academyFileName(reference, label);
  let blobUrl: string | null = null;
  if (reference.startsWith(STORAGE_PREFIX)) {
    const path = reference.slice(STORAGE_PREFIX.length);
    const { data, error } = await supabase.storage.from(ACADEMY_BUCKET).download(path);
    if (error || !data) return false;
    blobUrl = URL.createObjectURL(data);
  }
  const anchor = document.createElement("a");
  anchor.href = blobUrl ?? reference;
  anchor.download = name;
  anchor.rel = "noopener";
  if (!blobUrl) anchor.target = "_blank";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  if (blobUrl) setTimeout(() => URL.revokeObjectURL(blobUrl!), 10000);
  return true;
}
