import { useSearchParams } from "react-router-dom";
import PageSEO from "@/components/PageSEO";
import MarketingLayout from "@/components/MarketingLayout";
import { Button } from "@/components/ui/button";
import { CheckCircle, Mail } from "lucide-react";
import type { CourseConfig } from "@/config/courses";

interface CourseSuccessProps {
  course: CourseConfig;
}

/** Post-purchase confirmation for the one-time $27 courses. */
const CourseSuccess = ({ course }: CourseSuccessProps) => {
  const [params] = useSearchParams();
  const email = params.get("email");

  return (
    <MarketingLayout minimalHeader>
      <PageSEO
        title={`You're in — ${course.cardTitle} | SaaSSuite`}
        description="Your purchase is confirmed. Course access and downloads are on the way to your inbox."
        path={`${course.path}/success`}
        noindex
      />
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <CheckCircle className="mx-auto mb-6 h-16 w-16 text-green-500" />
        <h1 className="mb-3 text-3xl font-bold text-gray-900 sm:text-4xl">You're in!</h1>
        <p className="mb-8 text-gray-600">
          Your access to <span className="font-semibold">{course.cardTitle}</span> is confirmed.
          {email ? (
            <>
              {" "}
              We just sent everything to <span className="font-semibold">{email}</span>.
            </>
          ) : (
            " Check your email for your login and downloads."
          )}
        </p>
        <div className="flex flex-col items-center gap-3">
          <Button asChild size="lg" className="rounded-full px-8">
            <a href="/signup">Create your SaaSSuite account</a>
          </Button>
          <a
            href="mailto:support@saassuite.ai"
            className="inline-flex items-center gap-2 text-sm text-gray-500 underline hover:text-gray-700"
          >
            <Mail className="h-4 w-4" /> Didn't get it? Email us
          </a>
        </div>
      </div>
    </MarketingLayout>
  );
};

export default CourseSuccess;
