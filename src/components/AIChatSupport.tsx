import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Bot, Sparkles, Check, Info, Code } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";

const AIChatSupport = () => {
  const { email } = useUser();
  const brandedPaymentLink = "https://link.saassuite.ai/payment-link/6931fbc4d8c1a8dff7043087";
  
  const [showChatWidget, setShowChatWidget] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showUpgradePopup, setShowUpgradePopup] = useState(false);
  const [hasBrandedSupport, setHasBrandedSupport] = useState(false);
  const [showEmbedCodePopup, setShowEmbedCodePopup] = useState(false);
  const [embedCode, setEmbedCode] = useState("");
  const [tempEmbedCode, setTempEmbedCode] = useState("");

  // Load user settings
  useEffect(() => {
    const loadSettings = async () => {
      if (!email) return;
      
      try {
        const { data, error } = await supabase
          .from('saas_suite_users')
          .select('show_chat_widget, branded_ai_support, ai_embed_code')
          .eq('email', email)
          .maybeSingle();
        
        if (error) {
          console.error('Error loading settings:', error);
          return;
        }
        
        if (data) {
          setShowChatWidget(data.show_chat_widget ?? true);
          setHasBrandedSupport((data as any).branded_ai_support ?? false);
          setEmbedCode((data as any).ai_embed_code ?? "");
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [email]);

  const toggleChatWidget = async (enabled: boolean) => {
    if (!email) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('saas_suite_users')
        .update({ show_chat_widget: enabled } as any)
        .eq('email', email);

      if (error) {
        console.error('Error updating chat widget setting:', error);
        toast.error("Failed to update chat widget setting");
        return;
      }

      setShowChatWidget(enabled);
      toast.success(enabled ? "Chat widget enabled" : "Chat widget disabled");
    } catch (error) {
      console.error('Error updating chat widget:', error);
      toast.error("Failed to update chat widget setting");
    } finally {
      setIsSaving(false);
    }
  };

  const saveEmbedCode = async () => {
    if (!email) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('saas_suite_users')
        .update({ ai_embed_code: tempEmbedCode } as any)
        .eq('email', email);

      if (error) {
        console.error('Error saving embed code:', error);
        toast.error("Failed to save embed code");
        return;
      }

      setEmbedCode(tempEmbedCode);
      toast.success("Embed code saved!");
      setShowEmbedCodePopup(false);
    } catch (error) {
      console.error('Error saving embed code:', error);
      toast.error("Failed to save embed code");
    } finally {
      setIsSaving(false);
    }
  };

  const openEmbedCodePopup = () => {
    setTempEmbedCode(embedCode);
    setShowEmbedCodePopup(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // User has branded support - show branded UI
  if (hasBrandedSupport) {
    return (
      <div className="space-y-6">
        <Card className="relative overflow-hidden border-primary/50">
          <div className="absolute top-0 left-0 right-0 h-1 bg-brand" />
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <Badge className="px-brand-fill border-0 shadow-none">
                Active
              </Badge>
            </div>
            <CardTitle className="text-xl">Branded AI Support Agent</CardTitle>
            <CardDescription>
              Your fully customized AI chat support is active
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">Custom brand colors and styling</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">Custom prompting for your business</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">Human handover capability</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">Custom actions (SMS, email, internal notifications)</span>
              </li>
            </ul>
            
            <div className="pt-4 border-t border-border">
              <Button 
                className="w-full"
                onClick={openEmbedCodePopup}
              >
                <Code className="w-4 h-4 mr-2" />
                View Embed Code
              </Button>
            </div>

            {/* Installation Info Card */}
            <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Info className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-500">
                To install, paste this code at the agency level → Company → White Label → Custom CSS
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Embed Code Popup */}
        <Dialog open={showEmbedCodePopup} onOpenChange={setShowEmbedCodePopup}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Embed Code</DialogTitle>
              <DialogDescription>
                Paste your custom AI chat widget embed code below. This will be saved for your reference.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Textarea
                value={tempEmbedCode}
                onChange={(e) => setTempEmbedCode(e.target.value)}
                placeholder="Paste your embed code here..."
                className="min-h-[200px] font-mono text-sm"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowEmbedCodePopup(false)}>
                  Cancel
                </Button>
                <Button onClick={saveEmbedCode} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // User has brandless support - show upgrade option
  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden border-border">
        <div className="absolute top-0 left-0 right-0 h-1 bg-muted" />
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Bot className="w-6 h-6 text-muted-foreground" />
              </div>
              <Badge variant="secondary">Included</Badge>
            </div>
            <Button 
              variant="outline"
              size="sm"
              className="px-brand-fill border-0 hover:brightness-110"
              onClick={() => setShowUpgradePopup(true)}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Upgrade to Branded Support
            </Button>
          </div>
          <CardTitle className="text-xl mt-4">Brandless AI Support Agent</CardTitle>
          <CardDescription>
            Standard AI chat support for your customers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-muted-foreground">24/7 AI-powered customer support</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-muted-foreground">Black and white themed interface</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-muted-foreground">Doesn't disclose software name or HighLevel branding</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-muted-foreground">Included with all SaaSSuite plans</span>
            </li>
          </ul>
          
          {/* Chat Widget Toggle */}
          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Bot className="w-5 h-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="chat-widget-toggle" className="font-medium">
                    Show AI Chat Widget
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Display the chat support widget to your users
                  </p>
                </div>
              </div>
              <Switch
                id="chat-widget-toggle"
                checked={showChatWidget}
                onCheckedChange={toggleChatWidget}
                disabled={isSaving}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upgrade Popup */}
      <Dialog open={showUpgradePopup} onOpenChange={setShowUpgradePopup}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <Badge className="px-brand-fill border-0 shadow-none">
                Premium
              </Badge>
            </div>
            <DialogTitle className="text-xl">Branded AI Support Agent</DialogTitle>
            <DialogDescription>
              Fully customized AI chat support with your branding
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">Custom brand colors and styling</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">15-minute setup/implementation call included</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">Custom prompting for your business</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">Human handover capability</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">Custom actions (SMS, email, internal notifications)</span>
              </li>
            </ul>
            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-4">
                <span className="text-2xl font-bold text-foreground">$20</span>
                <span className="text-sm text-muted-foreground">/month per customer</span>
              </div>
              <Button 
                className="w-full px-brand-fill hover:brightness-110"
                onClick={() => window.open(brandedPaymentLink, "_blank")}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Upgrade to Branded Agent
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AIChatSupport;
