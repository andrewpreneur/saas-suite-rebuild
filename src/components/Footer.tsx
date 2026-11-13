import { TextUsLink } from "@/components/TextUsLink";
import { Button } from "@/components/ui/button";
import { withWebinarAttribution } from "@/utils/webinarAttribution";
import { Facebook, Instagram, Linkedin, Youtube } from "lucide-react";

const Footer = ({ minimal = false }: { minimal?: boolean }) => {
  if (minimal) {
    // Landing-page footer: phone + legal only, so visitors stay on the offer.
    return (
      <footer className="mt-12 border-t border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-8 text-center text-sm text-muted-foreground">
          <TextUsLink className="font-semibold" />
          <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
            <a href="/privacy">Privacy Policy</a><a href="/terms">Terms of Service</a><a href="/cookies">Cookie Policy</a><a href="/refunds">Refund Policy</a><a href="/accessibility">Accessibility</a>
          </div>
          <p className="mt-3 text-xs">&copy; {new Date().getFullYear()} SaaSSuite, a product of DNA Media Consulting LLC. Not affiliated with HighLevel Inc. Results are not guaranteed.</p>
        </div>
      </footer>
    );
  }
  return (
    <footer className="bg-gray-50 border-t border-gray-200 mt-16">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          {/* Logo and Brand */}
          <div className="flex flex-col items-start md:col-span-2">
            <div className="flex items-center space-x-3 mb-4">
              <img src="/assets/saassuite-footer-logo.png" alt="SaaSSuite Logo" className="w-10 h-10" />
              <h3 className="text-xl font-bold text-gray-900">SaaSSuite</h3>
            </div>
            <p className="text-gray-600 text-sm">
              Streamline your HighLevel experience with powerful white-label tools and automation.
            </p>
            <TextUsLink className="mt-3" />
            <div className="flex items-center gap-4 mt-4">
              <a href="https://www.youtube.com/@andrewpreneurship" target="_blank" rel="me noreferrer" className="text-gray-600 hover:text-gray-900" aria-label="SaaSSuite on YouTube">
                <Youtube className="w-5 h-5" />
              </a>
              <a href="https://www.instagram.com/andrewpreneurship/" target="_blank" rel="me noreferrer" className="text-gray-600 hover:text-gray-900" aria-label="SaaSSuite on Instagram">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="https://www.facebook.com/andrewpreneurship" target="_blank" rel="me noreferrer" className="text-gray-600 hover:text-gray-900" aria-label="SaaSSuite on Facebook">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="https://www.linkedin.com/in/realandrewgeorge/" target="_blank" rel="me noreferrer" className="text-gray-600 hover:text-gray-900" aria-label="SaaSSuite on LinkedIn">
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Quick Links</h4>
            <div className="flex flex-col space-y-3">
              <Button variant="link" className="p-0 h-auto text-gray-600 hover:text-gray-900 justify-start" asChild>
                <a href="/">Home</a>
              </Button>
              <Button variant="link" className="p-0 h-auto text-gray-600 hover:text-gray-900 justify-start" asChild>
                <a href="/pricing">Pricing</a>
              </Button>
              <Button variant="link" className="p-0 h-auto text-gray-600 hover:text-gray-900 justify-start" asChild>
                <a href="/blog">Blog</a>
              </Button>
              <Button variant="link" className="p-0 h-auto text-gray-600 hover:text-gray-900 justify-start" asChild>
                <a href={withWebinarAttribution("/webinar")}>Watch Demo</a>
              </Button>
              <Button variant="link" className="p-0 h-auto text-gray-600 hover:text-gray-900 justify-start" asChild>
                <a href="/go">Get Started</a>
              </Button>
              <Button variant="link" className="p-0 h-auto text-gray-600 hover:text-gray-900 justify-start" asChild>
                <a href="/affiliate">Affiliate Program</a>
              </Button>
            </div>
          </div>

          {/* Compare */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Compare</h4>
            <div className="flex flex-col space-y-3">
              <Button variant="link" className="p-0 h-auto text-gray-600 hover:text-gray-900 justify-start" asChild>
                <a href="/alternatives/ghlengine">vs GHLEngine</a>
              </Button>
              <Button variant="link" className="p-0 h-auto text-gray-600 hover:text-gray-900 justify-start" asChild>
                <a href="/alternatives/hlprotools">vs HLProTools</a>
              </Button>
              <Button variant="link" className="p-0 h-auto text-gray-600 hover:text-gray-900 justify-start" asChild>
                <a href="/alternatives/extendly">vs Extendly</a>
              </Button>
            </div>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Legal</h4>
            <div className="flex flex-col space-y-3">
              <Button variant="link" className="p-0 h-auto text-gray-600 hover:text-gray-900 justify-start" asChild>
                <a href="/privacy">Privacy Policy</a>
              </Button>
              <Button variant="link" className="p-0 h-auto text-gray-600 hover:text-gray-900 justify-start" asChild>
                <a href="/terms">Terms of Service</a>
              </Button>
              <Button variant="link" className="p-0 h-auto text-gray-600 hover:text-gray-900 justify-start" asChild>
                <a href="/cookies">Cookie Policy</a>
              </Button>
              <Button variant="link" className="p-0 h-auto text-gray-600 hover:text-gray-900 justify-start" asChild>
                <a href="/refunds">Refund Policy</a>
              </Button>
              <Button variant="link" className="p-0 h-auto text-gray-600 hover:text-gray-900 justify-start" asChild>
                <a href="/accessibility">Accessibility</a>
              </Button>
              <Button variant="link" className="p-0 h-auto text-gray-600 hover:text-gray-900 justify-start" asChild>
                <a href="/support">Contact / Support</a>
              </Button>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-gray-200 mt-8 pt-8 text-center">
          <p className="text-gray-600 text-sm">
            &copy; {new Date().getFullYear()} SaaSSuite, a product of DNA Media Consulting LLC. All
            rights reserved.
          </p>
          <p className="text-gray-500 text-xs mt-2">
            5830 E 2nd St, Casper, WY 82609, United States · andrew@dna-media.net
          </p>
          <p className="text-gray-500 text-xs mt-2 max-w-3xl mx-auto">
            SaaSSuite is an independent product and is not affiliated with, endorsed by, or sponsored
            by HighLevel Inc. HighLevel, Stripe, Slack, and Meta are trademarks of their respective
            owners. Results described by customers are their own experience and are not a guarantee
            of your results.
          </p>
          <div className="mt-4">
            <Button variant="link" className="text-blue-600 hover:text-blue-800" asChild>
              <a href="/support">Need help? Contact us</a>
            </Button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;