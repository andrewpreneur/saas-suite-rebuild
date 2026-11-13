import { Link } from "react-router-dom";
import { useMetaPixel } from "@/hooks/useMetaPixel";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { useEffect } from "react";

const WatchWebinar = () => {
  useMetaPixel();
  useEffect(() => {
    // Load the webinar script
    const script = document.createElement('script');
    script.src = 'https://viralmeetings.com/js/ewk_watch_v1.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // Cleanup script on unmount
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  return (
    <>
      <SEO 
        title="SaaSSuite Webinar Registration"
        description="Learn how to onboard, educate, and retain customers in this live webinar training."
        image="/assets/webinar-social.png"
      />
      <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-center">
            <Link to="/" className="flex items-center gap-3">
              <img src="/assets/saassuite-logo.png" alt="SaaSSuite Logo" className="h-8 w-auto" />
              <span className="text-xl font-bold text-foreground">
                SaaSSuite
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* Webinar Iframe */}
      <main className="flex-1 relative">
        <iframe 
          id="wk_watch_room_iframe" 
          data-wk-base-url="https://viralmeetings.com/webinar/watch/6916a70d0134d3344d35504e" 
          style={{ width: '100%', height: '100vh', border: 0 }} 
          allow="camera; microphone; display-capture; autoplay;"
        />
      </main>

      {/* Footer */}
      <Footer />
      </div>
    </>
  );
};

export default WatchWebinar;
