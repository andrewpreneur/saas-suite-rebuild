import HighLevelIntegrationPanel from "@/components/highlevel/HighLevelIntegrationPanel";
import { supportSmsUrl } from "@/lib/supportContact";
import { useState, useEffect, useRef, type ReactNode } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
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
import {
  HideWhileSettingOpen,
  SettingItem,
  SettingList,
  SettingPages,
  useSettingPageOpen,
} from "@/components/premium/SettingList";
import { MoreMenu } from "@/components/premium/MoreMenu";
import { Field } from "@/components/premium/settings/Field";
import { Disclosure, FieldError, PageSection, StatusRow } from "@/components/premium/settings/Page";
import { HeroPane } from "@/components/premium/HeroPane";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  ExternalLink,
  UserPlus,
  Trash2,
  Users,
  CreditCard,
  Link2,
  Plug,
  User as UserIcon,
  ArrowLeft,
  Gift,
  Image as ImageIcon,
  Languages,
  Globe,
  GraduationCap,
  Lock,
  MessageCircle,
  ReceiptText,
  Slack,
} from "lucide-react";
import { toAgencySlug, agencyIdentifiersMatch } from "@/utils/agencySlug";
import StripeEmbeddedCheckout from "@/components/StripeEmbeddedCheckout";
import SlackIntegration from "@/pages/SlackIntegration";
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
  // The name as last loaded or saved: the URL warning only shows once it is edited.
  const [savedAgencyName, setSavedAgencyName] = useState("");
  const [agencyNameError, setAgencyNameError] = useState("");
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
  const [domainAccessLoaded, setDomainAccessLoaded] = useState(false);

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
    setDomainAccessLoaded(true);
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
        setSavedAgencyName(userData.agency_name || "");
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
      setSavedAgencyName(agencyName || "");
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
      if (err?.code === "23505") setAgencyNameError(msg);
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleContact = () => {
    window.location.href = supportSmsUrl("HELP");
  };

  const [checkoutPlan, setCheckoutPlan] = useState<CheckoutPlan | null>(null);

  // Save feedback and field errors for the forms on these pages.
  const [savingProfile, setSavingProfile] = useState(false);
  const [adminEmailError, setAdminEmailError] = useState("");
  const saveProfile = async () => {
    if (savingProfile) return;
    setSavingProfile(true);
    try {
      await handleSaveProfile();
    } finally {
      setSavingProfile(false);
    }
  };
  const inviteAdmin = () => {
    if (!/^\S+@\S+\.\S+$/.test(newAdminEmail.trim())) {
      setAdminEmailError("Enter a full email address, like name@agency.com.");
      return;
    }
    setAdminEmailError("");
    void handleAddAdmin();
  };

  // Known once the Slack or HighLevel page has been opened; until then the row keeps its description.
  const [slackStatus, setSlackStatus] = useState<{ connected: boolean; name?: string | null } | null>(null);
  const [highLevelStatus, setHighLevelStatus] = useState<{ connected: boolean; name?: string | null } | null>(null);
  const connectionLabel = (status: { connected: boolean; name?: string | null } | null, fallback: string) =>
    !status ? fallback : status.connected ? (status.name ? `Connected to ${status.name}` : "Connected") : "Not connected";

  const languageLabel =
    LANGUAGE_OPTIONS.find((option) => option.value === language)?.label || language;

  type SettingsTab = NonNullable<SettingsPanelProps["initialTab"]>;
  /** Every row that opens its own page. */
  type PanelKey = SettingsTab | "logo" | "language";
  const planLabel =
    userPlan === "STARTER" ? t.common_starter : userPlan === "BASIC" ? t.common_basic : t.common_advanced;

  // Which page is open comes from the URL, so the browser's Back button returns to the list.
  // `/app/billing`, `/app/admins` and the other old sub-routes keep working; Profile, Agency
  // logo and Language (which never had a route) use `/app/settings?page=...`.
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const PAGE_PATHS: Record<PanelKey, string> = {
    profile: "/app/settings?page=profile",
    logo: "/app/settings?page=logo",
    language: "/app/settings?page=language",
    admins: "/app/admins",
    billing: "/app/billing",
    domain: "/app/custom-domain",
    slack: "/app/slack",
    highlevel: "/app/highlevel",
    external: "/app/external",
  };
  const pageParam = searchParams.get("page");
  const openPanel: PanelKey | null =
    initialTab !== "profile"
      ? initialTab
      : pageParam === "profile" || pageParam === "logo" || pageParam === "language"
        ? pageParam
        : null;
  const cameFromList = Boolean((location.state as { fromSettingsList?: boolean } | null)?.fromSettingsList);
  const showPanel = (key: PanelKey, replace = false) =>
    navigate(PAGE_PATHS[key], { replace, state: { fromSettingsList: replace ? cameFromList : true } });
  const closePanel = () => {
    // Opened from the list: step back to it, so Back and the back link do the same thing.
    if (cameFromList) navigate(-1);
    else navigate("/app/settings", { replace: true });
  };
  const row = (key: PanelKey) => ({
    open: openPanel === key && !resyncing,
    onOpenChange: (next: boolean) => (next ? showPanel(key) : closePanel()),
  });
  // SettingItem mirrors `open` into the shared pages context one effect at a time. Jumping straight
  // from a later page to an earlier one (Cmd+K, Back) can leave the context empty; close and reopen once.
  const [resyncing, setResyncing] = useState(false);
  useEffect(() => {
    if (resyncing) setResyncing(false);
  }, [resyncing]);

  // When a page closes, keyboard focus returns to the row that opened it.
  const lastOpenPanel = useRef<PanelKey | null>(openPanel);
  useEffect(() => {
    const previous = lastOpenPanel.current;
    lastOpenPanel.current = openPanel;
    if (!previous || openPanel) return;
    const timer = window.setTimeout(() => {
      document.querySelector<HTMLElement>(`[data-testid="settings-row-${previous}"]`)?.focus();
    }, 60);
    return () => window.clearTimeout(timer);
  }, [openPanel]);

  const agencyNameChanged = agencyName.trim() !== savedAgencyName.trim();
  const adminCount = accountAdmins.length;
  const STRIPE_PORTAL = "https://billing.stripe.com/p/login/bIY04697i9jzghy4gg";
  const openStripePortal = () => {
    window.location.href = STRIPE_PORTAL;
  };

  return (
    <SettingPages backLabel="All settings">
      <PageSync want={openPanel !== null && !resyncing} onMismatch={() => setResyncing(true)} />
      <SettingsStack>
        <HideWhileSettingOpen>
          <PageHeader
            title={t.settings_title}
            subtitle="Pick a row to change it."
            more={[{ label: "Back to Client Hub", icon: <ArrowLeft />, onSelect: onBack }]}
          />
        </HideWhileSettingOpen>

        <SettingList label="Account">
          <SettingItem
            icon={<UserIcon />}
            title={t.settings_profile}
            value={[name || "No name yet", userEmail].filter(Boolean).join(" · ")}
            testId="settings-row-profile"
            panel={{
              description: "Who you are and what your agency is called.",
              footer: (
                <Button
                  type="submit"
                  form="settings-profile-form"
                  variant="accent"
                  className="h-11 w-full sm:h-10 sm:w-auto"
                  disabled={savingProfile}
                >
                  {savingProfile ? (
                    <>
                      <Loader2 className="animate-spin" aria-hidden="true" /> Saving profile
                    </>
                  ) : (
                    t.settings_saveProfile
                  )}
                </Button>
              ),
            }}
            {...row("profile")}
          >
            <form
              id="settings-profile-form"
              className="grid w-full min-w-0 gap-6"
              onSubmit={(event) => {
                event.preventDefault();
                void saveProfile();
              }}
            >
              {viewer.showsAccountAdmin && (
                <Banner tone="info" title={`Signed in as ${viewer.displayName}.`}>
                  <span className="break-all">{viewer.displayEmail}</span>. Saving here changes the agency account,
                  not who is signed in.
                </Banner>
              )}
              <fieldset className="grid min-w-0 gap-4 sm:grid-cols-2">
                <legend className="px-eyebrow mb-3 !text-[11px] !leading-4">You</legend>
                <Field label={viewer.showsAccountAdmin ? "Account owner name" : t.settings_name} htmlFor="name">
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t.settings_name}
                    autoComplete="name"
                  />
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
                  label={viewer.showsAccountAdmin ? "Account email" : t.settings_email}
                  htmlFor="email"
                  hint="Your sign-in email. It can't be changed here."
                  className="sm:col-span-2"
                >
                  <Input id="email" value={userEmail} disabled placeholder={t.settings_email} />
                </Field>
              </fieldset>
              <fieldset className="grid min-w-0 gap-4 border-t border-border/70 pt-5">
                <legend className="sr-only">Agency</legend>
                <p className="px-eyebrow !text-[11px] !leading-4" aria-hidden="true">
                  Agency
                </p>
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
                    onChange={(e) => {
                      setAgencyName(e.target.value);
                      setAgencyNameError("");
                    }}
                    placeholder={t.settings_agencyName}
                    autoComplete="organization"
                    aria-invalid={!!agencyNameError}
                    aria-describedby={agencyNameError ? "agency-error" : undefined}
                  />
                  <FieldError id="agency-error">{agencyNameError}</FieldError>
                </Field>
                {showAgencyWarning && agencyNameChanged && (
                  <Banner tone="warning" title="Saving this name changes your URL.">
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
              </fieldset>
            </form>
          </SettingItem>

          <SettingItem
            icon={<ImageIcon />}
            title="Agency logo"
            value={agencyLogoUrl ? "Logo added" : "No logo yet"}
            testId="settings-row-logo"
            panel={{ description: "Shown on your Knowledge Base and your branded login page." }}
            {...row("logo")}
          >
            <AgencyLogoCard key={agencyLogoUrl} bare email={email} logoUrl={agencyLogoUrl} onChange={setAgencyLogoUrl} />
          </SettingItem>

          <div data-tip-target="settings-tab-admins" className="empty:hidden">
            <SettingItem
              icon={<Users />}
              title={t.settings_admins}
              value={
                loadingAdmins
                  ? "Loading"
                  : adminCount === 0
                    ? "Only you so far"
                    : `${adminCount} admin${adminCount !== 1 ? "s" : ""} · permissions and notifications`
              }
              testId="settings-row-admins"
              panel={{ title: t.admins_title, description: "Invite teammates and choose what each one can do." }}
              {...row("admins")}
            >
              <Tabs defaultValue="team">
                <TabsList className="mb-5">
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
                <TabsContent value="team" className="mt-0">
                  <form
                    noValidate
                    onSubmit={(event) => {
                      event.preventDefault();
                      inviteAdmin();
                    }}
                  >
                    <h3 className="text-sm font-semibold text-foreground">Invite an admin</h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">They get an email with a sign-in link.</p>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <Field label={t.admins_email} htmlFor="admin-email" className="sm:col-span-2">
                        <Input
                          id="admin-email"
                          type="email"
                          value={newAdminEmail}
                          onChange={(e) => {
                            setNewAdminEmail(e.target.value);
                            setAdminEmailError("");
                          }}
                          placeholder="name@agency.com"
                          autoComplete="off"
                          aria-invalid={!!adminEmailError}
                          aria-describedby={adminEmailError ? "admin-email-error" : undefined}
                        />
                        <FieldError id="admin-email-error">{adminEmailError}</FieldError>
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
                      <Field label="Phone (optional)" htmlFor="admin-phone" hint="Used for text alerts.">
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
                    <div className="mt-4 flex justify-end">
                      <Button
                        type="submit"
                        variant="accent"
                        className="h-11 w-full sm:h-10 sm:w-auto"
                        disabled={!newAdminEmail || isAddingAdmin}
                      >
                        {isAddingAdmin ? (
                          <>
                            <Loader2 className="animate-spin" aria-hidden="true" /> {t.admins_sending}
                          </>
                        ) : (
                          <>
                            <UserPlus aria-hidden="true" /> Send invite
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                  <PageSection title={t.admins_currentAdmins}>
                    {loadingAdmins ? (
                      <div className="space-y-2" aria-busy="true" aria-label="Loading admins">
                        <div className="px-skeleton h-14 rounded-lg" />
                        <div className="px-skeleton h-14 rounded-lg" />
                      </div>
                    ) : accountAdmins.length === 0 ? (
                      <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
                        {t.admins_noAdmins}. Only you can sign in to this account.
                      </p>
                    ) : (
                      <ul className="divide-y divide-border/70">
                        {accountAdmins.map((admin) => (
                          <li key={admin.id} className="flex items-center justify-between gap-3 py-3">
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
                                <p className="truncate text-xs text-muted-foreground">
                                  {admin.admin_name ? `${admin.admin_email} · ` : ""}
                                  {admin.status === "accepted" ? t.admins_active : t.admins_pending} · {t.admins_invited}{" "}
                                  {new Date(admin.invited_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <MoreMenu
                              size="sm"
                              label={`Actions for ${admin.admin_name || admin.admin_email}`}
                              items={[
                                {
                                  label: "Remove admin",
                                  icon: <Trash2 />,
                                  danger: true,
                                  onSelect: () => handleRemoveAdmin(admin.id, admin.admin_email),
                                },
                              ]}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </PageSection>
                </TabsContent>
              </Tabs>
            </SettingItem>
          </div>

          <div data-tip-target="settings-tab-billing" className="empty:hidden">
            <SettingItem
              icon={<CreditCard />}
              title={t.settings_billing}
              value={`${planLabel} plan · plans, invoices and add-ons`}
              testId="settings-row-billing"
              panel={{ title: t.billing_title, description: "Your plan, invoices and add-ons." }}
              {...row("billing")}
            >
              <HeroPane>
              <StatusRow
                tone="on"
                label={`${planLabel} plan`}
                detail={
                  isNativeApp()
                    ? "Manage this subscription in your phone's subscription settings."
                    : "Invoices, your card and cancellation open in the secure Stripe portal."
                }
              >
                {!isNativeApp() ? (
                  <Button variant="accent" className="h-11 flex-1 sm:h-10 sm:flex-none" onClick={openStripePortal}>
                    Manage billing <ExternalLink aria-hidden="true" />
                  </Button>
                ) : null}
                <MoreMenu
                  label="More billing actions"
                  items={[
                    ...(!isNativeApp()
                      ? [{ label: "View invoices", icon: <ReceiptText />, onSelect: openStripePortal }]
                      : []),
                    { label: "Text us for help", icon: <MessageCircle />, onSelect: handleContact },
                  ]}
                />
              </StatusRow>
              </HeroPane>

              <Disclosure label="Compare plans" defaultOpen={userPlan !== "ADVANCED"}>
                <SaasPricingCards
                  compact
                  currentPlan={userPlan}
                  onSelect={setCheckoutPlan}
                  onStarter={openStripePortal}
                  className="md:[&>div.grid]:grid-cols-1 [&>div:first-child]:mb-5"
                />
              </Disclosure>

              <PageSection title="Add-ons" className="mt-2">
                <ul className="divide-y divide-border/70">
                  <AddOnRow
                    icon={<Users />}
                    title="Agency Support"
                    description={
                      userPlan === "ADVANCED"
                        ? "We answer your clients for you. $49 a month per account."
                        : "We answer your clients for you. Needs the Advanced plan."
                    }
                  >
                    {userPlan === "ADVANCED" ? (
                      <Button
                        variant="outline"
                        className="h-11 w-full sm:h-10 sm:w-auto"
                        onClick={() => (window.location.href = "/app/agency-support")}
                      >
                        Buy accounts
                      </Button>
                    ) : null}
                  </AddOnRow>
                  <AddOnRow
                    icon={<GraduationCap />}
                    title="Onboarding Calls"
                    description="Done-with-you sessions to launch your SaaS faster."
                  >
                    <Button
                      variant="outline"
                      className="h-11 w-full sm:h-10 sm:w-auto"
                      onClick={() => {
                        window.location.href = "/onboardings";
                      }}
                    >
                      View onboardings
                    </Button>
                  </AddOnRow>
                  <AddOnRow
                    icon={<Globe />}
                    title="Custom Domain"
                    badge={customDomainAccess ? <Tag tone="success">Active</Tag> : null}
                    description="Use your own domain instead of yoursoftwareonboarding.com."
                  >
                    <Button
                      variant="outline"
                      className="h-11 w-full sm:h-10 sm:w-auto"
                      onClick={() => showPanel("domain", true)}
                    >
                      {customDomainAccess ? "Manage domain" : "See Custom Domain"}
                    </Button>
                  </AddOnRow>
                </ul>
              </PageSection>
            </SettingItem>
          </div>

          <SettingItem
            icon={<Globe />}
            title="Custom Domain"
            value={customDomainAccess ? "Your own domain or subdomain" : "An add-on. See what it does"}
            status={
              !domainAccessLoaded ? undefined : customDomainAccess ? (
                <Tag tone="success">Active</Tag>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <Lock className="size-3" aria-hidden="true" />
                  Locked
                </span>
              )
            }
            testId="settings-row-domain"
            panel={{ description: "Use your own domain instead of yoursoftwareonboarding.com." }}
            {...row("domain")}
          >
            <CustomDomainPanel />
          </SettingItem>

          <SettingItem
            icon={<Languages />}
            title={t.settings_language}
            value={languageLabel}
            testId="settings-row-language"
            panel={{ description: "The language you see across SaaSSuite." }}
            {...row("language")}
          >
            <LanguageSettings />
          </SettingItem>

          <SettingItem
            icon={<Gift />}
            title={t.settings_hideBonuses}
            value={`${t.settings_hideBonusesDesc.replace(/\.?\s*$/, "")}. Saves as you switch it.`}
            toggle={
              <Switch
                id="hide-bonuses"
                aria-label={t.settings_hideBonuses}
                checked={hideBonuses}
                onCheckedChange={setHideBonuses}
              />
            }
          />
        </SettingList>

        {/* Asks each integration for its connection once, out of sight, so the rows below can say "Connected" before their page is opened. */}
        {!slackStatus ? (
          <div hidden aria-hidden="true">
            <SlackIntegration onStatus={setSlackStatus} />
          </div>
        ) : null}
        {!highLevelStatus && currentAgencyId ? (
          <div hidden aria-hidden="true">
            <HighLevelIntegrationPanel agencyId={currentAgencyId} onStatus={setHighLevelStatus} />
          </div>
        ) : null}

        <SettingList label="Integrations">
          <SettingItem
            icon={<Slack />}
            title="Slack"
            value={connectionLabel(slackStatus, "Connection, weekly AI Copilot and weekly support report")}
            testId="settings-row-slack"
            panel={{ description: "Run SaaSSuite commands and get weekly updates in your Slack channel." }}
            {...row("slack")}
          >
            <SlackIntegration
              onStatus={setSlackStatus}
              moreItems={[
                {
                  label: "Join our Slack for 1:1 help",
                  icon: <ExternalLink />,
                  onSelect: () => {
                    window.location.href = "https://saassuite.slack.com/archives/C0C6UU543SR";
                  },
                },
              ]}
            >
              <PageSection title="Weekly posts" description="Each one saves as you switch it.">
                <div className="divide-y divide-border/70">
                  <WeeklyCopilotSlackCard bare />
                  <WeeklySlackReportCard bare />
                </div>
              </PageSection>
            </SlackIntegration>
          </SettingItem>

          <div data-tip-target="settings-tab-highlevel" className="empty:hidden">
            <SettingItem
              icon={<Plug />}
              title="HighLevel"
              value={connectionLabel(highLevelStatus, "Your agency account and sub-accounts")}
              testId="settings-row-highlevel"
              panel={{
                title: "HighLevel connection",
                description: "Connect once to use your sub-accounts across SaaS Suite.",
              }}
              {...row("highlevel")}
            >
              <HighLevelIntegrationPanel agencyId={currentAgencyId} onStatus={setHighLevelStatus} />
            </SettingItem>
          </div>

          <SettingItem
            icon={<Link2 />}
            title="Connect external platform"
            value="Bring in support from another tool"
            testId="settings-row-external"
            panel={{ description: "Track logins from software that is not built on HighLevel." }}
            {...row("external")}
          >
            <ExternalPlatformGate>
              <ExternalPlatformPanel />
            </ExternalPlatformGate>
          </SettingItem>
        </SettingList>

        <HideWhileSettingOpen>
          <DeleteAccountSection />
        </HideWhileSettingOpen>

        {/* Stripe Embedded Checkout for upgrades */}
        <StripeEmbeddedCheckout
          plan={checkoutPlan || "basic"}
          open={!!checkoutPlan}
          onOpenChange={(open) => {
            if (!open) setCheckoutPlan(null);
          }}
          email={email || undefined}
        />
      </SettingsStack>
    </SettingPages>
  );
}

/** The list is spaced out; an open page stands alone, so the gaps between hidden groups go away. */
function SettingsStack({ children }: { children: ReactNode }) {
  const pageOpen = useSettingPageOpen();
  return <div className={cn("mx-auto w-full min-w-0 max-w-3xl", !pageOpen && "space-y-6")}>{children}</div>;
}

/** Tells the panel when the URL says a page is open but the shared pages context did not follow. */
function PageSync({ want, onMismatch }: { want: boolean; onMismatch: () => void }) {
  const pageOpen = useSettingPageOpen();
  useEffect(() => {
    if (!want || pageOpen) return;
    // Opening normally lands within a frame; only a real miss is still closed after this.
    const timer = window.setTimeout(onMismatch, 80);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want, pageOpen]);
  return null;
}

/** One add-on on the Billing page: what it is in a line, and its one button. */
function AddOnRow({
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
  children?: ReactNode;
}) {
  return (
    <li className="flex min-w-0 flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="px-icon-chip size-9 shrink-0 [&_svg]:size-[18px]" aria-hidden="true">
          {icon}
        </span>
        <div className="min-w-0">
          <h4 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
            {title}
            {badge}
          </h4>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </li>
  );
}
