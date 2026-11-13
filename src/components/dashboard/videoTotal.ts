import { VIDEO_CATEGORIES } from "../../constants/videoCategories";

/** Agency-owned custom lessons are shared across plans and counted once. */
export function dashboardVideoTotal(customVideoCount: number): number {
  const standardIds = new Set(VIDEO_CATEGORIES.flatMap(category => category.modules.map(module => module.id)));
  return standardIds.size + customVideoCount;
}