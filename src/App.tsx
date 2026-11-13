import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { UserProvider } from "@/contexts/UserContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { SessionTrackerProvider, SessionRouteTracker } from "@/contexts/SessionTrackerContext";
import { CoPilotProvider } from "@/contexts/CoPilotContext";
import { CoPilotShell } from "@/components/copilot/CoPilotShell";
import { ChatProvider } from "@/components/chat-copilot/ChatContext";
import SiteTracker from "@/components/SiteTracker";
import RobotsPolicy from "@/components/RobotsPolicy";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/premium/PageSkeleton";
import { lazyRoute, RouteErrorBoundary } from "@/lib/lazyRoute";
import { pathKey } from "@/entries/paintFirst";
import { TrainingSuccessShell } from "@/components/one-feature/TrainingSuccessShell";
import { AppVersionNotice } from "@/components/AppVersionNotice";

import Index from "./pages/Index";
import Signup from "./pages/Signup";
import StoreBillingLinker from "@/components/store/StoreBillingLinker";
import NativeOAuthReturn from "@/components/NativeOAuthReturn";
import PageSEO from "./components/PageSEO";
import { FIRST_CLIENT_COURSE, AGENCY_FREEDOM_COURSE } from "@/config/courses";
import { TipsBotProvider, TipsBotToast } from "@/components/tips-bot";
import MetaPixelRouteTracker from "@/components/MetaPixelRouteTracker";
import { isKitHost } from "@/funnel/one-feature-kit/host";

