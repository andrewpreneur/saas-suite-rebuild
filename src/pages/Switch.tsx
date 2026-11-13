import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, ExternalLink, Calendar, Home, Link as LinkIcon, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Footer from "@/components/Footer";

const Switch = () => {
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
            How to Switch to SaaSSuite
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Learn how easy it is to switch your HighLevel account to us and start accessing all our exclusive tools and support.
          </p>
        </div>

        {/* Video Section */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="aspect-video w-full mb-6">
              <video
                controls
                className="w-full h-full rounded-lg"
                src="https://storage.googleapis.com/msgsndr/T69cI1milcirIORef4Ib/media/68dedf30bd01df38e369832d.mp4"
              >
                Your browser does not support the video tag.
              </video>
            </div>
            
            <div className="text-center">
              <Button
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => window.open('https://www.gohighlevel.com/gohighlevel-pricing?fp_ref=howtousehighlevel', '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Create Your New Agency Under Us
              </Button>
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

        {/* Our Affiliate Links Section */}
        <Card className="mb-8">
          <CardContent className="p-8">
            <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
              <LinkIcon className="w-6 h-6 text-primary" />
              Our Affiliate Links
            </h2>
            
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                <span className="text-foreground font-medium">Brand New $97 or $297 14 Day Trial</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('https://www.gohighlevel.com/?fp_ref=howtousehighlevel', '_blank')}
                  className="w-full sm:w-auto"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Visit Link
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                <span className="text-foreground font-medium">Upgrade from $97 → $297</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('https://www.gohighlevel.com/297upgrade?fp_ref=howtousehighlevel', '_blank')}
                  className="w-full sm:w-auto"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Visit Link
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                <span className="text-foreground font-medium">Upgrade from $297 → $497</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('https://www.gohighlevel.com/saasupgrade?fp_ref=howtousehighlevel', '_blank')}
                  className="w-full sm:w-auto"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Visit Link
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                <span className="text-foreground font-medium">Brand New $497 14 Day Trial</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('https://www.gohighlevel.com/protrial-page?fp_ref=howtousehighlevel', '_blank')}
                  className="w-full sm:w-auto"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Visit Link
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Important Read Me Section */}
        <Card className="mb-8 border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20">
          <CardContent className="p-8">
            <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              IMPORTANT: READ ME
            </h2>
            
            <div className="space-y-4 text-muted-foreground">
              <p>
                Before bulk transferring accounts, transfer one dummy account with some sort of data inside of it (a few dummy contacts, a workflow, a site, something) from your old agency to your new one. Usually the transfer process takes anywhere from 5 minutes to sometimes close to an hour, so wait for this account to go over, then confirm it still contains all of its data/assets inside of it. Once the account looks good, transfer the remaining accounts over.
              </p>
              
              <p>
                If the account transfer doesn't work while you're in trial, then complete your trial early (best to do this a few days before your current pay window for your existing agency so you're not paying anything extra) (you'll also get a discount for finishing it early), then once you've paid, then try your sub account transfers.
              </p>
              
              <p>
                Once all account assets are moved over, you can safely de-activate your old account, and finish reconnecting all of your agency settings in your new agency account.
              </p>
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
    </div>
  );
};

export default Switch;
