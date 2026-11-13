import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import prerender from "@prerenderer/rollup-plugin";
import { getAllPublicRoutes } from "./scripts/seo-routes";
import { cleanPrerenderedHtml, deferFunnelModuleScript, preloadLanderLcpImage, shelveHomepageMedia } from "./scripts/prerenderPostProcess";
import { appVersionPlugin } from "./scripts/appVersionPlugin";

// Paid-traffic landers: prerendered for speed, but noindexed via RobotsPolicy.
const CAMPAIGN_ROUTES = ["/go", "/go-paid", "/breakdown-paid"];
// Checkout and thank-you are public funnel steps. They stay out of the sitemap
// (tests forbid those URLs there) and are still written to static HTML.
const FUNNEL_PRERENDER_ROUTES = ["/one-feature-kit/checkout", "/one-feature-kit/thank-you"];
// Ad landers. Own HTML so the SPA fallback (homepage index.html) is not what
// paid traffic downloads. Kept out of the sitemap; RobotsPolicy noindexes them.
const LANDER_PRERENDER_ROUTES = [
  "/onefeaturetraining-1",
  "/onefeaturetraining-2",
  "/onefeaturetraining-3",
  "/onefeaturetraining-4",
  "/onefeaturetraining-5",
  "/onefeaturetraining-success",
  "/onefeaturetraining-quiz",
  "/aisaas",
  "/agents",
  "/work-with-us",
  "/highlevelers",
  "/highlevelers-upgrade",
  "/founders-plan",
  "/one-feature-away",
  "/black-friday",
  "/skool-challenge",
];

export default defineConfig(async ({ mode }) => {
  // Make Supabase creds available to the build-time route fetch.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));

  const prerenderRoutes =
    mode === "production"
      ? [...(await getAllPublicRoutes()).map((r) => r.path), ...CAMPAIGN_ROUTES, ...FUNNEL_PRERENDER_ROUTES, ...LANDER_PRERENDER_ROUTES]
      : [];

  if (mode === "production") {
    console.log(`[prerender] ${prerenderRoutes.length} routes`);
  }

  return {
  server: {
    host: "::",
    port: 8080,
    allowedHosts: ["onefeaturekit.com", "www.onefeaturekit.com", "saassuite.ai", "gofreesaas.com"],
  },
  plugins: [
    appVersionPlugin(),
    react(),
    mode === 'development' && componentTagger(),
    mode === 'production' && prerender({
      routes: prerenderRoutes,
      renderer: '@prerenderer/renderer-puppeteer',
      rendererOptions: {
        renderAfterTime: 3000,
        maxConcurrentRoutes: 3,
        timeout: 60000,
        headless: true,
        launchOptions: {
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
          ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
        },
      },
      postProcess(renderedRoute: { route: string; html: string }) {
        renderedRoute.html = cleanPrerenderedHtml(renderedRoute.html)
          .replace(/<html(?![^>]*\slang=)/i, '<html lang="en"')
          .trim();
        // index.html is the SPA fallback. Shelve its hero media so a miss
        // does not download the homepage GIF/MP4. `/` promotes them before paint.
        if (renderedRoute.route === "/") {
          renderedRoute.html = shelveHomepageMedia(renderedRoute.html);
        }
        // Funnel pages hydrate. Other marketing HTML stays prerendered for crawlers;
        // the app shell client-renders those routes.
        if (
          renderedRoute.route === "/one-feature-kit" ||
          renderedRoute.route.startsWith("/one-feature-kit/")
        ) {
          renderedRoute.html = deferFunnelModuleScript(
            renderedRoute.html.replace(
              /<html\b(?![^>]*\bdata-ss-hydrate=)/i,
              '<html data-ss-hydrate="1"',
            ),
          );
        } else if (LANDER_PRERENDER_ROUTES.includes(renderedRoute.route)) {
          // Same paint-first boot as the kit, without hydration. These routes
          // client-render inside the app shell, and hydrateRoot rejects that
          // Suspense HTML. A head module preload was keeping the hero behind
          // the whole app graph on slow mobile. The LCP image is preloaded
          // from the snapshot so it starts before the body is parsed.
          renderedRoute.html = deferFunnelModuleScript(preloadLanderLcpImage(renderedRoute.html));
        }
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return;
          // Stripe stays out of the sales page. It loads only from the checkout dynamic import.
          if (id.includes("node_modules/@stripe/")) return "stripe";
          if (
            id.includes("node_modules/react-dom") ||
            id.includes("node_modules/react-router") ||
            id.includes("node_modules/scheduler") ||
            /node_modules\/react\//.test(id)
          ) {
            return "react-vendor";
          }
          if (id.includes("node_modules/@supabase/")) return "supabase";
        },
      },
    },
  },
  };
});
