import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUser } from "@/contexts/UserContext";
import { useSessionTracker } from "@/contexts/SessionTrackerContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { ExistingAgencyDialog } from "@/components/ExistingAgencyDialog";
import { LEARNING_HUB_PATH } from "@/lib/onboardingArrival";
import { readNextPath, clearNextPath } from "@/utils/deepLink";
import { navigateWithParams } from "@/utils/preserveParams";

const questions = [
  {
    id: 5,
    question: "What's your agency or software name?",
    subtitle: "This instantly generates your branded client portal URL.",
    placeholder: "e.g. Bright Marketing",
    options: [
      "textInput"
    ]
  },
  {
    id: 1,
    question: "How long have you had HighLevel?",
    options: [
      "< 6 months",
      "< 12 months", 
      "1-2 years",
      "2-5 years",
      "5 years+",
      "I don't use HighLevel"
    ]
  },
  {
    id: 2,
    question: "How many active sub accounts/customers do you have?",
    options: [
      "0",
      "1-10",
      "10-50", 
      "50-100",
      "100-500",
      "500+"
    ]
  },
  {
    id: 3,
    question: "What do we call you?",
    placeholder: "Name",
    options: [
      "textInput"
    ]
  },
  {
    id: 4,
    question: "What's the best number to text you on?",
    subtitle: "We use this to give you direct 1:1 text support whenever you need help.",
    options: [
      "phoneInput"
    ]
  }
];


const COUNTRY_CODES = [
  { code: '+1', flag: '🇺🇸' },
  { code: '+44', flag: '🇬🇧' },
  { code: '+61', flag: '🇦🇺' },
  { code: '+91', flag: '🇮🇳' },
  { code: '+86', flag: '🇨🇳' },
  { code: '+81', flag: '🇯🇵' },
  { code: '+49', flag: '🇩🇪' },
  { code: '+33', flag: '🇫🇷' },
  { code: '+39', flag: '🇮🇹' },
  { code: '+34', flag: '🇪🇸' },
  { code: '+52', flag: '🇲🇽' },
  { code: '+55', flag: '🇧🇷' },
];

