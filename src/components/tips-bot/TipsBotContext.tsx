import { buildMenuRemovalTour } from './menuRemovalTour';
import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { useSessionTracker } from '@/contexts/SessionTrackerContext';
import { TourKind, markShownThisSession, readTour, recordComplete, recordDismiss, recordSequenceComplete, setToursDisabled, suppressAutoToursForSession } from '@/lib/tourSchedule';

export interface TipNavigation {
  openPanel?: 'home-customize' | 'advanced-mode' | 'custom-videos' | 'view-tickets' | 'edit-colors';
  selectTab?: string; // Tab value to select within a panel (e.g., 'links', 'welcome', 'checklist')
  v3LiveTab?: 'home' | 'education' | 'support'; // Switch the V3 live-preview tab
  uiVersion?: 'v2' | 'v3'; // Optionally force UI version
  selectTool?: string; // In-app tool id to select (dispatches tipbot-select-tool)
  routePath?: string; // Router path the target lives on (e.g. '/slack-integration')
  communityTab?: 'feed' | 'snapshots' | 'academy' | 'ideas' | 'ask'; // Community hub page
  openSidebarSection?: string; // Expand a sidebar group (build / grow / support)
  finishPath?: string; // Last step only: where "Finish tour" takes the person (e.g. '/app/highlevel')
}

export interface Tip {
  id: string;
  title: string;
  description: string;
  category: 'navigation' | 'customization' | 'features' | 'content';
  targetSelector: string; // data-tip-target attribute value
  arrowPosition: 'top' | 'bottom' | 'left' | 'right';
  checkCondition: (data: TipCheckData) => boolean;
  priority: number;
  navigation?: TipNavigation; // Optional navigation action to perform when showing this tip
}

export interface TipCheckData {
  userSettings: {
    v2_navigation_enabled?: boolean;
    client_hub_enabled?: boolean;
    branded_ai_support?: boolean;
    primary_color?: string;
    agency_id_basic?: string;
    agency_id_advanced?: string;
    agency_id_elite?: string;
    login_welcome_headline?: string;
  };
  homeSettings: {
    daily_checklist_enabled?: boolean;
    welcome_headline?: string;
    welcome_subheadline?: string;
    welcome_video_enabled?: boolean;
    welcome_video_url?: string;
    announcements_enabled?: boolean;
    announcements_headline?: string;
    custom_links_enabled?: boolean;
    custom_link_1_text?: string;
    custom_link_2_text?: string;
    custom_link_3_text?: string;
    ai_chat_enabled?: boolean;
    tab_name_education?: string;
    tab_name_home?: string;
    tab_name_support?: string;
  };
  hasCustomVideos: boolean;
  hasChecklistItems: boolean;
  supportTicketingEnabled: boolean;
}

