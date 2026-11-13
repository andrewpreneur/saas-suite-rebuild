import HighLevelIntegrationPanel from "@/components/highlevel/HighLevelIntegrationPanel";
import { TextUsLink } from "@/components/TextUsLink";
import { supportSmsUrl } from "@/lib/supportContact";
import { useState, useEffect, type ReactNode } from "react";
import { PageHeader } from "@/components/platform/PageHeader";
import { useUser } from "@/contexts/UserContext";
import { useViewerIdentity } from "@/hooks/useViewerIdentity";
import { useLanguage } from "@/contexts/LanguageContext";
import { LANGUAGE_OPTIONS } from "@/translations";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tag } from "@/components/ui/tag";
import { Banner } from "@/components/ui/banner";
import { SectionCard } from "@/components/premium/SectionCard";
import AnimatedTabs from "@/components/premium/21st/animated-tabs";
import { EmptyState, EmptyStateIllustration } from "@/components/premium/21st/empty-state";
import { Field, SectionFooter, ToggleRow } from "@/components/premium/settings/Field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ExternalLink,
  Sparkles,
  UserPlus,
  Trash2,
  Users,
  CreditCard,
  Link2,
  Plug,
  SlidersHorizontal,
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

  type SettingsTab = NonNullable<SettingsPanelProps["initialTab"]>;
  const navItem =
    "h-11 shrink-0 justify-start gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground data-[state=active]:bg-brand-subtle data-[state=active]:font-semibold data-[state=active]:text-brand xl:h-10 xl:w-full [&_svg]:size-4 [&_svg]:shrink-0";
  const planLabel =
    userPlan === "STARTER" ? t.common_starter : userPlan === "BASIC" ? t.common_basic : t.common_advanced;

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6">
      <div className="flex items-start gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Go back" className="-ml-2 mt-0.5 shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <PageHeader
            title={t.settings_title}
            subtitle="Account, preferences, and support for this agency."
            actions={
              <>
                <Tag tone="brand">
                  <Crown aria-hidden="true" />
                  <span className="sr-only">Plan: </span>
                  {userPlan}
                </Tag>
                <Tag tone="neutral" className="border-border bg-card text-muted-foreground">
                  <Globe aria-hidden="true" />
                  <span className="sr-only">{t.settings_language}: </span>
                  {languageLabel}
                </Tag>
              </>
            }
          />
        </div>
      </div>

      <Tabs
        value={initialTab}
        orientation="vertical"
        onValueChange={(v) => {
          if (v === "domain" && !customDomainAccess) return;
          onTabChange?.(v as SettingsTab);
        }}
        className="flex w-full min-w-0 flex-col gap-4 xl:flex-row xl:gap-8"
      >
        <nav aria-label="Settings sections" className="min-w-0 shrink-0 xl:w-60">
          <TabsList className="-mx-4 flex h-auto max-w-none flex-row items-stretch justify-start gap-1 overflow-x-auto bg-none px-4 pb-1 [scrollbar-width:none] xl:sticky xl:top-20 xl:mx-0 xl:flex-col xl:overflow-visible xl:px-0 xl:pb-0 [&::-webkit-scrollbar]:hidden [&_.tabs-indicator]:hidden">
            <p className="px-eyebrow hidden px-3 pb-1 xl:block">Account</p>
            <TabsTrigger value="profile" className={navItem}>
              <UserIcon aria-hidden="true" />
              {t.settings_profile}
            </TabsTrigger>
            <TabsTrigger value="admins" data-tip-target="settings-tab-admins" className={navItem}>
              <Users aria-hidden="true" />
              {t.settings_admins}
            </TabsTrigger>
            <TabsTrigger value="billing" data-tip-target="settings-tab-billing" className={navItem}>
              <CreditCard aria-hidden="true" />
              {t.settings_billing}
            </TabsTrigger>
            <TabsTrigger value="domain" disabled={!customDomainAccess} className={navItem}>
              <Globe aria-hidden="true" />
              Custom Domain
              {!customDomainAccess && (
                <Lock className="!size-3 xl:ml-auto" aria-label="Locked: add the Custom Domain upgrade in Billing" />
              )}
            </TabsTrigger>
            <p className="px-eyebrow hidden px-3 pb-1 pt-4 xl:block">Integrations</p>
            <TabsTrigger value="slack" className={navItem} onClick={() => setSlackSub("connection")}>
              <Slack aria-hidden="true" />
              Slack
            </TabsTrigger>
            <TabsTrigger value="highlevel" className={navItem}>
              <Plug aria-hidden="true" />
              HighLevel
            </TabsTrigger>
            <TabsTrigger value="external" className={navItem}>
              <Link2 aria-hidden="true" />
              Connect external platform
            </TabsTrigger>
          </TabsList>
        </nav>

        <div className="min-w-0 flex-1">
          {/* ── Profile Tab ── */}
          <TabsContent value="profile" className="mt-0 space-y-6">
            <SectionCard
              icon={<UserIcon />}
              title={t.settings_profile}
              description="Who you are and what your agency is called."
            >
              <div className="grid w-full min-w-0 gap-4 sm:grid-cols-2">
                {viewer.showsAccountAdmin && (
                  <Banner tone="info" title={`Signed in as ${viewer.displayName}.`} className="sm:col-span-2">
                    <span className="break-all">{viewer.displayEmail}</span>. The name and email below are the agency
                    account. Saving them does not change who is signed in.
                  </Banner>
                )}
                <Field label={viewer.showsAccountAdmin ? "Account owner name" : t.settings_name} htmlFor="name">
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t.settings_name}
                    autoComplete="name"
                  />
                </Field>
                <Field
                  label={viewer.showsAccountAdmin ? "Account email" : t.settings_email}
                  htmlFor="email"
                  hint="Your sign-in email. It can't be changed here."
                >
                  <Input id="email" value={userEmail} disabled placeholder={t.settings_email} />
                </Field>
                <Field label="Phone" htmlFor="phone" hint="Used for text alerts.">
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 555 123 4567"
                    autoComplete="tel"
                  />
                </Field>
                <Field
                  label={t.settings_agencyName}
                  htmlFor="agency"
                  hint={
                    agencyName ? (
                      <>
                        {t.settings_urlSlug}: <span className="font-mono">{toAgencySlug(agencyName)}</span>
                      </>
                    ) : undefined
                  }
                >
                  <Input
                    id="agency"
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    placeholder={t.settings_agencyName}
                    autoComplete="organization"
                  />
                </Field>
                {showAgencyWarning && (
                  <Banner
                    tone="warning"
                    title="Saving this name changes your URL."
                    className="sm:col-span-2"
                  >
                    It moves from <span className="break-words font-mono">{currentAgencyId}</span> to{" "}
                    <span className="break-words font-mono">{toAgencySlug(agencyName)}</span>.
                    {agencyUserCount > 0 && (
                      <>
                        {" "}
                        You have{" "}
                        <strong>
                          {agencyUserCount} user{agencyUserCount !== 1 ? "s" : ""}
                        </strong>{" "}
                        on the current URL. They will need to <strong>log back in once</strong> at the new one. All
                        their progress is kept.
                      </>
                    )}
                  </Banner>
                )}
              </div>
              <SectionFooter note="Saves your name, phone and agency name.">
                <Button variant="accent" onClick={handleSaveProfile}>
                  {t.settings_saveProfile}
                </Button>
              </SectionFooter>
            </SectionCard>

            <AgencyLogoCard
              key={agencyLogoUrl}
              email={email}
              logoUrl={agencyLogoUrl}
              onChange={setAgencyLogoUrl}
            />

            <SectionCard
              icon={<SlidersHorizontal />}
              title="Preferences"
              description="How SaaSSuite looks and reads for you."
            >
              <ToggleRow
                label={t.settings_hideBonuses}
                htmlFor="hide-bonuses"
                description={`${t.settings_hideBonusesDesc.replace(/\.?\s*$/, "")}. Saves as you switch it.`}
                className="mb-4 border-b border-border pb-4"
              >
                <Switch id="hide-bonuses" checked={hideBonuses} onCheckedChange={setHideBonuses} />
              </ToggleRow>
              {/* Dynamic (one-line CSS + JS) install is always on; the old manual-code switch was removed. */}
              <LanguageSettings />
            </SectionCard>

            <DeleteAccountSection />
          </TabsContent>

          {/* ── Admins Tab ── */}
          <TabsContent value="admins" className="mt-0 space-y-6">
            <SectionCard icon={<Users />} title={t.admins_title} description={t.admins_desc}>
              <Tabs defaultValue="team" className="space-y-6">
                <TabsList>
                  <TabsTrigger value="team">Team</TabsTrigger>
                  <TabsTrigger value="permissions">Permissions</TabsTrigger>
                  <TabsTrigger value="notifications">Notifications</TabsTrigger>
                </TabsList>
                <TabsContent value="permissions" className="mt-0">
                  <AdminPermissionsPanel />
                </TabsContent>
                <TabsContent value="notifications" className="mt-0">
                  <SupportNotificationsPanel />
                </TabsContent>
                <TabsContent value="team" className="mt-0 space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Invite an admin</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      They get an email invitation and can sign in with that address.
                    </p>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <Field label={t.admins_email} htmlFor="admin-email" className="sm:col-span-2">
                        <Input
                          id="admin-email"
                          type="email"
                          value={newAdminEmail}
                          onChange={(e) => setNewAdminEmail(e.target.value)}
                          placeholder="name@agency.com"
                          autoComplete="off"
                        />
                      </Field>
                      <Field label={t.admins_name} htmlFor="admin-name">
                        <Input
                          id="admin-name"
                          value={newAdminName}
                          onChange={(e) => setNewAdminName(e.target.value)}
                          placeholder={t.admins_name}
                          autoComplete="off"
                        />
                      </Field>
                      <Field label="Phone" htmlFor="admin-phone" hint="Used for text alerts. Optional.">
                        <Input
                          id="admin-phone"
                          type="tel"
                          value={newAdminPhone}
                          onChange={(e) => setNewAdminPhone(e.target.value)}
                          placeholder="+1 555 123 4567"
                          autoComplete="off"
                        />
                      </Field>
                    </div>
                    <SectionFooter note={!newAdminEmail ? "Enter an email address to send the invitation." : undefined}>
                      <Button variant="accent" onClick={handleAddAdmin} disabled={!newAdminEmail || isAddingAdmin}>
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
                    </SectionFooter>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">{t.admins_currentAdmins}</h3>
                    {loadingAdmins ? (
                      <div className="space-y-2" aria-busy="true" aria-label="Loading admins">
                        <div className="px-skeleton h-16 rounded-lg" />
                        <div className="px-skeleton h-16 rounded-lg" />
                      </div>
                    ) : accountAdmins.length === 0 ? (
                      <EmptyState
                        className="rounded-lg border border-dashed border-border py-8"
                        icon={
                          <EmptyStateIllustration className="size-12 rounded-lg border-border bg-muted text-muted-foreground">
                            <Users className="size-5" aria-hidden="true" />
                          </EmptyStateIllustration>
                        }
                        title={t.admins_noAdmins}
                        description="Invite a teammate above to share this account."
                      />
                    ) : (
                      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                        {accountAdmins.map((admin) => (
                          <li key={admin.id} className="flex items-center justify-between gap-3 px-4 py-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <span
                                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-sm font-semibold uppercase text-brand"
                                aria-hidden="true"
                              >
                                {(admin.admin_name || admin.admin_email).slice(0, 1)}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">
                                  {admin.admin_name || admin.admin_email}
                                </p>
                                {admin.admin_name && (
                                  <p className="truncate text-xs text-muted-foreground">{admin.admin_email}</p>
                                )}
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  <Tag tone={admin.status === "accepted" ? "success" : "warning"}>
                                    {admin.status === "accepted" ? t.admins_active : t.admins_pending}
                                  </Tag>
                                  <span className="text-xs text-muted-foreground">
                                    {t.admins_invited} {new Date(admin.invited_at).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Remove ${admin.admin_name || admin.admin_email}`}
                              onClick={() => handleRemoveAdmin(admin.id, admin.admin_email)}
                              className="size-11 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive sm:size-10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </SectionCard>
          </TabsContent>

          {/* ── Billing Tab ── */}
          <TabsContent value="billing" className="mt-0 space-y-6">
            <SectionCard
              icon={<CreditCard />}
              title={t.billing_title}
              description={
                <>
                  {t.billing_currentPlan} <span className="font-semibold text-foreground">{planLabel}</span>.
                </>
              }
              actions={
                !isNativeApp() ? (
                  <Button
                    variant="outline"
                    className="h-11 sm:h-10"
                    onClick={() => {
                      window.location.href = "https://billing.stripe.com/p/login/bIY04697i9jzghy4gg";
                    }}
                  >
                    Manage billing <ExternalLink />
                  </Button>
                ) : undefined
              }
            >
              <SaasPricingCards
                compact
                currentPlan={userPlan}
                onSelect={setCheckoutPlan}
                onStarter={() => {
                  window.location.href = "https://billing.stripe.com/p/login/bIY04697i9jzghy4gg";
                }}
              />
              <p className="mt-4 text-sm text-muted-foreground">
                <strong className="font-semibold text-foreground">Need help?</strong>{" "}
                <TextUsLink message="HELP" variant="inline" icon={false} className="font-normal text-foreground">
                  Text Us
                </TextUsLink>{" "}
                for immediate assistance.
              </p>
            </SectionCard>

            {/* ── Upgrades ── */}
            <SectionCard
              icon={<Sparkles />}
              title="Upgrades"
              description="Optional add-ons that extend your SaaS Suite experience."
            >
              <div className="space-y-3">
                {/* Agency Support add-on ($49/month per client account) */}
                <UpgradeTile
                  icon={<Users />}
                  title="Agency Support add-on"
                  description="White-glove fulfillment for your client accounts. $49/month per account. Buy accounts into your wallet, then assign who gets support."
                >
                  {userPlan === "ADVANCED" ? (
                    <Button
                      variant="outline"
                      className="h-11 w-full sm:h-10"
                      onClick={() => (window.location.href = "/app/agency-support")}
                    >
                      Buy Agency Support accounts
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Available on the Advanced plan. Upgrade above to add Agency Support.
                    </p>
                  )}
                </UpgradeTile>
                <UpgradeTile
                  icon={<GraduationCap />}
                  title="Onboarding Calls"
                  description="Done-with-you onboarding sessions to get your SaaS launched faster."
                >
                  <Button
                    variant="outline"
                    className="h-11 w-full sm:h-10"
                    onClick={() => {
                      window.location.href = "/onboardings";
                    }}
                  >
                    View onboardings <ExternalLink />
                  </Button>
                </UpgradeTile>
                <UpgradeTile
                  icon={<Globe />}
                  title="Custom Domain"
                  badge={customDomainAccess ? <Tag tone="success">Active</Tag> : null}
                  description="Replace yoursoftwareonboarding.com with your own domain or subdomain."
                >
                  <Button
                    variant="outline"
                    className="h-11 w-full sm:h-10"
                    onClick={() => {
                      if (customDomainAccess) {
                        onTabChange?.("domain");
                      } else {
                        setCustomDomainDialogOpen(true);
                      }
                    }}
                  >
                    {customDomainAccess ? "Manage domain" : "Learn more"}
                  </Button>
                </UpgradeTile>
              </div>
            </SectionCard>
          </TabsContent>

          {/* ── Custom Domain Tab ── */}
          <TabsContent value="domain" className="mt-0 space-y-6">
            <CustomDomainPanel />
          </TabsContent>

          <TabsContent value="slack" className="mt-0 space-y-6">
            <section className="px-surface px-brand-wash flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="flex min-w-0 items-start gap-3">
                <span className="px-icon-chip shrink-0 bg-card [&_svg]:size-5" aria-hidden="true">
                  <Slack />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-foreground">Get 1:1 help from our team</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Join our SaaSSuite Slack channel to ask questions and get help directly from the team.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="accent"
                className="h-11 w-full shrink-0 sm:h-10 sm:w-auto"
                onClick={() => {
                  window.location.href = "https://saassuite.slack.com/archives/C0C6UU543SR";
                }}
              >
                Join our Slack
                <ExternalLink />
              </Button>
            </section>
            <div className="max-w-full overflow-x-auto">
              <AnimatedTabs
                variant="pill"
                layoutId="settings-slack-sub"
                activeTab={slackSub}
                onChange={(id) => setSlackSub(id as typeof slackSub)}
                tabs={[
                  { id: "connection", label: "Connection" },
                  { id: "copilot", label: "Weekly AI Copilot" },
                  { id: "report", label: "Weekly support report" },
                ]}
                className="[&>button]:min-h-[40px] [&>button]:whitespace-nowrap [&>button]:px-3"
              />
            </div>
            {slackSub === "connection" && <SlackIntegration />}
            {slackSub === "copilot" && <WeeklyCopilotSlackCard />}
            {slackSub === "report" && <WeeklySlackReportCard />}
          </TabsContent>

          <TabsContent value="highlevel" className="mt-0 space-y-6">
            <HighLevelIntegrationPanel agencyId={currentAgencyId} />
          </TabsContent>
          <TabsContent value="external" className="mt-0 space-y-6">
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

function UpgradeTile({
  icon,
  title,
  description,
  badge,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="px-icon-chip shrink-0 [&_svg]:size-5" aria-hidden="true">
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
            {title}
            {badge}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="shrink-0 sm:max-w-[240px] [&>button]:sm:w-auto">{children}</div>
    </div>
  );
}
