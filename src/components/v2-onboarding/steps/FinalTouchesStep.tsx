import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  Palette, 
  UserCheck, 
  Headphones, 
  Link2, 
  ClipboardList,
  Plus,
  Trash2,
  Check,
  Mail,
  User,
  Users,
  LogIn,
  HelpCircle,
  Webhook,
  Save,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { OnboardingData } from "../V2OnboardingWizard";
import BrandingTool from "@/components/BrandingTool";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface FinalTouchesStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  agencyId: string | null;
}

interface ChecklistItem {
  id?: string;
  title: string;
  description: string;
  link_to: string;
  link_url: string;
  item_order: number;
}

const FinalTouchesStep = ({ data, updateData, agencyId }: FinalTouchesStepProps) => {
  const { email, plan } = useUser();
  const userPlan = plan || "ADVANCED";
  const isLoginForced = userPlan === "STARTER" || userPlan === "BASIC";
  const [isSaving, setIsSaving] = useState(false);
  
  // Login tracking state  
  const [loginEnabled, setLoginEnabled] = useState(true);
  const [loginWith, setLoginWith] = useState<'EMAIL' | 'NAME' | 'BOTH'>('EMAIL');
  const [loginWelcomeHeadline, setLoginWelcomeHeadline] = useState('Welcome to Your Client Hub');
  const [loginWelcomeSubheadline, setLoginWelcomeSubheadline] = useState('Enter your details to access your dashboard');
  
  // Support state
  const [aiChatEnabled, setAiChatEnabled] = useState(false);
  const [supportTicketingEnabled, setSupportTicketingEnabled] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [tempWebhookUrl, setTempWebhookUrl] = useState("");
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  
  // Helpful links state
  const [linksEnabled, setLinksEnabled] = useState(data.features.helpfulLinks);
  const [links, setLinks] = useState([
    { text: "", url: "", color: "#3b82f6" },
    { text: "", url: "", color: "#3b82f6" },
    { text: "", url: "", color: "#3b82f6" },
  ]);
  
  // Onboarding checklist state
  const [checklistEnabled, setChecklistEnabled] = useState(data.features.onboardingChecklist);
  const [checklistTitle, setChecklistTitle] = useState("Daily Checklist");
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);

  // Load existing settings
  useEffect(() => {
    const loadSettings = async () => {
      if (!agencyId || !email) return;

      try {
        // Load v2_home_settings
        const { data: homeSettings } = await supabase
          .from("v2_home_settings")
          .select("*")
          .eq("agency_id", agencyId)
          .maybeSingle();

        if (homeSettings) {
          setAiChatEnabled(homeSettings.ai_chat_enabled);
          setChecklistTitle(homeSettings.checklist_title || "Daily Checklist");
          
          // Load links
          setLinks([
            { 
              text: homeSettings.custom_link_1_text || "", 
              url: homeSettings.custom_link_1_url || "", 
              color: homeSettings.custom_link_1_color || "#3b82f6" 
            },
            { 
              text: homeSettings.custom_link_2_text || "", 
              url: homeSettings.custom_link_2_url || "", 
              color: homeSettings.custom_link_2_color || "#3b82f6" 
            },
            { 
              text: homeSettings.custom_link_3_text || "", 
              url: homeSettings.custom_link_3_url || "", 
              color: homeSettings.custom_link_3_color || "#3b82f6" 
            },
          ]);
          
          setLinksEnabled(homeSettings.custom_links_enabled);
        }

        // Load user settings
        const { data: userSettings } = await supabase
          .from("saas_suite_users")
          .select("support_ticketing_enabled, login_enabled, login_with, login_welcome_headline, login_welcome_subheadline, support_webhook_url")
          .ilike("email", email)
          .maybeSingle();

        if (userSettings) {
          setSupportTicketingEnabled(userSettings.support_ticketing_enabled || false);
          setLoginEnabled(userSettings.login_enabled ?? true);
          setLoginWith((userSettings.login_with as 'EMAIL' | 'NAME' | 'BOTH') || 'EMAIL');
          setLoginWelcomeHeadline(userSettings.login_welcome_headline || 'Welcome to Your Client Hub');
          setLoginWelcomeSubheadline(userSettings.login_welcome_subheadline || 'Enter your details to access your dashboard');
          setWebhookUrl((userSettings as any).support_webhook_url || "");
          setTempWebhookUrl((userSettings as any).support_webhook_url || "");
        }

        // Load checklist items
        const { data: items } = await supabase
          .from("agency_onboarding_checklist")
          .select("*")
          .eq("agency_id", agencyId)
          .order("item_order");

        if (items && items.length > 0) {
          setChecklistItems(items.map(item => ({
            id: item.id,
            title: item.title,
            description: item.description || "",
            link_to: item.link_to || "none",
            link_url: item.link_url || "",
            item_order: item.item_order,
          })));
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    };

    loadSettings();
  }, [agencyId, email]);

  const saveLoginSettings = async () => {
    if (!email) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('saas_suite_users')
        .update({
          login_enabled: loginEnabled,
          login_with: loginWith,
          login_welcome_headline: loginWelcomeHeadline,
          login_welcome_subheadline: loginWelcomeSubheadline,
        })
        .ilike('email', email);
      
      if (error) throw error;
      toast.success("Login settings saved!");
    } catch (error) {
      console.error('Error saving login settings:', error);
      toast.error("Failed to save login settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!agencyId || !email) return;

    setIsSaving(true);
    try {
      // Save v2_home_settings
      await supabase
        .from("v2_home_settings")
        .upsert({
          agency_id: agencyId,
          ai_chat_enabled: aiChatEnabled && data.features.support,
          custom_links_enabled: linksEnabled,
          custom_link_1_text: links[0].text || null,
          custom_link_1_url: links[0].url || null,
          custom_link_1_color: links[0].color,
          custom_link_2_text: links[1].text || null,
          custom_link_2_url: links[1].url || null,
          custom_link_2_color: links[1].color,
          custom_link_3_text: links[2].text || null,
          custom_link_3_url: links[2].url || null,
          custom_link_3_color: links[2].color,
          checklist_title: checklistTitle,
          daily_checklist_enabled: checklistEnabled,
        }, { onConflict: "agency_id" });

      // Save user settings
      await supabase
        .from("saas_suite_users")
        .update({
          support_ticketing_enabled: supportTicketingEnabled && data.features.support,
        })
        .ilike("email", email);

      // Save checklist items
      if (checklistItems.length > 0 && checklistEnabled) {
        // Delete existing items first
        await supabase
          .from("agency_onboarding_checklist")
          .delete()
          .eq("agency_id", agencyId);

        // Insert new items
        const itemsToInsert = checklistItems.map((item, index) => ({
          agency_id: agencyId,
          title: item.title,
          description: item.description,
          link_to: item.link_to,
          link_url: item.link_url,
          item_order: index + 1,
        }));

        await supabase
          .from("agency_onboarding_checklist")
          .insert(itemsToInsert);
      }

      toast.success("Settings saved!");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const saveWebhookUrl = async () => {
    if (!email) return;
    
    setIsSavingWebhook(true);
    try {
      const { error } = await supabase
        .from('saas_suite_users')
        .update({ support_webhook_url: tempWebhookUrl } as any)
        .ilike('email', email);

      if (error) {
        console.error('Error saving webhook URL:', error);
        toast.error("Failed to save webhook URL");
        return;
      }

      setWebhookUrl(tempWebhookUrl);
      toast.success("Webhook URL saved!");
    } catch (error) {
      console.error('Error saving webhook URL:', error);
      toast.error("Failed to save webhook URL");
    } finally {
      setIsSavingWebhook(false);
    }
  };

  const testWebhook = async () => {
    if (!webhookUrl) {
      toast.error("Please save a webhook URL first");
      return;
    }
    
    setIsTestingWebhook(true);
    try {
      const sampleTicket = {
        id: "test-" + Date.now(),
        ticket_number: 0,
        agency_id: agencyId || "test-agency",
        customer_name: "Test Customer",
        customer_email: "test@example.com",
        issue_category: "Test Category",
        request_text: "This is a test webhook payload to verify your endpoint is working correctly.",
        status: "open",
        created_at: new Date().toISOString()
      };

      const { error } = await supabase.functions.invoke('notify-support-webhook', {
        body: { 
          event_type: 'test_webhook',
          ticket: sampleTicket
        }
      });

      if (error) {
        console.error('Error testing webhook:', error);
        toast.error("Failed to send test webhook");
        return;
      }

      toast.success("Test webhook sent! Check your endpoint for the payload.");
    } catch (error) {
      console.error('Error testing webhook:', error);
      toast.error("Failed to send test webhook");
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const addChecklistItem = () => {
    setChecklistItems(prev => [
      ...prev,
      {
        title: "",
        description: "",
        link_to: "none",
        link_url: "",
        item_order: prev.length + 1,
      },
    ]);
  };

  const removeChecklistItem = (index: number) => {
    setChecklistItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateChecklistItem = (index: number, updates: Partial<ChecklistItem>) => {
    setChecklistItems(prev =>
      prev.map((item, i) => (i === index ? { ...item, ...updates } : item))
    );
  };

  const hasAnyFeature = data.features.branding || 
    data.features.loginTracking || 
    data.features.support || 
    data.features.helpfulLinks || 
    data.features.onboardingChecklist;

  if (!hasAnyFeature) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Final Touches</h2>
          <p className="text-muted-foreground mt-2">
            You're all set! Click "Continue to App" to start using SaaS Suite.
          </p>
        </div>

        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-6 text-center">
          <Check className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Setup Complete!</h3>
          <p className="text-muted-foreground">
            You can customize additional features anytime from the Client Hub Manager.
          </p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Final Touches</h2>
          <p className="text-muted-foreground mt-2">
            Configure the features you selected in step 1. You can always change these later.
          </p>
        </div>

        <Accordion type="multiple" className="w-full space-y-3">
          {/* Branding Tool */}
          {data.features.branding && (
            <AccordionItem value="branding" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <Palette className="w-5 h-5 text-primary" />
                  <div className="text-left">
                    <span className="font-medium">Branding Tool</span>
                    <p className="text-sm text-muted-foreground font-normal">
                      Customize your white label appearance
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                <BrandingTool onReset={() => {}} />
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Login Tracking / Customization */}
          {data.features.loginTracking && (
            <AccordionItem value="login-tracking" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <UserCheck className="w-5 h-5 text-primary" />
                  <div className="text-left">
                    <span className="font-medium">Login Customization</span>
                    <p className="text-sm text-muted-foreground font-normal">
                      Configure how users log in to your Client Hub
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                {/* Notice */}
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700">
                    Login settings apply to <strong>all plans</strong> and are shared across your entire account.
                  </p>
                </div>
                
                {/* Enable Login Toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <LogIn className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Enable Login</span>
                    {isLoginForced && (
                      <span className="text-xs text-muted-foreground">(Required on your plan)</span>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>{isLoginForced ? "Login is required on Starter and Basic plans to accurately track user limits." : "When disabled, users will be automatically assigned as \"Guest User #X\" without needing to log in."}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Switch
                    checked={isLoginForced ? true : loginEnabled}
                    onCheckedChange={isLoginForced ? undefined : setLoginEnabled}
                    disabled={isLoginForced}
                  />
                </div>
                
                {loginEnabled && (
                  <>
                    {/* Login Method */}
                    <div className="space-y-2">
                      <Label className="text-sm">Login Method</Label>
                      <div className="flex gap-2">
                        <Button
                          variant={loginWith === 'EMAIL' ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1"
                          onClick={() => setLoginWith('EMAIL')}
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          Email
                        </Button>
                        <Button
                          variant={loginWith === 'NAME' ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1"
                          onClick={() => setLoginWith('NAME')}
                        >
                          <User className="w-4 h-4 mr-2" />
                          Name
                        </Button>
                        <Button
                          variant={loginWith === 'BOTH' ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1"
                          onClick={() => setLoginWith('BOTH')}
                        >
                          <Users className="w-4 h-4 mr-2" />
                          Both
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {loginWith === 'EMAIL' 
                          ? "Users will log in with their email address" 
                          : loginWith === 'NAME'
                            ? "Users will log in with their name (no email required)"
                            : "Users will log in with both their name and email address"}
                      </p>
                    </div>
                    
                    {/* Welcome Headline */}
                    <div className="space-y-2">
                      <Label className="text-sm">Welcome Headline</Label>
                      <Input
                        value={loginWelcomeHeadline}
                        onChange={(e) => setLoginWelcomeHeadline(e.target.value)}
                        placeholder="Welcome to Your Client Hub"
                        className="text-sm"
                      />
                    </div>
                    
                    {/* Welcome Subheadline */}
                    <div className="space-y-2">
                      <Label className="text-sm">Welcome Subheadline</Label>
                      <Textarea
                        value={loginWelcomeSubheadline}
                        onChange={(e) => setLoginWelcomeSubheadline(e.target.value)}
                        placeholder="Enter your details to access your dashboard"
                        className="text-sm resize-none"
                        rows={2}
                      />
                    </div>
                  </>
                )}
                
                <Button 
                  onClick={saveLoginSettings} 
                  disabled={isSaving}
                  className="w-full"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? "Saving..." : "Save Login Settings"}
                </Button>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Support */}
          {data.features.support && (
            <AccordionItem value="support" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <Headphones className="w-5 h-5 text-primary" />
                  <div className="text-left">
                    <span className="font-medium">Support</span>
                    <p className="text-sm text-muted-foreground font-normal">
                      Configure support tools for your clients
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <Label>Enable AI Chat Support</Label>
                    <p className="text-sm text-muted-foreground">
                      Let clients chat with an AI assistant
                    </p>
                  </div>
                  <Switch
                    checked={aiChatEnabled}
                    onCheckedChange={setAiChatEnabled}
                  />
                </div>
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <Label>Enable Support Ticketing</Label>
                    <p className="text-sm text-muted-foreground">
                      Let clients submit support tickets
                    </p>
                  </div>
                  <Switch
                    checked={supportTicketingEnabled}
                    onCheckedChange={setSupportTicketingEnabled}
                  />
                </div>
                
                {/* Webhook URL - only show when ticketing is enabled */}
                {supportTicketingEnabled && (
                  <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <Webhook className="w-4 h-4 text-muted-foreground" />
                      <Label className="text-sm font-medium">Inbound Webhook URL</Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Receive ticket notifications via webhook when new tickets are created or updated.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        value={tempWebhookUrl}
                        onChange={(e) => setTempWebhookUrl(e.target.value)}
                        placeholder="https://your-webhook-endpoint.com/tickets"
                        className="text-sm flex-1"
                      />
                      <Button
                        size="sm"
                        onClick={saveWebhookUrl}
                        disabled={isSavingWebhook}
                      >
                        {isSavingWebhook ? "Saving..." : "Save"}
                      </Button>
                    </div>
                    {webhookUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={testWebhook}
                        disabled={isTestingWebhook}
                        className="w-full"
                      >
                        {isTestingWebhook ? "Sending..." : "Test Webhook"}
                      </Button>
                    )}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Helpful Links */}
          {data.features.helpfulLinks && (
            <AccordionItem value="links" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <Link2 className="w-5 h-5 text-primary" />
                  <div className="text-left">
                    <span className="font-medium">Helpful Links</span>
                    <p className="text-sm text-muted-foreground font-normal">
                      Add quick links for calendars, communities, etc.
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable Quick Links</Label>
                  <Switch
                    checked={linksEnabled}
                    onCheckedChange={setLinksEnabled}
                  />
                </div>
                
                {linksEnabled && (
                  <div className="space-y-3">
                    {links.map((link, index) => (
                      <div key={index} className="grid grid-cols-3 gap-2">
                        <Input
                          placeholder="Link text"
                          value={link.text}
                          onChange={(e) => {
                            const newLinks = [...links];
                            newLinks[index].text = e.target.value;
                            setLinks(newLinks);
                          }}
                        />
                        <Input
                          placeholder="URL"
                          value={link.url}
                          onChange={(e) => {
                            const newLinks = [...links];
                            newLinks[index].url = e.target.value;
                            setLinks(newLinks);
                          }}
                        />
                        <input
                          type="color"
                          value={link.color}
                          onChange={(e) => {
                            const newLinks = [...links];
                            newLinks[index].color = e.target.value;
                            setLinks(newLinks);
                          }}
                          className="w-full h-10 rounded border cursor-pointer"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Onboarding Checklist */}
          {data.features.onboardingChecklist && (
            <AccordionItem value="checklist" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <ClipboardList className="w-5 h-5 text-primary" />
                  <div className="text-left">
                    <span className="font-medium">Onboarding Checklist</span>
                    <p className="text-sm text-muted-foreground font-normal">
                      Guide users through setup tasks
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable Onboarding Checklist</Label>
                  <Switch
                    checked={checklistEnabled}
                    onCheckedChange={setChecklistEnabled}
                  />
                </div>
                
                {checklistEnabled && (
                  <>
                    <div>
                      <Label>Checklist Title</Label>
                      <Input
                        value={checklistTitle}
                        onChange={(e) => setChecklistTitle(e.target.value)}
                        placeholder="Daily Checklist"
                        className="mt-1"
                      />
                    </div>

                    <div className="space-y-3">
                      {checklistItems.map((item, index) => (
                        <Card key={index} className="bg-muted/50">
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Item {index + 1}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeChecklistItem(index)}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                            <Input
                              placeholder="Task title"
                              value={item.title}
                              onChange={(e) =>
                                updateChecklistItem(index, { title: e.target.value })
                              }
                            />
                            <Textarea
                              placeholder="Description (optional)"
                              value={item.description}
                              onChange={(e) =>
                                updateChecklistItem(index, { description: e.target.value })
                              }
                              rows={2}
                            />
                          </CardContent>
                        </Card>
                      ))}

                      <Button
                        variant="outline"
                        onClick={addChecklistItem}
                        className="w-full"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Checklist Item
                      </Button>
                    </div>
                  </>
                )}
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>

        <Button
          onClick={handleSaveSettings}
          disabled={isSaving}
          className="w-full"
        >
          {isSaving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </TooltipProvider>
  );
};

export default FinalTouchesStep;
