import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUser } from "@/contexts/UserContext";
import { useSessionTracker } from "@/contexts/SessionTrackerContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CircleAlert, Globe, LogOut, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { ExistingAgencyDialog } from "@/components/ExistingAgencyDialog";
import { LEARNING_HUB_PATH } from "@/lib/onboardingArrival";
import { readNextPath, clearNextPath } from "@/utils/deepLink";
import { navigateWithParams } from "@/utils/preserveParams";
import { toAgencySlug } from "@/utils/agencySlug";
import { buildHubUrl } from "@/lib/hubUrl";
import { pageEnter, popIn } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useWizard } from "@/components/premium/21st/wizard-steps";
import { TextShimmer } from "@/components/premium/21st/text-shimmer";
import {
  OnboardingShell,
  StepHeading,
  StepRail,
  StepSlide,
} from "@/components/premium/onboarding/OnboardingShell";
import { OptionCard, SuccessMark } from "@/components/premium/onboarding/pieces";

const questions = [
  {
    id: 5,
    question: "What's your agency or software name?",
    subtitle: "This instantly generates your branded client portal URL.",
    placeholder: "e.g. Bright Marketing",
    options: ["textInput"],
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
      "I don't use HighLevel",
    ],
  },
  {
    id: 2,
    question: "How many active sub accounts/customers do you have?",
    options: ["0", "1-10", "10-50", "50-100", "100-500", "500+"],
  },
  {
    id: 3,
    question: "What do we call you?",
    placeholder: "Name",
    options: ["textInput"],
  },
  {
    id: 4,
    question: "What's the best number to text you on?",
    subtitle: "We use this to give you direct 1:1 text support whenever you need help.",
    options: ["phoneInput"],
  },
];

const COUNTRY_CODES = [
  { code: "+1", flag: "🇺🇸" },
  { code: "+44", flag: "🇬🇧" },
  { code: "+61", flag: "🇦🇺" },
  { code: "+91", flag: "🇮🇳" },
  { code: "+86", flag: "🇨🇳" },
  { code: "+81", flag: "🇯🇵" },
  { code: "+49", flag: "🇩🇪" },
  { code: "+33", flag: "🇫🇷" },
  { code: "+39", flag: "🇮🇹" },
  { code: "+34", flag: "🇪🇸" },
  { code: "+52", flag: "🇲🇽" },
  { code: "+55", flag: "🇧🇷" },
];