// Define all tips with target selectors
export const ALL_TIPS: Tip[] = [
  {
    id: 'customize_welcome_headline',
    title: 'Personalize Your Welcome',
    description: 'Customize the welcome headline to match your brand voice.',
    category: 'customization',
    targetSelector: 'home-customize-tab-welcome',
    arrowPosition: 'top',
    priority: 1,
    checkCondition: (data) => data.homeSettings.welcome_headline === 'Welcome to your custom software solution',
    navigation: { openPanel: 'home-customize', selectTab: 'welcome' },
  },
  {
    id: 'enable_welcome_video',
    title: 'Add a Welcome Video',
    description: 'Greet clients with a personalized video message on their dashboard.',
    category: 'content',
    targetSelector: 'home-customize-tab-welcome',
    arrowPosition: 'top',
    priority: 2,
    checkCondition: (data) => !data.homeSettings.welcome_video_enabled,
    navigation: { openPanel: 'home-customize', selectTab: 'welcome' },
  },
  {
    id: 'enable_daily_checklist',
    title: 'Enable Daily Checklist',
    description: 'Help your clients stay on track with a customizable daily checklist.',
    category: 'features',
    targetSelector: 'home-customize-tab-daily',
    arrowPosition: 'top',
    priority: 3,
    checkCondition: (data) => !data.homeSettings.daily_checklist_enabled,
    navigation: { openPanel: 'home-customize', selectTab: 'daily' },
  },
  {
    id: 'enable_announcements',
    title: 'Use Announcements',
    description: 'Keep clients informed with announcements on their dashboard.',
    category: 'features',
    targetSelector: 'home-customize-tab-announcements',
    arrowPosition: 'top',
    priority: 4,
    checkCondition: (data) => !data.homeSettings.announcements_enabled,
    navigation: { openPanel: 'home-customize', selectTab: 'announcements' },
  },
  {
    id: 'enable_custom_links',
    title: 'Add Quick Links',
    description: 'Give clients quick access to important resources with custom links.',
    category: 'features',
    targetSelector: 'home-customize-tab-links',
    arrowPosition: 'top',
    priority: 5,
    checkCondition: (data) => !data.homeSettings.custom_links_enabled,
    navigation: { openPanel: 'home-customize', selectTab: 'links' },
  },
  {
    id: 'add_custom_link_1',
    title: 'Add Your First Quick Link',
    description: 'Create a quick link to your most important resource.',
    category: 'content',
    targetSelector: 'home-customize-tab-links',
    arrowPosition: 'top',
    priority: 6,
    checkCondition: (data) => data.homeSettings.custom_links_enabled && !data.homeSettings.custom_link_1_text,
    navigation: { openPanel: 'home-customize', selectTab: 'links' },
  },
  {
    id: 'add_custom_link_2',
    title: 'Add a Second Quick Link',
    description: 'Expand your quick links with another helpful resource.',
    category: 'content',
    targetSelector: 'home-customize-tab-links',
    arrowPosition: 'top',
    priority: 7,
    checkCondition: (data) => data.homeSettings.custom_links_enabled && !!data.homeSettings.custom_link_1_text && !data.homeSettings.custom_link_2_text,
    navigation: { openPanel: 'home-customize', selectTab: 'links' },
  },
  {
    id: 'add_custom_link_3',
    title: 'Complete Your Quick Links',
    description: 'Add a third quick link to maximize client convenience.',
    category: 'content',
    targetSelector: 'home-customize-tab-links',
    arrowPosition: 'top',
    priority: 8,
    checkCondition: (data) => data.homeSettings.custom_links_enabled && !!data.homeSettings.custom_link_2_text && !data.homeSettings.custom_link_3_text,
    navigation: { openPanel: 'home-customize', selectTab: 'links' },
  },
  {
    id: 'enable_ai_support',
    title: 'Enable AI Support',
    description: 'Let AI help answer your clients\' questions automatically.',
    category: 'features',
    targetSelector: 'client-hub-ai-support',
    arrowPosition: 'right',
    priority: 9,
    checkCondition: (data) => !data.homeSettings.ai_chat_enabled,
  },
  {
    id: 'enable_support_ticketing',
    title: 'Enable Support Tickets',
    description: 'Allow clients to submit support tickets directly from their dashboard.',
    category: 'features',
    targetSelector: 'client-hub-support-ticketing',
    arrowPosition: 'right',
    priority: 10,
    checkCondition: (data) => !data.supportTicketingEnabled,
  },
  {
    id: 'set_brand_colors',
    title: 'Set Your Brand Colors',
    description: 'Customize the platform with your brand colors for a cohesive look.',
    category: 'customization',
    targetSelector: 'sidebar-branding',
    arrowPosition: 'left',
    priority: 11,
    checkCondition: (data) => !data.userSettings.primary_color,
  },
  {
    id: 'create_plan_1',
    title: 'Create Plan 1 URL',
    description: 'Set up your first onboarding plan for clients.',
    category: 'features',
    targetSelector: 'client-hub-plan-url',
    arrowPosition: 'bottom',
    priority: 12,
    checkCondition: (data) => !data.userSettings.agency_id_basic,
  },
  {
    id: 'create_plan_2',
    title: 'Customize Visible Onboarding Videos',
    description: 'Toggle videos on or off to customize what your clients see in their onboarding experience.',
    category: 'features',
    targetSelector: 'client-hub-advanced-mode',
    arrowPosition: 'right',
    priority: 13,
    checkCondition: (data) => !!data.userSettings.agency_id_basic && !data.userSettings.agency_id_advanced,
  },
  {
    id: 'create_plan_3',
    title: 'Install Onboarding Variations',
    description: 'Install multiple onboarding links and set permissions to specific roles and sub accounts inside of your company settings in HighLevel.',
    category: 'features',
    targetSelector: 'client-hub-plan-selector',
    arrowPosition: 'bottom',
    priority: 14,
    checkCondition: (data) => !!data.userSettings.agency_id_advanced && !data.userSettings.agency_id_elite,
  },
  {
    id: 'add_custom_videos',
    title: 'Add Custom Videos',
    description: 'Upload your own training videos to personalize the onboarding experience.',
    category: 'content',
    targetSelector: 'client-hub-custom-videos',
    arrowPosition: 'right',
    priority: 15,
    checkCondition: (data) => !data.hasCustomVideos,
  },
  {
    id: 'add_checklist_items',
    title: 'Create Onboarding Checklist',
    description: 'Guide clients through setup with custom checklist items. You can link to videos or URLs!',
    category: 'content',
    targetSelector: 'home-customize-tab-checklist',
    arrowPosition: 'top',
    priority: 16,
    checkCondition: (data) => !data.hasChecklistItems,
    navigation: { openPanel: 'home-customize', selectTab: 'checklist' },
  },
  {
    id: 'customize_tab_names',
    title: 'Customize Tab Names',
    description: 'Rename the Education, Home, and Support tabs to match your terminology.',
    category: 'customization',
    targetSelector: 'home-customize-tab-welcome',
    arrowPosition: 'top',
    priority: 17,
    checkCondition: (data) => 
      data.homeSettings.tab_name_education === 'Education' && 
      data.homeSettings.tab_name_home === 'Home' && 
      data.homeSettings.tab_name_support === 'Support',
    navigation: { openPanel: 'home-customize', selectTab: 'welcome' },
  },
  {
    id: 'enable_branded_ai',
    title: 'Upgrade to Branded AI',
    description: 'Get AI support with your branding for a seamless client experience.',
    category: 'features',
    targetSelector: 'client-hub-branded-ai',
    arrowPosition: 'right',
    priority: 18,
    checkCondition: (data) => !data.userSettings.branded_ai_support,
  },
  {
    id: 'finish_community',
    title: 'Exclusive skills, prompts & courses',
    description: 'The Community is included on every plan — grab exclusive AI skills, prompt libraries, GHL courses and done-for-you snapshots any time.',
    category: 'content',
    targetSelector: 'sidebar-community',
    arrowPosition: 'left',
    priority: 19,
    checkCondition: () => true,
  },
  {
    id: 'finish_dashboard',
    title: 'Your dashboard',
    description: 'This is home base — client logins, activity and SaaS health all land here as your users come through.',
    category: 'navigation',
    targetSelector: 'sidebar-dashboard',
    arrowPosition: 'left',
    priority: 20,
    checkCondition: () => true,
    navigation: { selectTool: 'dashboard' },
  },
  {
    id: 'finish_install',
    title: 'Install it in HighLevel',
    description: 'Open the installation guide and add your portal as a custom menu link in HighLevel. Clients cannot see it until that is done.',
    category: 'features',
    targetSelector: 'client-hub-install-guide',
    arrowPosition: 'left',
    priority: 21,
    checkCondition: () => true,
    navigation: { selectTool: 'client-hub' },
  },
  {
    id: 'finish_highlevel',
    title: 'Connect HighLevel',
    description: 'Connect your HighLevel account here so your sub-accounts are ready to pick across SaaS Suite.',
    category: 'features',
    targetSelector: 'settings-tab-highlevel',
    arrowPosition: 'right',
    priority: 22,
    checkCondition: () => true,
    navigation: { selectTool: 'settings', finishPath: '/app/highlevel' },
  },
];