const InitialQuestions = () => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [countryCode, setCountryCode] = useState("+1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { clearUser } = useUser();
  const { user, email } = useUser();
  const { trackEvent } = useSessionTracker();
  const navigate = useNavigate();

  // Record which intro question they're looking at so drop-off is visible later
  useEffect(() => {
    const q = questions[currentQuestion];
    trackEvent("question_viewed", q.question, { step: currentQuestion + 1, question_id: q.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion]);

  // Pre-fill name / agency name from database if available
  useEffect(() => {
    const loadName = async () => {
      if (!email) return;
      const { data } = await supabase
        .from('saas_suite_users')
        .select('full_name, agency_name')
        .ilike('email', email)
        .maybeSingle();
      if (data?.full_name || data?.agency_name) {
        setAnswers(prev => ({
          ...prev,
          ...(data.full_name ? { '3': data.full_name } : {}),
          ...(data.agency_name ? { '5': data.agency_name } : {}),
        }));
      }
    };
    loadName();
  }, [email]);


  const handleAnswerChange = (value: string) => {
    setAnswers(prev => ({
      ...prev,
      [questions[currentQuestion].id]: value
    }));
  };

  const handleNext = () => {
    const q = questions[currentQuestion];
    trackEvent("question_answered", q.question, {
      step: currentQuestion + 1,
      question_id: q.id,
      answer: q.id === 4 ? "provided" : answers[q.id],
    });
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!user || !email) return;

    setIsSubmitting(true);
    
    try {
      // Pull fbclid + UTM attribution from URL / localStorage (captured on first page load)
      const { getStoredFbclid, getStoredAttribution } = await import("@/utils/fbAttribution");
      const fbclid = getStoredFbclid();
      const attribution = getStoredAttribution();

      // Save the onboarding responses to saas_suite_users
      const { error: responseError } = await supabase
        .from('saas_suite_users')
        .update({
          ...(answers[1] ? { highlevel_experience: answers[1] } : {}),
          ...(answers[2] ? { active_subaccounts: answers[2] } : {}),
          ...(answers[3]?.trim() ? { full_name: answers[3].trim() } : {}),
          ...(answers[5]?.trim() ? { agency_name: answers[5].trim() } : {}),

          ...(fbclid ? { fbclid } : {}),
          ...(attribution.utm_source ? { utm_source: attribution.utm_source } : {}),
          ...(attribution.utm_medium ? { utm_medium: attribution.utm_medium } : {}),
          ...(attribution.utm_campaign ? { utm_campaign: attribution.utm_campaign } : {}),
          ...(attribution.utm_term ? { utm_term: attribution.utm_term } : {}),
          ...(attribution.utm_content ? { utm_content: attribution.utm_content } : {}),
          ...(attribution.utm_id ? { utm_id: attribution.utm_id } : {}),
          ...(attribution.gclid ? { gclid: attribution.gclid } : {}),
          ...(attribution.referrer ? { referrer: attribution.referrer } : {}),
          ...(attribution.landing_page ? { landing_page: attribution.landing_page } : {}),
        })
        .ilike('email', email);

      if (responseError) throw responseError;

      // Save phone number to text_requests for 1:1 support
      const cleanNumber = (answers[4] || "").replace(/[^0-9]/g, '');
      const fullPhoneNumber = cleanNumber ? `${countryCode}${cleanNumber}` : null;
      if (fullPhoneNumber) {
        try {
          await supabase.from('text_requests').insert([{
            name: answers[3] || email || 'Onboarding user',
            phone_number: fullPhoneNumber,
            source: 'onboarding',
          }]);
        } catch (e) {
          console.error('Failed to save phone:', e);
        }
      }

      // Call webhook to notify LeadConnector
      try {
        await fetch('https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/c80002d8-3a02-4e62-8f41-19256fdc1414', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            email: email,
            onboarding_completed: true,
            highlevel_experience: answers[1],
            active_subaccounts: answers[2],
            full_name: answers[3],
            phone_number: fullPhoneNumber,
            fbclid: fbclid || "",
            utm_source: attribution.utm_source || "",
            utm_medium: attribution.utm_medium || "",
            utm_campaign: attribution.utm_campaign || "",
            utm_term: attribution.utm_term || "",
            utm_content: attribution.utm_content || "",
            utm_id: attribution.utm_id || "",
            gclid: attribution.gclid || "",
            referrer: attribution.referrer || "",
            landing_page: attribution.landing_page || "",
          }),
        });
      } catch (webhookError) {
        console.error('Webhook call failed:', webhookError);
      }

      trackEvent("initial_questions_completed", "Finished intro questions", {
        phone_provided: !!fullPhoneNumber,
      });

      toast.success("Welcome! Let's get you set up.");

      await continueToOnboarding();

    } catch (error) {
      console.error('Error saving onboarding responses:', error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Provision their live hub without replacing the chat-first experience.
  const continueToOnboarding = async () => {
    try {
      const { getDeviceType } = await import("@/utils/device");
      if (email) {
        await supabase.rpc("record_user_device", { user_email: email, device: getDeviceType() });
      }
      const { error } = await supabase.functions.invoke("provision-hub", { body: {} });
      if (error) throw error;
      if (email) {
        const { error: completionError } = await supabase.rpc("mark_initial_questions_completed", { user_email: email.trim().toLowerCase() });
        if (completionError) throw completionError;
      }
      const next = readNextPath();
      const destination = navigateWithParams(/^\/(app\/)?copilot/.test(next || '') ? next : LEARNING_HUB_PATH);
      clearNextPath();
      window.location.href = destination;
      return;
    } catch (e) {
      console.error("Hub provisioning failed:", e);
      if (email) {
        const { error } = await supabase.rpc("mark_initial_questions_completed", { user_email: email.trim().toLowerCase() });
        if (error) { toast.error("Couldn't finish saving your answers. Please try again."); return; }
      }
      const next = readNextPath();
      window.location.href = navigateWithParams(/^\/(app\/)?copilot/.test(next || '') ? next : LEARNING_HUB_PATH);
    }
  };


  const currentQuestionData = questions[currentQuestion];
  const currentAnswer = answers[currentQuestionData.id];
  const progress = ((currentQuestion + 1) / questions.length) * 100;
  const isLastQuestion = currentQuestion === questions.length - 1;
  const isTextInput = currentQuestionData.options.includes("textInput");
  const isPhoneInput = currentQuestionData.options.includes("phoneInput");
  const noHighLevel = currentQuestionData.id === 1 && currentAnswer === "I don't use HighLevel";
  const phoneDigits = isPhoneInput ? (currentAnswer || "").replace(/[^0-9]/g, '') : '';
  const phoneValid = isPhoneInput ? /^[0-9]{7,15}$/.test(phoneDigits) : true;
  const canProceed = !noHighLevel && currentAnswer !== undefined && currentAnswer.trim() !== "" && phoneValid;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-background/80 flex items-center justify-center p-4 relative">
      <ExistingAgencyDialog />
      {/* Logout button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={clearUser}
        className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
      >
        <LogOut className="w-4 h-4 mr-2" />
        Log out
      </Button>
      <Card className="w-full max-w-lg shadow-elevated border-border/50 bg-card/80 backdrop-blur-sm animate-fade-in relative overflow-hidden" key={currentQuestion}>
        <CardHeader className="text-center pb-4">
          <div className="mb-4">
            <Progress value={progress} className="w-full h-2" />
            <p className="text-sm text-muted-foreground mt-2">
              Question {currentQuestion + 1} of {questions.length}
            </p>
          </div>
          <CardTitle className="text-xl font-bold text-foreground animate-fade-in">
            {currentQuestionData.question}
          </CardTitle>
          {(currentQuestionData as any).subtitle && (
            <p className="text-sm text-muted-foreground mt-2 animate-fade-in">
              {(currentQuestionData as any).subtitle}
            </p>
          )}
        </CardHeader>
        
        <CardContent className="space-y-6 animate-fade-in">
          {isPhoneInput ? (
            <div className="flex gap-2 animate-fade-in">
              <Select value={countryCode} onValueChange={setCountryCode}>
                <SelectTrigger className="w-[90px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRY_CODES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.flag} {c.code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="tel"
                placeholder="Phone number"
                value={currentAnswer || ""}
                onChange={(e) => handleAnswerChange(e.target.value)}
                className="flex-1"
                maxLength={20}
              />
            </div>
          ) : isTextInput ? (
            <div className="space-y-3 animate-fade-in">
              <Input
                type="text"
                placeholder={(currentQuestionData as any).placeholder || "Name"}
                value={currentAnswer || ""}
                onChange={(e) => handleAnswerChange(e.target.value)}
                className="w-full"
              />
            </div>
          ) : (
            <RadioGroup
              value={currentAnswer || ""}
              onValueChange={handleAnswerChange}
              className="space-y-3 animate-fade-in"
            >
              {currentQuestionData.options.map((option) => (
                <div key={option} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={option} />
                  <Label htmlFor={option} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}

          {noHighLevel && (
            <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-3 animate-fade-in">
              <p className="text-sm text-foreground">
                That's okay! Click below to create a HighLevel account and get SaaSSuite, leads, coaching, support, and more completely for free.
              </p>
              <Button
                className="w-full"
                onClick={() => {
                  window.location.href = 'https://www.gohighlevel.com/?fp_ref=howtousehighlevel';
                }}
              >
                Create HighLevel Account
              </Button>
            </div>
          )}

          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
              disabled={currentQuestion === 0}
            >
              Back
            </Button>
            
            <Button
              onClick={handleNext}
              disabled={!canProceed || isSubmitting}
              className="min-w-[120px]"
            >
              {isSubmitting ? "Saving..." : isLastQuestion ? "Continue to App" : "Next"}
            </Button>
          </div>

          <Button variant="ghost" className="w-full mt-2" disabled={isSubmitting} onClick={() => {
            trackEvent("question_skipped", "Continue in Copilot", { step: currentQuestion + 1 });
            void handleSubmit();
          }}>Skip remaining questions · Continue in Copilot</Button>

          {isPhoneInput && (
            <div className="flex justify-center pt-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={isSubmitting}
                onClick={() => {
                  trackEvent("question_skipped", "Phone number", { step: currentQuestion + 1, question_id: 4 });
                  handleAnswerChange("");
                  if (isLastQuestion) {
                    handleSubmit();
                  } else {
                    setCurrentQuestion(currentQuestion + 1);
                  }
                }}
                className="text-muted-foreground"
              >
                Skip for now
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InitialQuestions;