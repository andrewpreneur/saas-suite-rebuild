import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Plus, 
  Trash2, 
  Save, 
  GripVertical,
  CheckSquare,
  AlertCircle,
  Link as LinkIcon,
  Video,
  X
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { VIDEO_CATEGORIES, linkedVideoLabel } from "@/constants/videoCategories";
import { Switch } from "@/components/ui/switch";
import { getV2HomeSettingsDefaults } from "@/constants/homeSettingsDefaults";

interface CustomVideo {
  id: string;
  title: string;
  module_type: string;
  custom_module_title: string | null;
  existing_module_id: string | null;
}

interface ChecklistItem {
  id: string;
  title: string;
  description: string | null;
  item_order: number;
  link_to: 'none' | 'url' | 'video';
  link_url: string | null;
  linked_video: string | null;
  isNew?: boolean;
}

interface OnboardingChecklistPanelProps {
  selectedPlanAgencyId: string | null;
}

const OnboardingChecklistPanel = ({ selectedPlanAgencyId }: OnboardingChecklistPanelProps) => {
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [customVideos, setCustomVideos] = useState<CustomVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);

  // What to do next settings
  type NextPriority = 'onboarding_videos' | 'checklist' | 'custom_text' | 'custom_url';
  const [nextEnabled, setNextEnabled] = useState(true);
  const [nextPriority, setNextPriority] = useState<NextPriority>('onboarding_videos');
  const [nextCustomText, setNextCustomText] = useState('');
  const [nextCustomUrl, setNextCustomUrl] = useState('');
  const [nextCustomUrlLabel, setNextCustomUrlLabel] = useState('');
  const [savingNext, setSavingNext] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!selectedPlanAgencyId) {
        setChecklistItems([]);
        setCustomVideos([]);
        setIsLoading(false);
        return;
      }

      try {
        // Load existing checklist items and custom videos in parallel
        const [checklistResult, customVideosResult, homeResult] = await Promise.all([
          supabase.rpc('get_agency_onboarding_checklist', { lookup_agency_id: selectedPlanAgencyId }),
          supabase.from('custom_onboarding_videos').select('id, title, module_type, custom_module_title, existing_module_id').eq('agency_id', selectedPlanAgencyId),
          supabase.from('v2_home_settings').select('next_steps_enabled, next_steps_priority, next_steps_custom_text, next_steps_custom_url, next_steps_custom_url_label').eq('agency_id', selectedPlanAgencyId).maybeSingle()
        ]);

        if (checklistResult.error) {
          console.error('Error loading checklist:', checklistResult.error);
        } else if (checklistResult.data) {
          setChecklistItems(checklistResult.data.map((item: any) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            item_order: item.item_order,
            link_to: (item.link_to as 'none' | 'url' | 'video') || 'none',
            link_url: item.link_url,
            linked_video: item.linked_video
          })));
        }

        if (customVideosResult.error) {
          console.error('Error loading custom videos:', customVideosResult.error);
        } else if (customVideosResult.data) {
          setCustomVideos(customVideosResult.data);
        }

        const home: any = homeResult?.data;
        if (home) {
          setNextEnabled(home.next_steps_enabled ?? true);
          setNextPriority((home.next_steps_priority as NextPriority) || 'onboarding_videos');
          setNextCustomText(home.next_steps_custom_text || '');
          setNextCustomUrl(home.next_steps_custom_url || '');
          setNextCustomUrlLabel(home.next_steps_custom_url_label || '');
        } else {
          setNextEnabled(true);
          setNextPriority('onboarding_videos');
          setNextCustomText('');
          setNextCustomUrl('');
          setNextCustomUrlLabel('');
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    setIsLoading(true);
    loadData();
  }, [selectedPlanAgencyId]);

  const addNewItem = () => {
    const newOrder = checklistItems.length > 0 
      ? Math.max(...checklistItems.map(i => i.item_order)) + 1 
      : 1;
    
    setChecklistItems([
      ...checklistItems,
      {
        id: `new-${Date.now()}`,
        title: "",
        description: "",
        item_order: newOrder,
        link_to: 'none',
        link_url: null,
        linked_video: null,
        isNew: true
      }
    ]);
  };

  const updateItem = (id: string, field: keyof ChecklistItem, value: string | null) => {
    setChecklistItems(items => 
      items.map(item => {
        if (item.id !== id) return item;
        
        // If changing link_to, reset the related fields
        if (field === 'link_to') {
          return { 
            ...item, 
            link_to: value as 'none' | 'url' | 'video',
            link_url: value === 'url' ? item.link_url : null,
            linked_video: value === 'video' ? item.linked_video : null
          };
        }
        
        return { ...item, [field]: value };
      })
    );
  };

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggedItemId(itemId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', itemId);
  };

  const handleDragOver = (e: React.DragEvent, itemId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedItemId !== itemId) {
      setDragOverItemId(itemId);
    }
  };

  const handleDragLeave = () => {
    setDragOverItemId(null);
  };

  const handleDragEnd = () => {
    setDraggedItemId(null);
    setDragOverItemId(null);
  };

  const handleDrop = (e: React.DragEvent, targetItemId: string) => {
    e.preventDefault();
    
    if (!draggedItemId || draggedItemId === targetItemId) {
      handleDragEnd();
      return;
    }

    const sortedItems = [...checklistItems].sort((a, b) => a.item_order - b.item_order);
    const draggedIndex = sortedItems.findIndex(item => item.id === draggedItemId);
    const targetIndex = sortedItems.findIndex(item => item.id === targetItemId);

    if (draggedIndex === -1 || targetIndex === -1) {
      handleDragEnd();
      return;
    }

    // Remove dragged item and insert at target position
    const [draggedItem] = sortedItems.splice(draggedIndex, 1);
    sortedItems.splice(targetIndex, 0, draggedItem);

    // Update item_order for all items based on new positions
    const reorderedItems = sortedItems.map((item, index) => ({
      ...item,
      item_order: index + 1
    }));

    setChecklistItems(reorderedItems);
    handleDragEnd();
  };

  const removeItem = async (id: string) => {
    const item = checklistItems.find(i => i.id === id);
    
    if (item?.isNew) {
      // Just remove from state if it's new (not saved yet)
      setChecklistItems(items => items.filter(i => i.id !== id));
    } else {
      // Delete from database
      try {
        const { error } = await supabase
          .from('agency_onboarding_checklist')
          .delete()
          .eq('id', id);

        if (error) throw error;
        
        setChecklistItems(items => items.filter(i => i.id !== id));
        toast.success("Checklist item deleted");
      } catch (error) {
        console.error('Error deleting item:', error);
        toast.error("Failed to delete item");
      }
    }
  };

  const saveChecklist = async () => {
    if (!selectedPlanAgencyId) {
      toast.error("Please create this plan's URL first");
      return;
    }

    // Validate all items have titles
    const invalidItems = checklistItems.filter(item => !item.title.trim());
    if (invalidItems.length > 0) {
      toast.error("All checklist items must have a title");
      return;
    }

    // Validate URL items have a URL
    const invalidUrlItems = checklistItems.filter(item => item.link_to === 'url' && !item.link_url?.trim());
    if (invalidUrlItems.length > 0) {
      toast.error("Please provide a URL for all URL-linked items");
      return;
    }

    // Validate video items have a video selected
    const invalidVideoItems = checklistItems.filter(item => item.link_to === 'video' && !item.linked_video);
    if (invalidVideoItems.length > 0) {
      toast.error("Please select a video for all video-linked items");
      return;
    }

    setIsSaving(true);
    try {
      // Separate new items from existing ones
      const newItems = checklistItems.filter(item => item.isNew);
      const existingItems = checklistItems.filter(item => !item.isNew);

      // Insert new items
      for (const item of newItems) {
        const { data, error } = await supabase
          .from('agency_onboarding_checklist')
          .insert({
            agency_id: selectedPlanAgencyId,
            title: item.title,
            description: item.description || null,
            item_order: item.item_order,
            link_to: item.link_to,
            link_url: item.link_url,
            linked_video: item.linked_video
          })
          .select()
          .single();

        if (error) throw error;

        // Update the item in state with the real ID
        setChecklistItems(items => 
          items.map(i => 
            i.id === item.id ? { 
              ...data, 
              link_to: data.link_to as 'none' | 'url' | 'video',
              isNew: false 
            } : i
          )
        );
      }

      // Update existing items
      for (const item of existingItems) {
        const { error } = await supabase
          .from('agency_onboarding_checklist')
          .update({
            title: item.title,
            description: item.description || null,
            item_order: item.item_order,
            link_to: item.link_to,
            link_url: item.link_url,
            linked_video: item.linked_video
          })
          .eq('id', item.id);

        if (error) throw error;
      }

      toast.success("Onboarding checklist saved!");
    } catch (error) {
      console.error('Error saving checklist:', error);
      toast.error("Failed to save checklist");
    } finally {
      setIsSaving(false);
    }
  };

  const saveNextSteps = async (overrides?: Partial<{
    next_steps_enabled: boolean;
    next_steps_priority: NextPriority;
    next_steps_custom_text: string;
    next_steps_custom_url: string;
    next_steps_custom_url_label: string;
  }>) => {
    if (!selectedPlanAgencyId) return;
    setSavingNext(true);
    try {
      // Ensure row exists
      const { data: existing } = await supabase
        .from('v2_home_settings')
        .select('agency_id')
        .eq('agency_id', selectedPlanAgencyId)
        .maybeSingle();
      if (!existing) {
        await supabase
          .from('v2_home_settings')
          .insert(getV2HomeSettingsDefaults(selectedPlanAgencyId) as any);
      }
      const payload: any = {
        next_steps_enabled: nextEnabled,
        next_steps_priority: nextPriority,
        next_steps_custom_text: nextCustomText || null,
        next_steps_custom_url: nextCustomUrl || null,
        next_steps_custom_url_label: nextCustomUrlLabel || null,
        ...overrides,
      };
      const { error } = await supabase
        .from('v2_home_settings')
        .update(payload)
        .eq('agency_id', selectedPlanAgencyId);
      if (error) throw error;
    } catch (e) {
      console.error('Error saving What to do next:', e);
      toast.error('Failed to save "What to do next"');
    } finally {
      setSavingNext(false);
    }
  };

  // Helper to get video name from ID
  const getVideoName = (videoId: string): string => {
    // Check custom videos first
    const customVideo = customVideos.find(v => v.id === videoId);
    if (customVideo) return customVideo.title;

    return linkedVideoLabel(videoId) || videoId;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!selectedPlanAgencyId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium">No plan URL created</p>
        <p className="text-sm">Create a URL for this plan to manage its checklist</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted">
        <AlertCircle className="w-4 h-4 text-info mt-0.5 flex-shrink-0" />
        <div className="text-sm text-foreground">
          <p className="font-medium">Onboarding Checklist</p>
          <p className="text-xs mt-1 text-muted-foreground">
            Create a custom onboarding checklist for your clients. These items will appear on their home page 
            and they can check them off as they complete each step. Optionally link items to URLs or videos.
          </p>
        </div>
      </div>

      {checklistItems.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No checklist items yet</p>
          <p className="text-sm">Add items to create an onboarding checklist for your clients</p>
        </div>
      ) : (
        <div className="space-y-3">
          {checklistItems
            .sort((a, b) => a.item_order - b.item_order)
            .map((item, index) => (
              <Card 
                key={item.id} 
                className={`border-border transition-all duration-200 ${
                  draggedItemId === item.id ? 'opacity-50 scale-[0.98]' : ''
                } ${
                  dragOverItemId === item.id ? 'border-primary border-2 bg-primary/5' : ''
                }`}
                draggable
                onDragStart={(e) => handleDragStart(e, item.id)}
                onDragOver={(e) => handleDragOver(e, item.id)}
                onDragLeave={handleDragLeave}
                onDragEnd={handleDragEnd}
                onDrop={(e) => handleDrop(e, item.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div 
                      className="flex items-center gap-2 text-muted-foreground pt-2 cursor-grab active:cursor-grabbing hover:text-foreground transition-colors"
                      title="Drag to reorder"
                    >
                      <GripVertical className="w-4 h-4" />
                      <span className="text-sm font-medium w-6">{index + 1}.</span>
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Title</Label>
                        <Input
                          value={item.title}
                          onChange={(e) => updateItem(item.id, 'title', e.target.value)}
                          placeholder="e.g., Complete your profile setup"
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Description (optional)</Label>
                        <Textarea
                          value={item.description || ''}
                          onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                          placeholder="Add more details about this step..."
                          className="text-sm resize-none"
                          rows={2}
                        />
                      </div>
                      
                      {/* Link Type Selection */}
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Link Type</Label>
                        <Select
                          value={item.link_to}
                          onValueChange={(value) => updateItem(item.id, 'link_to', value)}
                        >
                          <SelectTrigger className="text-sm">
                            <SelectValue placeholder="Select link type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              <div className="flex items-center gap-2">
                                <X className="w-4 h-4" />
                                <span>None</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="url">
                              <div className="flex items-center gap-2">
                                <LinkIcon className="w-4 h-4" />
                                <span>URL</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="video">
                              <div className="flex items-center gap-2">
                                <Video className="w-4 h-4" />
                                <span>Link to Video</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* URL Input */}
                      {item.link_to === 'url' && (
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">URL</Label>
                          <Input
                            value={item.link_url || ''}
                            onChange={(e) => updateItem(item.id, 'link_url', e.target.value)}
                            placeholder="https://example.com"
                            className="text-sm"
                            type="url"
                          />
                        </div>
                      )}

                      {/* Video Selection */}
                      {item.link_to === 'video' && (
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Select Video</Label>
                          <Select
                            value={item.linked_video || ''}
                            onValueChange={(value) => updateItem(item.id, 'linked_video', value)}
                          >
                            <SelectTrigger className="text-sm">
                              <SelectValue placeholder="Select a video">
                                {item.linked_video ? getVideoName(item.linked_video) : "Select a video"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              {/* Custom Videos */}
                              {customVideos.length > 0 && (
                                <>
                                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted">
                                    Custom Videos
                                  </div>
                                  {customVideos.map((video) => (
                                    <SelectItem key={video.id} value={video.id}>
                                      {video.title}
                                    </SelectItem>
                                  ))}
                                </>
                              )}
                              
                              {/* Platform Videos by Category */}
                              {VIDEO_CATEGORIES.map((category) => (
                                <div key={category.id}>
                                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted">
                                    {category.name}
                                  </div>
                                  {category.modules.map((module) => (
                                    <SelectItem 
                                      key={`${category.id}:${module.id}`} 
                                      value={`${category.id}:${module.id}`}
                                    >
                                      {module.name}
                                    </SelectItem>
                                  ))}
                                </div>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(item.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button
          variant="outline"
          onClick={addNewItem}
          className="flex-1"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Checklist Item
        </Button>
        <Button
          onClick={saveChecklist}
          disabled={isSaving || checklistItems.length === 0}
          className="flex-1"
        >
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Saving..." : "Save Checklist"}
        </Button>
      </div>

      {/* What to do next */}
      <Card className="border-border">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">What to do next</p>
              <p className="text-xs text-muted-foreground">
                Customize the section that tells clients what to focus on
              </p>
            </div>
            <Switch
              checked={nextEnabled}
              onCheckedChange={(checked) => {
                setNextEnabled(checked);
                saveNextSteps({ next_steps_enabled: checked });
              }}
            />
          </div>

          {nextEnabled && (
            <>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Prioritize</Label>
                <Select
                  value={nextPriority}
                  onValueChange={(value) => {
                    const v = value as typeof nextPriority;
                    setNextPriority(v);
                    saveNextSteps({ next_steps_priority: v });
                  }}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="onboarding_videos">Onboarding videos</SelectItem>
                    <SelectItem value="checklist">Checklist items</SelectItem>
                    <SelectItem value="custom_text">Custom text</SelectItem>
                    <SelectItem value="custom_url">Custom URL</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {nextPriority === 'custom_text' && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Custom text</Label>
                  <Textarea
                    value={nextCustomText}
                    onChange={(e) => setNextCustomText(e.target.value)}
                    onBlur={() => saveNextSteps()}
                    placeholder="Tell clients what they should do next..."
                    rows={3}
                    className="text-sm resize-none"
                  />
                </div>
              )}

              {nextPriority === 'custom_url' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Button label</Label>
                    <Input
                      value={nextCustomUrlLabel}
                      onChange={(e) => setNextCustomUrlLabel(e.target.value)}
                      onBlur={() => saveNextSteps()}
                      placeholder="e.g., Book your call"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">URL</Label>
                    <Input
                      value={nextCustomUrl}
                      onChange={(e) => setNextCustomUrl(e.target.value)}
                      onBlur={() => saveNextSteps()}
                      placeholder="https://example.com"
                      type="url"
                      className="text-sm"
                    />
                  </div>
                </div>
              )}

              {savingNext && (
                <p className="text-xs text-muted-foreground">Saving…</p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OnboardingChecklistPanel;