// V3-flavored walkthrough — same steps as ALL_TIPS but pointing into the V3 editor surfaces.
// Each tip switches the V3 live-preview tab where appropriate before highlighting its target.
export const V3_TIPS: Tip[] = [
  {
    id: 'v3_customize_welcome_headline',
    title: 'Personalize Your Welcome',
    description: 'Click the headline in the welcome card to set a message that matches your brand voice.',
    category: 'customization',
    targetSelector: 'v3-home-welcome',
    arrowPosition: 'top',
    priority: 1,
    checkCondition: (data) => data.homeSettings.welcome_headline === 'Welcome to your custom software solution',
    navigation: { uiVersion: 'v3', v3LiveTab: 'home' },
  },
  {
    id: 'v3_enable_welcome_video',
    title: 'Add a Welcome Video',
    description: 'Drop in a personalized video greeting right under the welcome card.',
    category: 'content',
    targetSelector: 'v3-home-welcome-video',
    arrowPosition: 'top',
    priority: 2,
    checkCondition: (data) => !data.homeSettings.welcome_video_enabled,
    navigation: { uiVersion: 'v3', v3LiveTab: 'home' },
  },
  {
    id: 'v3_enable_daily_checklist',
    title: 'Enable Daily Checklist',
    description: 'Turn on the daily checklist to keep clients on track each day.',
    category: 'features',
    targetSelector: 'v3-home-daily',
    arrowPosition: 'top',
    priority: 3,
    checkCondition: (data) => !data.homeSettings.daily_checklist_enabled,
    navigation: { uiVersion: 'v3', v3LiveTab: 'home' },
  },
  {
    id: 'v3_enable_announcements',
    title: 'Use Announcements',
    description: 'Add an announcement bar to push updates to your clients.',
    category: 'features',
    targetSelector: 'v3-home-announcement',
    arrowPosition: 'top',
    priority: 4,
    checkCondition: (data) => !data.homeSettings.announcements_enabled,
    navigation: { uiVersion: 'v3', v3LiveTab: 'home' },
  },
  {
    id: 'v3_enable_custom_links',
    title: 'Add Quick Links',
    description: 'Give clients fast access to your most important resources with custom buttons.',
    category: 'features',
    targetSelector: 'v3-home-custom-links',
    arrowPosition: 'top',
    priority: 5,
    checkCondition: (data) => !data.homeSettings.custom_links_enabled,
    navigation: { uiVersion: 'v3', v3LiveTab: 'home' },
  },
  {
    id: 'v3_add_custom_link_1',
    title: 'Add Your First Quick Link',
    description: 'Create a quick link to your most important resource.',
    category: 'content',
    targetSelector: 'v3-home-custom-links',
    arrowPosition: 'top',
    priority: 6,
    checkCondition: (data) => data.homeSettings.custom_links_enabled && !data.homeSettings.custom_link_1_text,
    navigation: { uiVersion: 'v3', v3LiveTab: 'home' },
  },
  {
    id: 'v3_add_custom_link_2',
    title: 'Add a Second Quick Link',
    description: 'Expand your quick links with another helpful resource.',
    category: 'content',
    targetSelector: 'v3-home-custom-links',
    arrowPosition: 'top',
    priority: 7,
    checkCondition: (data) => data.homeSettings.custom_links_enabled && !!data.homeSettings.custom_link_1_text && !data.homeSettings.custom_link_2_text,
    navigation: { uiVersion: 'v3', v3LiveTab: 'home' },
  },
  {
    id: 'v3_add_custom_link_3',
    title: 'Complete Your Quick Links',
    description: 'Add a third quick link to maximize client convenience.',
    category: 'content',
    targetSelector: 'v3-home-custom-links',
    arrowPosition: 'top',
    priority: 8,
    checkCondition: (data) => data.homeSettings.custom_links_enabled && !!data.homeSettings.custom_link_2_text && !data.homeSettings.custom_link_3_text,
    navigation: { uiVersion: 'v3', v3LiveTab: 'home' },
  },
  {
    id: 'v3_enable_ai_support',
    title: 'Enable AI Support',
    description: 'Let AI answer client questions automatically from the support page.',
    category: 'features',
    targetSelector: 'v3-support-ai-chat',
    arrowPosition: 'top',
    priority: 9,
    checkCondition: (data) => !data.homeSettings.ai_chat_enabled,
    navigation: { uiVersion: 'v3', v3LiveTab: 'support' },
  },
  {
    id: 'v3_enable_support_ticketing',
    title: 'Enable Support Tickets',
    description: 'Allow clients to submit support tickets directly from their dashboard.',
    category: 'features',
    targetSelector: 'v3-support-ticketing',
    arrowPosition: 'top',
    priority: 10,
    checkCondition: (data) => !data.supportTicketingEnabled,
    navigation: { uiVersion: 'v3', v3LiveTab: 'support' },
  },
  {
    id: 'v3_set_brand_colors',
    title: 'Set Your Brand Colors',
    description: 'Customize the platform with your brand colors for a cohesive look.',
    category: 'customization',
    targetSelector: 'sidebar-branding',
    arrowPosition: 'left',
    priority: 11,
    checkCondition: (data) => !data.userSettings.primary_color,
  },
  {
    id: 'v3_create_plan_1',
    title: 'Create Plan 1 URL',
    description: 'Set up your first onboarding plan for clients.',
    category: 'features',
    targetSelector: 'v3-edu-plan-url',
    arrowPosition: 'bottom',
    priority: 12,
    checkCondition: (data) => !data.userSettings.agency_id_basic,
    navigation: { uiVersion: 'v3', v3LiveTab: 'education' },
  },
  {
    id: 'v3_create_plan_2',
    title: 'Customize Visible Onboarding Videos',
    description: 'Toggle videos on or off to customize what your clients see in their onboarding experience.',
    category: 'features',
    targetSelector: 'v3-edu-video-list',
    arrowPosition: 'top',
    priority: 13,
    checkCondition: (data) => !!data.userSettings.agency_id_basic && !data.userSettings.agency_id_advanced,
    navigation: { uiVersion: 'v3', v3LiveTab: 'education' },
  },
  {
    id: 'v3_create_plan_3',
    title: 'Install Onboarding Variations',
    description: 'Install multiple onboarding links and set permissions for specific roles and sub-accounts inside your HighLevel company settings.',
    category: 'features',
    targetSelector: 'v3-edu-plan-url',
    arrowPosition: 'bottom',
    priority: 14,
    checkCondition: (data) => !!data.userSettings.agency_id_advanced && !data.userSettings.agency_id_elite,
    navigation: { uiVersion: 'v3', v3LiveTab: 'education' },
  },
  {
    id: 'v3_add_custom_videos',
    title: 'Add Custom Videos',
    description: 'Upload your own training videos to personalize the onboarding experience.',
    category: 'content',
    targetSelector: 'v3-edu-add-custom-video',
    arrowPosition: 'top',
    priority: 15,
    checkCondition: (data) => !data.hasCustomVideos,
    navigation: { uiVersion: 'v3', v3LiveTab: 'education' },
  },
  {
    id: 'v3_add_checklist_items',
    title: 'Create Onboarding Checklist',
    description: 'Guide clients through setup with checklist items. You can link them to videos or URLs!',
    category: 'content',
    targetSelector: 'v3-home-checklist',
    arrowPosition: 'top',
    priority: 16,
    checkCondition: (data) => !data.hasChecklistItems,
    navigation: { uiVersion: 'v3', v3LiveTab: 'home' },
  },
  {
    id: 'v3_customize_tab_names',
    title: 'Customize Tab Names',
    description: 'Rename the Education, Home, and Support tabs to match your terminology.',
    category: 'customization',
    targetSelector: 'v3-edu-tab-names',
    arrowPosition: 'bottom',
    priority: 17,
    checkCondition: (data) =>
      data.homeSettings.tab_name_education === 'Education' &&
      data.homeSettings.tab_name_home === 'Home' &&
      data.homeSettings.tab_name_support === 'Support',
    navigation: { uiVersion: 'v3', v3LiveTab: 'education' },
  },
  {
    id: 'v3_enable_branded_ai',
    title: 'Upgrade to Branded AI',
    description: 'Get AI support with your branding for a seamless client experience.',
    category: 'features',
    targetSelector: 'client-hub-branded-ai',
    arrowPosition: 'right',
    priority: 18,
    checkCondition: (data) => !data.userSettings.branded_ai_support,
  },
  {
    id: 'v3_finish_community',
    title: 'Exclusive skills, prompts & courses',
    description: 'The Community is included on every plan — grab exclusive AI skills, prompt libraries, GHL courses and done-for-you snapshots any time.',
    category: 'content',
    targetSelector: 'sidebar-community',
    arrowPosition: 'left',
    priority: 19,
    checkCondition: () => true,
  },
  {
    id: 'v3_finish_dashboard',
    title: 'Your dashboard',
    description: 'This is home base — client logins, activity and SaaS health all land here as your users come through.',
    category: 'navigation',
    targetSelector: 'sidebar-dashboard',
    arrowPosition: 'left',
    priority: 20,
    checkCondition: () => true,
    navigation: { selectTool: 'dashboard' },
  },
  {
    id: 'v3_finish_install',
    title: 'Install it in HighLevel',
    description: 'Open the installation guide and add your portal as a custom menu link in HighLevel. Clients cannot see it until that is done.',
    category: 'features',
    targetSelector: 'client-hub-install-guide',
    arrowPosition: 'left',
    priority: 21,
    checkCondition: () => true,
    navigation: { selectTool: 'client-hub' },
  },
  {
    id: 'v3_finish_highlevel',
    title: 'Connect HighLevel',
    description: 'Connect your HighLevel account here so your sub-accounts are ready to pick across SaaS Suite.',
    category: 'features',
    targetSelector: 'settings-tab-highlevel',
    arrowPosition: 'right',
    priority: 22,
    checkCondition: () => true,
    navigation: { selectTool: 'settings', finishPath: '/app/highlevel' },
  },
];

