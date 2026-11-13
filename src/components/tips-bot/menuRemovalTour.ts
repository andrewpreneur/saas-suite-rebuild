import type { Tip } from './TipsBotContext';

/** Menu-removal steps in the full interactive walkthrough. The page play button opens the training video. */
export function buildMenuRemovalTour(): Tip[] {
  const steps: [string, string, string][] = [
    ['menu-manual-links', 'Choose the links to hide', 'Select Main Navigation items to hide. Switch to Settings Navigation to select settings items too. Hiding links does not change HighLevel permissions.'],
    ['menu-manual-preset', 'Name your preset', 'Give this combination a clear name, such as AI Studio. Your automation uses that exact saved preset name.'],
    ['menu-manual-scope', 'Choose where it applies', 'For a test, enable specific sub-account only and choose your test account. Leaving this off applies the manual rule to all sub-accounts.'],
    ['menu-manual-apply', 'Save your manual rule', 'Apply saves your selected links. Install your SaaSSuite Custom CSS and JavaScript in HighLevel and refresh the test account to check. The tour never saves or changes rules for you.'],
    ['menu-manual-rules', 'Review saved presets', 'Pause, edit or copy saved rules here. The webhook icon jumps to automation setup for that preset.'],
    ['menu-automation-connection', 'Connect HighLevel', 'Connect in Settings → HighLevel with a private integration token and one location ID. Include custom-menu-link.write for onboarding-link assignment, then return here.'],
    ['menu-automation-snapshot', 'Install the snapshot', 'Import this snapshot into your main agency account. It contains the workflow actions for menu removal, AI permissions and onboarding-link assignment.'],
    ['menu-automation-workflow', 'Open the workflow', 'In HighLevel, open Automations → Menu Link Removal and locate the Custom Webhook removal action.'],
    ['menu-automation-secret', 'Save your webhook secret', 'Use your existing secret or create one for your first setup. Save it in the X-SaaSSuite-Webhook-Secret header. Rotating invalidates the old secret; the tour never rotates it.'],
    ['menu-automation-removal', 'Configure menu removal', 'Choose your saved preset and copy the POST URL, header and request body. Map location_id to the buyer’s sub-account and email to their login email.'],
    ['menu-automation-ai', 'Optional: AI permissions', 'For standalone AI features, choose what the buyer can access and copy the PUT action and scopes body into the workflow. Skip this action if you do not need AI-only permissions.'],
    ['menu-automation-assignment', 'Optional: assign onboarding', 'Choose the exact menu link and Add or Remove. Copy this separate POST action into the workflow with the chosen link ID and buyer’s location ID.'],
    ['menu-automation-test', 'Publish and test', 'Publish the workflow and test one real test sub-account, using a fresh event ID if supplied. Refresh HighLevel and verify hidden items and the correct onboarding link. Use Text us if anything is missing.'],
  ];
  return steps.map(([targetSelector, title, description], i) => ({
    id: `tour_${targetSelector}`, title, description, targetSelector,
    category: 'features', arrowPosition: 'top', priority: i + 1,
    checkCondition: () => true,
    navigation: { selectTool: 'streamline', openSidebarSection: 'grow' },
  }));
}
