import { useEffect } from "react";
import Footer from "@/components/Footer";
import PageSEO from "@/components/PageSEO";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { WL_SALES_VIDEO, fireConfetti } from "@/components/one-feature/shared";

const steps = [
  "Download the video",
  "Upload it to Claude Opus 5.5 with your logo and colors",
  "Put it on your landing page or run it as an ad",
];

const OneFeatureWlSalesVideo = () => {
  useEffect(() => { fireConfetti(); }, []);
  return (
    <>
      <PageSEO title="Here's Your Bonus | One-Feature White Label Sales Video" description="Your One-Feature white label sales video." path="/onefeaturetraining-wlsalesvideo" />
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <main className="container mx-auto max-w-4xl space-y-10 px-4 py-10 text-center">
          <h1 className="text-[34px] font-extrabold text-foreground sm:text-[48px]">
            Here's Your <span className="webinar-2-accent">Bonus!</span>
          </h1>
          <video src={WL_SALES_VIDEO} controls playsInline className="mx-auto w-full rounded-lg border border-border shadow-lg" />
          <section className="space-y-4 text-left">
            <h2 className="text-center text-2xl font-extrabold text-foreground">Here's how to use it</h2>
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-4 rounded-lg border border-border bg-card p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-extrabold text-primary-foreground">{i + 1}</span>
                <span className="text-lg font-semibold text-foreground">{s}</span>
              </div>
            ))}
            <Button asChild size="lg" className="webinar-2-cta min-h-14 w-full text-lg font-extrabold uppercase">
              <a href={WL_SALES_VIDEO} download target="_self"><Download className="mr-2 h-5 w-5" />Download the Video</a>
            </Button>
          </section>
        </main>
        <Footer minimal />
      </div>
    </>
  );
};

export default OneFeatureWlSalesVideo;
