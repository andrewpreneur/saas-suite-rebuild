import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { VIDEO_CATEGORIES } from "@/constants/videoCategories";
import { VIDEO_TRANSCRIPTIONS } from "@/constants/videoTranscriptions";
import { BookOpen } from "lucide-react";

interface VideoSetting {
  category_id: string;
  module_id: string;
  is_visible: boolean;
}

interface CustomVideo {
  id: string;
  title: string;
  transcription: string | null;
  module_type: string;
  existing_module_id: string | null;
  custom_module_title: string | null;
  module_order: number;
  lesson_order: number;
  tiers: string[] | null;
}

const TrainingDoc = () => {
  const { agencyId, tier } = useParams<{ agencyId: string; tier: string }>();
  const [videoSettings, setVideoSettings] = useState<VideoSetting[]>([]);
  const [customVideos, setCustomVideos] = useState<CustomVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      if (!agencyId || !tier) {
        setError("Invalid URL");
        setIsLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase.rpc(
          "get_agency_video_settings",
          { lookup_agency_id: agencyId, lookup_tier: tier }
        );

        if (fetchError) {
          console.error("Error loading video settings:", fetchError);
          setError("Could not load training document");
          setIsLoading(false);
          return;
        }

        setVideoSettings(data || []);

        // Load custom video transcriptions for this agency
        const { data: customData, error: customError } = await supabase
          .from("custom_onboarding_videos")
          .select(
            "id, title, transcription, module_type, existing_module_id, custom_module_title, module_order, lesson_order, tiers"
          )
          .eq("agency_id", agencyId)
          .eq("transcription_status", "success")
          .order("module_order", { ascending: true })
          .order("lesson_order", { ascending: true });

        if (customError) {
          console.error("Error loading custom videos:", customError);
        } else {
          const filtered = (customData || []).filter(
            (v: any) =>
              v.transcription &&
              v.transcription.trim() &&
              (!v.tiers || v.tiers.length === 0 || v.tiers.includes(tier))
          );
          setCustomVideos(filtered as CustomVideo[]);
        }
      } catch (err) {
        console.error("Error:", err);
        setError("Could not load training document");
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [agencyId, tier]);

  const isModuleVisible = (categoryId: string, moduleId: string): boolean => {
    // If no custom settings exist at all, all videos are visible by default
    if (videoSettings.length === 0) return true;

    const setting = videoSettings.find(
      (s) => s.category_id === categoryId && s.module_id === moduleId
    );

    // If no specific setting exists for this module, it's visible by default
    if (!setting) return true;

    return setting.is_visible;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-500">{error}</p>
      </div>
    );
  }

  // Filter categories and modules based on visibility
  const visibleCategories = VIDEO_CATEGORIES.map((category) => ({
    ...category,
    modules: category.modules.filter(
      (module) =>
        isModuleVisible(category.id, module.id) &&
        VIDEO_TRANSCRIPTIONS[module.id]
    ),
  })).filter((category) => category.modules.length > 0);

  // Group custom videos by module title for display
  const customModuleGroups: { title: string; videos: CustomVideo[] }[] = [];
  for (const v of customVideos) {
    let groupTitle = "Custom Training Videos";
    if (v.module_type === "custom" && v.custom_module_title) {
      groupTitle = v.custom_module_title.trim();
    } else if (v.module_type === "existing" && v.existing_module_id) {
      // Try to look up the existing module name
      for (const cat of VIDEO_CATEGORIES) {
        const found = cat.modules.find((m) => m.id === v.existing_module_id);
        if (found) {
          groupTitle = found.name;
          break;
        }
      }
    }
    let group = customModuleGroups.find((g) => g.title === groupTitle);
    if (!group) {
      group = { title: groupTitle, videos: [] };
      customModuleGroups.push(group);
    }
    group.videos.push(v);
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
            <BookOpen className="w-6 h-6 text-gray-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Onboarding Training Document
          </h1>
          <p className="text-gray-500 text-sm">
            Reference guide with detailed walkthroughs for each onboarding video
          </p>
        </div>

        {/* Content */}
        <div className="space-y-12">
          {visibleCategories.map((category) => (
            <div key={category.id}>
              <h2 className="text-xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200">
                {category.name}
              </h2>
              <div className="space-y-8">
                {category.modules.map((module) => (
                  <div key={module.id}>
                    <h3 className="text-lg font-medium text-gray-800 mb-3">
                      {module.name}
                    </h3>
                    <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">
                      {VIDEO_TRANSCRIPTIONS[module.id]}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Custom uploaded videos */}
          {customModuleGroups.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200">
                Custom Training Videos
              </h2>
              <div className="space-y-10">
                {customModuleGroups.map((group) => (
                  <div key={group.title}>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                      {group.title}
                    </h3>
                    <div className="space-y-6 pl-2">
                      {group.videos.map((v) => (
                        <div key={v.id}>
                          <h4 className="text-base font-medium text-gray-700 mb-2">
                            {v.title}
                          </h4>
                          <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">
                            {v.transcription}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {visibleCategories.length === 0 && customModuleGroups.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400">
                No training content is currently available.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrainingDoc;
