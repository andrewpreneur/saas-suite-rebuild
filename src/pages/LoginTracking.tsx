import LoginTrackingSalesPage from "@/components/LoginTrackingSalesPage";
import PageSEO from "@/components/PageSEO";
import { LOGIN_TRACKING_FAQS } from "@/config/pageFaqs";
import { buildFaqJsonLd, buildBreadcrumbJsonLd, buildServiceJsonLd } from "@/lib/seoJsonLd";

const LoginTracking = () => {
  return (
    <>
      <PageSEO
        title="Login & Usage Tracking for HighLevel SaaS | SaaSSuite"
        description="See exactly who logs in, when, and how often. Track HighLevel SaaS client engagement so you can boost activation and stop churn before it happens."
        path="/login-tracking"
        jsonLd={[
          buildServiceJsonLd({
            name: "HighLevel Client Login & Usage Tracking",
            description:
              "SaaS health dashboard tracking client logins, onboarding progress, and engagement so agencies can spot churn early.",
            path: "/login-tracking",
          }),
          buildBreadcrumbJsonLd([{ name: "Login Tracking", path: "/login-tracking" }])!,
          buildFaqJsonLd(LOGIN_TRACKING_FAQS)!,
        ]}
      />
      <LoginTrackingSalesPage />
    </>
  );
};

export default LoginTracking;
