import { useState } from "react";
import { useMetaPixel } from "@/hooks/useMetaPixel";
import StripeEmbeddedCheckout from "@/components/StripeEmbeddedCheckout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, ExternalLink, Calendar, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Footer from "@/components/Footer";

const Gift = () => {
  // Uses the app's own checkout so access is granted automatically.
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  useMetaPixel();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              type="button"
              onClick={() => navigate('/')}
              aria-label="SaaSSuite home"
              className="flex items-center space-x-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <img src="/assets/saassuite-logo.png" alt="SaaSSuite Logo" className="w-10 h-10" />
              <h1 className="text-xl font-bold text-foreground">SaaSSuite</h1>
            </button>
            <Button variant="outline" onClick={() => navigate('/')}>
              <Home className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Free Email Marketing System
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            We're giving away a complete email marketing system to existing HighLevel agency owners.
            Watch the tutorial below and install the snapshot today.
          </p>
        </div>

        {/* Video Section */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="aspect-video w-full mb-6">
              <iframe
                width="100%"
                height="100%"
                src="https://www.youtube.com/embed/eeEKchZAotI"
                title="Email Marketing Tutorial"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="rounded-lg"
              />
            </div>
            
            <div className="text-center">
              <Button
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => window.open('https://affiliates.gohighlevel.com/?fp_ref=howtousehighlevel&share=juJUavNjhX6gE38EfYYp', '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Install the Snapshot
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Sales Section */}
        <Card className="mb-8 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="p-8">
            <h2 className="text-3xl font-bold text-foreground mb-4 text-center">
              Cold email works. It works better with us.
            </h2>
            
            <div className="space-y-6 mb-8">
              <p className="text-lg text-muted-foreground">
                Email marketing is one of the most effective ways to reach your audience, but to achieve a 50% open rate, 
                you need two critical components: <span className="font-semibold text-foreground">proper email warmup</span> and <span className="font-semibold text-foreground">verified leads</span>.
              </p>
              
              <p className="text-lg text-muted-foreground">
                We provide both for FREE for anyone under us as GHL affiliates, along with comprehensive marketing materials and 1:1 support.
              </p>

              <div className="bg-background/50 p-6 rounded-lg border border-border">
                <h3 className="text-xl font-semibold text-foreground mb-4">What You Get:</h3>
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">Complete email warmup system for maximum deliverability</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">Verified lead lists to ensure your emails reach real prospects</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">All the marketing materials and templates you need</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">1:1 personalized support to help you succeed</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">Access to our active software platform and tools</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">Tons of resources and ongoing training</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6 justify-center items-center">
              <div className="flex flex-col items-center gap-2">
                <Button
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 text-sm px-6 py-6 h-auto"
                  onClick={() => window.open('https://www.gohighlevel.com/gohighlevel-pricing?fp_ref=howtousehighlevel', '_blank')}
                >
                  Sign Up or Switch Under Us
                </Button>
                <span className="text-sm text-muted-foreground">Get everything for free</span>
              </div>
              
              <div className="flex flex-col items-center gap-2">
                <Button
                  size="lg"
                  variant="outline"
                  className="text-sm px-6 py-6 h-auto"
                  onClick={() => setCheckoutOpen(true)}
                >
                  Already have GHL? Don't want to Switch?
                </Button>
                <span className="text-sm text-muted-foreground">Pay Now</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* What Does "Switch" Mean Section */}
        <Card className="mb-8">
          <CardContent className="p-8">
            <h2 className="text-2xl font-bold text-foreground mb-4">
              What does "Switch" mean?
            </h2>
            
            <p className="text-muted-foreground mb-6">
              By choosing us as your affiliate, you get guaranteed marketing systems, all our tools, and 1:1 support. 
              We don't leave our customers in the dust by just giving free systems and then leaving them. We have an 
              active software that our affiliates get access to and tons of resources.
            </p>

            <p className="text-muted-foreground mb-6">
              "Switching" means making a new HighLevel account under our links and transferring your sub accounts over. 
              Here's what transfers and what needs to be reconnected:
            </p>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Assets that Transfer */}
              <div className="bg-green-50 dark:bg-green-950/20 p-6 rounded-lg border border-green-200 dark:border-green-800">
                <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-4">Assets that Transfer</h3>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-green-800 dark:text-green-200">Websites</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-green-800 dark:text-green-200">Funnels</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-green-800 dark:text-green-200">Automations</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-green-800 dark:text-green-200">Phone numbers</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-green-800 dark:text-green-200">Conversation History</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-green-800 dark:text-green-200">Domains</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-green-800 dark:text-green-200">And more...</span>
                  </li>
                </ul>
              </div>

              {/* Assets that Need to be Re-connected */}
              <div className="bg-yellow-50 dark:bg-yellow-950/20 p-6 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-4">Need Re-connection</h3>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-yellow-800 dark:text-yellow-200">Social Media Connections</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-yellow-800 dark:text-yellow-200">Calendar Connections</span>
                  </li>
                </ul>
              </div>

              {/* Assets that Don't Transfer */}
              <div className="bg-red-50 dark:bg-red-950/20 p-6 rounded-lg border border-red-200 dark:border-red-800">
                <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-4">Don't Transfer</h3>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-red-600 dark:text-red-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-red-800 dark:text-red-200">SAAS Configurator Plans (they still exist in Stripe, you just need to resync them or use them on the sub account level)</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CTA Section */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardContent className="p-6 text-center">
              <Calendar className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">Book a Call</h3>
              <p className="text-muted-foreground mb-4">
                Have questions? Schedule a demo call with our team to learn more.
              </p>
              <Button
                variant="outline"
                size="lg"
                onClick={() => navigate('/book')}
              >
                Schedule Demo
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <Home className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">Learn More About SaaSSuite</h3>
              <p className="text-muted-foreground mb-4">
                Discover all our tools and features to streamline your HighLevel experience.
              </p>
              <Button
                variant="outline"
                size="lg"
                onClick={() => navigate('/')}
              >
                Explore SaaSSuite
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
      <StripeEmbeddedCheckout plan="advanced" open={checkoutOpen} onOpenChange={setCheckoutOpen} />
    </div>
  );
};

export default Gift;
