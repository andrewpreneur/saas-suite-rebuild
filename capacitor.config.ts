import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.p5d824616a50a49a49b578fb62de744ee',
  appName: 'saas-suite',
  webDir: 'dist',
  server: {
    // Live-reload from the Lovable sandbox while developing on a device.
    // Remove this block (and re-run `npx cap sync`) for store builds so the app
    // loads the bundled `dist` build instead.
    url: 'https://5d824616-a50a-49a4-9b57-8fb62de744ee.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
};

export default config;
