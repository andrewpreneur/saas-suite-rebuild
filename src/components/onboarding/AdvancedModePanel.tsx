import { useState, useEffect, useMemo, useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Settings } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { VIDEO_CATEGORIES, getVideoCategoriesWithCounts } from "@/constants/videoCategories";
import { Badge } from "@/components/ui/badge";
import { processTrainingDocContent } from "@/utils/compileTrainingDocContent";

interface AgencyVersions {
  basic_id: string | null;
  advanced_id: string | null;
  elite_id: string | null;
}

interface VideoSettings {
  [agencyId: string]: {
    [categoryId: string]: {
      [moduleId: string]: boolean;
    };
  };
}

interface AdvancedModePanelProps {
  selectedPlan: 'plan1' | 'plan2' | 'plan3';
  agencyVersions: AgencyVersions;
}

// Suggested setup presets — each maps to module IDs based on topic
const SUGGESTED_SETUPS: { id: string; label: string; moduleIds: string[] }[] = [
  {
    id: "crm",
    label: "CRM",
    moduleIds: [
      "new-contact",
      "import-contacts",
      "generate-leads",
      "multi-channel",
      "facebook-lead-ads",
      "voice-ai-agent",
    ],
  },
  {
    id: "payments",
    label: "Payments",
    moduleIds: [
      "stripe-payments",
      "payment-link",
      "invoices",
      "first-product",
    ],
  },
  {
    id: "websites-automations",
    label: "Websites & Automations",
    moduleIds: [
      "professional-website",
      "wordpress-migration",
      "drip-campaigns",
      "documents-contracts",
    ],
  },
  {
    id: "sales",
    label: "Sales",
    moduleIds: [
      "sales-pipeline",
      "email-sync",
      "live-chat",
      "social-messaging",
      "first-campaign",
      "scheduling",
      "sms-campaign",
      "a2p-registration",
      "social-media-planner",
    ],
  },
  {
    id: "courses",
    label: "Courses",
    moduleIds: ["online-course"],
  },
];

// Build a flat list of all module IDs
const ALL_MODULE_IDS = VIDEO_CATEGORIES.flatMap((c) => c.modules.map((m) => m.id));

