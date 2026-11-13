import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Users } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import VideoTestimonialsSection from "@/components/VideoTestimonialsSection";
import Footer from "@/components/Footer";
import AnimatedSection from "@/components/AnimatedSection";
import PageSEO from "@/components/PageSEO";
import andrewPortrait from "@/assets/webinar-2-andrew.png";
import { useAffiliateTracking } from "@/hooks/useAffiliateTracking";
import { LeadForm, useGoTo } from "@/components/one-feature/shared";
import { preloadTrainingSuccess } from "@/lib/trainingSuccessNav";

/** /onefeaturetraining-1 (straight to training) and -2 (opt-in popup first). */
const OneFeatureTraining = ({ variant }: { variant: 1 | 2 }) => {
  useAffiliateTracking("webinar");
  const goTo = useGoTo();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    void preloadTrainingSuccess();
  }, []);
  const onWatch = () => (variant === 1 ? goTo("/onefeaturetraining-success") : setOpen(true));

  return (
    <>
      <PageSEO
        title="I Sell ONE GHL Feature for $99/Month | Free Training"
        description="Watch Andrew George show how he sells one HighLevel feature for $99/month. Free training."
        path={`/onefeaturetraining-${variant}`}
        noindex={variant === 2}
      />
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <main className="container mx-auto px-4 py-0">
          <section className="webinar-2-hero relative mx-auto mb-2 overflow-hidden rounded-lg px-4 pt-5 text-center sm:px-8 md:pt-7">
            <img src="/assets/saassuite-logo.png" alt="SaaSSuite" width="96" height="96" decoding="async" fetchPriority="low" className="mx-auto mb-2 h-12 w-12 object-contain sm:h-14 sm:w-14" />
            <AnimatedSection animation="fade-blur" delay={0}>
              <div className="webinar-2-attention mx-auto mb-3 inline-flex px-6 py-2 text-[16px] font-bold uppercase sm:text-[18px]">
                Attention HighLevel Users
              </div>
            </AnimatedSection>
            <AnimatedSection animation="fade-blur" delay={100}>
              <h1 className="mx-auto max-w-4xl text-[31px] font-extrabold leading-tight text-foreground sm:text-[40px] md:text-[48px]">
                I Sell <span className="webinar-2-accent">ONE GHL Feature</span> for{" "}
                <span className="webinar-2-accent">$99/month</span>, and this is how...
              </h1>
            </AnimatedSection>
            <AnimatedSection animation="fade-blur" delay={200}>
              <p className="mx-auto mt-3 max-w-2xl text-[21px] font-medium text-muted-foreground sm:text-[24px]">
                ...without paying for expensive tools, knowing how to code, or any experience whatsoever...
              </p>
            </AnimatedSection>
            <AnimatedSection animation="fade-in" delay={150} duration={600} className="mx-auto mt-3 max-w-xl">
              <div className="relative mx-auto h-[366px] w-full max-w-[390px] sm:h-[425px] sm:max-w-[450px] md:h-[459px]">
                <div className="absolute inset-x-0 bottom-2 top-0 overflow-hidden sm:bottom-4">
                  <img src={andrewPortrait} alt="Andrew George" width="768" height="1366"
                    fetchPriority="high" decoding="async" loading="eager"
                    className="absolute inset-x-0 top-0 mx-auto h-full w-auto max-w-none translate-x-[calc(10%-5px)] -translate-y-[8%] scale-[1.42] object-contain object-top" />
                </div>
                <Button size="lg" onClick={onWatch}
                  className="webinar-2-cta absolute bottom-2 left-1/2 z-20 min-h-14 w-[calc(100%-1rem)] -translate-x-1/2 text-[21px] font-extrabold uppercase sm:bottom-4 sm:text-[26px]">
                  Watch Now <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
                </Button>
              </div>
            </AnimatedSection>
            <AnimatedSection animation="fade-blur" delay={400} className="mx-auto max-w-xl pb-3">
              <div className="mt-4 flex items-center justify-center gap-2 text-muted-foreground">
                <Users className="h-5 w-5 webinar-2-accent" aria-hidden="true" />
                <span className="text-[16px] font-semibold sm:text-[18px]">{variant === 2 ? "Trusted by 1,200+ agencies" : "Trusted by 500+ Agencies"}</span>
              </div>
            </AnimatedSection>
          </section>
          <div className="mb-16"><VideoTestimonialsSection deferPosters={variant === 2} /></div>
          <AnimatedSection animation="fade-blur" delay={550} className="mx-auto mb-16 max-w-4xl">
            <div className="rounded-lg bg-primary p-8 text-center md:p-12">
              <h2 className="mb-4 text-[34px] font-bold text-primary-foreground md:text-[42px]">See How One Feature Pays Monthly</h2>
              <p className="mb-8 text-[23px] text-primary-foreground/90">Watch the free training now.</p>
              <Button size="lg" onClick={onWatch} className="webinar-2-cta px-10 py-6 text-[21px] font-bold uppercase">
                Watch Now <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
              </Button>
            </div>
          </AnimatedSection>
        </main>
        <Footer minimal />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-md">
            <DialogTitle className="text-center text-2xl font-extrabold">Where should we send the training?</DialogTitle>
            <LeadForm page="onefeaturetraining-2" form="watch_popup" submitLabel="Watch Now"
              onDone={() => goTo("/onefeaturetraining-success?src=oft2")} />
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default OneFeatureTraining;
