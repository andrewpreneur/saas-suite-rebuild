import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Palette,
  UserCheck,
  Headphones,
  Link2,
  ClipboardList,
  Plus,
  Trash2,
  Mail,
  User,
  Users,
  HelpCircle,
  Info,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { OnboardingData } from "../V2OnboardingWizard";
import BrandingTool from "@/components/BrandingTool";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { popIn } from "@/lib/motion";
import { StepHeading } from "@/components/premium/onboarding/OnboardingShell";
import { OptionCard, SettingRow, SuccessMark } from "@/components/premium/onboarding/pieces";

/** One collapsible group with the standard icon chip header. */
const Group = ({
  value,
  icon,
  title,
  description,
  children,
}: {
  value: string;
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) => (
  <AccordionItem value={value} className="px-surface border-0 px-4 sm:px-6">
    <AccordionTrigger className="gap-3 py-4 hover:no-underline">
      <div className="flex min-w-0 items-center gap-3">
        <span className="px-icon-chip shrink-0 [&_svg]:size-5" aria-hidden="true">
          {icon}
        </span>
        <div className="min-w-0 text-left">
          <span className="block text-body font-semibold text-foreground">{title}</span>
          <span className="block text-small font-normal text-muted-foreground">{description}</span>
        </div>
      </div>
    </AccordionTrigger>
    <AccordionContent className="space-y-4 pb-6 pt-2">{children}</AccordionContent>
  </AccordionItem>
);

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
  const [loginWith, setLoginWith] = useState<"EMAIL" | "NAME" | "BOTH">("EMAIL");
  const [loginWelcomeHeadline, setLoginWelcomeHeadline] = useState("Welcome to Your Client Hub");
  const [loginWelcomeSubheadline, setLoginWelcomeSubheadline] = useState(
    "Enter your details to access your dashboard",
  );

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
              color: homeSettings.custom_link_1_color || "#3b82f6",
            },
            {
              text: homeSettings.custom_link_2_text || "",
              url: homeSettings.custom_link_2_url || "",
              color: homeSettings.custom_link_2_color || "#3b82f6",
            },
            {
              text: homeSettings.custom_link_3_text || "",
              url: homeSettings.custom_link_3_url || "",
              color: homeSettings.custom_link_3_color || "#3b82f6",
            },
          ]);

          setLinksEnabled(homeSettings.custom_links_enabled);
        }

        // Load user settings
        const { data: userSettings } = await supabase
          .from("saas_suite_users")
          .select(
            "support_ticketing_enabled, login_enabled, login_with, login_welcome_headline, login_welcome_subheadline, support_webhook_url",
          )
          .ilike("email", email)
          .maybeSingle();

        if (userSettings) {
          setSupportTicketingEnabled(userSettings.support_ticketing_enabled || false);
          setLoginEnabled(userSettings.login_enabled ?? true);
          setLoginWith((userSettings.login_with as "EMAIL" | "NAME" | "BOTH") || "EMAIL");
          setLoginWelcomeHeadline(
            userSettings.login_welcome_headline || "Welcome to Your Client Hub",
          );
          setLoginWelcomeSubheadline(
            userSettings.login_welcome_subheadline || "Enter your details to access your dashboard",
          );
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
          setChecklistItems(
            items.map((item) => ({
              id: item.id,
              title: item.title,
              description: item.description || "",
              link_to: item.link_to || "none",
              link_url: item.link_url || "",
              item_order: item.item_order,
            })),
          );
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
        .from("saas_suite_users")
        .update({
          login_enabled: loginEnabled,
          login_with: loginWith,
          login_welcome_headline: loginWelcomeHeadline,
          login_welcome_subheadline: loginWelcomeSubheadline,
        })
        .ilike("email", email);

      if (error) throw error;
      toast.success("Login settings saved");
    } catch (error) {
      console.error("Error saving login settings:", error);
      toast.error("Could not save login settings. Try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!agencyId || !email) return;

    setIsSaving(true);
    try {
      // Save v2_home_settings
      await supabase.from("v2_home_settings").upsert(
        {
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
        },
        { onConflict: "agency_id" },
      );

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
        await supabase.from("agency_onboarding_checklist").delete().eq("agency_id", agencyId);

        // Insert new items
        const itemsToInsert = checklistItems.map((item, index) => ({
          agency_id: agencyId,
          title: item.title,
          description: item.description,
          link_to: item.link_to,
          link_url: item.link_url,
          item_order: index + 1,
        }));

        await supabase.from("agency_onboarding_checklist").insert(itemsToInsert);
      }

      toast.success("Settings saved");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Could not save settings. Try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveWebhookUrl = async () => {
    if (!email) return;

    setIsSavingWebhook(true);
    try {
      const { error } = await supabase
        .from("saas_suite_users")
        .update({ support_webhook_url: tempWebhookUrl } as any)
        .ilike("email", email);

      if (error) {
        console.error("Error saving webhook URL:", error);
        toast.error("Could not save the webhook URL. Try again.");
        return;
      }

      setWebhookUrl(tempWebhookUrl);
      toast.success("Webhook URL saved");
    } catch (error) {
      console.error("Error saving webhook URL:", error);
      toast.error("Could not save the webhook URL. Try again.");
    } finally {
      setIsSavingWebhook(false);
    }
  };

  const testWebhook = async () => {
    if (!webhookUrl) {
      toast.error("Save a webhook URL first");
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
        request_text:
          "This is a test webhook payload to verify your endpoint is working correctly.",
        status: "open",
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.functions.invoke("notify-support-webhook", {
        body: {
          event_type: "test_webhook",
          ticket: sampleTicket,
        },
      });

      if (error) {
        console.error("Error testing webhook:", error);
        toast.error("Could not send the test. Check the URL and try again.");
        return;
      }

      toast.success("Test sent. Check your endpoint for the payload.");
    } catch (error) {
      console.error("Error testing webhook:", error);
      toast.error("Could not send the test. Check the URL and try again.");
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const addChecklistItem = () => {
    setChecklistItems((prev) => [
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
    setChecklistItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateChecklistItem = (index: number, updates: Partial<ChecklistItem>) => {
    setChecklistItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...updates } : item)),
    );
  };

  const hasAnyFeature =
    data.features.branding ||
    data.features.loginTracking ||
    data.features.support ||
    data.features.helpfulLinks ||
    data.features.onboardingChecklist;

  if (!hasAnyFeature) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <SuccessMark size={56} />
        <StepHeading
          className="mb-0 mt-8"
          title="Setup complete"
          subtitle="Nothing else to configure. You can add more features any time from the Client Hub Manager."
        />
      </div>
    );
  }

  const LOGIN_METHODS = [
    {
      id: "EMAIL" as const,
      title: "Email",
      description: "Clients enter their email address",
      icon: <Mail />,
    },
    {
      id: "NAME" as const,
      title: "Name",
      description: "Clients enter their name, no email needed",
      icon: <User />,
    },
    {
      id: "BOTH" as const,
      title: "Both",
      description: "Clients enter their name and email",
      icon: <Users />,
    },
  ];

  return (
    <TooltipProvider>
      <div>
        <StepHeading
          title="Any final touches?"
          subtitle="All optional. Open what you want to set up now, or finish and come back later."
        />

        <Accordion type="multiple" className="w-full space-y-3">
          {/* Branding Tool */}
          {data.features.branding && (
            <Group
              value="branding"
              icon={<Palette />}
              title="Branding tool"
              description="Customize how your white label looks"
            >
              <BrandingTool onReset={() => {}} />
            </Group>
          )}

          {/* Login Tracking / Customization */}
          {data.features.loginTracking && (
            <Group
              value="login-tracking"
              icon={<UserCheck />}
              title="Client login"
              description="Choose how clients sign in to your Client Hub"
            >
              <p className="flex items-start gap-2 rounded-md bg-muted p-3 text-small text-muted-foreground">
                <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
                <span>
                  Login settings apply to{" "}
                  <strong className="font-semibold text-foreground">all plans</strong> and are
                  shared across your account.
                </span>
              </p>

              <SettingRow
                htmlFor="loginEnabled"
                title={
                  <span className="inline-flex items-center gap-2">
                    Ask clients to log in
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="size-4 cursor-help text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>
                          {isLoginForced
                            ? "Login is required on Starter and Basic plans to accurately track user limits."
                            : 'When disabled, users will be automatically assigned as "Guest User #X" without needing to log in.'}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </span>
                }
                description={
                  isLoginForced ? "Required on your plan" : "Turn off to let clients in as guests"
                }
                control={
                  <Switch
                    id="loginEnabled"
                    checked={isLoginForced ? true : loginEnabled}
                    onCheckedChange={isLoginForced ? undefined : setLoginEnabled}
                    disabled={isLoginForced}
                  />
                }
              />

              {loginEnabled && (
                <>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground" id="login-method-label">
                      Login method
                    </p>
                    <div
                      role="radiogroup"
                      aria-labelledby="login-method-label"
                      className="grid gap-2 sm:grid-cols-3"
                    >
                      {LOGIN_METHODS.map((m) => (
                        <OptionCard
                          key={m.id}
                          title={m.title}
                          selected={loginWith === m.id}
                          onSelect={() => setLoginWith(m.id)}
                        />
                      ))}
                    </div>
                    <p className="text-small text-muted-foreground">
                      {LOGIN_METHODS.find((m) => m.id === loginWith)?.description}
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="loginWelcomeHeadline">Welcome headline</Label>
                    <Input
                      id="loginWelcomeHeadline"
                      value={loginWelcomeHeadline}
                      onChange={(e) => setLoginWelcomeHeadline(e.target.value)}
                      placeholder="Welcome to Your Client Hub"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="loginWelcomeSubheadline">Welcome subheadline</Label>
                    <Textarea
                      id="loginWelcomeSubheadline"
                      value={loginWelcomeSubheadline}
                      onChange={(e) => setLoginWelcomeSubheadline(e.target.value)}
                      placeholder="Enter your details to access your dashboard"
                      className="resize-none"
                      rows={2}
                    />
                  </div>
                </>
              )}

              <Button variant="outline" onClick={saveLoginSettings} disabled={isSaving}>
                {isSaving ? "Saving" : "Save login settings"}
              </Button>
            </Group>
          )}

          {/* Support */}
          {data.features.support && (
            <Group
              value="support"
              icon={<Headphones />}
              title="Support"
              description="Give clients a way to get help"
            >
              <SettingRow
                htmlFor="aiChat"
                title="AI chat support"
                description="Clients chat with an AI assistant"
                control={
                  <Switch id="aiChat" checked={aiChatEnabled} onCheckedChange={setAiChatEnabled} />
                }
              />
              <SettingRow
                htmlFor="ticketing"
                title="Support tickets"
                description="Clients send you support tickets"
                control={
                  <Switch
                    id="ticketing"
                    checked={supportTicketingEnabled}
                    onCheckedChange={setSupportTicketingEnabled}
                  />
                }
              />

              {/* Webhook URL - only show when ticketing is enabled */}
              <AnimatePresence initial={false}>
                {supportTicketingEnabled && (
                  <motion.div
                    key="webhook"
                    variants={popIn}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    className="space-y-2 rounded-lg bg-muted p-4"
                  >
                    <Label htmlFor="webhookUrl">Inbound webhook URL</Label>
                    <p className="text-small text-muted-foreground">
                      Optional. We post here when a ticket is created or updated.
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        id="webhookUrl"
                        value={tempWebhookUrl}
                        onChange={(e) => setTempWebhookUrl(e.target.value)}
                        placeholder="https://your-webhook-endpoint.com/tickets"
                        className="min-w-0 flex-1 bg-card"
                      />
                      <Button variant="outline" onClick={saveWebhookUrl} disabled={isSavingWebhook}>
                        {isSavingWebhook ? "Saving" : "Save URL"}
                      </Button>
                      {webhookUrl && (
                        <Button variant="ghost" onClick={testWebhook} disabled={isTestingWebhook}>
                          {isTestingWebhook ? "Sending" : "Send test"}
                        </Button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Group>
          )}

          {/* Helpful Links */}
          {data.features.helpfulLinks && (
            <Group
              value="links"
              icon={<Link2 />}
              title="Helpful links"
              description="Quick links to calendars, communities and more"
            >
              <SettingRow
                htmlFor="linksEnabled"
                title="Show quick links"
                control={
                  <Switch
                    id="linksEnabled"
                    checked={linksEnabled}
                    onCheckedChange={setLinksEnabled}
                  />
                }
              />

              {linksEnabled && (
                <div className="space-y-3">
                  {links.map((link, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_1fr_auto]"
                    >
                      <Input
                        aria-label={`Link ${index + 1} text`}
                        placeholder="Link text"
                        value={link.text}
                        onChange={(e) => {
                          const newLinks = [...links];
                          newLinks[index].text = e.target.value;
                          setLinks(newLinks);
                        }}
                      />
                      <Input
                        aria-label={`Link ${index + 1} URL`}
                        placeholder="https://..."
                        className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto"
                        value={link.url}
                        onChange={(e) => {
                          const newLinks = [...links];
                          newLinks[index].url = e.target.value;
                          setLinks(newLinks);
                        }}
                      />
                      <input
                        type="color"
                        aria-label={`Link ${index + 1} color`}
                        value={link.color}
                        onChange={(e) => {
                          const newLinks = [...links];
                          newLinks[index].color = e.target.value;
                          setLinks(newLinks);
                        }}
                        className="size-11 cursor-pointer rounded-md border border-border bg-card p-1 sm:size-10"
                      />
                    </div>
                  ))}
                </div>
              )}
            </Group>
          )}

          {/* Onboarding Checklist */}
          {data.features.onboardingChecklist && (
            <Group
              value="checklist"
              icon={<ClipboardList />}
              title="Client checklist"
              description="Guide clients through their first tasks"
            >
              <SettingRow
                htmlFor="checklistEnabled"
                title="Show a checklist to clients"
                control={
                  <Switch
                    id="checklistEnabled"
                    checked={checklistEnabled}
                    onCheckedChange={setChecklistEnabled}
                  />
                }
              />

              {checklistEnabled && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="checklistTitle">Checklist title</Label>
                    <Input
                      id="checklistTitle"
                      value={checklistTitle}
                      onChange={(e) => setChecklistTitle(e.target.value)}
                      placeholder="Daily Checklist"
                    />
                  </div>

                  <div className="space-y-3">
                    <AnimatePresence initial={false}>
                      {checklistItems.map((item, index) => (
                        <motion.div
                          key={item.id ?? `new-${index}`}
                          variants={popIn}
                          initial="hidden"
                          animate="show"
                          exit="exit"
                          className="space-y-2 rounded-lg bg-muted p-4"
                        >
                          <div className="flex items-center justify-between">
                            <span className="px-eyebrow">Task {index + 1}</span>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Remove task ${index + 1}`}
                              onClick={() => removeChecklistItem(index)}
                            >
                              <Trash2 className="text-destructive" />
                            </Button>
                          </div>
                          <Input
                            aria-label={`Task ${index + 1} title`}
                            placeholder="Task title"
                            className="bg-card"
                            value={item.title}
                            onChange={(e) => updateChecklistItem(index, { title: e.target.value })}
                          />
                          <Textarea
                            aria-label={`Task ${index + 1} description`}
                            placeholder="Description (optional)"
                            className="bg-card"
                            value={item.description}
                            onChange={(e) =>
                              updateChecklistItem(index, { description: e.target.value })
                            }
                            rows={2}
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    <Button variant="outline" onClick={addChecklistItem} className="w-full">
                      <Plus />
                      Add a task
                    </Button>
                  </div>
                </>
              )}
            </Group>
          )}
        </Accordion>

        <div className="mt-6 flex items-center justify-between gap-3">
          <p className="text-small text-muted-foreground">
            Save before you finish so nothing here is lost.
          </p>
          <Button variant="outline" onClick={handleSaveSettings} disabled={isSaving}>
            {isSaving ? "Saving" : "Save these settings"}
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default FinalTouchesStep;