/**
 * The interactive walkthrough ("Show me around").
 *
 * Unlike the ambient tips above, every step here is unconditional and carries
 * explicit navigation (which tool to open, which preview tab / panel to show),
 * so the tour can drive the app itself instead of dead-ending on a target that
 * only exists on some other screen. Built per UI version because the editor
 * surfaces differ between the V2 panels and the V3 live editor.
 */
export function buildWalkthrough(isV3: boolean): Tip[] {
  const hub = (
    id: string,
    title: string,
    description: string,
    category: Tip['category'],
    v3Target: string,
    v2Target: string,
    tab: 'home' | 'education' | 'support',
    v2Panel?: TipNavigation,
  ): Tip => ({
    id,
    title,
    description,
    category,
    targetSelector: isV3 ? v3Target : v2Target,
    arrowPosition: 'top',
    priority: 0,
    checkCondition: () => true,
    navigation: isV3
      ? { selectTool: 'client-hub', uiVersion: 'v3', v3LiveTab: tab }
      : { selectTool: 'client-hub', ...(v2Panel ?? {}) },
  });

  const steps: Tip[] = [
    hub(
      'tour_welcome',
      'Personalize your welcome',
      'This is the welcome message your clients see first. Set the headline and subheadline in your own brand voice.',
      'customization',
      'v3-home-welcome',
      'home-customize-tab-welcome',
      'home',
      { openPanel: 'home-customize', selectTab: 'welcome' },
    ),
    hub(
      'tour_welcome_video',
      'Add a welcome video',
      'Record a short greeting and drop it in here — it lifts activation more than anything else on the page.',
      'content',
      'v3-home-welcome-video',
      'home-customize-tab-welcome',
      'home',
      { openPanel: 'home-customize', selectTab: 'welcome' },
    ),
    hub(
      'tour_checklist',
      'Daily checklist',
      'Give clients a short list of daily actions. Each item can link to a video or a URL.',
      'features',
      'v3-home-daily',
      'home-customize-tab-daily',
      'home',
      { openPanel: 'home-customize', selectTab: 'daily' },
    ),
    hub(
      'tour_announcements',
      'Announcements',
      'Push updates, offers or maintenance notices straight to your clients’ home page.',
      'features',
      'v3-home-announcement',
      'home-customize-tab-announcements',
      'home',
      { openPanel: 'home-customize', selectTab: 'announcements' },
    ),
    hub(
      'tour_links',
      'Quick links',
      'Add up to three buttons pointing at whatever your clients ask for most — booking, billing, your KB.',
      'features',
      'v3-home-custom-links',
      'home-customize-tab-links',
      'home',
      { openPanel: 'home-customize', selectTab: 'links' },
    ),
    hub(
      'tour_videos',
      'Choose the training videos',
      'Toggle the onboarding videos on or off so clients only see what applies to your offer.',
      'content',
      'v3-edu-video-list',
      'client-hub-advanced-mode',
      'education',
    ),
    hub(
      'tour_plan_url',
      'Your onboarding plan URLs',
      'Each plan gets its own hub URL. This is what you install inside HighLevel for that group of clients.',
      'features',
      'v3-edu-plan-url',
      'client-hub-plan-url',
      'education',
    ),
    hub(
      'tour_support',
      'AI support & tickets',
      'Turn on AI support so clients get instant answers, and ticketing for anything the AI hands over to you.',
      'features',
      'v3-support-ai-chat',
      'client-hub-ai-support',
      'support',
    ),
    {
      id: 'tour_install',
      title: 'Install it in HighLevel',
      description:
        'Open the installation guide and add your hub as a custom menu link. Until that is done, your clients cannot see any of this.',
      category: 'features',
      targetSelector: 'client-hub-install-guide',
      arrowPosition: 'left',
      priority: 0,
      checkCondition: () => true,
      navigation: { selectTool: 'client-hub' },
    },
    {
      id: 'tour_dashboard',
      title: 'Your dashboard',
      description:
        'Home base. Your live hub URL sits at the top, with client logins, activity and SaaS health underneath as users come through.',
      category: 'navigation',
      targetSelector: 'dashboard-hub-url',
      arrowPosition: 'bottom',
      priority: 0,
      checkCondition: () => true,
      navigation: { selectTool: 'dashboard' },
    },
    {
      id: 'tour_community',
      title: 'Community: skills, prompts & courses',
      description:
        'Included on every plan — exclusive AI skills, prompt libraries, GHL courses and done-for-you snapshots.',
      category: 'content',
      targetSelector: 'community-nav',
      arrowPosition: 'bottom',
      priority: 0,
      checkCondition: () => true,
      navigation: { selectTool: 'community', communityTab: 'feed' },
    },
    ...buildMenuRemovalTour(),
    {
      id: 'tour_settings',
      title: 'Settings & billing',
      description:
        'Your plan, add-ons, team and account live here. Settings opens from your profile card.',
      category: 'navigation',
      targetSelector: 'sidebar-profile',
      arrowPosition: 'left',
      priority: 0,
      checkCondition: () => true,
      navigation: { selectTool: 'settings' },
    },
    {
      id: 'tour_highlevel',
      title: 'Connect HighLevel',
      description: HIGHLEVEL_FINISH_COPY,
      category: 'features',
      targetSelector: 'settings-tab-highlevel',
      arrowPosition: 'right',
      priority: 0,
      checkCondition: () => true,
      navigation: { selectTool: 'settings', finishPath: HIGHLEVEL_FINISH_PATH },
    },
  ];

  // Keep authored order stable (all priorities are equal on purpose).
  return steps.map((s, i) => ({ ...s, priority: i + 1 }));
}

