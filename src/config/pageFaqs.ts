import type { FaqItem } from "@/lib/seoJsonLd";

/**
 * FAQ copy mirrored 1:1 from what each page renders on screen.
 * If you edit the visible FAQ, edit it here too — schema must match the page.
 */
export const HOME_FAQS: FaqItem[] = [
  {
    question: "What is SaaSSuite?",
    answer:
      "SaaSSuite is a comprehensive tool designed to enhance and customize your HighLevel experience with white-label capabilities.",
  },
  {
    question: "Do I need HighLevel to use this?",
    answer:
      "Yes, SaaSSuite is designed to work with your existing HighLevel account to provide additional customization and features.",
  },
  {
    question: "Is there a setup fee?",
    answer:
      "No setup fees! You only pay the monthly or yearly subscription fee with instant access after payment.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Absolutely! You can cancel your subscription at any time without any penalties or hidden fees.",
  },
];

export const PRICING_FAQS: FaqItem[] = HOME_FAQS;

export const AI_SUPPORT_FAQS: FaqItem[] = [
  {
    question: "What is the AI Support tool?",
    answer:
      "It's a custom AI chat bot that lives inside your white-labeled SaaS. Train it on your own documentation and it answers client questions instantly, 24/7.",
  },
  {
    question: "Can I brand it to my agency?",
    answer:
      "Yes! The AI chat widget is fully white-labeled — your name, your colors, your personality. Clients will think it's your own in-house support.",
  },
  {
    question: "How do I train the AI?",
    answer:
      "Simply upload training documents (SOPs, guides, FAQs) and set personality instructions. The AI learns from your content and responds accordingly.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Absolutely! You can cancel your subscription at any time without any penalties or hidden fees.",
  },
];

export const BRANDING_TOOL_FAQS: FaqItem[] = [
  {
    question: "What is the Branding Tool?",
    answer:
      "The Branding Tool lets you generate Custom CSS for your HighLevel account so your sidebar, navigation, and UI match your brand colors perfectly.",
  },
  {
    question: "Does it support V2 HighLevel?",
    answer:
      "Yes! We support both the classic V1 interface and the new V2 HighLevel interface with dedicated branding tools for each.",
  },
  {
    question: "Do I need HighLevel to use this?",
    answer:
      "Yes, SaaSSuite is designed to work with your existing HighLevel account to provide additional customization and features.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Absolutely! You can cancel your subscription at any time without any penalties or hidden fees.",
  },
];

export const LOGIN_TRACKING_FAQS: FaqItem[] = [
  {
    question: "What does Login Tracking include?",
    answer:
      "You get a full SaaS Health Dashboard showing login activity, onboarding progress, video completion rates, and engagement metrics for every client.",
  },
  {
    question: "Can I see who's at risk of churning?",
    answer:
      "Yes! The dashboard highlights clients who haven't logged in recently or haven't completed onboarding, so you can proactively reach out before they cancel.",
  },
  {
    question: "Does it work with all HighLevel plans?",
    answer:
      "Yes, SaaSSuite works with any HighLevel account — whether you're on the Starter, Freelancer, or Agency plan.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Absolutely! You can cancel your subscription at any time without any penalties or hidden fees.",
  },
];

export const EMAIL_WARMUP_FAQS: FaqItem[] = [
  {
    question: "What is email warmup?",
    answer:
      "Email warmup gradually builds your sender reputation by sending and receiving real engagement on your email accounts. This tells inbox providers (Gmail, Outlook, etc.) that your emails are trustworthy.",
  },
  {
    question: "Is this a one-time service?",
    answer:
      "Yes! You pay $199 once and we handle the full warmup process for you. No recurring fees or hidden charges.",
  },
  {
    question: "What's included with the free month of SaaSSuite?",
    answer:
      "You get full access to SaaSSuite's Starter plan — including onboarding videos, custom checklists, support ticketing, and branding tools — completely free for your first month.",
  },
  {
    question: "Does this work with HighLevel's built-in email?",
    answer:
      "Yes, our service is specifically designed for HighLevel's email infrastructure including LC Email, Mailgun, and custom SMTP setups.",
  },
];