const InitialQuestions = () => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [countryCode, setCountryCode] = useState("+1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Presentation only: show the inline error after a blur or a blocked Continue.
  const [touched, setTouched] = useState(false);
  // Which answers came from the account, so we can say so instead of asking cold.
  const [prefilled, setPrefilled] = useState<Record<string, boolean>>({});
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
        .from("saas_suite_users")
        .select("full_name, agency_name")
        .ilike("email", email)
        .maybeSingle();
      if (data?.full_name || data?.agency_name) {
        setPrefilled({ "3": !!data.full_name, "5": !!data.agency_name });
        setAnswers((prev) => ({
          ...prev,
          ...(data.full_name ? { "3": data.full_name } : {}),
          ...(data.agency_name ? { "5": data.agency_name } : {}),
        }));
      }
    };
    loadName();
  }, [email]);

  const handleAnswerChange = (value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questions[currentQuestion].id]: value,
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
        .from("saas_suite_users")
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
        .ilike("email", email);

      if (responseError) throw responseError;

      // Save phone number to text_requests for 1:1 support
      const cleanNumber = (answers[4] || "").replace(/[^0-9]/g, "");
      const fullPhoneNumber = cleanNumber ? `${countryCode}${cleanNumber}` : null;
      if (fullPhoneNumber) {
        try {
          await supabase.from("text_requests").insert([
            {
              name: answers[3] || email || "Onboarding user",
              phone_number: fullPhoneNumber,
              source: "onboarding",
            },
          ]);
        } catch (e) {
          console.error("Failed to save phone:", e);
        }
      }

      // Call webhook to notify LeadConnector
      try {
        await fetch(
          "https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/c80002d8-3a02-4e62-8f41-19256fdc1414",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
          },
        );
      } catch (webhookError) {
        console.error("Webhook call failed:", webhookError);
      }

      trackEvent("initial_questions_completed", "Finished intro questions", {
        phone_provided: !!fullPhoneNumber,
      });

      toast.success("Welcome! Let's get you set up.");

      await continueToOnboarding();
    } catch (error) {
      console.error("Error saving onboarding responses:", error);
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
        const { error: completionError } = await supabase.rpc("mark_initial_questions_completed", {
          user_email: email.trim().toLowerCase(),
        });
        if (completionError) throw completionError;
      }
      const next = readNextPath();
      const destination = navigateWithParams(
        /^\/(app\/)?copilot/.test(next || "") ? next : LEARNING_HUB_PATH,
      );
      clearNextPath();
      window.location.href = destination;
      return;
    } catch (e) {
      console.error("Hub provisioning failed:", e);
      if (email) {
        const { error } = await supabase.rpc("mark_initial_questions_completed", {
          user_email: email.trim().toLowerCase(),
        });
        if (error) {
          toast.error("Couldn't finish saving your answers. Please try again.");
          return;
        }
      }
      const next = readNextPath();
      window.location.href = navigateWithParams(
        /^\/(app\/)?copilot/.test(next || "") ? next : LEARNING_HUB_PATH,
      );
    }
  };

  const currentQuestionData = questions[currentQuestion];
  const currentAnswer = answers[currentQuestionData.id];
  const progress = ((currentQuestion + 1) / questions.length) * 100;
  const isLastQuestion = currentQuestion === questions.length - 1;
  const isTextInput = currentQuestionData.options.includes("textInput");
  const isPhoneInput = currentQuestionData.options.includes("phoneInput");
  const noHighLevel = currentQuestionData.id === 1 && currentAnswer === "I don't use HighLevel";
  const phoneDigits = isPhoneInput ? (currentAnswer || "").replace(/[^0-9]/g, "") : "";
  const phoneValid = isPhoneInput ? /^[0-9]{7,15}$/.test(phoneDigits) : true;
  const canProceed =
    !noHighLevel && currentAnswer !== undefined && currentAnswer.trim() !== "" && phoneValid;

  const STEP_LABELS = ["Your brand", "HighLevel", "Customers", "Your name", "Your number"];
  const wizard = useWizard({
    total: questions.length,
    index: currentQuestion,
    onIndexChange: (i) => {
      setTouched(false);
      setCurrentQuestion(i);
    },
  });

  const errorText =
    !touched || canProceed || noHighLevel
      ? ""
      : isPhoneInput
        ? "Enter 7 to 15 digits, or skip this for now."
        : isTextInput
          ? currentQuestionData.id === 5
            ? "Enter your agency or software name to continue."
            : "Enter your name to continue."
          : "Pick one option to continue.";

  // Continue stays enabled; if something is missing we say what, next to the field.
  const attemptNext = () => {
    if (isSubmitting) return;
    if (!canProceed) {
      setTouched(true);
      return;
    }
    setTouched(false);
    handleNext();
  };

  const slug = toAgencySlug(answers[5] || "");
  const fieldId = `iq-field-${currentQuestionData.id}`;
  const inputCls = cn(
    "h-14 w-full rounded-md border border-input bg-card px-4 text-body-lg text-foreground shadow-card",
    "placeholder:text-muted-foreground transition-[border-color,box-shadow] duration-150",
    "focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
    "aria-[invalid=true]:border-destructive",
  );

  // Preview only: /initial-questions?preview=done shows the finish screen without saving anything.
  const previewDone = new URLSearchParams(window.location.search).get("preview") === "done";

  if (isSubmitting || previewDone) {
    return (
      <OnboardingShell>
        <ExistingAgencyDialog />
        <motion.div
          variants={pageEnter}
          initial="hidden"
          animate="show"
          className="flex flex-1 flex-col items-center justify-center pb-16 text-center"
          role="status"
        >
          <SuccessMark />
          <h1 className="mt-8 text-h2 text-foreground sm:text-h1">
            {answers[3]?.trim()
              ? `Nice to meet you, ${answers[3].trim().split(" ")[0]}`
              : "You're in"}
          </h1>
          <TextShimmer className="mt-3 text-body-lg">Building your client portal</TextShimmer>
        </motion.div>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      topRight={
        <Button
          variant="ghost"
          size="sm"
          onClick={clearUser}
          className="text-muted-foreground hover:text-foreground"
        >
          <LogOut />
          Log out
        </Button>
      }
      rail={
        <StepRail
          noun="Question"
          index={currentQuestion}
          labels={STEP_LABELS}
          onStepClick={(i) => wizard.goTo(i)}
        />
      }
      footer={
        <>
          {currentQuestion > 0 ? (
            <Button variant="ghost" onClick={() => wizard.back()}>
              <ArrowLeft />
              Back
            </Button>
          ) : null}
          <Button variant="accent" size="lg" onClick={attemptNext} className="ml-auto min-w-[9rem]">
            {isLastQuestion ? "Finish setup" : "Continue"}
            <ArrowRight />
          </Button>
        </>
      }
    >
      <ExistingAgencyDialog />
      <StepSlide stepKey={currentQuestionData.id} direction={wizard.direction}>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            attemptNext();
          }}
        >
          <StepHeading
            title={
              <label htmlFor={isTextInput || isPhoneInput ? fieldId : undefined}>
                {currentQuestionData.question}
              </label>
            }
            subtitle={(currentQuestionData as any).subtitle}
          />

          {isPhoneInput ? (
            <div className="flex gap-2">
              <Select value={countryCode} onValueChange={setCountryCode}>
                <SelectTrigger
                  className="h-14 w-[6.5rem] shrink-0 bg-card text-body shadow-card"
                  aria-label="Country code"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRY_CODES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.flag} {c.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input
                id={fieldId}
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="Phone number"
                value={currentAnswer || ""}
                onChange={(e) => handleAnswerChange(e.target.value)}
                onBlur={() => {
                  if ((currentAnswer || "").trim()) setTouched(true);
                }}
                aria-invalid={errorText ? true : undefined}
                aria-describedby={errorText ? `${fieldId}-error` : undefined}
                className={cn(inputCls, "min-w-0 flex-1")}
                maxLength={20}
                autoFocus
              />
            </div>
          ) : isTextInput ? (
            <div className="space-y-3">
              <input
                id={fieldId}
                type="text"
                autoComplete={currentQuestionData.id === 5 ? "organization" : "name"}
                placeholder={(currentQuestionData as any).placeholder || "Name"}
                value={currentAnswer || ""}
                onChange={(e) => handleAnswerChange(e.target.value)}
                onBlur={() => setTouched(true)}
                aria-invalid={errorText ? true : undefined}
                aria-describedby={errorText ? `${fieldId}-error` : undefined}
                className={inputCls}
                autoFocus
              />
              {prefilled[String(currentQuestionData.id)] && !errorText ? (
                <p className="flex items-center gap-1.5 text-small text-muted-foreground">
                  <Sparkles className="size-4 text-brand" aria-hidden="true" />
                  We filled this in from your account. Change it if it is wrong.
                </p>
              ) : null}
              <AnimatePresence initial={false}>
                {currentQuestionData.id === 5 && slug ? (
                  <motion.div
                    key="url"
                    variants={popIn}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    className="px-brand-wash flex items-center gap-3 rounded-lg p-4"
                  >
                    <span className="px-icon-chip shrink-0 bg-card" aria-hidden="true">
                      <Globe className="size-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="px-eyebrow block">Your client portal</span>
                      <span className="block truncate font-mono text-small text-foreground">
                        {buildHubUrl(slug).replace(/^https:\/\//, "")}
                      </span>
                    </span>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          ) : (
            <div
              role="radiogroup"
              aria-label={currentQuestionData.question}
              className="grid gap-3 sm:grid-cols-2"
            >
              {currentQuestionData.options.map((option) => (
                <OptionCard
                  key={option}
                  id={option}
                  title={option}
                  selected={currentAnswer === option}
                  onSelect={() => handleAnswerChange(option)}
                />
              ))}
            </div>
          )}

          <div aria-live="polite">
            {errorText ? (
              <p
                id={`${fieldId}-error`}
                className="mt-3 flex items-center gap-1.5 text-small font-medium text-destructive"
              >
                <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
                {errorText}
              </p>
            ) : null}
          </div>

          <AnimatePresence initial={false}>
            {noHighLevel && (
              <motion.div
                key="no-hl"
                variants={popIn}
                initial="hidden"
                animate="show"
                exit="exit"
                className="px-brand-wash mt-6 rounded-lg p-4 sm:p-6"
              >
                <p className="text-body font-semibold text-foreground">
                  No HighLevel yet? That is fine.
                </p>
                <p className="mt-1 text-small text-muted-foreground">
                  SaaSSuite runs inside HighLevel, so you need an account first. Create one and you
                  get SaaSSuite, leads, coaching and support free.
                </p>
                <Button
                  type="button"
                  className="mt-4 w-full sm:w-auto"
                  onClick={() => {
                    window.location.href = "https://www.gohighlevel.com/?fp_ref=howtousehighlevel";
                  }}
                >
                  Create HighLevel account
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Keeps Enter working on the option steps. */}
          <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
            Continue
          </button>
        </form>

        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-border pt-4">
          {isPhoneInput && (
            <Button
              variant="link"
              size="sm"
              className="px-0"
              onClick={() => {
                trackEvent("question_skipped", "Phone number", {
                  step: currentQuestion + 1,
                  question_id: 4,
                });
                handleAnswerChange("");
                if (isLastQuestion) {
                  handleSubmit();
                } else {
                  setCurrentQuestion(currentQuestion + 1);
                }
              }}
            >
              Skip for now
            </Button>
          )}
          <Button
            variant="link"
            size="sm"
            className="px-0 text-muted-foreground hover:text-foreground"
            onClick={() => {
              trackEvent("question_skipped", "Continue in Copilot", { step: currentQuestion + 1 });
              void handleSubmit();
            }}
          >
            Skip the questions and continue in Copilot
          </Button>
        </div>
      </StepSlide>
    </OnboardingShell>
  );
};

export default InitialQuestions;