const CommunityLanding = lazyRoute(() => import("./pages/CommunityLanding"));
const SkillLanding = lazyRoute(() => import("./pages/SkillLanding"));
const SetupGuide = lazyRoute(() => import("./pages/SetupGuide"));
const PublicCopilotPage = lazyRoute(() => import("./pages/PublicCopilot"));
const AppPage = lazyRoute(() => import("./pages/App"));
const Auth = lazyRoute(() => import("./pages/Auth"));
const Login = lazyRoute(() => import("./pages/Login"));
const NativeAuthCallback = lazyRoute(() => import("./pages/NativeAuthCallback"));
const InitialQuestionsPage = lazyRoute(() => import("./pages/InitialQuestions"));
const V2Onboarding = lazyRoute(() => import("./pages/V2Onboarding"));
const NotFound = lazyRoute(() => import("./pages/NotFound"));
const Pricing = lazyRoute(() => import("./pages/Pricing"));
const Review = lazyRoute(() => import("./pages/Review"));
const Privacy = lazyRoute(() => import("./pages/Privacy"));
const Terms = lazyRoute(() => import("./pages/Terms"));
const Accessibility = lazyRoute(() => import("./pages/Accessibility"));
const CookiePolicy = lazyRoute(() => import("./pages/CookiePolicy"));
const Refunds = lazyRoute(() => import("./pages/Refunds"));
const Book = lazyRoute(() => import("./pages/Book"));
const BuildYourSaas = lazyRoute(() => import("./pages/BuildYourSaas"));
const Success = lazyRoute(() => import("./pages/Success"));
const BumpPreview = lazyRoute(() => import("./pages/BumpPreview"));
const Gift = lazyRoute(() => import("./pages/Gift"));
const Switch = lazyRoute(() => import("./pages/Switch"));
const ResetPassword = lazyRoute(() => import("./pages/ResetPassword"));
const AffiliatePage = lazyRoute(() => import("./components/AffiliatePage"));
const GoLandingPage = lazyRoute(() => import("./components/GoLandingPage"));
const Breakdown = lazyRoute(() => import("./pages/Breakdown"));
const GoPaid = lazyRoute(() => import("./pages/GoPaid"));
const BreakdownPaid = lazyRoute(() => import("./pages/BreakdownPaid"));
const GoPaid27 = lazyRoute(() => import("./pages/GoPaid27"));
const GoPaid97 = lazyRoute(() => import("./pages/GoPaid97"));
const BreakdownPaid27 = lazyRoute(() => import("./pages/BreakdownPaid27"));
const BreakdownPaid97 = lazyRoute(() => import("./pages/BreakdownPaid97"));
const PromoPage = lazyRoute(() => import("./components/PromoPage"));
const Summit = lazyRoute(() => import("./pages/Summit"));
const Webinar = lazyRoute(() => import("./pages/Webinar"));
const Webinar2 = lazyRoute(() => import("./pages/Webinar2"));
const WebinarConfirmation = lazyRoute(() => import("./pages/WebinarConfirmation"));
const AISaasWebinar = lazyRoute(() => import("./pages/AISaasWebinar"));
const AISaasWebinarConfirmation = lazyRoute(() => import("./pages/AISaasWebinarConfirmation"));
const WatchWebinar = lazyRoute(() => import("./pages/WatchWebinar"));
const Special = lazyRoute(() => import("./pages/Special"));
const AI = lazyRoute(() => import("./pages/AI"));
const CyberWeek = lazyRoute(() => import("./pages/CyberWeek"));
const Admin = lazyRoute(() => import("./pages/Admin"));
const AdminVoiceUpdates = lazyRoute(() => import("./pages/AdminVoiceUpdates"));
const AdminSupport = lazyRoute(() => import("./pages/AdminSupport"));
const AdminAgency = lazyRoute(() => import("./pages/AdminAgency"));
const AccountSelector = lazyRoute(() => import("./pages/AccountSelector"));
const SlackIntegration = lazyRoute(() => import("./pages/SlackIntegration"));
const BrandingToolPage = lazyRoute(() => import("./pages/BrandingTool"));
const Offers = lazyRoute(() => import("./pages/Offers"));
const Support = lazyRoute(() => import("./pages/Support"));
const Giveaway = lazyRoute(() => import("./pages/Giveaway"));
const Illegal = lazyRoute(() => import("./pages/Illegal"));
const ChallengeRules = lazyRoute(() => import("./pages/ChallengeRules"));
const LoginTracking = lazyRoute(() => import("./pages/LoginTracking"));
const FunnelStats = lazyRoute(() => import("./pages/FunnelStats"));
const SupportService = lazyRoute(() => import("./pages/SupportService"));
const EmailWarmup = lazyRoute(() => import("./pages/EmailWarmup"));
const TrainingDoc = lazyRoute(() => import("./pages/TrainingDoc"));
const AIWebinar = lazyRoute(() => import("./pages/AIWebinar"));
const PricingDummy = lazyRoute(() => import("./pages/PricingDummy"));
const Testimonial = lazyRoute(() => import("./pages/Testimonial"));
const AfterParty = lazyRoute(() => import("./pages/AfterParty"));
const Bonuses = lazyRoute(() => import("./pages/Bonuses"));
const Onboardings = lazyRoute(() => import("./pages/Onboardings"));
const BrandKit = lazyRoute(() => import("./pages/BrandKit"));
const AdminDesignSystem = lazyRoute(() => import("./pages/AdminDesignSystem"));
const Hierarchy = lazyRoute(() => import("./pages/Hierarchy"));
const BlogIndex = lazyRoute(() => import("./pages/BlogIndex"));
const BlogPost = lazyRoute(() => import("./pages/BlogPost"));
const AdminBlog = lazyRoute(() => import("./pages/AdminBlog"));
const AdminKitCustomers = lazyRoute(() => import("./pages/AdminKitCustomers"));
const AdminSetupTracker = lazyRoute(() => import("./pages/AdminSetupTracker"));
const AlternativePage = lazyRoute(() => import("./pages/AlternativePage"));
const NichePage = lazyRoute(() => import("./pages/NichePage"));
const CommasTest = lazyRoute(() => import("./pages/CommasTest"));
const CommasCheckout = lazyRoute(() => import("./pages/CommasCheckout"));
const FirstGhlClient = lazyRoute(() => import("./pages/FirstGhlClient"));
const DigitalAgencyFreedom = lazyRoute(() => import("./pages/DigitalAgencyFreedom"));
const CourseSuccess = lazyRoute(() => import("./pages/CourseSuccess"));
const SupportRep = lazyRoute(() => import("./pages/SupportRep"));
const SupportRepPortal = lazyRoute(() => import("./pages/SupportRepPortal"));
const MarketplaceReturn = lazyRoute(() => import("./pages/MarketplaceReturn"));
const OneFeatureTraining = lazyRoute(() => import("./pages/OneFeatureTraining"));
const OneFeatureTrainingSuccess = lazyRoute(() => import("./pages/OneFeatureTrainingSuccess"));
const OneFeatureWlSalesVideo = lazyRoute(() => import("./pages/OneFeatureWlSalesVideo"));
const OneFeatureStrategy = lazyRoute(() => import("./pages/OneFeatureStrategy"));
const OneFeatureQuiz = lazyRoute(() => import("./pages/OneFeatureQuiz"));
const AgentsApply = lazyRoute(() => import("./pages/AgentsApply"));
const WorkWithUs = lazyRoute(() => import("./pages/WorkWithUs"));
const HighLevelers = lazyRoute(() => import("./pages/HighLevelers"));
const FoundersPlan = lazyRoute(() => import("./pages/FoundersPlan"));
const OneFeatureAway = lazyRoute(() => import("./pages/OneFeatureAway"));
const SkoolChallenge = lazyRoute(() => import("./pages/SkoolChallenge"));
const BlackFriday = lazyRoute(() => import("./pages/BlackFriday"));
const OneFeatureKit = lazyRoute(() => import("./pages/OneFeatureKit"));
const GhlDfy = lazyRoute(() => import("./pages/GhlDfy"));
const AiSaasTrial = lazyRoute(() => import("./pages/AiSaasTrial"));
const SaasPartner = lazyRoute(() => import("./pages/SaasPartner"));

