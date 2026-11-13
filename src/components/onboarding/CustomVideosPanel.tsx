import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Settings, Trash2, Info, Pencil, Mic, CircleCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { transcribeVideoOnSave, TranscribeOnSaveCheckbox } from "@/lib/transcribeOnSave";

interface AgencyVersions {
  basic_id: string | null;
  advanced_id: string | null;
  elite_id: string | null;
}

interface CustomVideo {
  id: string;
  title: string;
  description: string;
  video_url: string;
  module_type: string;
  custom_module_title: string | null;
  existing_module_id: string | null;
  lesson_order: number;
  tiers: string[] | null;
  is_embed: boolean;
  module_order: number;
  transcription?: string | null;
  transcription_status?: string | null;
}

interface CustomVideosPanelProps {
  standalone?: boolean;
  selectedPlanAgencyId?: string | null;
  agencyVersions?: AgencyVersions;
}

const CustomVideosPanel = ({ standalone = false, selectedPlanAgencyId, agencyVersions }: CustomVideosPanelProps) => {
  const { email } = useUser();
  const [customVideos, setCustomVideos] = useState<CustomVideo[]>([]);
  const [showCustomVideoDialog, setShowCustomVideoDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [primaryAgencyId, setPrimaryAgencyId] = useState<string | null>(null);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [customVideoForm, setCustomVideoForm] = useState({
    moduleType: 'existing' as 'existing' | 'custom',
    customModuleTitle: '',
    existingModuleId: '',
    lessonOrder: 1,
    moduleOrder: 1,
    title: '',
    description: '',
    videoUrl: '',
    videoType: 'url' as 'url' | 'embed',
    isEmbed: false
  });

  // Determine which agency IDs are available for tier toggles
  const availableTiers = {
    basic: agencyVersions?.basic_id || null,
    advanced: agencyVersions?.advanced_id || null,
    elite: agencyVersions?.elite_id || null
  };

  const resetForm = () => {
    setCustomVideoForm({
      moduleType: 'existing',
      customModuleTitle: '',
      existingModuleId: '',
      lessonOrder: 1,
      moduleOrder: 1,
      title: '',
      description: '',
      videoUrl: '',
      videoType: 'url',
      isEmbed: false
    });
    setEditingVideoId(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setShowCustomVideoDialog(true);
  };

  const openEditDialog = (video: CustomVideo) => {
    // Determine module type and values based on video data
    let moduleType: 'existing' | 'custom' = 'existing';
    let existingModuleId = '';
    let customModuleTitle = '';

    if (video.module_type === 'custom' && video.custom_module_title) {
      moduleType = 'custom';
      customModuleTitle = video.custom_module_title;
    } else if (video.existing_module_id) {
      moduleType = 'existing';
      existingModuleId = video.existing_module_id;
    }

    setCustomVideoForm({
      moduleType,
      customModuleTitle,
      existingModuleId,
      lessonOrder: video.lesson_order,
      moduleOrder: video.module_order ?? 1,
      title: video.title,
      description: video.description,
      videoUrl: video.video_url,
      videoType: video.is_embed ? 'embed' : 'url',
      isEmbed: video.is_embed
    });
    setEditingVideoId(video.id);
    setShowCustomVideoDialog(true);
  };

  useEffect(() => {
    const loadData = async () => {
      if (!email) return;
      
      try {
        // Get user's primary agency_id for loading/saving custom videos
        const { data: userData } = await supabase
          .from('saas_suite_users')
          .select('agency_id')
          .eq('email', email)
          .maybeSingle();

        if (userData?.agency_id) {
          setPrimaryAgencyId(userData.agency_id);

          // Custom videos are stored at the primary agency level
          const { data: videos } = await supabase
            .from('custom_onboarding_videos')
            .select('*')
            .eq('agency_id', userData.agency_id)
            .order('lesson_order', { ascending: true });
          
          if (videos) {
            setCustomVideos(videos);
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [email]);

  const [autoTranscribe, setAutoTranscribe] = useState(true);
  const saveCustomVideo = async () => {
    if (!email || !primaryAgencyId) return;

    // Validate form
    if (customVideoForm.moduleType === 'custom' && !customVideoForm.customModuleTitle) {
      toast.error("Please enter a custom module title");
      return;
    }
    if (customVideoForm.moduleType === 'existing' && !customVideoForm.existingModuleId) {
      toast.error("Please select an existing module");
      return;
    }
    if (!customVideoForm.title || !customVideoForm.description || !customVideoForm.videoUrl) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSaving(true);
    try {
      // Determine if selecting a user-created custom module from the "existing" dropdown
      const isSelectingCustomModule = customVideoForm.moduleType === 'existing' && 
        customVideoForm.existingModuleId.startsWith('custom:');
      
      const customModuleTitle = isSelectingCustomModule 
        ? customVideoForm.existingModuleId.replace('custom:', '')
        : (customVideoForm.moduleType === 'custom' ? customVideoForm.customModuleTitle : null);
      
      const existingModuleId = isSelectingCustomModule 
        ? null 
        : (customVideoForm.moduleType === 'existing' ? customVideoForm.existingModuleId : null);
      
      const moduleType = isSelectingCustomModule ? 'custom' : customVideoForm.moduleType;

      const videoData = {
        module_type: moduleType,
        custom_module_title: customModuleTitle,
        existing_module_id: existingModuleId,
        lesson_order: customVideoForm.lessonOrder,
        module_order: customVideoForm.moduleOrder,
        title: customVideoForm.title,
        description: customVideoForm.description,
        video_url: customVideoForm.videoUrl,
        is_embed: customVideoForm.videoType === 'embed'
      };

      if (editingVideoId) {
        // Update existing video
        const { data, error } = await supabase
          .from('custom_onboarding_videos')
          .update(videoData)
          .eq('id', editingVideoId)
          .select()
          .single();

        if (error) throw error;

        setCustomVideos(prev => prev.map(v => v.id === editingVideoId ? data : v));
        toast.success("Video updated!");
        if (autoTranscribe && data) transcribeVideoOnSave(data.id, data.title, email, !!data.is_embed);
      } else {
        // Insert new video
        const { data, error } = await supabase
          .from('custom_onboarding_videos')
          .insert({
            agency_id: primaryAgencyId,
            ...videoData,
            tiers: ['basic', 'advanced', 'elite']
          })
          .select()
          .single();

        if (error) throw error;

        setCustomVideos(prev => [...prev, data]);
        toast.success("Custom video saved!");
        if (autoTranscribe && data) transcribeVideoOnSave(data.id, data.title, email, !!data.is_embed);
      }

      setShowCustomVideoDialog(false);
      resetForm();
    } catch (error) {
      console.error('Error saving video:', error);
      toast.error("Failed to save video");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteCustomVideo = async (videoId: string) => {
    try {
      const { error } = await supabase
        .from('custom_onboarding_videos')
        .delete()
        .eq('id', videoId);

      if (error) throw error;

      setCustomVideos(prev => prev.filter(v => v.id !== videoId));
      toast.success("Video deleted");
    } catch (error) {
      console.error('Error deleting video:', error);
      toast.error("Failed to delete video");
    }
  };

  const toggleVideoTier = async (videoId: string, tier: string, isEnabled: boolean) => {
    const video = customVideos.find(v => v.id === videoId);
    if (!video) return;

    const currentTiers = video.tiers || [];
    const newTiers = isEnabled 
      ? [...currentTiers, tier]
      : currentTiers.filter(t => t !== tier);

    try {
      const { error } = await supabase
        .from('custom_onboarding_videos')
        .update({ tiers: newTiers })
        .eq('id', videoId);

      if (error) throw error;

      setCustomVideos(prev => prev.map(v => 
        v.id === videoId ? { ...v, tiers: newTiers } : v
      ));
    } catch (error) {
      console.error('Error updating video tiers:', error);
      toast.error("Failed to update video");
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    setShowCustomVideoDialog(open);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Info banner about custom videos being shared */}
      <Alert className="bg-amber-500/10 border-amber-500/20">
        <Info className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-700 text-sm">
          Custom videos are shared across all plans. Use the tier toggles below to control which plans can see each video.
        </AlertDescription>
      </Alert>

      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Upload and manage custom training videos for your clients.
        </p>
        <Button 
          onClick={openCreateDialog}
          variant="outline"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Upload Custom Video
        </Button>
      </div>

      {customVideos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
          <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg mb-2">No custom videos yet</p>
          <p className="text-sm">Upload your first video to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {customVideos.map((video) => (
            <div key={video.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{video.title}</h4>
                    {video.transcription_status === "success" && video.transcription && (
                      <span
                        className="relative inline-flex items-center"
                        title="Transcribed and added to training document"
                      >
                        <Mic className="w-5 h-5 text-green-600" />
                        <CircleCheck className="w-3 h-3 text-green-600 absolute -bottom-1 -right-1 bg-white rounded-full" />
                      </span>
                    )}
                    {video.transcription_status === "processing" && (
                      <span title="Transcribing...">
                        <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{video.description}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <span className="px-2 py-1 bg-muted rounded">
                      {video.module_type === 'custom' 
                        ? `Custom: ${video.custom_module_title}` 
                        : `Module: ${video.existing_module_id}`}
                    </span>
                    <span className="px-2 py-1 bg-muted rounded">
                      Order: {video.lesson_order}
                    </span>
                    <span className="px-2 py-1 bg-muted rounded">
                      {video.is_embed ? 'Embed Code' : 'URL'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(video)}
                    title="Edit video"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteCustomVideo(video.id)}
                    title="Delete video"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center gap-4 pt-2 border-t">
                <span className="text-sm font-medium">Show in:</span>
                <div className="flex gap-4">
                  {(['basic', 'advanced', 'elite'] as const).map((tier) => {
                    const tierAgencyId = availableTiers[tier];
                    const isDisabled = !tierAgencyId;
                    const tierLabel = tier === 'basic' ? 'Plan 1' : tier === 'advanced' ? 'Plan 2' : 'Plan 3';
                    
                    return (
                      <label key={tier} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={(video.tiers || []).includes(tier)}
                          onChange={(e) => toggleVideoTier(video.id, tier, e.target.checked)}
                          className="rounded border-gray-300"
                          disabled={isDisabled}
                        />
                        <span className={isDisabled ? 'text-muted-foreground' : ''}>
                          {tierLabel}
                          {isDisabled && ' (not created)'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Custom Video Create/Edit Dialog */}
      <Dialog open={showCustomVideoDialog} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingVideoId ? 'Edit Custom Video' : 'Upload Custom Video'}</DialogTitle>
            <DialogDescription>
              {editingVideoId 
                ? 'Update the video details below' 
                : 'Add a custom video to your onboarding experience'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {/* Module Type Selection */}
            <div className="space-y-2">
              <Label>Module Type</Label>
              <Select 
                value={customVideoForm.moduleType} 
                onValueChange={(value: 'existing' | 'custom') => setCustomVideoForm(prev => ({ 
                  ...prev, 
                  moduleType: value,
                  customModuleTitle: value === 'existing' ? '' : prev.customModuleTitle,
                  existingModuleId: value === 'custom' ? '' : prev.existingModuleId
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="existing">Add to Existing Module</SelectItem>
                  <SelectItem value="custom">Create Custom Module</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Module Title (if custom) */}
            {customVideoForm.moduleType === 'custom' && (
              <div className="space-y-2">
                <Label>Custom Module Title *</Label>
                <Input
                  placeholder="e.g., Getting Started"
                  value={customVideoForm.customModuleTitle}
                  onChange={(e) => setCustomVideoForm(prev => ({ ...prev, customModuleTitle: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">This module will appear above "Foundational Setup"</p>
              </div>
            )}

            {/* Existing Module Selection (if existing) */}
            {customVideoForm.moduleType === 'existing' && (
              <div className="space-y-2">
                <Label>Select Existing Module *</Label>
                <Select 
                  value={customVideoForm.existingModuleId} 
                  onValueChange={(value) => setCustomVideoForm(prev => ({ ...prev, existingModuleId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a module" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Default modules */}
                    <SelectItem value="foundational-setup">Foundational Setup</SelectItem>
                    <SelectItem value="marketing-lead-generation">Marketing & Lead Generation</SelectItem>
                    <SelectItem value="sales-conversation">Sales & Conversation</SelectItem>
                    <SelectItem value="website-content">Website & Content</SelectItem>
                    <SelectItem value="commerce">Commerce</SelectItem>
                    
                    {/* User-created custom modules */}
                    {(() => {
                      const customModules = customVideos
                        .filter(v => v.module_type === 'custom' && v.custom_module_title)
                        .map(v => v.custom_module_title!)
                        .filter((title, index, self) => self.indexOf(title) === index);
                      
                      if (customModules.length > 0) {
                        return (
                          <>
                            <div className="py-1 px-2 text-xs text-muted-foreground border-t mt-1 pt-2">Your Custom Modules</div>
                            {customModules.map((title) => (
                              <SelectItem key={`custom-${title}`} value={`custom:${title}`}>
                                {title}
                              </SelectItem>
                            ))}
                          </>
                        );
                      }
                      return null;
                    })()}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Custom modules you create will appear here for adding more videos
                </p>
              </div>
            )}

            {/* Lesson Order */}
            <div className="space-y-2">
              <Label>Lesson Order *</Label>
              <Input
                type="number"
                min="1"
                placeholder="1"
                value={customVideoForm.lessonOrder}
                onChange={(e) => setCustomVideoForm(prev => ({ ...prev, lessonOrder: parseInt(e.target.value) || 1 }))}
              />
              <p className="text-xs text-muted-foreground">1 = top of the list, higher numbers appear lower</p>
            </div>

            {/* Module Order */}
            <div className="space-y-2">
              <Label>Module Order *</Label>
              <Input
                type="number"
                min="1"
                placeholder="1"
                value={customVideoForm.moduleOrder}
                onChange={(e) => setCustomVideoForm(prev => ({ ...prev, moduleOrder: parseInt(e.target.value) || 1 }))}
              />
              <p className="text-xs text-muted-foreground">Controls where this module appears (1 = top). Applies to the whole module.</p>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label>Video Title *</Label>
              <Input
                placeholder="e.g., Welcome to Our Platform"
                value={customVideoForm.title}
                onChange={(e) => setCustomVideoForm(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Description *</Label>
              <Input
                placeholder="Brief description of what this video covers"
                value={customVideoForm.description}
                onChange={(e) => setCustomVideoForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            {/* Video Type Selection */}
            <div className="space-y-2">
              <Label>Video Type *</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={customVideoForm.videoType === 'url' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setCustomVideoForm(prev => ({ ...prev, videoType: 'url' }))}
                >
                  URL
                </Button>
                <Button
                  type="button"
                  variant={customVideoForm.videoType === 'embed' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setCustomVideoForm(prev => ({ ...prev, videoType: 'embed' }))}
                >
                  Embed Code
                </Button>
              </div>
            </div>

            {/* Video URL or Embed Code */}
            <div className="space-y-2">
              <Label>{customVideoForm.videoType === 'url' ? 'Video Link' : 'Embed Code'} *</Label>
              {customVideoForm.videoType === 'url' ? (
                <Input
                  placeholder="https://youtube.com/..."
                  value={customVideoForm.videoUrl}
                  onChange={(e) => setCustomVideoForm(prev => ({ ...prev, videoUrl: e.target.value }))}
                />
              ) : (
                <Textarea
                  placeholder="<iframe src=&quot;...&quot;></iframe>"
                  value={customVideoForm.videoUrl}
                  onChange={(e) => setCustomVideoForm(prev => ({ ...prev, videoUrl: e.target.value }))}
                  rows={4}
                  className="font-mono text-xs"
                />
              )}
              <p className="text-xs text-muted-foreground">
                {customVideoForm.videoType === 'url' 
                  ? "Enter a YouTube, Vimeo, or other video URL" 
                  : "Paste your embed code (e.g., iframe from YouTube, Vimeo, Loom, etc.)"}
              </p>
            </div>

            <TranscribeOnSaveCheckbox id="panel-auto-transcribe" checked={autoTranscribe} onChange={setAutoTranscribe} />

            <div className="flex gap-3 pt-4">
              <Button 
                onClick={saveCustomVideo}
                disabled={isSaving}
                className="flex-1"
              >
                {isSaving ? "Saving..." : (editingVideoId ? "Update Video" : "Save Video")}
              </Button>
              <Button 
                variant="outline"
                onClick={() => handleDialogClose(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomVideosPanel;
