import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useAffiliateTracking } from "@/hooks/useAffiliateTracking";
import { ArrowRight, Users } from "lucide-react";
import VideoTestimonialsSection from "@/components/VideoTestimonialsSection";
import Footer from "@/components/Footer";
import AnimatedSection from "@/components/AnimatedSection";
import PageSEO from "@/components/PageSEO";
import { buildBreadcrumbJsonLd } from "@/lib/seoJsonLd";
import andrewPortrait from "@/assets/webinar-2-andrew.png";
import { watchWebinarRegistrationForms } from "@/utils/webinarRegistrationCapture";
import { ensureWebinarAttributionOnPage } from "@/utils/webinarAttribution";
import { trackingPixelsAllowed } from "@/utils/trackingConsent";
import { useWebinarMetaGuard } from "@/hooks/useWebinarMetaGuard";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
const AISaasWebinar = () => {
  useWebinarMetaGuard();
  useAffiliateTracking('webinar');
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
        title="Build an AI SaaS Product and Sales System | Free Webinar"
        description="Watch Andrew George build a dummy-proof AI SaaS product and sales system in 90 minutes for $0. Register free."
        path="/ai-saas-webinar"
        jsonLd={buildBreadcrumbJsonLd([{ name: "AI SaaS Webinar", path: "/ai-saas-webinar" }])!}
      />
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        {/* Main Content */}
        <main className="container mx-auto px-4 py-0">
          {/* Focused registration hero */}
          <section className="webinar-2-hero relative mx-auto mb-2 overflow-hidden rounded-lg px-4 pt-5 text-center sm:px-8 md:pt-7">
            <img
              src="/assets/saassuite-logo.png"
              alt="SaaSSuite"
              width="96"
              height="96"
              fetchPriority="high"
              className="mx-auto mb-2 h-12 w-12 object-contain sm:h-14 sm:w-14"
            />
            <AnimatedSection animation="fade-blur" delay={0}>
              <div className="webinar-2-attention mx-auto mb-3 inline-flex px-6 py-2 text-[16px] font-bold uppercase sm:text-[18px]">
                Attention HighLevel Users
              </div>
            </AnimatedSection>
            <AnimatedSection animation="fade-blur" delay={100}>
              <h1 className="mx-auto max-w-4xl text-[31px] font-extrabold leading-tight text-foreground sm:text-[40px] md:text-[48px]">
                Watch Me Build A Dummy-Proof AI SaaS <span className="webinar-2-accent">PRODUCT + SALES</span> System In 90 Minutes For{" "}
                <span className="webinar-2-accent">$0</span>
              </h1>
            </AnimatedSection>

            <AnimatedSection animation="fade-blur" delay={200}>
              <p className="mx-auto mt-3 max-w-2xl text-[21px] font-medium text-muted-foreground sm:text-[24px]">
                ...without paying for expensive tools, knowing how to code, or any experience whatsoever...
              </p>
            </AnimatedSection>

            <AnimatedSection animation="fade-in" delay={150} duration={600} className="mx-auto mt-3 max-w-xl">
              <div className="relative mx-auto h-[366px] w-full max-w-[390px] sm:h-[425px] sm:max-w-[450px] md:h-[459px]">
                {/* Photo is clipped so nothing renders below the CTA button */}
                <div className="absolute inset-x-0 bottom-2 top-0 overflow-hidden sm:bottom-4">
                  <img
                    src={andrewPortrait}
                    alt="Andrew George"
                    width="768"
                    height="1366"
                    fetchPriority="high"
                    className="absolute inset-x-0 top-0 mx-auto h-full w-auto max-w-none translate-x-[calc(10%-5px)] -translate-y-[8%] scale-[1.42] object-contain object-top"
                  />
                </div>

                <div className="absolute right-0 top-[28%] z-10 w-28 text-left sm:-right-10 sm:w-36">
                  <p className="webinar-2-bonus-text text-[14px] font-bold uppercase leading-tight sm:text-[16px]">
                    Free bonus when you register
                  </p>
                  <div className="mt-1 flex items-center justify-end gap-1">
                    <svg className="webinar-2-arrow h-7 w-14 sm:h-9 sm:w-20" viewBox="0 0 64 28" fill="none" aria-hidden="true">
                      <path d="M3 21c12 2 27-1 45-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                      <path d="m41 6 15 6-12 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                    <div className="webinar-2-book flex h-16 w-12 items-center justify-center sm:h-20 sm:w-16" aria-label="Mystery bonus">
                      <span className="webinar-2-accent text-[23px] font-black sm:text-[28px]" aria-hidden="true">???</span>
                    </div>
                  </div>
                </div>

                <Button
                  size="lg"
                  onClick={openRegistration}
                  className="webinar-2-cta absolute bottom-2 left-1/2 z-20 min-h-14 w-[calc(100%-1rem)] -translate-x-1/2 text-[21px] font-extrabold uppercase sm:bottom-4 sm:text-[26px]"
                >
                  Secure my free seat
                  <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
                </Button>
              </div>
            </AnimatedSection>

            <AnimatedSection animation="fade-blur" delay={400} className="mx-auto max-w-xl pb-3">
              <p className="text-[16px] font-medium text-muted-foreground sm:text-[18px]">
                Free workshop reveals how to build this entire business in less than 90 minutes...
              </p>
              <div className="mt-7 flex items-center justify-center gap-2 text-muted-foreground">
                <Users className="h-5 w-5 webinar-2-accent" aria-hidden="true" />
                <span className="text-[16px] font-semibold sm:text-[18px]">Trusted by 500+ Agencies</span>
              </div>
            </AnimatedSection>
          </section>

          {/* Testimonials Section */}
          <div className="mb-16">
            <VideoTestimonialsSection />
          </div>

          {/* Final CTA Section */}
          <AnimatedSection animation="fade-blur" delay={550} className="max-w-4xl mx-auto mb-16">
            <div className="rounded-lg bg-primary p-8 text-center md:p-12">
              <h2 className="text-[34px] md:text-[42px] font-bold mb-4 text-primary-foreground">
                Ready to Build Customers Who Stay?
              </h2>
              <p className="text-[23px] text-primary-foreground/90 mb-8">
                Reserve your free seat and see the strategy SaaSPreneur Gold winners use to attract and retain customers.
              </p>
              <div className="flex justify-center">
                <Button size="lg" onClick={openRegistration} className="webinar-2-cta px-10 py-6 text-[21px] font-bold">
                  Secure my free seat
                  <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </AnimatedSection>
        </main>

        {/* Footer */}
        <Footer />

        {/* Registration Popup */}
        <Dialog open={isRegistrationOpen} onOpenChange={setIsRegistrationOpen}>
          <DialogContent className="w-[95vw] sm:w-[85vw] md:w-[70vw] max-w-2xl max-h-[90vh] p-0 bg-transparent border-0 shadow-none" aria-describedby="registration-description">
            <DialogTitle className="sr-only">Webinar Registration</DialogTitle>
            <div id="registration-description" className="sr-only">Register for the webinar by filling out the form</div>
            <div className="w-full overflow-x-hidden">
              <div key={embedKey} className="max-w-full" dangerouslySetInnerHTML={{
                __html: "<style>#wk_element_6aef8c2761d05f7a7fee01f707ee3d9f, #wk_element_0395e8cddb33074c3bdcf16019d90668_calendar { background: rgb(170, 66, 219) !important; border-color: rgb(170, 66, 219) !important; } @media (max-width: 1e+09px) {  #wk_element_399409224331983c0bb3717d18e66cc0 { width: 100%; max-width: 100%; min-height: 16px; padding: 16px; margin: 0px auto; border-style: solid; border-color: rgb(255, 255, 255); border-width: 0px; border-radius: 16px; background: rgb(255, 255, 255); }  #wk_element_889d2c8b54ae5001837c2ec42ca72c7e { width: 100%; max-width: 100%; min-height: 0px; padding: 0px; margin: 0px; border-style: none; background: rgba(0, 0, 0, 0); font-family: HKGroteskPro, serif; font-size: 16px; line-height: 1.35; letter-spacing: 0px; display: flex; }  #wk_element_889d2c8b54ae5001837c2ec42ca72c7e :not(:last-child) { margin-bottom: 0px; }  #wk_element_399409224331983c0bb3717d18e66cc0_checkbox { color: rgb(0, 0, 0); }  #wk_element_6aef8c2761d05f7a7fee01f707ee3d9f { width: 100%; max-width: 100%; min-height: 0px; padding: 8px 16px; margin: 0px; color: rgb(255, 255, 255); border-style: solid; border-color: rgb(170, 66, 219); border-width: 0px; border-radius: 6px; background: rgb(170, 66, 219); font-family: HKGroteskPro, serif; font-size: 19px; line-height: 1.5; letter-spacing: 0px; display: flex; }  #wk_element_6aef8c2761d05f7a7fee01f707ee3d9f :not(:last-child) { margin-bottom: 0px; }  #wk_element_0395e8cddb33074c3bdcf16019d90668 { width: 540px; max-width: 100%; min-height: 16px; padding: 16px 0px 0px; margin: 0px auto; border-style: none; background: rgba(0, 0, 0, 0); }  #wk_element_0395e8cddb33074c3bdcf16019d90668_calendar { background: rgb(170, 66, 219); }  #wk_element_d94017575195c57e80b94bab113f9bdc { max-width: 540px; min-height: 16px; padding: 0px; margin: 0px auto; border-style: solid; border-color: rgb(255, 255, 255); border-width: 0px; border-radius: 16px; background: rgb(255, 255, 255); }}@media (max-width: 992px) {}@media (max-width: 768px) {}</style><div class=\"wk_root\" style=\"width: 100%; z-index: 100000;\"><div class=\"wk_ascend_tree col-12 col-md my-auto shadow wk_column wk_editor_hide_tooltips\" id=\"wk_element_d94017575195c57e80b94bab113f9bdc\" data-custom-css-classes=\"shadow\" data-wk-border-style-desktop=\"solid\" data-wk-background-type-desktop=\"solid\"> <div class=\"wk_registration_timer\" id=\"wk_element_0395e8cddb33074c3bdcf16019d90668\" data-wk-background-type-desktop=\"default\" data-wk-border-style-desktop=\"default\" calendar=\"hide\" data-classes=\"wk_registration_timer\" data-wk-days-label=\"days\" data-wk-hours-label=\"hours\" data-wk-in-progress-text=\"webinar session is now in progress. Register now to join the in progress session.\" data-wk-instant-watch-text=\"Instant watch session available. Join now!\" data-wk-minutes-label=\"minutes\" data-wk-next-session-text=\"Next session in:\" data-wk-seconds-label=\"seconds\" data-wk-webinar-id=\"6ac025c8b106329d6236ba46\" timer_size=\"small\"> <div class=\"wk_row_internal\"> <div class=\"col wk_timer\"> <div class=\"mx-auto rounded-2 shadow wk_calendar\" style=\"max-width: 170px; background: #fff; display:none\"> <div class=\"wk_calendar_color\" id=\"wk_element_0395e8cddb33074c3bdcf16019d90668_calendar\" style=\"border-top-left-radius: .375rem; border-top-right-radius: .375rem\"> <h5 class=\"text-center fw-bold py-2 text-uppercase text-white wk_calendar_month\">October</h5> </div> <h1 class=\"text-center fw-bold mb-2 pb-2 wk_calendar_day\">2</h1> </div> <h5 class=\"text-center mb-4 mt-5 wk_calendar_header\" style=\"display:none\"><i class=\"fa-clock fa-regular\"></i><span class=\"wk_calendar_time\"> 5:55 PM CDT</span></h5> <h6 class=\"text-center fw-bold wk_timer_header\">Next session in:</h6> <div class=\"wk_row_internal mx-auto wk_timer_row\" style=\"\"> <div class=\"col-3 px-0\"> <h5 class=\"text-center mb-0 wk_timer_days\">0</h5> <h6 class=\"text-center mb-0 wk_timer_days_label\">days</h6> </div> <div class=\"col-3 px-0\"> <h5 class=\"text-center mb-0 wk_timer_hours\">0</h5> <h6 class=\"text-center mb-0 wk_timer_hours_label\">hours</h6> </div> <div class=\"col-3 px-0\"> <h5 class=\"text-center mb-0 wk_timer_minutes\">0</h5> <h6 class=\"text-center mb-0 wk_timer_minutes_label\">minutes</h6> </div> <div class=\"col-3 px-0\"> <h5 class=\"text-center mb-0 wk_timer_seconds\">0</h5> <h6 class=\"text-center mb-0 wk_timer_seconds_label\">seconds</h6> </div> </div> </div> </div> </div> <div class=\"wk_editor_hide_tooltips shadow shadow-none wk_registration_form\" id=\"wk_element_399409224331983c0bb3717d18e66cc0\" data-wk-background-type-desktop=\"solid\" data-wk-border-style-desktop=\"solid\" data-wk-enable-instant-watch=\"false\" data-custom-css-classes=\"shadow-none\" data-wk-date-format-type=\"en-US\" data-wk-webinar-id=\"6ac025c8b106329d6236ba46\" data-wk-number-of-sessions-to-show=\"all\"> <form class=\"wk_ascend_tree wk_registration_form_element\"> <select class=\"mb-3 bg-light form-select form-select-lg wk_registration_form_date\" onchange=\"set_date_text(event,this.value)\"></select><input class=\"wk_registration_form_date_text\" type=\"hidden\"><input class=\"mb-3 bg-light form-control form-control-lg wk_registration_form_first_name\" placeholder=\"First Name\" required=\"\"><input class=\"mb-3 bg-light form-control form-control-lg d-none wk_registration_form_last_name\" placeholder=\"Last Name\"><input class=\"mb-3 bg-light form-control form-control-lg wk_registration_form_email\" placeholder=\"Email\" oninput=\"wk_input_change(this)\" type=\"email\" required=\"\"><input class=\"form-control form-control-lg bg-light mb-3 wk_registration_form_phone\" type=\"tel\" placeholder=\"Phone Number\" required=\"\" oninput=\"wk_input_change(this)\"><input class=\"mb-3 bg-light form-control form-control-lg wk_registration_form_custom_field_1\" placeholder=\"Do you have a HighLevel account? (Yes/No)\" required=\"\"><input class=\"mb-3 bg-light form-control form-control-lg d-none wk_registration_form_custom_field_2\" placeholder=\"Custom Field 2\"><input class=\"mb-3 bg-light form-control form-control-lg d-none wk_registration_form_custom_field_3\" placeholder=\"Custom Field 3\"><input class=\"mb-3 bg-light form-control form-control-lg d-none wk_registration_form_custom_field_4\" placeholder=\"Custom Field 4\"><input class=\"mb-3 bg-light form-control form-control-lg d-none wk_registration_form_custom_field_5\" placeholder=\"Custom Field 5\"> <div class=\"mb-3 d-none mx-0 p-0 wk_registration_form_checkbox wk_row_internal\"> <div class=\"my-auto col-auto\"> <div class=\"wk_checkbox\"><input class=\"wk_checkbox_input\" type=\"checkbox\" id=\"wk_element_399409224331983c0bb3717d18e66cc0_checkbox\"></div> </div> <div class=\"my-auto col\"> <div class=\"wk_editor_hide_tooltips wk_text\" id=\"wk_element_889d2c8b54ae5001837c2ec42ca72c7e\" data-wk-background-type-desktop=\"default\" data-wk-border-style-desktop=\"default\"> <div contenteditable=\"false\" style=\"width: 100%; margin-top: auto; margin-bottom: auto;\"> <p>I consent to receiving emails and/or text message reminders for this event.</p> </div> </div> </div> </div> <div class=\"wk_editor_hide_tooltips wk_button btn btn-lg wk_button_hide_settings\" id=\"wk_element_6aef8c2761d05f7a7fee01f707ee3d9f\" data-wk-background-type-desktop=\"solid\" data-wk-border-style-desktop=\"solid\" onclick=\"webinar_registration_submit(event)\"> <div contenteditable=\"false\" style=\"width: 100%; margin-top: auto; margin-bottom: auto;\"> <p><b>SAVE MY SEAT</b></p> </div> </div> </form> </div> </div></div>"
              }} />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>;
};
export default AISaasWebinar;