const queryClient = new QueryClient();

const kitHost = typeof window !== "undefined" && isKitHost(window.location.hostname);

function PreserveSearchRedirect({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={`${to}${search}`} replace />;
}

/** Other routes keep the empty loading fallback. The success page must paint its bridge instead. */
function RouteFallback() {
  const { pathname } = useLocation();
  if (pathKey(pathname) === "/onefeaturetraining-success") return <TrainingSuccessShell />;
  // Signed-in pages get a skeleton in the shape of a page; public pages keep a blank screen.
  if (pathname.startsWith("/app") || pathname.startsWith("/admin")) {
    return (
      <div className="px-canvas min-h-screen">
        <PageSkeleton />
      </div>
    );
  }
  return <div className="min-h-screen bg-background" role="status" aria-label="Loading" />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <UserProvider>
      <LanguageProvider>
        <SessionTrackerProvider>
          <CoPilotProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <AppVersionNotice />
                <RobotsPolicy />
                <MetaPixelRouteTracker />
                <SessionRouteTracker />
                <TipsBotProvider>
                  <ChatProvider>
                    <RouteErrorBoundary>
                      <Suspense fallback={<RouteFallback />}>
                        {kitHost ? (
                          <Routes>
                            <Route path="/" element={<OneFeatureKit />} />
                            <Route
                              path="/business-in-a-box"
                              element={<Navigate to="/ghl-signup-and-upgrade" replace />}
                            />
                            <Route
                              path="/affiliate-club"
                              element={<Navigate to="/launch-pack" replace />}
                            />
                            <Route
                              path="/snapshot"
                              element={<Navigate to="/launch-pack" replace />}
                            />
                            <Route
                              path="/dfy-branding"
                              element={<Navigate to="/launch-pack" replace />}
                            />
                            <Route
                              path="/watch-us-build"
                              element={<Navigate to="/launch-pack" replace />}
                            />
                            <Route
                              path="/one-feature-kit/business-in-a-box"
                              element={<Navigate to="/ghl-signup-and-upgrade" replace />}
                            />
                            <Route
                              path="/one-feature-kit/affiliate-club"
                              element={<Navigate to="/launch-pack" replace />}
                            />
                            <Route
                              path="/one-feature-kit/snapshot"
                              element={<Navigate to="/launch-pack" replace />}
                            />
                            <Route
                              path="/one-feature-kit/dfy-branding"
                              element={<Navigate to="/launch-pack" replace />}
                            />
                            <Route
                              path="/one-feature-kit/watch-us-build"
                              element={<Navigate to="/launch-pack" replace />}
                            />
                            <Route path="/one-feature-kit" element={<OneFeatureKit />} />
                            <Route path="/one-feature-kit/:step" element={<OneFeatureKit />} />
                            <Route path="/:step" element={<OneFeatureKit />} />
                            <Route path="*" element={<NotFound />} />
                          </Routes>
                        ) : (
                          <Routes>
                            <Route path="/" element={<Index />} />
                            <Route path="/basic" element={<Index />} />
                            <Route path="/advanced" element={<Index />} />
                            <Route path="/auth" element={<Auth />} />
                            <Route path="/login" element={<Login />} />
                            <Route path="/auth/native" element={<NativeAuthCallback />} />
                            <Route path="/signup" element={<Signup />} />
                            <Route path="/initial-questions" element={<InitialQuestionsPage />} />
                            <Route path="/v2-onboarding" element={<V2Onboarding />} />
                            <Route path="/select-account" element={<AccountSelector />} />
                            <Route path="/account-selector" element={<AccountSelector />} />
                            <Route path="/app" element={<AppPage />} />
                            <Route path="/app/:tool" element={<AppPage />} />
                            <Route path="/app/:tool/:subTab" element={<AppPage />} />
                            {/* Short community shortcuts: /skills → /app/community/skills */}
                            <Route
                              path="/skills"
                              element={<Navigate to="/app/community/skills" replace />}
                            />
                            <Route
                              path="/prompts"
                              element={<Navigate to="/app/community/prompts" replace />}
                            />
                            <Route
                              path="/courses"
                              element={<Navigate to="/app/community/courses" replace />}
                            />
                            <Route
                              path="/lessons"
                              element={<Navigate to="/app/community/lessons" replace />}
                            />
                            <Route
                              path="/academy"
                              element={<Navigate to="/app/community/academy" replace />}
                            />
                            <Route
                              path="/snapshot-vault"
                              element={<Navigate to="/app/community/snapshots" replace />}
                            />
                            <Route path="/community" element={<CommunityLanding />} />
                            <Route path="/ai-studio-seo-prompt" element={<SkillLanding />} />
                            <Route path="/setup" element={<SetupGuide />} />
                            <Route path="/copilot" element={<PublicCopilotPage />} />
                            <Route path="/copilot/:slug" element={<PublicCopilotPage />} />
                            <Route path="/app/copilot" element={<AppPage />} />
                            <Route path="/app/copilot/first-time" element={<AppPage />} />
                            <Route path="/app/copilot/:threadId" element={<AppPage />} />
                            <Route path="/pricing" element={<Pricing />} />
                            <Route path="/ghldfy" element={<GhlDfy />} />
                            <Route path="/aisaas" element={<AiSaasTrial />} />
                            <Route path="/saaspartner" element={<SaasPartner />} />
                            <Route path="/review" element={<Review />} />
                            <Route path="/privacy" element={<Privacy />} />
                            <Route path="/terms" element={<Terms />} />
                            <Route path="/accessibility" element={<Accessibility />} />
                            <Route path="/cookies" element={<CookiePolicy />} />
                            <Route
                              path="/cookie-policy"
                              element={<Navigate to="/cookies" replace />}
                            />
                            <Route path="/refunds" element={<Refunds />} />
                            <Route
                              path="/refund-policy"
                              element={<Navigate to="/refunds" replace />}
                            />
                            <Route path="/book" element={<Book />} />
                            <Route path="/buildyoursaas" element={<BuildYourSaas />} />
                            <Route path="/buildyoursaas/checkout" element={<BuildYourSaas />} />
                            <Route path="/buildyoursaas/thank-you" element={<BuildYourSaas />} />
                            <Route path="/success" element={<Success />} />
                            <Route path="/bump-preview" element={<BumpPreview />} />
                            <Route path="/gift" element={<Gift />} />
                            <Route path="/switch" element={<Switch />} />
                            <Route path="/reset-password" element={<ResetPassword />} />
                            <Route path="/slack-integration" element={<SlackIntegration />} />
                            <Route path="/affiliate" element={<AffiliatePage />} />
                            <Route
                              path="/go"
                              element={
                                <>
                                  <PageSEO
                                    title="Go SaaSSuite — White-Label HighLevel Toolkit"
                                    description="Launch, brand, and scale your HighLevel SaaS with SaaSSuite: onboarding, AI support, branding, and retention in one white-label platform."
                                    path="/go"
                                  />
                                  <GoLandingPage />
                                </>
                              }
                            />
                            <Route path="/breakdown" element={<Breakdown />} />
                            <Route path="/go-paid" element={<GoPaid />} />
                            <Route path="/breakdown-paid" element={<BreakdownPaid />} />
                            <Route path="/go-paid-27" element={<GoPaid27 />} />
                            <Route path="/go-paid-97" element={<GoPaid97 />} />
                            <Route path="/breakdown-paid-27" element={<BreakdownPaid27 />} />
                            <Route path="/breakdown-paid-97" element={<BreakdownPaid97 />} />
                            <Route path="/first-ghl-client" element={<FirstGhlClient />} />
                            <Route
                              path="/first-ghl-client/success"
                              element={<CourseSuccess course={FIRST_CLIENT_COURSE} />}
                            />
                            <Route
                              path="/digital-agency-freedom"
                              element={<DigitalAgencyFreedom />}
                            />
                            <Route
                              path="/digital-agency-freedom/success"
                              element={<CourseSuccess course={AGENCY_FREEDOM_COURSE} />}
                            />
                            <Route path="/promo" element={<PromoPage />} />

                            <Route path="/summit" element={<Summit />} />
                            <Route path="/webinar" element={<Webinar />} />
                            <Route path="/webinar-2" element={<Webinar2 />} />
                            <Route path="/webinar-confirmation" element={<WebinarConfirmation />} />
                            <Route path="/ai-saas-webinar" element={<AISaasWebinar />} />
                            <Route
                              path="/ai-saas-webinar-confirmation"
                              element={<AISaasWebinarConfirmation />}
                            />
                            <Route
                              path="/ai-studio-webinar-confirmation"
                              element={<AISaasWebinarConfirmation />}
                            />
                            <Route path="/watch-saassuite-webinar" element={<WatchWebinar />} />
                            <Route path="/special" element={<Special />} />
                            <Route path="/ai" element={<AI />} />
                            <Route path="/cyberweek" element={<CyberWeek />} />
                            <Route path="/admin" element={<Admin />} />
                            <Route path="/admin/kit-customers" element={<AdminKitCustomers />} />
                            <Route path="/admin/support" element={<AdminSupport />} />
                            <Route path="/admin/agency" element={<AdminAgency />} />
                            <Route path="/admin/updates" element={<AdminVoiceUpdates />} />
                            <Route path="/branding-tool" element={<BrandingToolPage />} />
                            <Route path="/offers" element={<Offers />} />
                            <Route path="/support" element={<Support />} />
                            <Route path="/support-rep" element={<SupportRep />} />
                            <Route path="/support-rep/portal" element={<SupportRepPortal />} />
                            <Route path="/marketplace" element={<MarketplaceReturn />} />

                            <Route path="/challenge" element={<Giveaway />} />
                            <Route path="/illegal" element={<Illegal />} />
                            <Route
                              path="/giveaway"
                              element={<Navigate to="/challenge" replace />}
                            />
                            <Route
                              path="/move-your-saas-challenge-rules"
                              element={<ChallengeRules />}
                            />
                            <Route
                              path="/ai-support"
                              element={<Navigate to="/support" replace />}
                            />
                            <Route path="/login-tracking" element={<LoginTracking />} />
                            <Route path="/funnel-stats" element={<FunnelStats />} />
                            <Route
                              path="/webinar-stats"
                              element={<Navigate to="/funnel-stats" replace />}
                            />
                            <Route
                              path="/onefeature-stats"
                              element={<Navigate to="/funnel-stats" replace />}
                            />
                            <Route path="/support-service" element={<SupportService />} />
                            <Route
                              path="/support-wins"
                              element={<Navigate to="/support-service" replace />}
                            />
                            <Route path="/email-warmup" element={<EmailWarmup />} />
                            <Route
                              path="/onefeaturetraining-1"
                              element={<OneFeatureTraining variant={1} />}
                            />
                            <Route
                              path="/onefeaturetraining-2"
                              element={<OneFeatureTraining variant={2} />}
                            />
                            <Route
                              path="/onefeaturetraining-3"
                              element={<OneFeatureStrategy variant={3} />}
                            />
                            <Route
                              path="/onefeaturetraining-4"
                              element={<OneFeatureStrategy variant={4} />}
                            />
                            <Route
                              path="/onefeaturetraining-5"
                              element={<OneFeatureStrategy variant={5} />}
                            />
                            <Route path="/onefeaturetraining-quiz" element={<OneFeatureQuiz />} />
                            <Route
                              path="/one-feature-kit-free"
                              element={<PreserveSearchRedirect to="/onefeaturetraining-quiz" />}
                            />
                            <Route
                              path="/onefeaturetraining-success"
                              element={<OneFeatureTrainingSuccess />}
                            />
                            <Route
                              path="/agents/thanks"
                              element={<PreserveSearchRedirect to="/agents" />}
                            />
                            <Route path="/agents" element={<AgentsApply />} />
                            <Route path="/work-with-us" element={<WorkWithUs />} />
                            <Route
                              path="/highlevelers"
                              element={<HighLevelers funnel="highlevelers" />}
                            />
                            <Route
                              path="/highlevelers-upgrade"
                              element={<HighLevelers funnel="highlevelers_upgrade" />}
                            />
                            <Route path="/founders-plan" element={<FoundersPlan />} />
                            <Route path="/one-feature-away" element={<OneFeatureAway />} />
                            <Route path="/skool-challenge" element={<SkoolChallenge />} />
                            <Route path="/black-friday" element={<BlackFriday />} />
                            <Route
                              path="/onefeaturetraining-wlsalesvideo"
                              element={<OneFeatureWlSalesVideo />}
                            />
                            <Route
                              path="/one-feature-kit/business-in-a-box"
                              element={
                                <Navigate to="/one-feature-kit/ghl-signup-and-upgrade" replace />
                              }
                            />
                            <Route
                              path="/one-feature-kit/affiliate-club"
                              element={<Navigate to="/one-feature-kit/launch-pack" replace />}
                            />
                            <Route
                              path="/one-feature-kit/snapshot"
                              element={<Navigate to="/one-feature-kit/launch-pack" replace />}
                            />
                            <Route
                              path="/one-feature-kit/dfy-branding"
                              element={<Navigate to="/one-feature-kit/launch-pack" replace />}
                            />
                            <Route
                              path="/one-feature-kit/watch-us-build"
                              element={<Navigate to="/one-feature-kit/launch-pack" replace />}
                            />
                            <Route path="/one-feature-kit" element={<OneFeatureKit />} />
                            <Route path="/one-feature-kit/:step" element={<OneFeatureKit />} />
                            <Route path="/ai-webinar" element={<AIWebinar />} />
                            <Route path="/:agencyId/training-doc/:tier" element={<TrainingDoc />} />
                            <Route path="/pricing-dummy" element={<PricingDummy />} />
                            <Route path="/commas-test" element={<CommasTest />} />
                            <Route path="/commas-checkout" element={<CommasCheckout />} />
                            <Route path="/testimonial" element={<Testimonial />} />
                            <Route path="/afterparty" element={<AfterParty />} />
                            <Route path="/bonuses" element={<Bonuses />} />
                            <Route path="/onboardings" element={<Onboardings />} />
                            <Route path="/onboarding" element={<Onboardings />} />
                            <Route path="/brand-kit" element={<BrandKit />} />
                            <Route path="/hierarchy" element={<Hierarchy />} />
                            <Route path="/blog" element={<BlogIndex />} />
                            <Route path="/blog/:slug" element={<BlogPost />} />
                            <Route path="/admin/blog" element={<AdminBlog />} />
                            <Route path="/admin/design-system" element={<AdminDesignSystem />} />
                            <Route path="/admin/setup-tracker" element={<AdminSetupTracker />} />
                            <Route path="/alternatives/:competitor" element={<AlternativePage />} />
                            <Route path="/for/:niche" element={<NichePage />} />
                            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                            <Route path="*" element={<NotFound />} />
                          </Routes>
                        )}
                      </Suspense>
                    </RouteErrorBoundary>
                    {/* Walkthrough / tips overlay — survives route changes so announcement
              tours can run on standalone pages too. */}
                    {!kitHost && <TipsBotToast />}
                    {!kitHost && <CoPilotShell />}
                  </ChatProvider>
                </TipsBotProvider>
                {/* Marketing page analytics tracking */}
                <SiteTracker />
                {/* Cookie notice with opt-out — website only, not inside the phone apps */}
                <StoreBillingLinker />
                <NativeOAuthReturn />
              </BrowserRouter>
            </TooltipProvider>
          </CoPilotProvider>
        </SessionTrackerProvider>
      </LanguageProvider>
    </UserProvider>
  </QueryClientProvider>
);

export default App;
