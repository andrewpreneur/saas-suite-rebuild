import { Link } from "react-router-dom";
import Footer from "@/components/Footer";
import saassuiteLogo from "@/assets/saassuitelogo-dark.png";
import { Button } from "@/components/ui/button";
import { withWebinarAttribution } from "@/utils/webinarAttribution";

interface MarketingLayoutProps {
  children: React.ReactNode;
  /**
   * Logo-only header: hides the nav links and the "Get Started" button.
   * Used by single-offer paid-traffic pages that carry their own CTAs.
   */
  minimalHeader?: boolean;
}

const MarketingLayout = ({ children, minimalHeader = false }: MarketingLayoutProps) => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={saassuiteLogo} alt="SaaSSuite" className="w-8 h-8 rounded-md" />
            <span className="font-bold text-gray-900">SaaSSuite</span>
          </Link>
          {!minimalHeader && (
            <>
              <nav className="hidden md:flex items-center gap-6 text-sm text-gray-700">
                <Link to="/pricing" className="hover:text-gray-900">Pricing</Link>
                <Link to="/blog" className="hover:text-gray-900">Blog</Link>
                <Link to="/alternatives/ghlengine" className="hover:text-gray-900">Compare</Link>
                <Link to={withWebinarAttribution("/webinar")} className="hover:text-gray-900">Demo</Link>
              </nav>
              <Button asChild size="sm">
                <Link to="/go">Get Started</Link>
              </Button>
            </>
          )}
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
};

export default MarketingLayout;