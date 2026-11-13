// HighLevel sub-account Settings sidebar items. Dots are CSS-escaped so the
// stored selector works directly in the generated stylesheet.
export const SETTINGS_NAV_LINKS: { id: string; name: string; tabId: string }[] = [
  ["Business Profile", "#sb_business_info"], ["My Profile", "#sb_profile"], ["Billing", "#sb_saas-billing"],
  ["Users", "#sb_my-staff"], ["Opportunities & Pipelines", "#sb_Opportunities-Pipelines"], ["Calendars", "#sb_calendars"],
  ["Email Services", "#sb_location-email-services"], ["Phone System", "#sb_phone-system"], ["WhatsApp", "#sb_whatsapp"],
  ["Objects", "#sb_objects"], ["Custom Fields", "#sb_custom-fields-settings"], ["Custom Values", "#sb_custom-values"],
  ["Import Data", "#sb_import-data"], ["Manage Scoring", "#sb_manage-scoring"], ["Preference Management Hub", "#sb_manage-preferences"],
  ["Domains & URL Redirects", "#sb_domains-urlRedirects"], ["External Tracking", "#sb_external-tracking"],
  ["Integrations", "#sb_common\\.sidebar\\.lcIntegrations"], ["Private Integrations", "#sb_common\\.sidebar\\.privateIntegrations"],
  ["Conversation Providers", "#sb_conversations_providers"], ["Tags", "#sb_tags"], ["Labs", "#sb_labs"],
  ["Audit Logs", "#sb_audit-logs-location"], ["Brand Boards", "#sb_brand-boards"],
].map(([name, tabId]) => ({ id: `settings:${tabId}`, name: `${name}`, tabId }));
