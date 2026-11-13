import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Mail, Sparkles, Copy, Check, RefreshCw, Loader2 } from "lucide-react";

interface PlatformEmail {
  id: string;
  plan: string;
  email_type: string;
  subject: string;
  body: string;
  week_label: string | null;
  created_at: string;
}

const EMAIL_TYPE_LABELS: Record<string, string> = {
  feature_release: "Feature Release",
  feature_notification: "Feature Notification",
  helpful_tip: "Helpful Tip",
};

const PLAN_COLORS: Record<string, string> = {
  STARTER: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  BASIC: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  ADVANCED: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

const PlatformEmailsPanel = () => {
  const [emails, setEmails] = useState<PlatformEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingWeekly, setGeneratingWeekly] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generatePlan, setGeneratePlan] = useState<string>("STARTER");
  const [generateType, setGenerateType] = useState<string>("random");

  useEffect(() => {
    fetchEmails();
  }, []);

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("platform_emails")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEmails((data as PlatformEmail[]) || []);
    } catch (err) {
      console.error("Error fetching emails:", err);
      toast.error("Failed to load platform emails");
    } finally {
      setLoading(false);
    }
  };

  const generateSingleEmail = async () => {
    setGenerating(true);
    try {
      const weekLabel = `Week of ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
      const { data, error } = await supabase.functions.invoke("generate-platform-email", {
        body: {
          plan: generatePlan,
          email_type: generateType === "random" ? undefined : generateType,
          count: 1,
          save_to_db: true,
          week_label: weekLabel,
        },
      });

      if (error) throw error;
      toast.success(`Generated ${generatePlan} email successfully!`);
      fetchEmails();
    } catch (err) {
      console.error("Error generating email:", err);
      toast.error("Failed to generate email");
    } finally {
      setGenerating(false);
    }
  };

  const generateWeeklyBatch = async () => {
    setGeneratingWeekly(true);
    const plans = ["STARTER", "BASIC", "ADVANCED"];
    const weekLabel = `Week of ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

    try {
      for (const plan of plans) {
        const { data, error } = await supabase.functions.invoke("generate-platform-email", {
          body: { plan, count: 1, save_to_db: true, week_label: weekLabel },
        });

        if (error) throw error;
      }

      toast.success("Generated weekly emails for all 3 plans!");
      fetchEmails();
    } catch (err) {
      console.error("Error generating weekly batch:", err);
      toast.error("Failed to generate weekly batch");
    } finally {
      setGeneratingWeekly(false);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredEmails = selectedPlan === "all" ? emails : emails.filter((e) => e.plan === selectedPlan);

  const formatBody = (body: string) => body.replace(/\\n/g, "\n");

  return (
    <div className="space-y-6">
      {/* Generate Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-500" />
              Generate Single Email
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Select value={generatePlan} onValueChange={setGeneratePlan}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STARTER">Starter</SelectItem>
                  <SelectItem value="BASIC">Basic</SelectItem>
                  <SelectItem value="ADVANCED">Advanced</SelectItem>
                </SelectContent>
              </Select>
              <Select value={generateType} onValueChange={setGenerateType}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="random">Random Type</SelectItem>
                  <SelectItem value="feature_release">Feature Release</SelectItem>
                  <SelectItem value="feature_notification">Feature Notification</SelectItem>
                  <SelectItem value="helpful_tip">Helpful Tip</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={generateSingleEmail} disabled={generating} className="w-full">
              {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
              Generate Email
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-blue-500" />
              Weekly Batch
            </CardTitle>
            <CardDescription>Generate one email for each plan (Starter, Basic, Advanced)</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={generateWeeklyBatch} disabled={generatingWeekly} className="w-full" variant="secondary">
              {generatingWeekly ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Generate Weekly Emails (All Plans)
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Filter by plan:</span>
        <Tabs value={selectedPlan} onValueChange={setSelectedPlan}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="STARTER">Starter</TabsTrigger>
            <TabsTrigger value="BASIC">Basic</TabsTrigger>
            <TabsTrigger value="ADVANCED">Advanced</TabsTrigger>
          </TabsList>
        </Tabs>
        <span className="text-sm text-muted-foreground ml-auto">{filteredEmails.length} emails</span>
      </div>

      {/* Email List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredEmails.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No emails generated yet. Use the buttons above to generate your first batch!</p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[600px]">
          <div className="space-y-4 pr-4">
            {filteredEmails.map((email) => (
              <Card key={email.id} className="relative">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge className={PLAN_COLORS[email.plan]}>{email.plan}</Badge>
                        <Badge variant="outline">{EMAIL_TYPE_LABELS[email.email_type] || email.email_type}</Badge>
                        {email.week_label && (
                          <span className="text-xs text-muted-foreground">{email.week_label}</span>
                        )}
                      </div>
                      <CardTitle className="text-base">{email.subject}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed">
                    {formatBody(email.body)}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(email.subject, `subject-${email.id}`)}
                    >
                      {copiedId === `subject-${email.id}` ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                      Copy Subject
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(formatBody(email.body), `body-${email.id}`)}
                    >
                      {copiedId === `body-${email.id}` ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                      Copy Body
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(`Subject: ${email.subject}\n\n${formatBody(email.body)}`, `full-${email.id}`)
                      }
                    >
                      {copiedId === `full-${email.id}` ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                      Copy Full Email
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(email.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default PlatformEmailsPanel;