/**
 * Short tour for members who signed up straight into the community
 * (saassuite.ai/community → /signup?next=/app/community). Runs once.
 */
export const COMMUNITY_TOUR: Tip[] = [
  {
    id: 'community_tour_nav',
    title: 'Welcome to the community',
    description: 'These icons switch between the Feed, Snapshot Vault, Academy, Ideas Board and the team.',
    category: 'navigation',
    targetSelector: 'community-nav',
    arrowPosition: 'bottom',
    priority: 1,
    checkCondition: () => true,
    navigation: { communityTab: 'feed' },
  },
  {
    id: 'community_tour_snapshots',
    title: 'Snapshot Vault',
    description: 'Done-for-you HighLevel snapshots you can install into your agency in a couple of clicks.',
    category: 'content',
    targetSelector: 'community-page-snapshots',
    arrowPosition: 'top',
    priority: 2,
    checkCondition: () => true,
    navigation: { communityTab: 'snapshots' },
  },
  {
    id: 'community_tour_academy',
    title: 'Academy: skills, prompts & courses',
    description: 'AI skills, prompt libraries, GHL courses and the tech library all live here — free on every plan.',
    category: 'content',
    targetSelector: 'community-page-academy',
    arrowPosition: 'top',
    priority: 3,
    checkCondition: () => true,
    navigation: { communityTab: 'academy' },
  },
  {
    id: 'community_tour_feed',
    title: 'Post in the feed',
    description: 'Ask questions, share wins and see what other agency owners are shipping.',
    category: 'navigation',
    targetSelector: 'community-page-feed',
    arrowPosition: 'top',
    priority: 4,
    checkCondition: () => true,
    navigation: { communityTab: 'feed' },
  },
  {
    id: 'community_tour_ask',
    title: 'Message the team',
    description: 'Stuck on something? Message us right here and we will get back to you.',
    category: 'features',
    targetSelector: 'community-page-ask',
    arrowPosition: 'top',
    priority: 5,
    checkCondition: () => true,
    navigation: { communityTab: 'ask' },
  },
];

