import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { withWebinarAttribution } from "@/utils/webinarAttribution";

const Offers = () => {
  // Meta Pixel is loaded once globally in index.html; PageView fires via MetaPixelRouteTracker.

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-center">
            <Link to="/" className="flex items-center space-x-3">
              <img src="/lovable-uploads/f3f326f8-20fd-4406-a246-f4b2dbc34614.png" alt="SaaSSuite Logo" className="w-8 h-8" />
              <h1 className="text-2xl font-bold text-gray-900">SaaSSuite</h1>
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col items-center justify-center px-6 py-20">
        <img
          src="/assets/new-saas-logo.png"
          alt="SAASSuite.AI"
          className="h-20 mb-6 opacity-0 animate-[fadeInBlur_0.6s_ease-out_0.1s_forwards]" />
        

        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 opacity-0 animate-[fadeInBlur_0.6s_ease-out_0.25s_forwards]">Welcome to SaaSSuite!

        </h2>
        <p className="text-lg text-gray-500 mb-12 text-center opacity-0 animate-[fadeInBlur_0.6s_ease-out_0.4s_forwards]">
          Your GoHighLevel onboarding, retention, and support buddy 👋
        </p>

        <div className="flex flex-col gap-4 w-full max-w-md">
          <Button
            asChild
            size="lg"
            className="w-full h-auto py-5 flex flex-col items-center bg-[hsl(265,60%,55%)] hover:bg-[hsl(265,60%,48%)] text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] opacity-0 animate-[fadeInBlur_0.6s_ease-out_0.55s_forwards]">
            
            <Link to="/signup">
              <span className="text-lg font-semibold">🚀 Ready to try SaaSSuite?</span>
              <span className="text-sm opacity-80 font-normal">Create your account for free</span>
            </Link>
          </Button>

          <Button
            asChild
            size="lg"
            variant="outline"
            className="w-full h-auto py-5 flex flex-col items-center bg-[hsl(265,60%,95%)] hover:bg-[hsl(265,60%,90%)] border-[hsl(265,60%,80%)] text-[hsl(265,60%,35%)] rounded-xl shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.02] opacity-0 animate-[fadeInBlur_0.6s_ease-out_0.7s_forwards]">
            
            <Link to={withWebinarAttribution("/webinar")}>
              <span className="text-lg font-semibold">🎓 Want to Learn More?</span>
              <span className="text-sm opacity-70 font-normal">Take me to the on demand training</span>
            </Link>
          </Button>
        </div>

        <a
          href="https://saassuite.ai"
          className="mt-8 text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors opacity-0 animate-[fadeInBlur_0.6s_ease-out_0.85s_forwards]">
          
          🏠 Take me Home
        </a>
      </div>

      <style>{`
        @keyframes fadeInBlur {
          0% {
            opacity: 0;
            filter: blur(8px);
            transform: translateY(16px);
          }
          100% {
            opacity: 1;
            filter: blur(0px);
            transform: translateY(0);
          }
        }
      `}</style>
    </div>);

};

export default Offers;