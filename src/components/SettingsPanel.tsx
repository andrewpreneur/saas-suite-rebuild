import HighLevelIntegrationPanel from "@/components/highlevel/HighLevelIntegrationPanel";
import { TextUsLink } from "@/components/TextUsLink";
import { supportSmsUrl } from "@/lib/supportContact";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/platform/PageHeader";
import { useUser } from "@/contexts/UserContext";
import { useViewerIdentity } from "@/hooks/useViewerIdentity";
import { useLanguage } from "@/contexts/LanguageContext";
import { LANGUAGE_OPTIONS } from "@/translations";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { newUi } from "@/lib/uiVersion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Phone,
  ExternalLink,
  Sparkles,
  UserPlus,
  Trash2,
  Users,
  AlertTriangle,
  Check,
  User as UserIcon,
  ArrowLeft,
  Crown,
  Globe,
  GraduationCap,
  Lock,
  Slack,
} from "lucide-react";
import { toAgencySlug, agencyIdentifiersMatch } from "@/utils/agencySlug";
import StripeEmbeddedCheckout from "@/components/StripeEmbeddedCheckout";
import SlackIntegration from "@/pages/SlackIntegration";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { CustomDomainPanel } from "@/components/CustomDomainPanel";
import ExternalPlatformPanel from "@/components/ExternalPlatformPanel";
import ExternalPlatformGate from "@/components/support/ExternalPlatformGate";
import SaasPricingCards from "@/components/pricing/SaasPricingCards";
import type { CheckoutPlan } from "@/constants/pricingPlans";
import WeeklySlackReportCard from "@/components/support/WeeklySlackReportCard";
import WeeklyCopilotSlackCard from "@/components/support/WeeklyCopilotSlackCard";
import AgencyLogoCard from "@/components/settings/AgencyLogoCard";
import AdminPermissionsPanel from "@/components/settings/AdminPermissionsPanel";
import SupportNotificationsPanel from "@/components/settings/SupportNotificationsPanel";
import { isNativeApp } from "@/utils/nativeApp";
import DeleteAccountSection from "@/components/settings/DeleteAccountSection";
import LanguageSettings from "@/components/settings/LanguageSettings";

interface AccountAdmin {
  id: string;
  admin_email: string;
  admin_name: string | null;
  status: string;
  invited_at: string;
}

interface SettingsPanelProps {
  onBack: () => void;
  initialTab?: "profile" | "admins" | "billing" | "domain" | "slack" | "highlevel" | "external";
  onTabChange?: (
    tab: "profile" | "admins" | "billing" | "domain" | "slack" | "highlevel" | "external",
  ) => void;
}