/** Every walkthrough ends on the HighLevel row in Settings, and "Finish tour" opens the connection page. */
export const HIGHLEVEL_FINISH_PATH = '/app/highlevel';
const HIGHLEVEL_FINISH_COPY = 'Connect your HighLevel account here so your sub-accounts are ready to pick across SaaS Suite.';

/** Part 1 of the walkthrough: where everything lives in the sidebar. */
export function buildNavTour(): Tip[] {
  const step = (
    id: string,
    title: string,
    description: string,
    targetSelector: string,
    navigation?: TipNavigation,
  ): Tip => ({
    id, title, description, targetSelector, navigation,
    category: 'navigation', arrowPosition: 'right', priority: 0, checkCondition: () => true,
  });
  return [
    step(
      'nav_client_hub_group',
      'Client Hub',
      'Design, Edit Pages, workflows, menu link removal, and Client Support are grouped here.',
      'sidebar-section-client-hub',
    ),
    step(
      'nav_edit_pages',
      'Edit Pages',
      'Turn training videos on or off for each plan, reorder them, and add your own.',
      'sidebar-client-hub',
    ),
    step(
      'nav_support',
      'Client Support',
      'Tickets and AI chats from your clients show up here. The badge is how many are still open.',
      'sidebar-support',
    ),
    step(
      'nav_resources',
      'Resources',
      'Learning Hub, Community, Help, and Agents are in this group.',
      'sidebar-section-resources',
    ),
    step(
      'nav_learning',
      'Learning Hub',
      'Setup steps, walkthroughs, lessons, and free resources start here.',
      'sidebar-learning',
    ),
    step(
      'nav_profile',
      'Account',
      'Settings, including agency name and log out, open from your profile card.',
      'sidebar-profile',
    ),
    step('nav_billing', 'Billing', 'Manage your plan, payment method and invoices here.', 'settings-tab-billing', { selectTool: 'settings' }),
    step('nav_admins', 'Admins', 'Invite your team, choose what each person can see or edit, and set who gets notified.', 'settings-tab-admins', { selectTool: 'settings' }),
    step('nav_highlevel', 'Connect HighLevel', HIGHLEVEL_FINISH_COPY, 'settings-tab-highlevel', { selectTool: 'settings', finishPath: HIGHLEVEL_FINISH_PATH }),
  ];
}

interface TipsBotContextType {

  isEnabled: boolean;
  currentTip: Tip | null;
  dismissedTips: string[];
  availableTips: Tip[];
  dismissTip: (tipId: string) => Promise<void>;
  refreshTips: () => Promise<void>;
  showNextTip: () => void;
  /** Walkthrough only: go back one step. Never wraps. */
  showPrevTip: () => void;
  isLoading: boolean;
  isWalkthroughMode: boolean;
  startWalkthrough: (kind?: TourKind, fromStep?: number) => void;
  tourKind: TourKind | null;
  startTipSequence: (tips: Tip[]) => void;
  stopWalkthrough: (opts?: { permanent?: boolean; disableAll?: boolean }) => void;
  executeNavigation: (tip: Tip) => void;
}

const TipsBotContext = createContext<TipsBotContextType | undefined>(undefined);

