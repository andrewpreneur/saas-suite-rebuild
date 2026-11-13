import { Tip } from './TipsBotContext';

/**
 * Short interactive tours that fire when a user clicks an announcement image on
 * the dashboard. Same UI as the main walkthrough — greys out the page, scrolls
 * to the real feature and highlights it. Two steps each so they stay quick; the
 * community tour is five because it walks each page of the hub.
 */
const step = (
  id: string,
  title: string,
  description: string,
  targetSelector: string,
  navigation: Tip['navigation'],
  arrowPosition: Tip['arrowPosition'] = 'top',
  category: Tip['category'] = 'features',
  priority = 1,
): Tip => ({
  id,
  title,
  description,
  category,
  targetSelector,
  arrowPosition,
  priority,
  checkCondition: () => true,
  navigation,
});

const community = (communityTab: 'feed' | 'snapshots' | 'academy' | 'ideas' | 'ask') =>
  ({ selectTool: 'community', communityTab }) as const;
const support = { selectTool: 'support' } as const;
const hubHome = { selectTool: 'client-hub', uiVersion: 'v3', v3LiveTab: 'home' } as const;
const hubEdu = { selectTool: 'client-hub', uiVersion: 'v3', v3LiveTab: 'education' } as const;

export const ANNOUNCEMENT_TOURS: Record<string, Tip[]> = {
  community: [
    step('ann_community_1', 'The feed', 'Share wins, ask questions and react to other agency owners. New posts land here first.', 'community-page-feed', community('feed'), 'left', 'content', 1),
    step('ann_community_2', 'Snapshot Vault', 'Grab done-for-you HighLevel snapshots you can import straight into a sub-account.', 'community-page-snapshots', community('snapshots'), 'left', 'features', 2),
    step('ann_community_3', 'Academy', 'Structured lessons on running your SaaS — progress is tracked as you complete them.', 'community-page-academy', community('academy'), 'left', 'content', 3),
    step('ann_community_4', 'Ideas Board', 'Post a feature idea or upvote others. Statuses show what is pending, planned and live.', 'community-page-ideas', community('ideas'), 'left', 'features', 4),
    step('ann_community_5', 'Message the Team', 'Need us directly? Start a private thread here and our team replies inside the hub.', 'community-page-ask', community('ask'), 'left', 'features', 5),
  ],
  slack: [
    step('ann_slack_1', 'One-click install', 'Hit Add to Slack and pick the channel SaaSSuite should post into — available on every plan.', 'slack-install', { routePath: '/slack-integration' }, 'left', 'features', 1),
    step('ann_slack_2', 'Alerts and commands', 'You get pinged on logins, onboardings and tickets, plus slash commands to run SaaSSuite from Slack.', 'slack-commands', { routePath: '/slack-integration' }, 'left', 'features', 2),
  ],
  affiliate: [
    step('ann_affiliate_1', 'Recurring commissions', 'Every tier pays out monthly for as long as your referral stays subscribed.', 'affiliate-rewards', { routePath: '/affiliate' }, 'left', 'features', 1),
    step('ann_affiliate_2', 'Apply in a minute', 'Fill this form to get your personal referral link and payout details.', 'affiliate-form-card', { routePath: '/affiliate' }, 'left', 'content', 2),
  ],
  'module-reorder': [
    step('ann_modules_1', 'Drag to reorder', 'Every built-in and custom module lives here — drag the handles to set the order clients see.', 'v3-edu-video-list', hubEdu, 'left', 'customization', 1),
    step('ann_modules_2', 'Rename anything', 'Rename modules and tabs to your own language — changes hit your clients instantly.', 'v3-edu-tab-names', hubEdu, 'left', 'customization', 2),
  ],
  'ticket-reply': [
    step('ann_tickets_1', 'Your support queues', 'AI chats, human handovers and client tickets all land in these tabs.', 'support-tabs', support, 'left', 'navigation', 1),
    step('ann_tickets_2', 'Reply with attachments', 'Open a ticket, write your response and attach a screenshot — our AI emails your client a polished update.', 'support-ticket-filters', support, 'left', 'features', 2),
  ],
  'video-thumbnail': [
    step('ann_thumb_1', 'Upload a thumbnail', 'Click this box on the welcome video card to upload a custom cover — it saves automatically.', 'v3-home-video-thumbnail', hubHome, 'left', 'customization', 1),
    step('ann_thumb_2', 'Match your copy', 'Pair the thumbnail with your headline and subheadline so the whole card feels intentional.', 'v3-home-welcome', hubHome, 'left', 'customization', 2),
  ],
  'popup-iframe': [
    step('ann_popup_1', 'Your custom buttons', 'These quick-link buttons appear on your client home page.', 'v3-home-custom-links', hubHome, 'left', 'features', 1),
    step('ann_popup_2', 'Open as popup iFrame', 'Each button has a toggle — leave it off for a new tab, or flip it on to open in a slick in-app popup.', 'v3-home-custom-links', hubHome, 'left', 'customization', 2),
  ],
};
