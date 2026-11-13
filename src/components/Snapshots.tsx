import { PageHeader } from "@/components/platform/PageHeader";
import { ExternalLink, Mail, Webhook, Mic } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SnapshotItem {
  id: string;
  title: string;
  description: string;
  url?: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SNAPSHOTS: SnapshotItem[] = [
  {
    id: "email-marketing",
    title: "Email Marketing Snapshot",
    description: "Pre-built email marketing workflows, templates, and campaigns ready to load into your sub-account.",
    url: "https://affiliates.gohighlevel.com/?fp_ref=howtousehighlevel&share=juJUavNjhX6gE38EfYYp",
    icon: Mail,
  },
  {
    id: "saas-mode-webinar-api",
    title: "SaaS Mode Webinar API Snapshot",
    description: "API-driven webinar registration and follow-up automations configured for SaaS Mode.",
    url: "https://affiliates.gohighlevel.com/?fp_ref=howtousehighlevel&share=yCGTHNFjc6DWxcAvjw4T",
    icon: Webhook,
  },
  {
    id: "voice-ai-onboarding",
    title: "Voice AI Onboarding Snapshot",
    description: "Voice AI agent onboarding flows wired up and ready to deploy.",
    url: "https://affiliates.gohighlevel.com/?fp_ref=howtousehighlevel&share=MgoLjgaUntXFNYQJxJPR",
    icon: Mic,
  },
];

export default function Snapshots() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Snapshots"
        subtitle="Load pre-built HighLevel snapshots into your sub-accounts."
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {SNAPSHOTS.map((snap) => {
          const Icon = snap.icon;
          return (
            <Card key={snap.id} className="flex flex-col">
              <CardHeader>
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <CardTitle className="text-lg">{snap.title}</CardTitle>
                <CardDescription>{snap.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Button
                  className="w-full gap-2"
                  disabled={!snap.url}
                  onClick={() => snap.url && window.open(snap.url, "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink className="w-4 h-4" />
                  {snap.url ? "Load Snapshot" : "Link coming soon"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}