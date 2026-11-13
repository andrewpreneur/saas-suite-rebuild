import { VIDEO_CATEGORIES } from "@/constants/videoCategories";
import { VIDEO_TRANSCRIPTIONS } from "@/constants/videoTranscriptions";
import { supabase } from "@/integrations/supabase/client";

/**
 * Compiles visible video transcriptions for an agency/tier into a single
 * text document suitable for RAG processing.
 */
export const compileTrainingDocContent = async (
  agencyId: string,
  tier: string
): Promise<string> => {
  // Fetch video settings for this agency/tier
  const { data: videoSettings, error } = await supabase.rpc(
    "get_agency_video_settings",
    { lookup_agency_id: agencyId, lookup_tier: tier }
  );

  if (error) {
    console.error("Error fetching video settings for training doc:", error);
  }

  const settings = videoSettings || [];

  const isModuleVisible = (categoryId: string, moduleId: string): boolean => {
    if (settings.length === 0) return true;
    const setting = settings.find(
      (s: any) => s.category_id === categoryId && s.module_id === moduleId
    );
    if (!setting) return true;
    return setting.is_visible;
  };

  // Build text content from visible modules that have transcriptions
  const sections: string[] = [];

  for (const category of VIDEO_CATEGORIES) {
    const visibleModules = category.modules.filter(
      (m) => isModuleVisible(category.id, m.id) && VIDEO_TRANSCRIPTIONS[m.id]
    );

    if (visibleModules.length === 0) continue;

    sections.push(`## ${category.name}\n`);

    for (const mod of visibleModules) {
      sections.push(`### ${mod.name}\n${VIDEO_TRANSCRIPTIONS[mod.id]}\n`);
    }
  }

  // Append transcriptions from custom uploaded videos (visible to this tier)
  try {
    const { data: customVideos } = await supabase
      .from("custom_onboarding_videos")
      .select("title, transcription, transcription_status, tiers")
      .eq("agency_id", agencyId)
      .eq("transcription_status", "success");

    const visibleCustom = (customVideos || []).filter(
      (v: any) =>
        v.transcription &&
        v.transcription.trim() &&
        (!v.tiers || v.tiers.includes(tier)),
    );

    if (visibleCustom.length > 0) {
      sections.push(`## Custom Training Videos\n`);
      for (const v of visibleCustom as any[]) {
        sections.push(`### ${v.title}\n${v.transcription}\n`);
      }
    }
  } catch (err) {
    console.error("Error appending custom video transcriptions:", err);
  }

  return sections.join("\n");
};

/**
 * Sends compiled training doc content to the process-training-doc edge function.
 */
export const processTrainingDocContent = async (
  agencyId: string,
  tier: string,
  additionalContent?: string
): Promise<void> => {
  try {
    const transcriptionContent = await compileTrainingDocContent(agencyId, tier);
    
    // Combine video transcriptions with any additional training doc content
    let fullContent = transcriptionContent;
    if (additionalContent && additionalContent.trim()) {
      fullContent += `\n\n## Additional Training Documentation\n\n${additionalContent}`;
    }

    if (!fullContent.trim()) {
      console.log("No training content to process for", agencyId);
      return;
    }

    const response = await supabase.functions.invoke("process-training-doc", {
      body: {
        agency_id: agencyId,
        tier,
        content: fullContent,
      },
    });

    if (response.error) {
      console.error("Error processing training doc:", response.error);
    } else {
      console.log("Training doc processed:", response.data);
    }
  } catch (err) {
    console.error("Error in processTrainingDocContent:", err);
  }
};