export const TipsBotProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { email, actualEmail } = useUser();
  const tourEmail = (actualEmail || email || '').trim().toLowerCase() || null;
  const tourEmailRef = useRef(tourEmail);
  tourEmailRef.current = tourEmail;
  const { trackEvent } = useSessionTracker();
  const [isEnabled, setIsEnabled] = useState(false);
  const [dismissedTips, setDismissedTips] = useState<string[]>([]);
  const [availableTips, setAvailableTips] = useState<Tip[]>([]);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [tipCheckData, setTipCheckData] = useState<TipCheckData | null>(null);
  const [isWalkthroughMode, setIsWalkthroughMode] = useState(false);
  const [walkthroughTips, setWalkthroughTips] = useState<Tip[]>([]);
  const [sessionSuppressed, setSessionSuppressed] = useState(false);
  const [tourKind, setTourKind] = useState<TourKind | null>(null);

  const rawCurrentTip = isWalkthroughMode
    ? (walkthroughTips.length > 0
        ? walkthroughTips[Math.min(currentTipIndex, walkthroughTips.length - 1)]
        : null)
    : (availableTips.length > 0 ? availableTips[currentTipIndex % availableTips.length] : null);
  const currentTip = sessionSuppressed ? null : rawCurrentTip;

  // Fetch all necessary data
  const fetchData = async () => {
    if (!email) {
      setIsLoading(false);
      return;
    }

    try {
      // Fetch user settings and check if tips bot is enabled
      const { data: userData } = await supabase
        .from('saas_suite_users')
        .select('tips_bot_enabled, v2_navigation_enabled, client_hub_enabled, branded_ai_support, primary_color, agency_id_basic, agency_id_advanced, agency_id_elite, login_welcome_headline, support_ticketing_enabled, agency_id')
        .ilike('email', email)
        .maybeSingle();

      if (!userData?.tips_bot_enabled) {
        setIsEnabled(false);
        setIsLoading(false);
        return;
      }

      setIsEnabled(true);

      // Fetch home settings
      const { data: homeData } = await supabase
        .from('v2_home_settings')
        .select('*')
        .eq('agency_id', userData.agency_id || '')
        .maybeSingle();

      // Check for custom videos
      const { count: videoCount } = await supabase
        .from('custom_onboarding_videos')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', userData.agency_id || '');

      // Check for checklist items
      const { count: checklistCount } = await supabase
        .from('agency_onboarding_checklist')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', userData.agency_id || '');

      // Fetch dismissed tips
      const { data: dismissedData } = await supabase
        .from('user_dismissed_tips')
        .select('tip_id')
        .ilike('user_email', email);

      const dismissed = dismissedData?.map(d => d.tip_id) || [];
      setDismissedTips(dismissed);

      const checkData: TipCheckData = {
        userSettings: {
          v2_navigation_enabled: userData.v2_navigation_enabled,
          client_hub_enabled: userData.client_hub_enabled,
          branded_ai_support: userData.branded_ai_support,
          primary_color: userData.primary_color,
          agency_id_basic: userData.agency_id_basic,
          agency_id_advanced: userData.agency_id_advanced,
          agency_id_elite: userData.agency_id_elite,
          login_welcome_headline: userData.login_welcome_headline,
        },
        homeSettings: {
          daily_checklist_enabled: homeData?.daily_checklist_enabled ?? true,
          welcome_headline: homeData?.welcome_headline ?? 'Welcome to your custom software solution',
          welcome_subheadline: homeData?.welcome_subheadline,
          welcome_video_enabled: homeData?.welcome_video_enabled ?? false,
          welcome_video_url: homeData?.welcome_video_url,
          announcements_enabled: homeData?.announcements_enabled ?? false,
          announcements_headline: homeData?.announcements_headline,
          custom_links_enabled: homeData?.custom_links_enabled ?? false,
          custom_link_1_text: homeData?.custom_link_1_text,
          custom_link_2_text: homeData?.custom_link_2_text,
          custom_link_3_text: homeData?.custom_link_3_text,
          ai_chat_enabled: homeData?.ai_chat_enabled ?? true,
          tab_name_education: homeData?.tab_name_education ?? 'Education',
          tab_name_home: homeData?.tab_name_home ?? 'Home',
          tab_name_support: homeData?.tab_name_support ?? 'Support',
        },
        hasCustomVideos: (videoCount || 0) > 0,
        hasChecklistItems: (checklistCount || 0) > 0,
        supportTicketingEnabled: userData.support_ticketing_enabled || false,
      };

      setTipCheckData(checkData);

      // Filter tips based on conditions and dismissed status
      const available = ALL_TIPS
        .filter(tip => !tip.id.includes('finish_'))
        .filter(tip => !dismissed.includes(tip.id))
        .filter(tip => tip.checkCondition(checkData))
        .sort((a, b) => a.priority - b.priority);

      setAvailableTips(available);
      setCurrentTipIndex(0);
    } catch (error) {
      console.error('Error fetching tips data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [email]);

  // Listen for external walkthrough start events. detail: { kind?, resume? }
  const startRef = useRef<(k?: TourKind, s?: number) => void>(() => {});
  useEffect(() => {
    const handleStartWalkthrough = (e: Event) => {
      const d = (e as CustomEvent<{ kind?: TourKind; resume?: boolean }>).detail || {};
      const kind = d.kind ?? 'nav';
      const step = d.resume && tourEmailRef.current ? readTour(kind, tourEmailRef.current).step : 0;
      startRef.current(kind, step);
    };
    window.addEventListener('start-walkthrough', handleStartWalkthrough);
    return () => window.removeEventListener('start-walkthrough', handleStartWalkthrough);
  }, []);

  const dismissTip = async (tipId: string) => {
    if (!email) return;

    try {
      await supabase
        .from('user_dismissed_tips')
        .insert({ user_email: email, tip_id: tipId });

      setDismissedTips(prev => [...prev, tipId]);
      setAvailableTips(prev => prev.filter(t => t.id !== tipId));
      // Dismissing any tip stops the bot from showing further tips this session.
      setSessionSuppressed(true);
      setIsWalkthroughMode(false);
      setWalkthroughTips([]);
    } catch (error) {
      console.error('Error dismissing tip:', error);
    }
  };

  const refreshTips = async () => {
    await fetchData();
  };

  const showNextTip = () => {
    const tipsArray = isWalkthroughMode ? walkthroughTips : availableTips;
    if (isWalkthroughMode) {
      // Never wrap in a walkthrough: the last step is the end of the tour.
      setCurrentTipIndex((prev) => {
        const next = Math.min(prev + 1, tipsArray.length - 1);
        if (next !== prev) {
          trackEvent('walkthrough_step', tipsArray[next]?.id, {
            step: next + 1,
            total: tipsArray.length,
          });
        }
        return next;
      });
      return;
    }
    if (tipsArray.length > 1) {
      setCurrentTipIndex((prev) => (prev + 1) % tipsArray.length);
    }
  };

  const showPrevTip = () => {
    if (!isWalkthroughMode) return;
    setCurrentTipIndex((prev) => Math.max(prev - 1, 0));
  };

  const startWalkthrough = (kind: TourKind = 'nav', fromStep = 0) => {
    setSessionSuppressed(false);
    trackEvent('walkthrough_started', kind === 'nav' ? 'Navigation walkthrough' : 'Client Hub walkthrough', { step: fromStep + 1 });
    if (tourEmail) markShownThisSession(kind, tourEmail);
    const begin = () => {
      const steps = kind === 'nav'
        ? buildNavTour()
        : buildWalkthrough((window as any).__clientHubUiVersion === 'v3');
      setTourKind(kind);
      setWalkthroughTips(steps);
      setCurrentTipIndex(Math.min(Math.max(0, fromStep), steps.length - 1));
      setIsWalkthroughMode(true);
    };
    // The tour lives inside the app. Started from anywhere outside /app, its
    // steps had nothing to attach to — move there first.
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/app')) {
      window.history.pushState({}, '', kind === 'nav' ? '/app/walkthrough' : '/app/client-hub');
      window.dispatchEvent(new PopStateEvent('popstate'));
      setTimeout(begin, 900);
      return;
    }
    begin();
  };

  startRef.current = startWalkthrough;

  // Start an ad-hoc, explicitly provided tour (e.g. announcement mini-tours).
  const startTipSequence = (tips: Tip[]) => {
    if (!tips.length) return;
    setSessionSuppressed(false);
    setTourKind(null);
    setWalkthroughTips(tips);
    setCurrentTipIndex(0);
    setIsWalkthroughMode(true);
  };

  const stopWalkthrough = (opts?: { permanent?: boolean; disableAll?: boolean }) => {
    const permanent = !!opts?.permanent;
    if (isWalkthroughMode) {
      const total = walkthroughTips.length;
      const reached = currentTipIndex + 1;
      const done = reached >= total;
      trackEvent(done || permanent ? 'walkthrough_completed' : 'walkthrough_abandoned', walkthroughTips[currentTipIndex]?.id, {
        step: reached,
        total,
        percent: total ? Math.round((reached / total) * 100) : 0,
        tour: tourKind,
      });
      if (tourEmail && (permanent || opts?.disableAll)) {
        suppressAutoToursForSession(tourEmail);
        if (opts?.disableAll) setToursDisabled(tourEmail, true);
        if (tourKind) recordComplete(tourKind, tourEmail);
        else recordSequenceComplete(walkthroughTips[0]?.id || '', tourEmail);
      } else if (tourKind && tourEmail) {
        if (done) recordComplete(tourKind, tourEmail);
        else recordDismiss(tourKind, tourEmail, currentTipIndex);
      }
    }
    setTourKind(null);
    setIsWalkthroughMode(false);
    setWalkthroughTips([]);
    setCurrentTipIndex(0);
  };

  // Execute navigation for a tip - this dispatches a custom event that ClientHub listens to
  const executeNavigation = (tip: Tip) => {
    if (tip.navigation) {
      if (tip.navigation.openSidebarSection) {
        window.dispatchEvent(
          new CustomEvent('tipbot-open-sidebar-section', { detail: { section: tip.navigation.openSidebarSection } }),
        );
      }
      if (tip.navigation.selectTool) {
        window.dispatchEvent(
          new CustomEvent('tipbot-select-tool', { detail: { tool: tip.navigation.selectTool } }),
        );
      }
      const event = new CustomEvent('tipbot-navigate', {
        detail: {
          openPanel: tip.navigation.openPanel,
          selectTab: tip.navigation.selectTab,
          v3LiveTab: tip.navigation.v3LiveTab,
          uiVersion: tip.navigation.uiVersion,
          communityTab: tip.navigation.communityTab,
        }
      });
      window.dispatchEvent(event);
    }
  };

  return (
    <TipsBotContext.Provider value={{
      isEnabled: isEnabled || isWalkthroughMode,
      currentTip,
      dismissedTips,
      availableTips: isWalkthroughMode ? walkthroughTips : availableTips,
      dismissTip,
      refreshTips,
      showNextTip,
      showPrevTip,
      isLoading,
      isWalkthroughMode,
      startWalkthrough,
      tourKind,
      startTipSequence,
      stopWalkthrough,
      executeNavigation,
    }}>
      {children}
    </TipsBotContext.Provider>
  );
};

export const useTipsBot = () => {
  const context = useContext(TipsBotContext);
  if (context === undefined) {
    throw new Error('useTipsBot must be used within a TipsBotProvider');
  }
  return context;
};