export function SettingsPanel({ onBack, initialTab = "profile", onTabChange }: SettingsPanelProps) {
  const { email, clearUser, hideBonuses, setHideBonuses, plan } = useUser();
  const { t, language } = useLanguage();
  const { toast } = useToast();

  // Profile state
  const [name, setName] = useState("");
  const viewer = useViewerIdentity(name);
  const [phone, setPhone] = useState("");
  const [newAdminPhone, setNewAdminPhone] = useState("");
  const [userEmail, setUserEmail] = useState(email || "");
  const [agencyName, setAgencyName] = useState("");
  const [currentAgencyId, setCurrentAgencyId] = useState<string | null>(null);
  const [showAgencyWarning, setShowAgencyWarning] = useState(false);
  const [agencyUserCount, setAgencyUserCount] = useState<number>(0);

  // Classic View state
  const [classicViewEnabled, setClassicViewEnabled] = useState(false);
  const [agencyLogoUrl, setAgencyLogoUrl] = useState("");
  const [logoLoaded, setLogoLoaded] = useState(false);

  // Dynamic Installation state
  const [dynamicInstallation, setDynamicInstallation] = useState(true);

  // Show V2 UI toggle (when off, V2/V3 switcher is hidden and V3 is default)
  const [showV2Ui, setShowV2Ui] = useState(true);

  // Account Admins state
  const [accountAdmins, setAccountAdmins] = useState<AccountAdmin[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminName, setNewAdminName] = useState("");
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  // Custom domain access
  const [customDomainAccess, setCustomDomainAccess] = useState(false);
  const [customDomainDialogOpen, setCustomDomainDialogOpen] = useState(false);

  const userPlan = plan || "ADVANCED";

  useEffect(() => {
    if (email) {
      setUserEmail(email);
      loadUserProfile();
      loadAccountAdmins();
      loadCustomDomainAccess();
    }
  }, [email]);

  const loadCustomDomainAccess = async () => {
    if (!email) return;
    const { data } = await supabase
      .from("saas_suite_users")
      .select("custom_domain_access")
      .ilike("email", email)
      .maybeSingle();
    setCustomDomainAccess(Boolean((data as any)?.custom_domain_access));
  };

  const loadUserProfile = async () => {
    if (!email) return;
    try {
      const { data: userData } = await supabase
        .from("saas_suite_users")
        .select(
          "full_name, bonuses_phone, agency_name, agency_id, agency_id_basic, agency_id_advanced, agency_id_elite, original_agency_id, original_agency_id_basic, original_agency_id_advanced, original_agency_id_elite, v2_navigation_enabled, dynamic_installation, show_v2_ui, kb_logo_url",
        )
        .ilike("email", email)
        .maybeSingle();

      if (userData) {
        setName(userData.full_name || "");
        setPhone((userData as any).bonuses_phone || "");
        setAgencyName(userData.agency_name || "");
        setAgencyLogoUrl((userData as any).kb_logo_url || "");
        setCurrentAgencyId(userData.agency_id || null);
        setClassicViewEnabled(!((userData as any).v2_navigation_enabled ?? true));
        setDynamicInstallation((userData as any).dynamic_installation ?? true);
        setShowV2Ui((userData as any).show_v2_ui ?? false);

        // Fetch user count across all agency IDs (including original IDs)
        const agencyIds = Array.from(
          new Set(
            [
              userData.agency_id,
              userData.agency_id_basic,
              userData.agency_id_advanced,
              userData.agency_id_elite,
              userData.original_agency_id,
              userData.original_agency_id_basic,
              userData.original_agency_id_advanced,
              userData.original_agency_id_elite,
            ].filter(Boolean) as string[],
          ),
        );

        let totalUsers = 0;
        for (const aid of agencyIds) {
          const { data } = await supabase.rpc("get_agency_clients", { p_agency_id: aid });
          if (data) totalUsers += data.length;
        }
        setAgencyUserCount(totalUsers);
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    }
  };

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
      const { data } = await supabase
        .from("account_admins")
        .select("*")
        .eq("owner_email", email)
        .order("invited_at", { ascending: false });
      setAccountAdmins((data || []) as AccountAdmin[]);
    } catch (error) {
      console.error("Error loading account admins:", error);
    } finally {
      setLoadingAdmins(false);
    }
  };

  const handleAddAdmin = async () => {
    if (!email || !newAdminEmail) return;
    setIsAddingAdmin(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-account-admin", {
        body: {
          owner_email: email,
          admin_email: newAdminEmail.trim().toLowerCase(),
          admin_name: newAdminName || undefined,
          admin_phone: newAdminPhone.trim() || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: "Error", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Admin Invited", description: `Invitation sent to ${newAdminEmail}` });
      setNewAdminEmail("");
      setNewAdminName("");
      setNewAdminPhone("");
      loadAccountAdmins();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add admin.",
        variant: "destructive",
      });
    } finally {
      setIsAddingAdmin(false);
    }
  };

  const handleRemoveAdmin = async (adminId: string, adminEmail: string) => {
    try {
      const { data: removed, error } = await supabase
        .from("account_admins")
        .delete()
        .eq("id", adminId)
        .select("id");
      if (error) throw error;
      if (!removed || removed.length === 0)
        throw new Error("You don't have permission to remove this admin.");
      toast({ title: "Admin Removed", description: `${adminEmail} has been removed` });
      loadAccountAdmins();
    } catch {
      toast({ title: "Error", description: "Failed to remove admin.", variant: "destructive" });
    }
  };

  const handleClassicViewToggle = async (enabled: boolean) => {
    if (!email) return;
    setClassicViewEnabled(enabled);
    try {
      const { error } = await supabase
        .from("saas_suite_users")
        .update({ v2_navigation_enabled: !enabled } as any)
        .ilike("email", email);
      if (error) throw error;
      toast({
        title: enabled ? "Classic View Enabled" : "Classic View Disabled",
        description: enabled ? "Legacy tabs are now visible." : "Using the modern navigation.",
      });
      window.dispatchEvent(new CustomEvent("user-settings-changed"));
    } catch {
      setClassicViewEnabled(!enabled);
      toast({ title: "Error", description: "Failed to update setting.", variant: "destructive" });
    }
  };

  const handleDynamicInstallationToggle = async (enabled: boolean) => {
    if (!email) return;
    setDynamicInstallation(enabled);
    try {
      const { error } = await supabase
        .from("saas_suite_users")
        .update({ dynamic_installation: enabled } as any)
        .ilike("email", email);
      if (error) throw error;
      toast({
        title: enabled ? "Dynamic Installation Enabled" : "Dynamic Installation Disabled",
        description: enabled
          ? "Using dynamic URLs — changes auto-sync to GHL."
          : "Using manual code blocks for installation.",
      });
      window.dispatchEvent(new CustomEvent("user-settings-changed"));
    } catch {
      setDynamicInstallation(!enabled);
      toast({ title: "Error", description: "Failed to update setting.", variant: "destructive" });
    }
  };

  const handleSaveProfile = async () => {
    if (!email) return;
    try {
      // Agency IDs (and Plan 1/2/3 URLs) are set by the database from the agency name.
      // The RPC resolves merged/alias logins to their owner account and checks permission.
      const { data: updated, error } = await (supabase as any).rpc("update_account_profile", {
        p_email: email,
        p_full_name: name || "",
        p_phone: phone.trim(),
        p_agency_name: agencyName || "",
      });
      if (error) throw error;
      if (!updated || updated.length === 0) {
        toast({
          title: "Nothing saved",
          description:
            "We couldn't find your account record to update. Please refresh and try again, or contact support.",
          variant: "destructive",
        });
        return;
      }
      const newId = (updated[0] as any)?.agency_id ?? null;
      if (newId) setCurrentAgencyId(newId);
      setShowAgencyWarning(false);
      toast({
        title: "Settings Saved",
        description: "Your profile has been updated successfully.",
      });
    } catch (err: any) {
      console.error("Error saving profile:", err);
      const msg =
        err?.code === "23505"
          ? "That agency name is already used by another account. Try a slightly different name."
          : `Failed to save profile.${err?.message ? ` (${err.message})` : ""}`;
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleContact = () => {
    window.location.href = supportSmsUrl("HELP");
  };

  const [checkoutPlan, setCheckoutPlan] = useState<CheckoutPlan | null>(null);
  const [slackSub, setSlackSub] = useState<"connection" | "copilot" | "report">("connection");

  const languageLabel =
    LANGUAGE_OPTIONS.find((option) => option.value === language)?.label || language;

  return (
    <div className="max-w-6xl mx-auto rounded-2xl bg-muted px-4 py-6">
      <div className="mb-6 flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Go back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <PageHeader
          title={t.settings_title}
          subtitle="Account, preferences, and support for this agency."
        />
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="flex min-w-0 items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3">
          <span className="text-sm text-muted-foreground">Plan</span>
          <span className="min-w-0 truncate text-sm font-medium">{userPlan}</span>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3">
          <span className="text-sm text-muted-foreground">{t.settings_language}</span>
          <span className="min-w-0 truncate text-sm font-medium">{languageLabel}</span>
        </div>
      </div>

      <Tabs
        value={initialTab}
        orientation="vertical"
        onValueChange={(v) => {
          if (v === "domain" && !customDomainAccess) return;
          onTabChange?.(
            v as "profile" | "admins" | "billing" | "domain" | "slack" | "highlevel" | "external",
          );
        }}
        className="flex w-full min-w-0 flex-col gap-6 xl:flex-row"
      >
        <nav className="shrink-0 xl:w-56">
          <TabsList className={newUi ? "flex h-auto w-full flex-col items-stretch justify-start gap-1 rounded-xl border bg-card bg-none p-2 [&>button]:h-11 [&>button]:rounded-md [&>button]:px-3 [&>button]:text-gray-700 [&>button]:after:hidden md:[&>button]:h-9 [&>button[data-state=active]]:bg-brand-subtle [&>button[data-state=active]]:text-[#3E27AE] xl:sticky xl:top-4" : "flex h-auto w-full flex-col items-stretch justify-start gap-1 bg-muted/40 p-2 xl:sticky xl:top-4"}>
            <TabsTrigger value="profile" className="justify-start">
              {t.settings_profile}
            </TabsTrigger>
            <TabsTrigger
              value="admins"
              data-tip-target="settings-tab-admins"
              className="justify-start"
            >
              {t.settings_admins}
            </TabsTrigger>
            <TabsTrigger
              value="billing"
              data-tip-target="settings-tab-billing"
              className="justify-start"
            >
              {t.settings_billing}
            </TabsTrigger>
            <TabsTrigger
              value="domain"
              disabled={!customDomainAccess}
              className="justify-start gap-1.5"
            >
              {!customDomainAccess && <Lock className="w-3 h-3" />}
              Custom Domain
            </TabsTrigger>
            <TabsTrigger
              value="slack"
              className="justify-start"
              onClick={() => setSlackSub("connection")}
            >
              Slack
            </TabsTrigger>
            {initialTab === "slack" && (
              <div className="ml-3 flex flex-col gap-1 border-l border-border pl-4">
                {(
                  [
                    ["connection", "Connection"],
                    ["copilot", "Weekly AI Copilot"],
                    ["report", "Weekly support report"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSlackSub(key)}
                    className={`whitespace-nowrap text-left text-sm rounded-md px-3 py-1.5 transition-colors ${
                      slackSub === key
                        ? "bg-background text-foreground font-medium shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <TabsTrigger value="highlevel" className="justify-start">
              HighLevel
            </TabsTrigger>
            <TabsTrigger value="external" className="justify-start whitespace-normal text-left">
              Connect external platform
            </TabsTrigger>
          </TabsList>
        </nav>
        <div className="min-w-0 flex-1 rounded-2xl bg-card p-4">
          {/* ── Profile Tab ── */}
          <TabsContent value="profile" className="space-y-4">
            <div className="grid w-full min-w-0 gap-4">
              {viewer.showsAccountAdmin && (
                <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                  <p className="font-medium text-foreground">Signed in as {viewer.displayName}</p>
                  <p className="truncate text-muted-foreground">{viewer.displayEmail}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    The name and email below are the agency account. Saving them does not change who is signed in.
                  </p>
                </div>
              )}
              <div>
                <Label htmlFor="name">{viewer.showsAccountAdmin ? "Account owner name" : t.settings_name}</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.settings_name}
                />
              </div>
              <div>
                <Label htmlFor="email">{viewer.showsAccountAdmin ? "Account email" : t.settings_email}</Label>
                <Input id="email" value={userEmail} disabled placeholder={t.settings_email} />
              </div>
              <div>
                <Label htmlFor="phone">Phone (for text alerts)</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 555 123 4567"
                />
              </div>
              <div>
                <Label htmlFor="agency">{t.settings_agencyName}</Label>
                <Input
                  id="agency"
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  placeholder={t.settings_agencyName}
                />
                {agencyName && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {t.settings_urlSlug}:{" "}
                    <span className="font-mono">{toAgencySlug(agencyName)}</span>
                  </p>
                )}
              </div>
              <AgencyLogoCard
                key={agencyLogoUrl}
                email={email}
                logoUrl={agencyLogoUrl}
                onChange={setAgencyLogoUrl}
              />
              {showAgencyWarning && (
                <Alert className="border-amber-300 bg-amber-50">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800 space-y-2">
                    <p>
                      <strong>{t.common_warning}:</strong> Changing your agency name will update
                      your URL from "<span className="font-mono">{currentAgencyId}</span>" → "
                      <span className="font-mono">{toAgencySlug(agencyName)}</span>"
                    </p>
                    {agencyUserCount > 0 && (
                      <p>
                        You currently have{" "}
                        <strong>
                          {agencyUserCount} user{agencyUserCount !== 1 ? "s" : ""}
                        </strong>{" "}
                        on your current URL. Once you switch, they will need to{" "}
                        <strong>log back in once</strong> to your new URL. All their progress will
                        be saved.
                      </p>
                    )}
                  </AlertDescription>
                </Alert>
              )}
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Label htmlFor="hide-bonuses">{t.settings_hideBonuses}</Label>
                  <p className="text-xs text-muted-foreground">{t.settings_hideBonusesDesc}</p>
                </div>
                <Switch id="hide-bonuses" className="shrink-0" checked={hideBonuses} onCheckedChange={setHideBonuses} />
              </div>
              {/* Dynamic (one-line CSS + JS) install is always on; the old manual-code switch was removed. */}
              <LanguageSettings />
              <Button onClick={handleSaveProfile} className="w-full">
                {t.settings_saveProfile}
              </Button>
              <DeleteAccountSection />
            </div>
          </TabsContent>

          {/* ── Admins Tab ── */}
          <TabsContent value="admins" className="space-y-4">
            <div className="w-full min-w-0 space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="font-medium">{t.admins_title}</h3>
                  <p className="text-xs text-muted-foreground">{t.admins_desc}</p>
                </div>
              </div>
              <Tabs defaultValue="team" className="space-y-4">
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="team">Team</TabsTrigger>
                  <TabsTrigger value="permissions">Permissions</TabsTrigger>
                  <TabsTrigger value="notifications">Notifications</TabsTrigger>
                </TabsList>
                <TabsContent value="permissions">
                  <AdminPermissionsPanel />
                </TabsContent>
                <TabsContent value="notifications">
                  <SupportNotificationsPanel />
                </TabsContent>
                <TabsContent value="team" className="space-y-4">
                  <div className="p-4 border rounded-lg space-y-3">
                    <div>
                      <Label htmlFor="admin-email">{t.admins_email}</Label>
                      <Input
                        id="admin-email"
                        type="email"
                        value={newAdminEmail}
                        onChange={(e) => setNewAdminEmail(e.target.value)}
                        placeholder={t.admins_email}
                      />
                    </div>
                    <div>
                      <Label htmlFor="admin-name">{t.admins_name}</Label>
                      <Input
                        id="admin-name"
                        value={newAdminName}
                        onChange={(e) => setNewAdminName(e.target.value)}
                        placeholder={t.admins_name}
                      />
                    </div>
                    <div>
                      <Label htmlFor="admin-phone">Phone (for text alerts)</Label>
                      <Input
                        id="admin-phone"
                        type="tel"
                        value={newAdminPhone}
                        onChange={(e) => setNewAdminPhone(e.target.value)}
                        placeholder="+1 555 123 4567"
                      />
                    </div>
                    <Button
                      onClick={handleAddAdmin}
                      disabled={!newAdminEmail || isAddingAdmin}
                      className="w-full"
                    >
                      {isAddingAdmin ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t.admins_sending}
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4 mr-2" /> {t.admins_addAdmin}
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label>{t.admins_currentAdmins}</Label>
                    {loadingAdmins ? (
                      <div className="flex items-center justify-center p-4">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : accountAdmins.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground bg-muted rounded-lg">
                        {t.admins_noAdmins}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {accountAdmins.map((admin) => (
                          <div
                            key={admin.id}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div>
                              <p className="font-medium text-sm">
                                {admin.admin_name || admin.admin_email}
                              </p>
                              {admin.admin_name && (
                                <p className="text-xs text-muted-foreground">{admin.admin_email}</p>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                <Badge
                                  variant={admin.status === "accepted" ? "default" : "secondary"}
                                  className="text-xs"
                                >
                                  {admin.status === "accepted" ? t.admins_active : t.admins_pending}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {t.admins_invited}{" "}
                                  {new Date(admin.invited_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Delete"
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
                </TabsContent>
              </Tabs>
            </div>
          </TabsContent>

          {/* ── Billing Tab ── */}
          <TabsContent value="billing" className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-1">{t.billing_title}</h3>
              <p className="text-sm text-muted-foreground mb-6">
                {t.billing_currentPlan}{" "}
                <span className="font-semibold text-foreground">
                  {userPlan === "STARTER"
                    ? t.common_starter
                    : userPlan === "BASIC"
                      ? t.common_basic
                      : t.common_advanced}
                </span>
                .
              </p>
              {!isNativeApp() && (
                <Button
                  variant="outline"
                  onClick={() => {
                    window.location.href = "https://billing.stripe.com/p/login/bIY04697i9jzghy4gg";
                  }}
                  className="mb-6"
                >
                  Manage Billing
                </Button>
              )}
            </div>

            {/* Agency Support add-on ($49/month per client account) */}
            <Card className="border-primary/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" /> Agency Support add-on
                </CardTitle>
                <CardDescription>
                  White-glove fulfillment for your client accounts — $49/month per account. Buy
                  accounts into your wallet, then assign who gets support.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {userPlan === "ADVANCED" ? (
                  <Button
                    className="w-full sm:w-auto h-11"
                    onClick={() => (window.location.href = "/app/agency-support")}
                  >
                    Buy Agency Support accounts
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Available on the Advanced plan — upgrade below to add Agency Support.
                  </p>
                )}
              </CardContent>
            </Card>

            <SaasPricingCards
              compact
              currentPlan={userPlan}
              onSelect={setCheckoutPlan}
              onStarter={() => {
                window.location.href = "https://billing.stripe.com/p/login/bIY04697i9jzghy4gg";
              }}
            />

            <div className="mt-6 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Need help?</strong> <TextUsLink message="HELP" variant="inline" icon={false} className="font-normal text-foreground">Text Us</TextUsLink> for immediate
                assistance.
              </p>
            </div>

            {/* ── Upgrades ── */}
            <div className="mt-10">
              <h3 className="text-lg font-semibold mb-1">Upgrades</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Optional add-ons that extend your SaaS Suite experience.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="flex flex-col">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-primary" /> Onboarding Calls
                    </CardTitle>
                    <CardDescription>
                      Done-with-you onboarding sessions to get your SaaS launched faster.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        window.location.href = "/onboardings";
                      }}
                    >
                      View Onboardings <ExternalLink className="w-4 h-4 ml-2" />
                    </Button>
                  </CardContent>
                </Card>

                <Card className="flex flex-col">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Globe className="w-5 h-5 text-primary" /> Custom Domain
                      {customDomainAccess && (
                        <Badge variant="secondary" className="ml-1">
                          Active
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Replace yoursoftwareonboarding.com with your own domain or subdomain.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto">
                    <Button
                      variant={customDomainAccess ? "outline" : "default"}
                      className="w-full"
                      onClick={() => {
                        if (customDomainAccess) {
                          onTabChange?.("domain");
                        } else {
                          setCustomDomainDialogOpen(true);
                        }
                      }}
                    >
                      {customDomainAccess ? "Manage Domain" : "Learn More"}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ── Custom Domain Tab ── */}
          <TabsContent value="domain" className="space-y-6">
            <CustomDomainPanel />
          </TabsContent>

          <TabsContent value="slack" className="space-y-6 mt-0">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Slack className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Get 1:1 help from our team</p>
                    <p className="text-sm text-muted-foreground">
                      Join our SaaSSuite Slack channel to ask questions and get help directly from
                      the team.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  className="w-full shrink-0 sm:w-auto"
                  onClick={() => {
                    window.location.href = "https://saassuite.slack.com/archives/C0C6UU543SR";
                  }}
                >
                  Join OUR Slack
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
            {slackSub === "connection" && <SlackIntegration />}
            {slackSub === "copilot" && <WeeklyCopilotSlackCard />}
            {slackSub === "report" && <WeeklySlackReportCard />}
          </TabsContent>

          <TabsContent value="highlevel" className="space-y-6 mt-0">
            <HighLevelIntegrationPanel agencyId={currentAgencyId} />
          </TabsContent>
          <TabsContent value="external" className="space-y-6">
            <ExternalPlatformGate>
              <ExternalPlatformPanel />
            </ExternalPlatformGate>
          </TabsContent>
        </div>

        {/* Custom Domain info dialog (pre-purchase) */}
        <Dialog open={customDomainDialogOpen} onOpenChange={setCustomDomainDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" /> Custom Domain Upgrade
              </DialogTitle>
              <DialogDescription className="space-y-3 pt-2 text-left">
                <p>
                  Replace the default <span className="font-mono">yoursoftwareonboarding.com</span>{" "}
                  URL with your own domain or subdomain (for example{" "}
                  <span className="font-mono">app.yoursite.com</span>).
                </p>
                <p>
                  After you purchase, you'll be redirected to a page inside your account where
                  you'll enter the exact domain or subdomain you want to use. Our team will wire it
                  up and notify you the moment it's live.
                </p>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setCustomDomainDialogOpen(false)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  window.location.href =
                    "https://link.saassuite.ai/payment-link/6a3af2039f7c6c76d1f86d4c";
                }}
              >
                Purchase Custom Domain <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Stripe Embedded Checkout for upgrades */}
        <StripeEmbeddedCheckout
          plan={checkoutPlan || "basic"}
          open={!!checkoutPlan}
          onOpenChange={(open) => {
            if (!open) setCheckoutPlan(null);
          }}
          email={email || undefined}
        />
      </Tabs>
    </div>
  );
}
