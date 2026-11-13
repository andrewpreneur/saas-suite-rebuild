import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useAffiliateTracking } from "@/hooks/useAffiliateTracking";
import { Check, ArrowUp, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import VideoTestimonialsSection from "@/components/VideoTestimonialsSection";
import Footer from "@/components/Footer";
import AnimatedSection from "@/components/AnimatedSection";
import PageSEO from "@/components/PageSEO";
import { buildBreadcrumbJsonLd } from "@/lib/seoJsonLd";
import TextRequestDialog from "@/components/TextRequestDialog";
import andrewGeorgeImage from "@/assets/andrew-george.png";
import { watchWebinarRegistrationForms } from "@/utils/webinarRegistrationCapture";
import { ensureWebinarAttributionOnPage } from "@/utils/webinarAttribution";
import { trackingPixelsAllowed } from "@/utils/trackingConsent";
import { useWebinarMetaGuard } from "@/hooks/useWebinarMetaGuard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
const Webinar = () => {
  useWebinarMetaGuard();
  useAffiliateTracking('webinar');
  const {
    session
  } = useUser();
  const [isTextDialogOpen, setIsTextDialogOpen] = useState(false);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [embedKey, setEmbedKey] = useState(0);
  const viewContentSent = useRef(false);

  // WebinarKit copies window.location.href when its script loads. Restore the
  // first-touch parameters before that snapshot.
  useLayoutEffect(() => {
    ensureWebinarAttributionOnPage();
  }, []);

  const openRegistration = () => {
    setIsRegistrationOpen(true);
    if (viewContentSent.current || !trackingPixelsAllowed()) return;
    const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
    if (typeof fbq !== "function") return;
    viewContentSent.current = true;
    fbq("track", "ViewContent");
  };
  
  // Re-initialize WebinarKit when dialog opens
  useEffect(() => {
    if (isRegistrationOpen) {
      // Force re-render of embed
      setEmbedKey(prev => prev + 1);
      
      // Remove existing WebinarKit script to force fresh load
      const existingScript = document.getElementById('ewk-js');
      if (existingScript) {
        existingScript.remove();
        console.log("Removed existing ewk-js script");
      }
      
      // Wait for dialog DOM to render, then reload script
      setTimeout(() => {
        ensureWebinarAttributionOnPage();
        const script = document.createElement('script');
        script.id = 'ewk-js';
        script.src = `https://viralmeetings.com/js/ewk_v7.js?v=7&sv=true&t=${Date.now()}`;
        script.onload = () => {
          console.log("ewk-js reloaded successfully");
          if (typeof (window as any).wk_init === 'function') {
            console.log("Calling wk_init after fresh script load");
            try {
              (window as any).wk_init();
              console.log("wk_init completed successfully");
            } catch (error) {
              console.error("Error calling wk_init:", error);
            }
          }
        };
        script.onerror = () => {
          console.error("Failed to reload ewk-js script");
        };
        document.body.appendChild(script);
      }, 100);
    }
  }, [isRegistrationOpen]);
  
  useEffect(() => {
    // Load vendor CSS
    const loadCSS = (href: string, id: string) => {
      if (!document.getElementById(id)) {
        const link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        link.href = href;
        document.head.appendChild(link);
        console.log(`Loaded CSS: ${id}`);
      }
    };

    // Load vendor JS
    const loadJS = (src: string, id: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (document.getElementById(id)) {
          console.log(`Script already loaded: ${id}`);
          resolve();
          return;
        }
        const script = document.createElement("script");
        script.id = id;
        script.src = src;
        script.onload = () => {
          console.log(`Loaded script: ${id}`);
          resolve();
        };
        script.onerror = () => {
          console.error(`Failed to load script: ${id}`);
          reject();
        };
        document.body.appendChild(script);
      });
    };

    // Load all vendor assets
    const loadVendorAssets = async () => {
      try {
        // Load CSS first
        loadCSS("https://cdn.jsdelivr.net/npm/intl-tel-input@19.5.6/build/css/intlTelInput.css", "intl-tel-input-css");
        loadCSS("https://viralmeetings.com/css/ewk_v5.css?cache=5", "ewk-css");

        // Load JS in sequence
        await loadJS("https://cdn.jsdelivr.net/npm/intl-tel-input@19.5.6/build/js/intlTelInput.min.js", "intl-tel-input-js");
        await loadJS("https://cdn.jsdelivr.net/npm/luxon@3.4.4/build/global/luxon.min.js", "luxon-js");
        // Drop a script left over from another route so it snapshots this URL.
        document.getElementById("ewk-js")?.remove();
        ensureWebinarAttributionOnPage();
        await loadJS("https://viralmeetings.com/js/ewk_v7.js?v=7&sv=true", "ewk-js");
        await loadJS("https://viralmeetings.com/js/ewk_i.js?v=1", "ewk-i-js");

        // Don't call wk_init here - it will be called when dialog opens
        console.log("Vendor assets loaded, waiting for dialog to open");
      } catch (error) {
        console.error("Error loading vendor assets:", error);
      }
    };
    loadVendorAssets();
  }, []);

  // Record each registration (name, email, phone + fbclid/UTM) on our side
  useEffect(() => {
    return watchWebinarRegistrationForms();
  }, []);

  // Meta Pixel tracking
  // Meta Pixel is loaded once globally in index.html; PageView fires via MetaPixelRouteTracker.
  return <>
      <PageSEO
        title="SaaSSuite Webinar — Onboard, Educate & Retain HighLevel Clients"
        description="Live training for HighLevel agency owners: how to onboard, educate, and retain SaaS clients using SaaSSuite. Register free."
        path="/webinar"
        jsonLd={buildBreadcrumbJsonLd([{ name: "Webinar", path: "/webinar" }])!}
      />
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        {/* Header */}
        <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-center">
              <Link to="/" className="flex items-center justify-center">
                <img src="/assets/saassuite-logo.png" alt="SaaSSuite Logo" className="h-11 w-auto" />
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-0">
          {/* Hero Section with Background */}
          <div className="relative mx-auto px-6 py-12 mb-12" style={{
          backgroundImage: "url(/assets/hero-bg.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          borderRadius: "25px"
        }}>
            <div className="text-center mb-8">
              <AnimatedSection animation="fade-blur" delay={0}>
                <div className="inline-block bg-[#882BDB] text-white px-6 py-2 rounded-full mb-4 font-bold text-sm tracking-wide">
                  ATTENTION HIGHLEVEL USERS
                </div>
              </AnimatedSection>
              <AnimatedSection animation="fade-blur" delay={150}>
                <h1 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
                  The #1 Way To Attract Sticky SaaS Customers Like a Magnet AND Keep Them <span className="text-[#882BDB]">FOR LIFE</span>
                </h1>
              </AnimatedSection>
              <AnimatedSection animation="fade-blur" delay={300}>
                <p className="text-muted-foreground mb-8 text-xl font-medium">
                  ...Without doing ANY onboarding calls or customer support whatsoever
                </p>
              </AnimatedSection>
              
              <AnimatedSection animation="fade-blur" delay={450} className="max-w-md mx-auto">
                <Button 
                  size="lg" 
                  onClick={openRegistration}
                  className="w-full bg-[#882BDB] hover:bg-[#882BDB]/90 text-white font-bold text-xl px-8 py-6 mb-4"
                >
                  SAVE MY SEAT
                </Button>
              </AnimatedSection>
              <AnimatedSection animation="fade-blur" delay={600} className="max-w-md mx-auto">
                <p className="text-muted-foreground text-sm font-medium">
                  &gt;&gt; Free Workshop reveals how to Install This Small Tweak in 5 Minutes (Limited Seats) &lt;&lt;
                </p>
              </AnimatedSection>

              {/* Trusted by badge */}
              <AnimatedSection animation="fade-blur" delay={100}>
                <div className="flex items-center justify-center gap-2 mt-6 text-muted-foreground">
                  <Users className="w-5 h-5" />
                  <span className="text-sm font-medium">Trusted by 500+ Agencies</span>
                </div>
              </AnimatedSection>
            </div>
          </div>

          {/* Here's What You'll Learn Section */}
          <AnimatedSection animation="fade-blur" delay={250} className="max-w-4xl mx-auto mb-16">
            <div className="bg-card border border-border rounded-lg p-8 md:p-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center text-foreground">
                Here's what you'll learn
              </h2>
              <div className="space-y-4 text-lg">
                <div className="flex items-start gap-3">
                  <Check className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                  <span className="text-muted-foreground">The one small secret highlevel users are using to enroll new users without them churning</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                  <span className="text-muted-foreground">The one small strategy to keep customers from canceling</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                  <span className="text-muted-foreground">The exact playbook top HighLevel agencies use to hit $30K/month and beyond</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                  <span className="text-muted-foreground">Why onboarding calls are actually harming your business</span>
                </div>
              </div>
            </div>
          </AnimatedSection>

          {/* Meet Your Presenter Banner */}
          <AnimatedSection animation="fade-in" className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">Meet Your Presenter</h2>
          </AnimatedSection>

          {/* Andrew George Section */}
          <AnimatedSection animation="fade-in" className="max-w-5xl mx-auto mb-16">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <img src={andrewGeorgeImage} alt="Andrew George" className="rounded-lg shadow-xl w-full max-w-md mx-auto" />
              </div>
              <div>
                <h2 className="text-3xl font-bold mb-6">Hi, I'm Andrew George</h2>
                <ul className="space-y-4 text-lg text-muted-foreground">
                  <li className="flex items-start gap-3">
                    <Check className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                    <span>Certified HighLevel educator with 20,000+ subscribers</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                    <span>Founder of SaaSSuite & 6 Figure Agency Owner</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                    <span>Helped 500+ agencies automate onboarding, education, & retention</span>
                  </li>
                </ul>
              </div>
            </div>
            <div className="text-center mt-8">
              <Button size="lg" onClick={openRegistration} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-lg px-8 py-6">
                Save My Seat
                <ArrowUp className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </AnimatedSection>

          {/* Are You Struggling Section */}
          <AnimatedSection animation="fade-blur" delay={350} className="max-w-5xl mx-auto mb-16">
            <div className="p-8 md:p-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-10 text-center text-foreground">
                Are you struggling to...
              </h2>
              <div className="grid md:grid-cols-3 gap-8 mb-10">
                <div className="bg-card border border-border rounded-lg p-6">
                  <h3 className="text-xl font-bold mb-4 text-primary flex items-center gap-2">
                    <div className="bg-green-500 rounded-full p-1 flex-shrink-0">
                      <Check className="w-5 h-5 text-white" strokeWidth={3} />
                    </div>
                    ONBOARD NEW USERS?
                  </h3>
                  <ul className="space-y-3 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span>Spending hours on onboarding calls with little results?</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span>Wasting money on extra onboarding tools that don't work?</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span>Need a proven system like top 7–8 figure agencies use?</span>
                    </li>
                  </ul>
                </div>
                <div className="bg-card border border-border rounded-lg p-6">
                  <h3 className="text-xl font-bold mb-4 text-primary flex items-center gap-2">
                    <div className="bg-green-500 rounded-full p-1 flex-shrink-0">
                      <Check className="w-5 h-5 text-white" strokeWidth={3} />
                    </div>
                    PERSONALLY EDUCATE?
                  </h3>
                  <ul className="space-y-3 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span>Can't scale personalized training to all customers?</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span>Customers not learning HighLevel properly?</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span>Missing signs of at-risk clients before they churn?</span>
                    </li>
                  </ul>
                </div>
                <div className="bg-card border border-border rounded-lg p-6">
                  <h3 className="text-xl font-bold mb-4 text-primary flex items-center gap-2">
                    <div className="bg-green-500 rounded-full p-1 flex-shrink-0">
                      <Check className="w-5 h-5 text-white" strokeWidth={3} />
                    </div>
                    KEEP CUSTOMERS LONGER - OR GET YOUR FIRST ONES?
                  </h3>
                  <ul className="space-y-3 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span>Low retention rates killing your recurring revenue?</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span>Can't track customer engagement effectively?</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span>Need help getting your first customers?</span>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="text-center">
                <Button size="lg" onClick={openRegistration} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-lg px-8 py-6">
                  Save My Seat
                  <ArrowUp className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </div>
          </AnimatedSection>

          {/* Testimonials Section */}
          <AnimatedSection animation="fade-in" className="mb-16">
            <VideoTestimonialsSection />
          </AnimatedSection>

          {/* Final CTA Section */}
          <AnimatedSection animation="fade-blur" delay={550} className="max-w-4xl mx-auto mb-16">
            <div className="bg-black rounded-lg p-12 text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-primary-foreground">
                Ready to Transform Your HighLevel Agency/SaaS?
              </h2>
              <p className="text-xl text-primary-foreground/90 mb-8">
                Join us for this game-changing webinar and discover how to onboard, educate, and retain customers like
                never before.
              </p>
              <div className="flex justify-center">
                <Button size="lg" onClick={openRegistration} className="bg-background hover:bg-background/90 text-foreground font-semibold text-lg px-10 py-6 shadow-lg">
                  Save My Seat
                  <ArrowUp className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </div>
          </AnimatedSection>
        </main>

        {/* Footer */}
        <Footer />

        {/* Fixed Help Button */}
        <button
          onClick={() => window.open('https://flowto.it/e9x57Mdihx?fc=0', '_blank')}
          className="fixed bottom-6 right-6 bg-primary text-primary-foreground rounded-full w-16 h-16 shadow-lg hover:bg-primary/90 transition-all flex items-center justify-center z-50"
          aria-label="Get help"
        >
          <span className="text-2xl font-bold">?</span>
        </button>

        {/* Registration Popup */}
        <Dialog open={isRegistrationOpen} onOpenChange={setIsRegistrationOpen}>
          <DialogContent className="w-[95vw] sm:w-[85vw] md:w-[70vw] max-w-2xl max-h-[90vh] p-0 bg-transparent border-0 shadow-none" aria-describedby="registration-description">
            <DialogTitle className="sr-only">Webinar Registration</DialogTitle>
            <div id="registration-description" className="sr-only">Register for the webinar by filling out the form</div>
            <div className="w-full overflow-x-hidden">
              <div key={embedKey} className="max-w-full" dangerouslySetInnerHTML={{
                __html: `<style>@media (max-width: 1e+09px) {  #wk_element_399409224331983c0bb3717d18e66cc0 { width: 100%; max-width: 100%; min-height: 16px; padding: 16px; margin: 0px auto; border-style: solid; border-color: rgb(255, 255, 255); border-width: 0px; border-radius: 16px; background: rgb(255, 255, 255); }  #wk_element_889d2c8b54ae5001837c2ec42ca72c7e { width: 100%; max-width: 100%; min-height: 0px; padding: 0px; margin: 0px; border-style: none; background: rgba(0, 0, 0, 0); font-family: HKGroteskPro, serif; font-size: 16px; line-height: 1.35; letter-spacing: 0px; display: flex; }  #wk_element_889d2c8b54ae5001837c2ec42ca72c7e :not(:last-child) { margin-bottom: 0px; }  #wk_element_399409224331983c0bb3717d18e66cc0_checkbox { color: rgb(0, 0, 0); }  #wk_element_6aef8c2761d05f7a7fee01f707ee3d9f { width: 100%; max-width: 100%; min-height: 0px; padding: 8px 16px; margin: 0px; color: rgb(255, 255, 255); border-style: solid; border-color: rgb(136, 43, 219); border-width: 0px; border-radius: 6px; background: rgb(136, 43, 219); font-family: HKGroteskPro, serif; font-size: 19px; line-height: 1.5; letter-spacing: 0px; display: flex; }  #wk_element_6aef8c2761d05f7a7fee01f707ee3d9f :not(:last-child) { margin-bottom: 0px; }  #wk_element_0395e8cddb33074c3bdcf16019d90668 { width: 540px; max-width: 100%; min-height: 16px; padding: 16px 0px 0px; margin: 0px auto; border-style: none; background: rgba(0, 0, 0, 0); }  #wk_element_0395e8cddb33074c3bdcf16019d90668_calendar { background: rgb(51, 94, 234); }  #wk_element_d94017575195c57e80b94bab113f9bdc { max-width: 540px; min-height: 16px; padding: 0px; margin: 0px auto; border-style: solid; border-color: rgb(255, 255, 255); border-width: 0px; border-radius: 16px; background: rgb(255, 255, 255); }}@media (max-width: 992px) {}@media (max-width: 768px) {}</style><div class="wk_root" style="width: 100%; z-index: 100000;"><div class="wk_ascend_tree col-12 col-md my-auto shadow wk_column wk_editor_hide_tooltips" id="wk_element_d94017575195c57e80b94bab113f9bdc" data-custom-css-classes="shadow" data-wk-border-style-desktop="solid" data-wk-background-type-desktop="solid"> <div class="wk_registration_timer" id="wk_element_0395e8cddb33074c3bdcf16019d90668" data-wk-background-type-desktop="default" data-wk-border-style-desktop="default" calendar="hide" data-classes="wk_registration_timer" data-wk-days-label="days" data-wk-hours-label="hours" data-wk-in-progress-text="webinar session is now in progress. Register now to join the in progress session." data-wk-instant-watch-text="Instant watch session available. Join now!" data-wk-minutes-label="minutes" data-wk-next-session-text="Next session in:" data-wk-seconds-label="seconds" data-wk-webinar-id="691759ac6ac8859d0246b656" timer_size="small"> <div class="wk_row_internal"> <div class="col wk_timer"> <div class="mx-auto rounded-2 shadow wk_calendar" style="max-width: 170px; background: #fff; display:none"> <div class="wk_calendar_color" id="wk_element_0395e8cddb33074c3bdcf16019d90668_calendar" style="border-top-left-radius: .375rem; border-top-right-radius: .375rem"> <h5 class="text-center fw-bold py-2 text-uppercase text-white wk_calendar_month">October</h5> </div> <h1 class="text-center fw-bold mb-2 pb-2 wk_calendar_day">5</h1> </div> <h5 class="text-center mb-4 mt-5 wk_calendar_header" style="display:none"><i class="fa-clock fa-regular"></i><span class="wk_calendar_time"> 8:00 PM CDT</span></h5> <h6 class="text-center fw-bold wk_timer_header">Mon, 10/5, 8:00 PM CDT webinar session is now in progress. Register now to join the in progress session.</h6> <div class="wk_row_internal mx-auto wk_timer_row" style="display: none;"> <div class="col-3 px-0"> <h5 class="text-center mb-0 wk_timer_days">0</h5> <h6 class="text-center mb-0 wk_timer_days_label">days</h6> </div> <div class="col-3 px-0"> <h5 class="text-center mb-0 wk_timer_hours">0</h5> <h6 class="text-center mb-0 wk_timer_hours_label">hours</h6> </div> <div class="col-3 px-0"> <h5 class="text-center mb-0 wk_timer_minutes">0</h5> <h6 class="text-center mb-0 wk_timer_minutes_label">minutes</h6> </div> <div class="col-3 px-0"> <h5 class="text-center mb-0 wk_timer_seconds">0</h5> <h6 class="text-center mb-0 wk_timer_seconds_label">seconds</h6> </div> </div> </div> </div> </div> <div class="wk_editor_hide_tooltips shadow shadow-none wk_registration_form" id="wk_element_399409224331983c0bb3717d18e66cc0" data-wk-background-type-desktop="solid" data-wk-border-style-desktop="solid" data-wk-enable-instant-watch="false" data-custom-css-classes="shadow-none" data-wk-date-format-type="en-US" data-wk-webinar-id="691759ac6ac8859d0246b656"> <form class="wk_ascend_tree wk_registration_form_element"> <select class="mb-3 bg-light form-select form-select-lg wk_registration_form_date" onchange="set_date_text(event,this.value)"></select><input class="wk_registration_form_date_text" type="hidden"><input class="mb-3 bg-light form-control form-control-lg wk_registration_form_first_name" placeholder="First Name" required=""><input class="mb-3 bg-light form-control form-control-lg d-none wk_registration_form_last_name" placeholder="Last Name"><input class="mb-3 bg-light form-control form-control-lg wk_registration_form_email" placeholder="Email" oninput="wk_input_change(this)" type="email" required=""><input class="form-control form-control-lg bg-light mb-3 wk_registration_form_phone" type="tel" placeholder="Phone Number" required="" oninput="wk_input_change(this)"><input class="mb-3 bg-light form-control form-control-lg wk_registration_form_custom_field_1" placeholder="Do you have a HighLevel account? (Yes/No)" required=""><input class="mb-3 bg-light form-control form-control-lg d-none wk_registration_form_custom_field_2" placeholder="Custom Field 2"><input class="mb-3 bg-light form-control form-control-lg d-none wk_registration_form_custom_field_3" placeholder="Custom Field 3"><input class="mb-3 bg-light form-control form-control-lg d-none wk_registration_form_custom_field_4" placeholder="Custom Field 4"><input class="mb-3 bg-light form-control form-control-lg d-none wk_registration_form_custom_field_5" placeholder="Custom Field 5"> <div class="mb-3 d-none mx-0 p-0 wk_registration_form_checkbox wk_row_internal"> <div class="my-auto col-auto"> <div class="wk_checkbox"><input class="wk_checkbox_input" type="checkbox" id="wk_element_399409224331983c0bb3717d18e66cc0_checkbox"></div> </div> <div class="my-auto col"> <div class="wk_editor_hide_tooltips wk_text" id="wk_element_889d2c8b54ae5001837c2ec42ca72c7e" data-wk-background-type-desktop="default" data-wk-border-style-desktop="default"> <div contenteditable="false" style="width: 100%; margin-top: auto; margin-bottom: auto;"> <p>I consent to receiving emails and/or text message reminders for this event.</p> </div> </div> </div> </div> <div class="wk_editor_hide_tooltips wk_button btn btn-lg wk_button_hide_settings" id="wk_element_6aef8c2761d05f7a7fee01f707ee3d9f" data-wk-background-type-desktop="solid" data-wk-border-style-desktop="solid" onclick="webinar_registration_submit(event)"> <div contenteditable="false" style="width: 100%; margin-top: auto; margin-bottom: auto;"> <p><b>SAVE MY SEAT</b></p> </div> </div> </form> </div> </div></div>`
              }} />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>;
};
export default Webinar;