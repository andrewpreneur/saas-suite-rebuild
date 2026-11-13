// Education V2 saves a video by calling hub-data module_set and does not call
// fire-platform-event. Onboarding V2 calls module_set and then fires
// video_completed, but only when that video was not already complete.
// Hub-data emits the same event for a new completion. fire-platform-event
// drops a second call for that same video inside a short window so onboarding's
// follow-up invoke does not send the HighLevel webhook twice.

export const VIDEO_COMPLETED_TRIGGER = "video_completed";
export const VIDEO_COMPLETED_DEDUPE_MS = 15_000;

export interface ModuleCompletionState {
  completed: boolean | null;
}

export interface VideoIdentity {
  categoryId: string | null;
  moduleId: string | null;
  videoId: string | null;
}

export interface VideoCompletedEvent {
  agency_id: string;
  trigger_type: typeof VIDEO_COMPLETED_TRIGGER;
  user_email: string | null;
  user_name: string | null;
  metadata: Record<string, string>;
}

export function videoIdentity(metadata: unknown): VideoIdentity | null {
  if (!metadata || typeof metadata !== "object") return null;
  const record = metadata as Record<string, unknown>;
  const categoryId = text(record.category_id);
  const moduleId = text(record.module_id);
  const videoId = text(record.video_id);
  if (!categoryId && !moduleId && !videoId) return null;
  return {
    categoryId,
    moduleId,
    videoId: videoId ?? (categoryId && moduleId ? `${categoryId}:${moduleId}` : null),
  };
}

/** A completion row means the video is already done, unless completed is explicitly false. */
export function alreadyCompleted(existing: ModuleCompletionState | null): boolean {
  if (!existing) return false;
  return existing.completed !== false;
}

export function educationVideoCompletedEvent(input: {
  markingComplete: boolean;
  existing: ModuleCompletionState | null;
  agencyId: string;
  categoryId: string;
  moduleId: string;
  userEmail: string | null;
  userName: string | null;
  title?: string | null;
}): VideoCompletedEvent | null {
  if (!input.markingComplete || alreadyCompleted(input.existing)) return null;
  const userEmail = input.userEmail?.trim() || null;
  const userName = input.userName?.trim() || null;
  if (!userEmail && !userName) return null;
  const metadata: Record<string, string> = {
    category_id: input.categoryId,
    module_id: input.moduleId,
    video_id: `${input.categoryId}:${input.moduleId}`,
  };
  const title = input.title?.trim();
  if (title) {
    metadata.title = title.slice(0, 200);
    metadata.video_title = metadata.title;
  }
  return {
    agency_id: input.agencyId,
    trigger_type: VIDEO_COMPLETED_TRIGGER,
    user_email: userEmail,
    user_name: userName,
    metadata,
  };
}

export function isDuplicateVideoCompleted(input: {
  incoming: VideoIdentity | null;
  prior: VideoIdentity | null;
  priorCreatedAt: string;
  now?: number;
  windowMs?: number;
}): boolean {
  if (!input.incoming || !input.prior) return false;
  const now = input.now ?? Date.now();
  const windowMs = input.windowMs ?? VIDEO_COMPLETED_DEDUPE_MS;
  const created = Date.parse(input.priorCreatedAt);
  if (!Number.isFinite(created)) return false;
  const age = now - created;
  if (age < 0 || age > windowMs) return false;
  const sameModule = Boolean(
    input.incoming.categoryId &&
      input.incoming.moduleId &&
      input.incoming.categoryId === input.prior.categoryId &&
      input.incoming.moduleId === input.prior.moduleId,
  );
  const sameVideo = Boolean(
    input.incoming.videoId && input.prior.videoId && input.incoming.videoId === input.prior.videoId,
  );
  return sameModule || sameVideo;
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
