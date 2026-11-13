import { Button } from "@/components/ui/button";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect } from "react";

const Success = () => {
  const navigate = useNavigate();
  const trialStarted = useSearchParams()[0].get("trial") === "started";

  useEffect(() => {
    // Load the form embed script
    const script = document.createElement('script');
    script.src = 'https://link.saassuite.ai/js/form_embed.js';
    script.type = 'text/javascript';
    document.body.appendChild(script);

    return () => {
      // Cleanup scripts when component unmounts
      const existingScript = document.querySelector('script[src="https://link.saassuite.ai/js/form_embed.js"]');
      if (existingScript) {
        document.body.removeChild(existingScript);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <img src="/assets/new-saas-logo.png" alt="SAASSuite.AI" className="h-8" />
              <h1 className="text-xl font-bold">Book a Call</h1>
            </div>
            <Button variant="ghost" onClick={() => navigate('/')} className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardHeader>
            {trialStarted && <p className="text-center text-lg font-bold text-primary">🎉 Your 14-day free trial has begun!</p>}
            <CardTitle className="text-3xl font-bold text-center">Book a Success Call</CardTitle>
            <p className="text-center text-muted-foreground">
              {trialStarted
                ? "The best next step is your success call. Pick a time below and our team will set up this entire system for you."
                : "Book a time that works for you and let's discuss how SaaSSuite.AI can transform your business"}
            </p>
          </CardHeader>
          <CardContent>
            <div className="w-full">
              <iframe 
                src="https://link.saassuite.ai/widget/booking/o9wpEynHX15bCaaSl9bM" 
                style={{
                  width: '100%',
                  border: 'none',
                  overflow: 'hidden',
                  minHeight: '600px'
                }} 
                scrolling="no" 
                id="Q7mKXAlwZZk1wKAMnqms_1758819960336" 
                title="Booking Calendar" 
              />
            </div>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
};

export default Success;