const AdvancedModePanel = ({ selectedPlan, agencyVersions }: AdvancedModePanelProps) => {
  const [videoSettings, setVideoSettings] = useState<VideoSettings>({});
  const [isLoading, setIsLoading] = useState(true);
  const [activeSetups, setActiveSetups] = useState<Set<string>>(new Set());

  const videoCategories = getVideoCategoriesWithCounts();

  const getCurrentAgencyId = (): string | null => {
    if (selectedPlan === 'plan1') return agencyVersions.basic_id;
    if (selectedPlan === 'plan2') return agencyVersions.advanced_id;
    return agencyVersions.elite_id;
  };

  const getTierName = (): 'basic' | 'advanced' | 'elite' => {
    if (selectedPlan === 'plan1') return 'basic';
    if (selectedPlan === 'plan2') return 'advanced';
    return 'elite';
  };

  useEffect(() => {
    const loadVideoSettings = async () => {
      const agencyId = getCurrentAgencyId();
      if (!agencyId) {
        setIsLoading(false);
        return;
      }

      try {
        const { data: settings } = await supabase
          .rpc('get_agency_video_settings', { lookup_agency_id: agencyId, lookup_tier: getTierName() });

        if (settings) {
          const newSettings: VideoSettings = { [agencyId]: {} };
          settings.forEach((s: any) => {
            if (!newSettings[agencyId][s.category_id]) {
              newSettings[agencyId][s.category_id] = {};
            }
            newSettings[agencyId][s.category_id][s.module_id] = s.is_visible;
          });
          setVideoSettings(newSettings);
        }
      } catch (error) {
        console.error('Error loading video settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    setIsLoading(true);
    setActiveSetups(new Set());
    loadVideoSettings();
  }, [selectedPlan, agencyVersions]);

  // Debounced RAG reprocessing
  const ragTimerRef = useCallback(() => {
    const agencyId = getCurrentAgencyId();
    if (agencyId) {
      processTrainingDocContent(agencyId, getTierName());
    }
  }, [selectedPlan, agencyVersions]);

  const scheduleRagReprocess = useCallback(() => {
    // Debounce: reprocess after 2s of no changes
    clearTimeout((window as any).__ragTimer);
    (window as any).__ragTimer = setTimeout(ragTimerRef, 2000);
  }, [ragTimerRef]);

  const toggleVideoVisibility = async (categoryId: string, moduleId: string, newVisible: boolean) => {
    const agencyId = getCurrentAgencyId();
    if (!agencyId) return;

    try {
      if (newVisible) {
        await supabase.rpc('delete_agency_video_setting', {
          agency_id_param: agencyId,
          category_id_param: categoryId,
          module_id_param: moduleId,
          tier_param: getTierName()
        });
      } else {
        await supabase.rpc('save_agency_video_setting', {
          agency_id_param: agencyId,
          category_id_param: categoryId,
          module_id_param: moduleId,
          is_visible_param: false,
          tier_param: getTierName()
        });
      }

      setVideoSettings(prev => {
        const newSettings = { ...prev };
        if (!newSettings[agencyId]) newSettings[agencyId] = {};
        if (!newSettings[agencyId][categoryId]) newSettings[agencyId][categoryId] = {};
        newSettings[agencyId][categoryId][moduleId] = newVisible;
        return newSettings;
      });

      scheduleRagReprocess();
    } catch (error) {
      console.error('Error toggling video visibility:', error);
      toast.error("Failed to update video visibility");
    }
  };

  const isModuleVisible = (categoryId: string, moduleId: string): boolean => {
    const agencyId = getCurrentAgencyId();
    if (!agencyId) return true;
    return videoSettings[agencyId]?.[categoryId]?.[moduleId] !== false;
  };

  // Count visible videos in a category
  const getVisibleCount = (category: typeof VIDEO_CATEGORIES[0]): number => {
    return category.modules.filter(m => isModuleVisible(category.id, m.id)).length;
  };

  // Check if all modules in a category are visible
  const isCategoryAllVisible = (category: typeof VIDEO_CATEGORIES[0]): boolean => {
    return category.modules.every(m => isModuleVisible(category.id, m.id));
  };

  // Toggle entire category
  const toggleCategory = async (category: typeof VIDEO_CATEGORIES[0], newVisible: boolean) => {
    for (const module of category.modules) {
      const currentlyVisible = isModuleVisible(category.id, module.id);
      if (currentlyVisible !== newVisible) {
        await toggleVideoVisibility(category.id, module.id, newVisible);
      }
    }
  };

  // Handle suggested setup toggle
  const handleSetupToggle = async (setupId: string) => {
    const newActiveSetups = new Set(activeSetups);
    const setup = SUGGESTED_SETUPS.find(s => s.id === setupId)!;

    if (newActiveSetups.has(setupId)) {
      // Deselecting: turn off videos associated with this setup (unless they belong to another active setup)
      newActiveSetups.delete(setupId);
      setActiveSetups(newActiveSetups);

      if (newActiveSetups.size === 0) {
        // All deselected → show all videos
        for (const cat of VIDEO_CATEGORIES) {
          for (const mod of cat.modules) {
            if (!isModuleVisible(cat.id, mod.id)) {
              await toggleVideoVisibility(cat.id, mod.id, true);
            }
          }
        }
      } else {
        // Turn off modules that belong ONLY to this deselected setup
        const otherActiveModuleIds = new Set<string>();
        for (const sid of newActiveSetups) {
          const s = SUGGESTED_SETUPS.find(x => x.id === sid)!;
          s.moduleIds.forEach(id => otherActiveModuleIds.add(id));
        }

        for (const moduleId of setup.moduleIds) {
          if (!otherActiveModuleIds.has(moduleId)) {
            // Find category for this module
            for (const cat of VIDEO_CATEGORIES) {
              const mod = cat.modules.find(m => m.id === moduleId);
              if (mod && isModuleVisible(cat.id, mod.id)) {
                await toggleVideoVisibility(cat.id, mod.id, false);
              }
            }
          }
        }
      }
    } else {
      // Selecting: if this is the first selection, turn off everything first, then turn on this setup's videos
      const isFirstSelection = newActiveSetups.size === 0;
      newActiveSetups.add(setupId);
      setActiveSetups(newActiveSetups);

      if (isFirstSelection) {
        // Turn off all videos first
        for (const cat of VIDEO_CATEGORIES) {
          for (const mod of cat.modules) {
            if (isModuleVisible(cat.id, mod.id)) {
              await toggleVideoVisibility(cat.id, mod.id, false);
            }
          }
        }
      }

      // Turn on this setup's videos
      for (const moduleId of setup.moduleIds) {
        for (const cat of VIDEO_CATEGORIES) {
          const mod = cat.modules.find(m => m.id === moduleId);
          if (mod && !isModuleVisible(cat.id, mod.id)) {
            await toggleVideoVisibility(cat.id, mod.id, true);
          }
        }
      }
    }
  };

  const currentAgencyId = getCurrentAgencyId();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!currentAgencyId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Settings className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="mb-2">No URL created for {selectedPlan === 'plan1' ? 'Plan 1' : selectedPlan === 'plan2' ? 'Plan 2' : 'Plan 3'} yet.</p>
        <p className="text-xs">Use the dropdown above to create a URL for this plan first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Customize which videos are visible for {selectedPlan === 'plan1' ? 'Plan 1' : selectedPlan === 'plan2' ? 'Plan 2' : 'Plan 3'}. Toggle visibility for each video in your onboarding experience.
      </p>

      {/* Suggested Setups */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-foreground">Suggested Setups</h4>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_SETUPS.map((setup) => {
            const isActive = activeSetups.has(setup.id);
            return (
              <button
                key={setup.id}
                onClick={() => handleSetupToggle(setup.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                }`}
              >
                {setup.label}
              </button>
            );
          })}
        </div>
      </div>

      <Accordion type="multiple" className="w-full">
        {videoCategories.map((category) => {
          const originalCategory = VIDEO_CATEGORIES.find(c => c.id === category.id)!;
          const visibleCount = getVisibleCount(originalCategory);
          const allVisible = isCategoryAllVisible(originalCategory);
          const totalCount = originalCategory.modules.length;

          return (
            <AccordionItem key={category.id} value={category.id}>
              <div className="flex items-center gap-2">
                <AccordionTrigger className="text-sm font-medium flex-1">
                  <div className="flex items-center gap-2">
                    <span>{category.name}</span>
                    <div className="flex items-center gap-0.5 ml-1">
                      {originalCategory.modules.map((mod) => (
                        <span
                          key={mod.id}
                          className={`w-2 h-2 rounded-full transition-colors ${
                            isModuleVisible(category.id, mod.id) ? "bg-success" : "bg-transparent"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </AccordionTrigger>
                <Switch
                  checked={allVisible}
                  onCheckedChange={(checked) => toggleCategory(originalCategory, checked)}
                  className="mr-2"
                />
              </div>
              <AccordionContent>
                <div className="space-y-2 pl-4">
                  {originalCategory.modules.map((module) => {
                    const isVisible = isModuleVisible(category.id, module.id);
                    return (
                      <div
                        key={module.id}
                        className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50"
                      >
                        <span className="text-sm">{module.name}</span>
                        <Switch
                          checked={isVisible}
                          onCheckedChange={(checked) => toggleVideoVisibility(category.id, module.id, checked)}
                        />
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
};

export default AdvancedModePanel;
