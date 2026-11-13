import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, ArrowRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getV2HomeSettingsDefaults } from "@/constants/homeSettingsDefaults";
import { useGhl } from "@/components/highlevel/useGhl";
import { useUser } from "@/contexts/UserContext";
import MultiPlanConnectionNotice from "@/components/highlevel/MultiPlanConnectionNotice";

interface SyncPlansDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agencyVersions: {
    basic_id: string | null;
    advanced_id: string | null;
    elite_id: string | null;
  };
  onSyncComplete: () => void;
}

type PlanOption = 'plan1' | 'plan2' | 'plan3';

const SyncPlansDialog = ({ open, onOpenChange, agencyVersions, onSyncComplete }: SyncPlansDialogProps) => {
  const { plan } = useUser();
  const connection = useGhl(agencyVersions.basic_id);
  const [parentPlan, setParentPlan] = useState<PlanOption | ''>('');
  const [childPlan, setChildPlan] = useState<PlanOption | ''>('');
  const [isSyncing, setIsSyncing] = useState(false);

  const getPlanAgencyId = (plan: PlanOption): string | null => {
    switch (plan) {
      case 'plan1': return agencyVersions.basic_id;
      case 'plan2': return agencyVersions.advanced_id;
      case 'plan3': return agencyVersions.elite_id;
      default: return null;
    }
  };

  const getPlanLabel = (plan: PlanOption): string => {
    switch (plan) {
      case 'plan1': return 'Plan 1';
      case 'plan2': return 'Plan 2';
      case 'plan3': return 'Plan 3';
      default: return '';
    }
  };

  const availablePlans: PlanOption[] = (['plan1', 'plan2', 'plan3'] as PlanOption[]).filter(plan => {
    const id = getPlanAgencyId(plan);
    return id !== null;
  });

  const handleSync = async () => {
    if (plan !== "ADVANCED" || !connection.connected) {
      toast.error("Connect HighLevel in Settings and use Advanced before syncing plans.");
      return;
    }
    if (!parentPlan || !childPlan) {
      toast.error("Please select both parent and child plans");
      return;
    }

    if (parentPlan === childPlan) {
      toast.error("Parent and child plans cannot be the same");
      return;
    }

    const parentAgencyId = getPlanAgencyId(parentPlan);
    const childAgencyId = getPlanAgencyId(childPlan);

    if (!parentAgencyId || !childAgencyId) {
      toast.error("Selected plans must have URLs created first");
      return;
    }

    setIsSyncing(true);
    try {
      // 1. Fetch parent v2_home_settings
      const { data: parentHomeSettings, error: homeError } = await supabase
        .from('v2_home_settings')
        .select('*')
        .eq('agency_id', parentAgencyId)
        .maybeSingle();

      if (homeError) throw homeError;

      // 2. Fetch parent daily checklist items
      const { data: parentChecklist, error: checklistError } = await supabase
        .from('agency_daily_checklist')
        .select('item_1, item_2, item_3')
        .eq('agency_id', parentAgencyId)
        .maybeSingle();

      if (checklistError) throw checklistError;

      // 3. Fetch parent onboarding checklist items
      const { data: parentOnboardingItems, error: onboardingError } = await supabase
        .from('agency_onboarding_checklist')
        .select('title, description, item_order, link_to, link_url, linked_video')
        .eq('agency_id', parentAgencyId)
        .order('item_order', { ascending: true });

      if (onboardingError) throw onboardingError;

      // 4. Update/insert child v2_home_settings
      if (parentHomeSettings) {
        // Remove id and agency_id from parent data to avoid conflicts
        const { id: _id, agency_id: _agencyId, created_at: _createdAt, ...settingsToSync } = parentHomeSettings;
        
        // Check if child has settings row
        const { data: existingChild } = await supabase
          .from('v2_home_settings')
          .select('id')
          .eq('agency_id', childAgencyId)
          .maybeSingle();

        if (existingChild) {
          // Update existing
          const { error: updateError } = await supabase
            .from('v2_home_settings')
            .update({ ...settingsToSync, updated_at: new Date().toISOString() })
            .eq('agency_id', childAgencyId);
          
          if (updateError) throw updateError;
        } else {
          // Insert new
          const { error: insertError } = await supabase
            .from('v2_home_settings')
            .insert({ 
              ...getV2HomeSettingsDefaults(childAgencyId),
              ...settingsToSync,
              agency_id: childAgencyId 
            });
          
          if (insertError) throw insertError;
        }
      }

      // 5. Update/insert child daily checklist
      if (parentChecklist) {
        const { data: existingChildChecklist } = await supabase
          .from('agency_daily_checklist')
          .select('id')
          .eq('agency_id', childAgencyId)
          .maybeSingle();

        if (existingChildChecklist) {
          const { error: updateError } = await supabase
            .from('agency_daily_checklist')
            .update({ 
              item_1: parentChecklist.item_1,
              item_2: parentChecklist.item_2,
              item_3: parentChecklist.item_3,
              updated_at: new Date().toISOString()
            })
            .eq('agency_id', childAgencyId);
          
          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase
            .from('agency_daily_checklist')
            .insert({
              agency_id: childAgencyId,
              item_1: parentChecklist.item_1,
              item_2: parentChecklist.item_2,
              item_3: parentChecklist.item_3
            });
          
          if (insertError) throw insertError;
        }
      }

      // 6. Replace child onboarding checklist items
      if (parentOnboardingItems && parentOnboardingItems.length > 0) {
        // Delete existing child onboarding items
        await supabase
          .from('agency_onboarding_checklist')
          .delete()
          .eq('agency_id', childAgencyId);

        // Insert parent items with new agency_id
        const itemsToInsert = parentOnboardingItems.map(item => ({
          agency_id: childAgencyId,
          title: item.title,
          description: item.description,
          item_order: item.item_order,
          link_to: item.link_to,
          link_url: item.link_url,
          linked_video: item.linked_video
        }));

        const { error: insertError } = await supabase
          .from('agency_onboarding_checklist')
          .insert(itemsToInsert);

        if (insertError) throw insertError;
      }

      toast.success(`Successfully synced ${getPlanLabel(parentPlan)} → ${getPlanLabel(childPlan)}`);
      onSyncComplete();
      onOpenChange(false);
      setParentPlan('');
      setChildPlan('');
    } catch (error) {
      console.error('Error syncing plans:', error);
      toast.error("Failed to sync plans. Please try again.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClose = () => {
    if (!isSyncing) {
      onOpenChange(false);
      setParentPlan('');
      setChildPlan('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-primary" />
            Sync Plans
          </DialogTitle>
          <DialogDescription>
            Copy all settings from one plan to another. This will overwrite the child plan's settings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!connection.connected && <MultiPlanConnectionNotice />}
          {availablePlans.length < 2 ? (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">At least 2 plan URLs required</p>
                <p className="text-amber-700 mt-1">
                  Create URLs for at least two plans before you can sync settings between them.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="parent-plan" className="text-sm font-medium">
                    Parent Plan (source)
                  </Label>
                  <Select value={parentPlan} onValueChange={(v) => setParentPlan(v as PlanOption)}>
                    <SelectTrigger id="parent-plan" className="w-full bg-background">
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePlans.map(plan => (
                        <SelectItem key={plan} value={plan} disabled={plan === childPlan}>
                          {getPlanLabel(plan)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-6" />

                <div className="flex-1 space-y-2">
                  <Label htmlFor="child-plan" className="text-sm font-medium">
                    Child Plan (target)
                  </Label>
                  <Select value={childPlan} onValueChange={(v) => setChildPlan(v as PlanOption)}>
                    <SelectTrigger id="child-plan" className="w-full bg-background">
                      <SelectValue placeholder="Select target" />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePlans.map(plan => (
                        <SelectItem key={plan} value={plan} disabled={plan === parentPlan}>
                          {getPlanLabel(plan)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {parentPlan && childPlan && parentPlan !== childPlan && (
                <div className="p-3 rounded-lg bg-muted/50 border text-sm space-y-1">
                  <p className="font-medium">This will copy:</p>
                  <ul className="text-muted-foreground list-disc list-inside space-y-0.5">
                    <li>Welcome message & video settings</li>
                    <li>Announcements configuration</li>
                    <li>Custom links</li>
                    <li>Tab names</li>
                    <li>AI chat settings</li>
                    <li>Daily checklist items</li>
                    <li>Onboarding checklist items</li>
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isSyncing}>
            Cancel
          </Button>
          {availablePlans.length >= 2 && (
            <Button 
              onClick={handleSync} 
              disabled={!parentPlan || !childPlan || parentPlan === childPlan || isSyncing || !connection.connected || plan !== "ADVANCED"}
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Sync Plans
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SyncPlansDialog;
