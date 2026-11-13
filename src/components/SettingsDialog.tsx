import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import { TextUsLink } from "@/components/TextUsLink";
import { supportSmsUrl } from "@/lib/supportContact";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Phone, ExternalLink, LayoutDashboard, Sparkles, UserPlus, Trash2, Users, AlertTriangle } from "lucide-react";
import UpgradeDialog from "@/components/UpgradeDialog";
import { toAgencySlug, agencyIdentifiersMatch } from "@/utils/agencySlug";
import DeleteAccountSection from '@/components/settings/DeleteAccountSection';

interface AccountAdmin {
  id: string;
  admin_email: string;
  admin_name: string | null;
  status: string;
  invited_at: string;
}

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { email, clearUser, hideBonuses, setHideBonuses } = useUser();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Profile state
  const [name, setName] = useState("");
  const [userEmail, setUserEmail] = useState(email || "");
  const [agencyName, setAgencyName] = useState("");
  const [currentAgencyId, setCurrentAgencyId] = useState<string | null>(null);
  const [showAgencyWarning, setShowAgencyWarning] = useState(false);
  
  // Cancellation flow state
  const [showCancelFlow, setShowCancelFlow] = useState(false);
  const [cancelStep, setCancelStep] = useState(1);
  const [cancelReason, setCancelReason] = useState("");
  const [hasOnboardingCall, setHasOnboardingCall] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  // 'cancel' = subscription cancellation (existing), 'delete' = full profile deletion
  const [flowMode, setFlowMode] = useState<'cancel' | 'delete'>('cancel');
  const [deleteComplete, setDeleteComplete] = useState(false);
  
  const cancelReasons = [
    "Missing features",
    "Having trouble setting up", 
    "Too expensive",
    "Not using enough",
    "Technical issues",
    "Unsatisfactory customer experience",
    "Went out of business",
    "Signing up for a different account",
    "Switching to a different product"
  ];

  // Classic View state (inverse of v2_navigation_enabled)
  const [classicViewEnabled, setClassicViewEnabled] = useState(false);

  // Account Admins state
  const [accountAdmins, setAccountAdmins] = useState<AccountAdmin[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminName, setNewAdminName] = useState("");
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  useEffect(() => {
    if (email) {
      setUserEmail(email);
      loadUserProfile();
      loadAccountAdmins();
    }
  }, [email]);

  const loadUserProfile = async () => {
    if (!email) return;
    
    try {
      const { data: userData, error } = await supabase
        .from('saas_suite_users')
        .select('full_name, agency_name, agency_id, v2_navigation_enabled')
        .ilike('email', email)
        .maybeSingle();
      
      if (error) {
        console.error('Error loading profile:', error);
        return;
      }
      
      if (userData) {
        setName(userData.full_name || "");
        setAgencyName(userData.agency_name || "");
        setCurrentAgencyId(userData.agency_id || null);
        setClassicViewEnabled(!((userData as any).v2_navigation_enabled ?? true));
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  // Check for agency name/ID mismatch when agency name changes
  useEffect(() => {
    if (currentAgencyId && agencyName) {
      const newSlug = toAgencySlug(agencyName);
      const matches = agencyIdentifiersMatch(agencyName, currentAgencyId);
      setShowAgencyWarning(!matches && !!newSlug && newSlug !== currentAgencyId);
    } else {
      setShowAgencyWarning(false);
    }
  }, [agencyName, currentAgencyId]);

  const loadAccountAdmins = async () => {
    if (!email) return;
    setLoadingAdmins(true);
    
    try {
      const { data, error } = await supabase
        .from('account_admins')
        .select('*')
        .eq('owner_email', email)
        .order('invited_at', { ascending: false });
      
      if (error) {
        console.error('Error loading account admins:', error);
        return;
      }
      
      setAccountAdmins((data || []) as AccountAdmin[]);
    } catch (error) {
      console.error('Error loading account admins:', error);
    } finally {
      setLoadingAdmins(false);
    }
  };

  const handleAddAdmin = async () => {
    if (!email || !newAdminEmail) return;
    
    setIsAddingAdmin(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('invite-account-admin', {
        body: {
          owner_email: email,
          admin_email: newAdminEmail.trim().toLowerCase(),
          admin_name: newAdminName || undefined
        }
      });

      if (error) throw error;
      
      if (data?.error) {
        toast({
          title: "Error",
          description: data.error,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Admin Invited",
        description: `Invitation sent to ${newAdminEmail}`
      });
      
      setNewAdminEmail("");
      setNewAdminName("");
      loadAccountAdmins();
    } catch (error: any) {
      console.error('Error adding admin:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add admin. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsAddingAdmin(false);
    }
  };

  const handleRemoveAdmin = async (adminId: string, adminEmail: string) => {
    try {
      const { data: removed, error } = await supabase
        .from('account_admins')
        .delete()
        .eq('id', adminId)
        .select('id');
      
      if (error) throw error;
      if (!removed || removed.length === 0) throw new Error("You don't have permission to remove this admin.");
      
      toast({
        title: "Admin Removed",
        description: `${adminEmail} has been removed as an admin`
      });
      
      loadAccountAdmins();
    } catch (error) {
      console.error('Error removing admin:', error);
      toast({
        title: "Error",
        description: "Failed to remove admin. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleClassicViewToggle = async (enabled: boolean) => {
    if (!email) return;
    
    setClassicViewEnabled(enabled);
    
    try {
      const { error } = await supabase
        .from('saas_suite_users')
        .update({ v2_navigation_enabled: !enabled } as any)
        .ilike('email', email);
      
      if (error) throw error;
      
      toast({
        title: enabled ? "Classic View Enabled" : "Classic View Disabled",
        description: enabled ? "Legacy tabs are now visible." : "Using the modern navigation."
      });
      
      window.dispatchEvent(new CustomEvent('user-settings-changed'));
    } catch (error) {
      console.error('Error updating classic view:', error);
      setClassicViewEnabled(!enabled);
      toast({
        title: "Error",
        description: "Failed to update setting. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleContact = () => {
    window.location.href = supportSmsUrl("HELP");
  };

  const handleUpgrade = () => {
    setShowUpgradeDialog(true);
  };

  const handleCancelNext = () => {
    if (cancelStep === 1 && !cancelReason) {
      toast({
        title: "Please select a reason",
        description: "You must select a reason to continue.",
        variant: "destructive"
      });
      return;
    }
    
    if (cancelStep === 2 && !hasOnboardingCall) {
      toast({
        title: "Please select an option",
        description: "You must select whether you've had your onboarding call.",
        variant: "destructive"
      });
      return;
    }
    
    if (cancelStep < 3) {
      setCancelStep(cancelStep + 1);
    }
  };

  const handleBookOnboarding = () => {
    window.open("https://saassuite.ai/book", '_blank');
  };

  const handleFinalCancel = async () => {
    if (!confirmCancel) {
      toast({
        title: "Please confirm",
        description: "You must check the confirmation box to proceed.",
        variant: "destructive"
      });
      return;
    }

    setIsCanceling(true);

    // Profile deletion path
    if (flowMode === 'delete') {
      try {
        const { data, error } = await supabase.functions.invoke('delete-user-account');
        if (error || (data as any)?.error) {
          throw new Error(error?.message || (data as any)?.error || 'Delete failed');
        }
        setIsCanceling(false);
        setDeleteComplete(true);
        // Sign out & redirect after showing the goodbye screen
        setTimeout(async () => {
          try { await (await import("@/lib/hardSignOut")).hardSignOut(); } catch {}
          window.location.href = '/';
        }, 3500);
      } catch (err: any) {
        console.error('Error deleting account:', err);
        toast({
          title: 'Error',
          description: err.message || 'Failed to delete profile. Please try again.',
          variant: 'destructive',
        });
        setIsCanceling(false);
      }
      return;
    }

    try {
      // Use suspend_user_access to preserve agency IDs with "NO" suffix
      const { data, error } = await supabase.rpc('suspend_user_access', {
        user_email: email
      });

      if (error) {
        console.error('Error canceling account:', error);
        toast({
          title: "Error",
          description: "Failed to cancel account. Please try again.",
          variant: "destructive"
        });
        setIsCanceling(false);
        return;
      }

      // Show redirect message
      toast({
        title: "Redirecting to Billing Portal",
        description: "Please finalize your cancellation in the billing portal.",
      });

      // Wait a moment then redirect to Stripe billing portal
      setTimeout(() => {
        clearUser();
        window.location.href = "https://billing.stripe.com/p/login/bIY04697i9jzghy4gg";
      }, 2000);

    } catch (error) {
      console.error('Error canceling account:', error);
      toast({
        title: "Error", 
        description: "Failed to cancel account. Please try again.",
        variant: "destructive"
      });
      setIsCanceling(false);
    }
  };

  const resetCancelFlow = () => {
    setShowCancelFlow(false);
    setCancelStep(1);
    setCancelReason("");
    setHasOnboardingCall("");
    setConfirmCancel(false);
    setIsCanceling(false);
    setFlowMode('cancel');
  };

  if (deleteComplete) {
    return (
      <Dialog open={open} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <div className="text-center py-10">
            <div className="text-6xl mb-4">☹️</div>
            <h3 className="text-xl font-semibold mb-2">Sorry to see you go!</h3>
            <p className="text-muted-foreground">
              Your account has been deleted. Redirecting you to the home page…
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (isCanceling) {
    return (
      <Dialog open={open} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">We're sorry to see you go!</h3>
            <p className="text-muted-foreground">
              {flowMode === 'delete' ? 'Deleting your profile...' : 'Closing your account...'}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (showCancelFlow) {
    return (
      <Dialog open={open} onOpenChange={resetCancelFlow}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {flowMode === 'delete' ? 'Delete Profile' : 'Cancel Subscription'} - Step {cancelStep} of 3
            </DialogTitle>
          </DialogHeader>
          
          {cancelStep === 1 && (
            <div className="space-y-4">
              <div>
                <Label className="text-base font-medium">Why do you want to cancel?</Label>
                <RadioGroup value={cancelReason} onValueChange={setCancelReason} className="mt-3">
                  {cancelReasons.map((reason) => (
                    <div key={reason} className="flex items-center space-x-2">
                      <RadioGroupItem value={reason} id={reason} />
                      <Label htmlFor={reason} className="text-sm">{reason}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={resetCancelFlow}>Back</Button>
                <Button onClick={handleCancelNext}>Next</Button>
              </div>
            </div>
          )}

          {cancelStep === 2 && (
            <div className="space-y-4">
              <div>
                <Label className="text-base font-medium">Have you had your onboarding call?</Label>
                <RadioGroup value={hasOnboardingCall} onValueChange={setHasOnboardingCall} className="mt-3">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="yes" />
                    <Label htmlFor="yes">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="no" />
                    <Label htmlFor="no">No</Label>
                  </div>
                </RadioGroup>
              </div>
              
              {hasOnboardingCall === "no" && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground mb-3">
                    Consider booking an onboarding call first - it might help resolve your concerns!
                  </p>
                  <Button onClick={handleBookOnboarding} className="w-full">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Book your onboarding call
                  </Button>
                </div>
              )}
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setCancelStep(1)}>Back</Button>
                <Button onClick={handleCancelNext}>Next</Button>
              </div>
            </div>
          )}

          {cancelStep === 3 && (
            <div className="space-y-4">
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-foreground">
                  {flowMode === 'delete'
                    ? 'By accepting below, you understand that your profile, agency ID, and all related data will be permanently deleted. This cannot be undone, and any live onboarding links will immediately stop functioning.'
                    : 'By accepting below, you understand that your account will be deleted immediately, any customizations will not be recoverable, and any live onboarding links will immediately stop functioning.'}
                </p>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="confirm-cancel" 
                  checked={confirmCancel}
                  onCheckedChange={(checked) => setConfirmCancel(!!checked)}
                />
                <Label htmlFor="confirm-cancel" className="text-sm">
                  {flowMode === 'delete'
                    ? 'I understand and want to permanently delete my profile'
                    : 'I understand and want to proceed with cancellation'}
                </Label>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setCancelStep(2)}>Back</Button>
                <Button 
                  variant="destructive" 
                  onClick={handleFinalCancel}
                  disabled={!confirmCancel}
                >
                  {flowMode === 'delete' ? 'Delete Profile' : 'Cancel Now'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="admins">Admins</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
          </TabsList>
          
          <TabsContent value="profile" className="space-y-4">
            <div className="grid gap-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                />
              </div>
              
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="Enter your email"
                  disabled
                />
              </div>
              
              <div>
                <Label htmlFor="agency">Agency Name</Label>
                <Input
                  id="agency"
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  placeholder="Enter your agency name"
                />
                {agencyName && (
                  <p className="text-xs text-muted-foreground mt-1">
                    URL slug: <span className="font-mono">{toAgencySlug(agencyName)}</span>
                  </p>
                )}
              </div>

              {/* Warning when agency name changes from current agency_id */}
              {showAgencyWarning && (
                <Alert className="border-amber-300 bg-amber-50">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    <strong>Warning:</strong> Changing your agency name will update all your onboarding URLs.
                    Your current URL slug "<span className="font-mono">{currentAgencyId}</span>" will change to 
                    "<span className="font-mono">{toAgencySlug(agencyName)}</span>".
                    Any existing shared links will need to be updated.
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="hide-bonuses">Hide Bonuses</Label>
                  <p className="text-xs text-muted-foreground">Hide Email Warmup and My Free Leads tabs</p>
                </div>
                <Switch
                  id="hide-bonuses"
                  checked={hideBonuses}
                  onCheckedChange={setHideBonuses}
                />
              </div>

              {/* Classic View Toggle (opt-out from V2 navigation) */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <Label htmlFor="classic-view-toggle">Switch to Classic View</Label>
                    <p className="text-xs text-muted-foreground">Show legacy Onboarding Tool and Support Features tabs</p>
                  </div>
                </div>
                <Switch
                  id="classic-view-toggle"
                  checked={classicViewEnabled}
                  onCheckedChange={handleClassicViewToggle}
                />
              </div>
            </div>

            <Button
              onClick={async () => {
                if (!email) return;
                
                try {
                  // Agency IDs (and Plan 1/2/3 URLs) are set by the database from the agency name.
                  const { data: updated, error } = await (supabase as any).rpc('update_account_profile', {
                    p_email: email,
                    p_full_name: name || '',
                    p_phone: null,
                    p_agency_name: agencyName || '',
                  });
                  
                  if (error) throw error;
                  const newId = (updated?.[0] as any)?.agency_id;
                  if (newId) setCurrentAgencyId(newId);
                  setShowAgencyWarning(false);
                  
                  toast({
                    title: "Settings Saved",
                    description: "Your profile has been updated successfully."
                  });
                } catch (error: any) {
                  console.error('Error saving profile:', error);
                  toast({
                    title: "Error",
                    description: error?.code === '23505'
                      ? "That agency name is already used by another account. Try a slightly different name."
                      : `Failed to save profile.${error?.message ? ` (${error.message})` : ''}`,
                    variant: "destructive"
                  });
                }
              }}
              className="w-full"
            >
              Save Profile
            </Button>

            <DeleteAccountSection />
          </TabsContent>

          <TabsContent value="admins" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="font-medium">Account Admins</h3>
                  <p className="text-xs text-muted-foreground">Add users who can help manage your account</p>
                </div>
              </div>

              {/* Add new admin form */}
              <div className="p-4 border rounded-lg space-y-3">
                <div>
                  <Label htmlFor="admin-email">Admin Email</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    placeholder="Enter admin's email address"
                  />
                </div>
                <div>
                  <Label htmlFor="admin-name">Admin Name (optional)</Label>
                  <Input
                    id="admin-name"
                    value={newAdminName}
                    onChange={(e) => setNewAdminName(e.target.value)}
                    placeholder="Enter admin's name"
                  />
                </div>
                <Button 
                  onClick={handleAddAdmin}
                  disabled={!newAdminEmail || isAddingAdmin}
                  className="w-full"
                >
                  {isAddingAdmin ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending Invitation...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Add Admin
                    </>
                  )}
                </Button>
              </div>

              {/* List of admins */}
              <div className="space-y-2">
                <Label>Current Admins</Label>
                {loadingAdmins ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : accountAdmins.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground bg-muted rounded-lg">
                    No admins added yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {accountAdmins.map((admin) => (
                      <div 
                        key={admin.id} 
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-sm">{admin.admin_name || admin.admin_email}</p>
                          {admin.admin_name && (
                            <p className="text-xs text-muted-foreground">{admin.admin_email}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <Badge 
                              variant={admin.status === 'accepted' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {admin.status === 'accepted' ? 'Active' : 'Pending'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Invited {new Date(admin.invited_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon" aria-label="Delete"
                          onClick={() => handleRemoveAdmin(admin.id, admin.admin_email)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="billing" className="space-y-4">
            <div className="grid gap-3">
              <Button 
                variant="outline" 
                onClick={handleContact}
                className="justify-start"
              >
                <Phone className="w-4 h-4 mr-2" />
                Contact Support
              </Button>
              
              <Button 
                onClick={handleUpgrade}
                className="justify-start"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Upgrade Plan
              </Button>
              
              <Button 
                variant="destructive" 
                onClick={() => setShowCancelFlow(true)}
                className="justify-start"
              >
                Cancel Subscription
              </Button>
            </div>
            
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Contact Support:</strong> <TextUsLink message="HELP" variant="inline" icon={false} className="font-normal text-foreground">Text Us</TextUsLink> for immediate assistance.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
      
      <UpgradeDialog 
        open={showUpgradeDialog} 
        onOpenChange={setShowUpgradeDialog} 
      />
    </Dialog>
  );
}