import { useState, useEffect } from "react";
import StripeEmbeddedCheckout from "@/components/StripeEmbeddedCheckout";
import { processTrainingDocContent } from "@/utils/compileTrainingDocContent";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { BookOpen, Check, Copy, Upload, Palette, Plus, Settings, Eye, EyeOff, User, Mail, Building2, Info, ChevronDown } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import helpWidgetImage from "@/assets/helpwidget.png";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { LoadNotice } from "@/components/platform/LoadNotice";
import { LOAD_TIMEOUT_MESSAGE, armLoadDeadline, loadErrorText } from "@/lib/loadSettle";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useSessionTracker } from "@/contexts/SessionTrackerContext";
import CodeBlock from "./CodeBlock";
import { extractColorsFromImage, isValidHexColor, normalizeHexColor } from "@/utils/colorExtraction";
import { useHubUrls } from "@/lib/hubUrl";

interface OnboardingState {
  step: number;
  completed: boolean;
  agencyId: string | null;
  colors: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
  loginWith: 'EMAIL' | 'NAME';
  agencyName: string | null;
  useAgencyNameUrl: boolean;
}

interface AgencyVersions {
  basic_id: string | null;
  advanced_id: string | null;
  elite_id: string | null;
}

interface VideoModule {
  id: string;
  name: string;
}

interface VideoCategory {
  id: string;
  name: string;
  modules: VideoModule[];
}

interface VideoSettings {
  [agencyId: string]: {
    [categoryId: string]: {
      [moduleId: string]: boolean;
    };
  };
}

const OnboardingTool = () => {
  const { email } = useUser();
  const { trackEvent } = useSessionTracker();
  const [onboarding, setOnboarding] = useState<OnboardingState>({
    step: 0,
    completed: false,
    agencyId: null,
    colors: {
      primary: "#3b82f6",
      secondary: "#10b981", 
      tertiary: "#f59e0b"
    },
    loginWith: 'EMAIL',
    agencyName: null,
    useAgencyNameUrl: false
  });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  // Uses the app's own checkout so access is granted automatically.
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showCustomizeUrl, setShowCustomizeUrl] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState("");
  const [colorInputs, setColorInputs] = useState({
    primary: "",
    secondary: "",
    tertiary: ""
  });
  const [tempColors, setTempColors] = useState({
    primary: "",
    secondary: "",
    tertiary: ""
  });
  const [agencyVersions, setAgencyVersions] = useState<AgencyVersions>({
    basic_id: null,
    advanced_id: null,
    elite_id: null
  });
  const [activeTab, setActiveTab] = useState("basic");
  const hubUrlFor = useHubUrls([agencyVersions.basic_id, onboarding.agencyId, onboarding.agencyName]);
  const [videoSettings, setVideoSettings] = useState<VideoSettings>({});
  const [selectedVersion, setSelectedVersion] = useState<'basic' | 'advanced' | 'elite' | 'custom'>('basic');
  const [customVideos, setCustomVideos] = useState<any[]>([]);
  const [userPlan, setUserPlan] = useState<'BASIC' | 'ADVANCED'>('ADVANCED');
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [menuLinkId, setMenuLinkId] = useState("");
  const [removeLaunchpad, setRemoveLaunchpad] = useState(true);
  const [showCustomVideoDialog, setShowCustomVideoDialog] = useState(false);
  const [customVideoForm, setCustomVideoForm] = useState({
    moduleType: 'existing' as 'existing' | 'custom',
    customModuleTitle: '',
    existingModuleId: '',
    lessonOrder: 1,
    title: '',
    description: '',
    videoUrl: ''
  });
const [agencyNameInput, setAgencyNameInput] = useState("");
  const [isCheckingName, setIsCheckingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
const [menuLinkTitle, setMenuLinkTitle] = useState("Onboarding");
  const [showWidgetCode, setShowWidgetCode] = useState(false);
  const [showChatWidgetText, setShowChatWidgetText] = useState(true);
  const [showSupportTicketText, setShowSupportTicketText] = useState(true);
  
  // New state for step 3 multi-step code installation
  const [codeSubStep, setCodeSubStep] = useState(1); // 1 = features, 2 = JS, 3 = CSS
  const [installHelpWidget, setInstallHelpWidget] = useState(true);
  const [autoNavigateOnLogin, setAutoNavigateOnLogin] = useState(true);

  // Video data structure
  const videoCategories: VideoCategory[] = [
    {
      id: "foundational-setup",
      name: "Foundational Setup (8 videos)",
      modules: [
        { id: "new-contact", name: "Create a New Contact" },
        { id: "import-contacts", name: "Import and engage with all your contacts instantly" },
        { id: "generate-leads", name: "Generate New Leads with a High-Converting Funnel" },
        { id: "multi-channel", name: "Set Up Multi-Channel Communication & Start Engaging in Minutes" },
        { id: "first-campaign", name: "Launch Your First Campaign to Drive Engagement" },
        { id: "drip-campaigns", name: "Nurture Leads with Automated Drip Campaigns" },
        { id: "scheduling", name: "Book More Appointments with Automated Scheduling" },
        { id: "sales-pipeline", name: "Accelerate Deal Closures with a Streamlined Sales Pipeline" }
      ]
    },
    {
      id: "marketing-lead-generation",
      name: "Marketing & Lead Generation (3 videos)",
      modules: [
        { id: "social-media-planner", name: "Manage All Your Social Media Posts in One Place" },
        { id: "facebook-lead-ads", name: "Capture New Leads with Facebook & Instagram Lead Ads" },
        { id: "sms-campaign", name: "Reach Customers with Your First SMS Campaign" }
      ]
    },
    {
      id: "sales-conversation", 
      name: "Sales & Conversation (4 videos)",
      modules: [
        { id: "email-sync", name: "Seamlessly Manage Your Sales Conversations" },
        { id: "live-chat", name: "Engage Website Visitors in Real Time with Live Chat" },
        { id: "social-messaging", name: "Streamline Facebook & Instagram Conversations for Faster Response" },
        { id: "a2p-registration", name: "A2P Registration: How to Verify Your Phone Number" }
      ]
    },
    {
      id: "website-content",
      name: "Website & Content (3 videos)", 
      modules: [
        { id: "professional-website", name: "Launch a Professional Website in Less Than a Day" },
        { id: "wordpress-migration", name: "Migrate Your WordPress Site Seamlessly" },
        { id: "documents-contracts", name: "Create and Manage Documents & Contracts" }
      ]
    },
    {
      id: "commerce",
      name: "Commerce (5 videos)",
      modules: [
        { id: "first-product", name: "Launch Your First Product and Start Selling" },
        { id: "online-course", name: "Launch Your First Online Course and Start Earning" },
        { id: "stripe-payments", name: "Start Collecting Payments with Stripe" },
        { id: "payment-link", name: "Accept Payments Easily with a Custom Payment Link" },
        { id: "invoices", name: "Generate and Send Professional Invoices" }
      ]
    },
    {
      id: "ai-tools",
      name: "AI & Automation Tools (4 videos)",
      modules: [
        { id: "voice-ai-agent", name: "How to Create Your First Voice AI Agent" },
        { id: "conversation-ai-appointments", name: "Book Appointments through Conversation AI" },
        { id: "ai-studio-vibe-coding", name: "AI Studio: Vibe Coding" },
        { id: "automations-101-workflows", name: "Automations 101: Workflows" }
      ]
    }
  ];

  const generateCssCode = () => {
    const launchpadCode = removeLaunchpad ? `#sb_launchpad {\n  display: none !important;\n}\n\n` : '';
    const reorderCode = `/*ONBOARDING TOOL REORDER*/\n#sidebar-v2 .hl_nav-header > nav {\n  display: flex;\n  flex-direction: column;\n  align-items: stretch;\n}\n\n/* CUSTOM MENU ID INPUT BELOW */\n#sidebar-v2 .hl_nav-header > nav > a[meta="${menuLinkId || 'INPUT-MENU-LINK-ID'}"] {\n  order: -1;\n}`;
    
    return launchpadCode + reorderCode;
  };

  // Helper to convert hex to rgba
  const hexToRgba = (hex: string, alpha: number): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      return `rgba(${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)},${alpha})`;
    }
    return `rgba(245,197,66,${alpha})`;
  };

  const generateHelpWidgetCode = () => {
    const primaryColor = tempColors.primary || onboarding.colors.primary || "#f5c542";
    const menuTitle = menuLinkTitle || "Onboarding";
    
    // Build the list items based on toggles
    const chatWidgetListItem = showChatWidgetText ? `
        <li>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
          <span>Get 24/7 chat support to help you with specific features</span>
        </li>` : '';
    
    const supportTicketListItem = showSupportTicketText ? `
        <li>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 5v2M15 11v2M15 17v2M5 5a2 2 0 0 0-2 2v3c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5zM5 12a2 2 0 0 0-2 2v3c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H5z"/></svg>
          <span>Submit and manage support tickets</span>
        </li>` : '';
    
    return `<!-- Help Widget -->
<script>
(function() {
  // Styles
  var css = \`
    .help-widget { position: fixed; z-index: 9999; font-family: system-ui, -apple-system, sans-serif; transition: all 0.3s ease-in-out; }
    .help-widget.bottom-right { bottom: 0; right: 0; }
    .help-widget.bottom-left { bottom: 0; left: 0; }
    .help-widget.bottom-center { bottom: 0; left: 50%; transform: translateX(-50%); }
    .help-widget.top-right { top: 0; right: 0; }
    .help-widget.top-left { top: 0; left: 0; }
    .help-widget.top-center { top: 0; left: 50%; transform: translateX(-50%); }
    .help-widget-bar { background: #141414; color: white; display: flex; flex-direction: column; align-items: center; overflow: hidden; position: relative; z-index: 10001; box-shadow: 0 4px 16px -2px rgba(0,0,0,0.3); }
    .help-widget.bottom-right .help-widget-bar { border-top-left-radius: 12px; }
    .help-widget.bottom-left .help-widget-bar { border-top-right-radius: 12px; }
    .help-widget.bottom-center .help-widget-bar { border-top-left-radius: 12px; border-top-right-radius: 12px; }
    .help-widget.top-right .help-widget-bar { border-bottom-left-radius: 12px; }
    .help-widget.top-left .help-widget-bar { border-bottom-right-radius: 12px; }
    .help-widget.top-center .help-widget-bar { border-bottom-left-radius: 12px; border-bottom-right-radius: 12px; }
    .help-widget-main { display: flex; align-items: center; }
    .help-widget-btn { background: transparent; color: white; border: none; cursor: pointer; display: flex; align-items: center; gap: 8px; padding: 8px 16px; transition: background 0.2s; }
    .help-widget-btn:hover { background: rgba(255,255,255,0.1); }
    .help-widget-btn .icon { font-size: 20px; font-weight: bold; }
    .help-widget-btn .text { font-size: 12px; font-weight: 500; }
    .help-widget-arrow { background: transparent; border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; opacity: 0; overflow: hidden; }
    .help-widget-arrow:hover { background: rgba(255,255,255,0.15); }
    .help-widget-arrow.horizontal { padding: 8px 0; width: 0; }
    .help-widget-arrow.vertical { padding: 0 16px; height: 0; }
    .help-widget-bar:hover .help-widget-arrow.visible.horizontal { opacity: 1; width: 24px; padding: 8px 6px; }
    .help-widget-bar:hover .help-widget-arrow.visible.vertical { opacity: 1; height: 20px; padding: 2px 16px; }
    .help-widget-arrow svg { width: 12px; height: 12px; }
    .help-widget-popup { position: absolute; background: #141414; color: white; border-radius: 12px; padding: 24px; min-width: 430px; box-shadow: 0 8px 32px -4px rgba(0,0,0,0.25); animation: fadeIn 0.2s ease-out; z-index: 10001; display: none; }
    .help-widget.bottom-right .help-widget-popup, .help-widget.bottom-left .help-widget-popup, .help-widget.bottom-center .help-widget-popup { bottom: 100%; margin-bottom: 24px; }
    .help-widget.top-right .help-widget-popup, .help-widget.top-left .help-widget-popup, .help-widget.top-center .help-widget-popup { top: 100%; margin-top: 24px; }
    .help-widget.bottom-right .help-widget-popup, .help-widget.top-right .help-widget-popup { right: 16px; }
    .help-widget.bottom-left .help-widget-popup, .help-widget.top-left .help-widget-popup { left: 16px; }
    .help-widget.bottom-center .help-widget-popup, .help-widget.top-center .help-widget-popup { left: 50%; transform: translateX(-50%); }
    .help-widget-popup::after { content: ''; position: absolute; width: 24px; height: 24px; background: #141414; transform: rotate(45deg); }
    .help-widget.bottom-right .help-widget-popup::after, .help-widget.bottom-left .help-widget-popup::after, .help-widget.bottom-center .help-widget-popup::after { bottom: -12px; }
    .help-widget.top-right .help-widget-popup::after, .help-widget.top-left .help-widget-popup::after, .help-widget.top-center .help-widget-popup::after { top: -12px; }
    .help-widget.bottom-right .help-widget-popup::after, .help-widget.top-right .help-widget-popup::after { right: 24px; }
    .help-widget.bottom-left .help-widget-popup::after, .help-widget.top-left .help-widget-popup::after { left: 24px; }
    .help-widget.bottom-center .help-widget-popup::after, .help-widget.top-center .help-widget-popup::after { left: 50%; margin-left: -12px; }
    .help-widget-close { position: absolute; top: -8px; right: -8px; width: 32px; height: 32px; background: #333; border-radius: 50%; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: white; }
    .help-widget-close:hover { background: #444; }
    .help-widget-close svg { width: 20px; height: 20px; }
    .help-widget-header { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
    .help-widget-subheader { font-size: 18px; line-height: 1.5; opacity: 0.75; margin-bottom: 20px; }
    .help-widget-accent { font-weight: 600; color: ${primaryColor}; }
    .help-widget-list { list-style: none; padding: 0; margin: 0; }
    .help-widget-list li { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; }
    .help-widget-list li:last-child { margin-bottom: 0; }
    .help-widget-list svg { width: 28px; height: 28px; color: ${primaryColor}; flex-shrink: 0; margin-top: 2px; }
    .help-widget-list span { font-size: 18px; line-height: 1.5; opacity: 0.9; }
    .help-widget-overlay { position: fixed; inset: 0; z-index: 9997; display: none; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  \`;
  
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // Widget HTML
  var widget = document.createElement('div');
  widget.className = 'help-widget bottom-right';
  widget.innerHTML = \`
    <div class="help-widget-overlay"></div>
    <div class="help-widget-popup">
      <button class="help-widget-close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
      <div class="help-widget-header">Need Help?</div>
      <p class="help-widget-subheader">Navigate to <span class="help-widget-accent">"${menuTitle}"</span> at the top of your main navigation to get help.</p>
      <ul class="help-widget-list">
        <li>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
          <span>Watch videos to learn how to use our software</span>
        </li>${chatWidgetListItem}${supportTicketListItem}
      </ul>
    </div>
    <div class="help-widget-bar">
      <button class="help-widget-arrow vertical up">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
      </button>
      <div class="help-widget-main">
        <button class="help-widget-arrow horizontal left">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <button class="help-widget-btn">
          <span class="icon">?</span>
          <span class="text">Help</span>
        </button>
        <button class="help-widget-arrow horizontal right">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
      <button class="help-widget-arrow vertical down">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
    </div>
  \`;
  document.body.appendChild(widget);

  var popup = widget.querySelector('.help-widget-popup');
  var overlay = widget.querySelector('.help-widget-overlay');
  var close = widget.querySelector('.help-widget-close');
  var btn = widget.querySelector('.help-widget-btn');
  var arrows = {
    up: widget.querySelector('.help-widget-arrow.up'),
    down: widget.querySelector('.help-widget-arrow.down'),
    left: widget.querySelector('.help-widget-arrow.left'),
    right: widget.querySelector('.help-widget-arrow.right')
  };

  var position = { vertical: 'bottom', horizontal: 'right' };

  function updatePosition() {
    widget.className = 'help-widget ' + position.vertical + '-' + position.horizontal;
    arrows.up.classList.toggle('visible', position.vertical !== 'top');
    arrows.down.classList.toggle('visible', position.vertical !== 'bottom');
    arrows.left.classList.toggle('visible', position.horizontal !== 'left');
    arrows.right.classList.toggle('visible', position.horizontal !== 'right');
  }

  function openPopup() { popup.style.display = 'block'; overlay.style.display = 'block'; }
  function closePopup() { popup.style.display = 'none'; overlay.style.display = 'none'; }

  btn.addEventListener('click', function(e) { e.stopPropagation(); openPopup(); });
  close.addEventListener('click', closePopup);
  overlay.addEventListener('click', closePopup);
  popup.addEventListener('click', function(e) { e.stopPropagation(); });

  arrows.up.addEventListener('click', function(e) { e.stopPropagation(); position.vertical = 'top'; updatePosition(); });
  arrows.down.addEventListener('click', function(e) { e.stopPropagation(); position.vertical = 'bottom'; updatePosition(); });
  arrows.left.addEventListener('click', function(e) {
    e.stopPropagation();
    if (position.horizontal === 'right') position.horizontal = 'center';
    else if (position.horizontal === 'center') position.horizontal = 'left';
    updatePosition();
  });
  arrows.right.addEventListener('click', function(e) {
    e.stopPropagation();
    if (position.horizontal === 'left') position.horizontal = 'center';
    else if (position.horizontal === 'center') position.horizontal = 'right';
    updatePosition();
  });

  updatePosition();
})();
</script>`;
  };

  // Generate auto-navigate JS code
  const generateAutoNavigateCode = () => {
    const menuId = menuLinkId || 'INPUT-MENU-LINK-ID';
    
    return `<script>
(function() {
  const desiredPath = 'custom-menu-link/${menuId}'; // your custom menu link ID
  const REDIRECT_KEY = 'ghl_initial_redirect_done';

  function maybeRedirect() {
    // Skip if we've already redirected during this session
    if (sessionStorage.getItem(REDIRECT_KEY) === 'true') return;

    const url = new URL(window.location.href);
    const match = url.pathname.match(/\\/location\\/([^/]+)\\/(dashboard|launchpad)/i);
    if (match && !url.pathname.includes(desiredPath)) {
      const locationId = match[1];
      const newUrl = \`\${url.origin}/v2/location/\${locationId}/\${desiredPath}\`;
      sessionStorage.setItem(REDIRECT_KEY, 'true');
      window.location.replace(newUrl);
    }
  }

  document.addEventListener('DOMContentLoaded', maybeRedirect);
  const observer = new MutationObserver(maybeRedirect);
  observer.observe(document.body, { childList: true, subtree: true });
  setInterval(maybeRedirect, 2000);
})();
</script>`;
  };

  // Generate combined JS code based on toggles
  const generateCombinedJsCode = () => {
    const parts: string[] = [];
    
    if (autoNavigateOnLogin) {
      parts.push(generateAutoNavigateCode());
    }
    
    if (installHelpWidget) {
      parts.push(generateHelpWidgetCode());
    }
    
    if (parts.length === 0) {
      return '// No JavaScript features enabled';
    }
    
    return parts.join('\n\n');
  };

  // Load user's onboarding state and agency versions
  useEffect(() => {
    let alive = true;
    const stop = armLoadDeadline(() => {
      if (!alive) return;
      setIsLoading(false);
      setLoadError(LOAD_TIMEOUT_MESSAGE);
    });
    const loadOnboardingState = async () => {
      if (!email) {
        stop();
        setIsLoading(false);
        setLoadError(null);
        return;
      }

      try {
        // Load user data
        const { data, error } = await supabase.rpc('get_user_by_email', {
          user_email: email
        });

        if (error) throw error;

        if (data && data.length > 0) {
          const userData = data[0];
          
          // Load user's plan and agency name from saas_suite_users table
          const { data: fullUserData } = await supabase
            .from('saas_suite_users')
            .select('plan, agency_name, use_agency_name_url')
            .ilike('email', email)
            .maybeSingle() as any;
          
          if (fullUserData?.plan) {
            setUserPlan(fullUserData.plan as 'BASIC' | 'ADVANCED');
          }
          
          // Use saved colors from database or empty strings if not set
          const savedColors = {
            primary: userData.primary_color || "",
            secondary: userData.secondary_color || "",
            tertiary: userData.tertiary_color || ""
          };

          // Use default colors for onboarding state (for fallbacks)
          const defaultColors = {
            primary: userData.primary_color || onboarding.colors.primary,
            secondary: userData.secondary_color || onboarding.colors.secondary,
            tertiary: userData.tertiary_color || onboarding.colors.tertiary
          };

          setOnboarding({
            step: userData.onboarding_step || 0,
            completed: userData.onboarding_completed || false,
            agencyId: userData.agency_id,
            colors: defaultColors,
            loginWith: ((userData as any).login_with as 'EMAIL' | 'NAME') || 'EMAIL',
            agencyName: fullUserData?.agency_name || null,
            useAgencyNameUrl: fullUserData?.use_agency_name_url || false
          });

          // Initialize agency name input if set
          if (fullUserData?.agency_name) {
            setAgencyNameInput(fullUserData.agency_name);
          }

          // Initialize both color inputs and temp colors with saved values
          setColorInputs(savedColors);
          setTempColors(savedColors);
        }

        // Load agency versions
        const { data: versionsData, error: versionsError } = await supabase.rpc('get_user_agency_versions', {
          user_email: email
        });

        if (versionsError) {
          console.error('Error loading agency versions:', versionsError);
        } else if (versionsData && versionsData.length > 0) {
          const versions = {
            basic_id: versionsData[0].basic_id,
            advanced_id: versionsData[0].advanced_id,
            elite_id: versionsData[0].elite_id
          };
          setAgencyVersions(versions);
          
          // Load video settings for existing agency versions
          await loadVideoSettings(versions);
        }
        if (alive) setLoadError(null);
      } catch (error) {
        console.error('Error loading onboarding state:', error);
        if (alive) setLoadError(loadErrorText(error, "Couldn't load onboarding."));
      } finally {
        stop();
        if (alive) setIsLoading(false);
      }
    };
    loadOnboardingState();
    return () => {
      alive = false;
      stop();
    };
  }, [email, loadAttempt]);

  // Load custom videos when Custom Videos tab is selected
  useEffect(() => {
    const fetchCustomVideos = async () => {
      if (!agencyVersions.basic_id) return;
      
      try {
        const { data, error } = await supabase
          .from('custom_onboarding_videos')
          .select('*')
          .eq('agency_id', agencyVersions.basic_id)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        setCustomVideos(data || []);
      } catch (error) {
        console.error('Error fetching custom videos:', error);
      }
    };

    if (selectedVersion === 'custom') {
      fetchCustomVideos();
    }
  }, [selectedVersion, agencyVersions.basic_id]);

  // Load video settings for all agency versions
  const loadVideoSettings = async (versions: AgencyVersions) => {
    const settings: VideoSettings = {};
    
    // Initialize settings with defaults for all agency versions
    for (const [versionType, agencyId] of Object.entries(versions)) {
      if (agencyId) {
        settings[agencyId] = {};
        
        // Initialize all videos as visible by default
        videoCategories.forEach(category => {
          settings[agencyId][category.id] = {};
          category.modules.forEach(module => {
            settings[agencyId][category.id][module.id] = true;
          });
        });

        // Load actual settings from database and override defaults
        try {
          const tierName = versionType.replace('_id', ''); // basic_id -> basic
          const { data: dbSettings, error } = await supabase.rpc('get_agency_video_settings', {
            lookup_agency_id: agencyId,
            lookup_tier: tierName
          });

          if (error) {
            console.error(`Error loading video settings for ${agencyId}:`, error);
          } else if (dbSettings && Array.isArray(dbSettings) && dbSettings.length > 0) {
            // Apply database settings (only for videos that are explicitly set to invisible)
            dbSettings.forEach((setting: { category_id: string; module_id: string; is_visible: boolean }) => {
              if (settings[agencyId][setting.category_id] && 
                  settings[agencyId][setting.category_id][setting.module_id] !== undefined) {
                settings[agencyId][setting.category_id][setting.module_id] = setting.is_visible;
              }
            });
          }
        } catch (error) {
          console.error(`Error loading video settings for agency ${agencyId}:`, error);
        }
      }
    }
    
    setVideoSettings(settings);
  };

  const updateOnboardingStep = async (step: number, completed: boolean = false) => {
    if (!email) return;

    setIsSaving(true);
    try {
      // Use register_user_safe to ensure user exists, then update directly 
      await supabase.rpc('register_user_safe', { user_email: email });
      
      // Update the onboarding step in database
      const { error } = await supabase
        .from('saas_suite_users')
        .update({ 
          onboarding_step: step,
          onboarding_completed: completed
        })
        .ilike('email', email);

      if (error) {
        console.error('Error updating onboarding step:', error);
        toast.error("Failed to save progress");
        return;
      }

      setOnboarding(prev => ({ ...prev, step, completed }));
      
      if (completed) {
        toast.success("Onboarding completed! 🎉");
      } else {
        toast.success("Progress saved!");
      }
    } catch (error) {
      console.error('Error updating onboarding:', error);
      toast.error("Failed to save progress");
    } finally {
      setIsSaving(false);
    }
  };

  const saveColors = async (colors: { primary: string; secondary: string; tertiary: string }) => {
    if (!email) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('saas_suite_users')
        .update({
          primary_color: colors.primary,
          secondary_color: colors.secondary,
          tertiary_color: colors.tertiary
        })
        .ilike('email', email);

      if (error) {
        console.error('Error saving colors:', error);
        toast.error("Failed to save brand colors");
        return;
      }

      setOnboarding(prev => ({ ...prev, colors }));
      toast.success("Brand colors saved!");
    } catch (error) {
      console.error('Error saving colors:', error);
      toast.error("Failed to save brand colors");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle temporary color changes (no database save)
  const handleColorInputChange = (colorType: 'primary' | 'secondary' | 'tertiary', value: string) => {
    setTempColors(prev => ({ ...prev, [colorType]: value }));
  };

  // Handle color picker changes (no database save)
  const handleColorPickerChange = (colorType: 'primary' | 'secondary' | 'tertiary', value: string) => {
    setTempColors(prev => ({ ...prev, [colorType]: value }));
  };

  const handleImageUpload = async (file: File) => {
    setIsSaving(true);
    try {
      const extractedColors = await extractColorsFromImage(file);
      
      const newColors = {
        primary: extractedColors[0] || "",
        secondary: extractedColors[1] || "",
        tertiary: extractedColors[2] || ""
      };

      // Update temp colors only, don't save to database
      setTempColors(newColors);
      toast.success("Colors extracted from image!");
    } catch (error) {
      console.error('Error extracting colors:', error);
      toast.error("Failed to extract colors from image");
    } finally {
      setIsSaving(false);
    }
  };

  // Complete setup with color saving
  const completeSetupWithColors = async () => {
    if (!email) return;

    setIsSaving(true);
    try {
      // Ensure user exists first
      await supabase.rpc('register_user_safe', { user_email: email });
      
      // Save colors and complete onboarding
      const { error } = await supabase
        .from('saas_suite_users')
        .update({
          primary_color: tempColors.primary || null,
          secondary_color: tempColors.secondary || null,
          tertiary_color: tempColors.tertiary || null,
          onboarding_step: 0,
          onboarding_completed: true
        })
        .ilike('email', email);

      if (error) {
        console.error('Error completing setup:', error);
        toast.error("Failed to complete setup");
        return;
      }

      setOnboarding(prev => ({ 
        ...prev, 
        step: 0, 
        completed: true,
        colors: {
          primary: tempColors.primary || prev.colors.primary,
          secondary: tempColors.secondary || prev.colors.secondary,
          tertiary: tempColors.tertiary || prev.colors.tertiary
        }
      }));
      
      toast.success("Onboarding completed! 🎉");
    } catch (error) {
      console.error('Error completing setup:', error);
      toast.error("Failed to complete setup");
    } finally {
      setIsSaving(false);
    }
  };

  // Skip color setup
  const skipColorSetup = async () => {
    await updateOnboardingStep(0, true);
  };

  // Check if agency name is available
  const checkAgencyNameAvailable = async (name: string): Promise<boolean> => {
    if (!name || name.length < 2) return false;
    
    try {
      const { data, error } = await supabase.rpc('check_agency_name_available', {
        name_to_check: name
      });
      
      if (error) {
        console.error('Error checking agency name:', error);
        return false;
      }
      
      return data === true;
    } catch (error) {
      console.error('Error checking agency name:', error);
      return false;
    }
  };

  // Save agency name and update URLs
  const saveAgencyName = async (name: string) => {
    if (!email || !name) return;
    
    setIsSaving(true);
    setNameError(null);
    
    try {
      // First check if name is available
      const isAvailable = await checkAgencyNameAvailable(name);
      
      if (!isAvailable) {
        setNameError("This agency name is already taken. Please choose a different one.");
        setIsSaving(false);
        return;
      }
      
      // Save the agency name and update URLs
      const { data, error } = await supabase.rpc('save_agency_name_and_update_urls', {
        user_email: email,
        new_agency_name: name
      });
      
      if (error) {
        console.error('Error saving agency name:', error);
        toast.error("Failed to save agency name");
        setIsSaving(false);
        return;
      }
      
      // Update local state
      setOnboarding(prev => ({ 
        ...prev, 
        agencyName: name,
        agencyId: name,
        useAgencyNameUrl: true 
      }));
      setAgencyVersions(prev => ({
        ...prev,
        basic_id: name,
        advanced_id: prev.advanced_id ? name + '-2' : null,
        elite_id: prev.elite_id ? name + '-3' : null
      }));
      
      toast.success("Agency name saved successfully!");
      trackEvent("agency_name_saved", "Agency name set", { name });
      
      // Proceed to step 1
      await updateOnboardingStep(1);
    } catch (error) {
      console.error('Error saving agency name:', error);
      toast.error("Failed to save agency name");
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle between agency name URLs and original URLs
  const toggleAgencyNameUrl = async (useNameUrl: boolean) => {
    if (!email) return;
    
    setIsSaving(true);
    try {
      const { data, error } = await supabase.rpc('toggle_agency_name_url', {
        user_email: email,
        use_name_url: useNameUrl
      });
      
      if (error) {
        console.error('Error toggling agency name URL:', error);
        toast.error("Failed to update URL preference");
        setIsSaving(false);
        return;
      }
      
      // Reload the agency versions to get the updated IDs
      const { data: versionsData } = await supabase.rpc('get_user_agency_versions', {
        user_email: email
      });
      
      if (versionsData && versionsData.length > 0) {
        setAgencyVersions({
          basic_id: versionsData[0].basic_id,
          advanced_id: versionsData[0].advanced_id,
          elite_id: versionsData[0].elite_id
        });
      }
      
      // Also reload the agency ID for onboarding state
      const { data: userData } = await supabase.rpc('get_user_by_email', {
        user_email: email
      });
      
      if (userData && userData.length > 0) {
        setOnboarding(prev => ({
          ...prev,
          agencyId: userData[0].agency_id,
          useAgencyNameUrl: useNameUrl
        }));
      }
      
      toast.success(useNameUrl ? "Switched to agency name URLs" : "Switched to original URLs");
    } catch (error) {
      console.error('Error toggling agency name URL:', error);
      toast.error("Failed to update URL preference");
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const restartOnboarding = () => {
    // Reset to step 1 to allow users to go through the installation guide again
    updateOnboardingStep(1, false);
  };

  const createAgencyVersion = async (versionType: 'basic' | 'advanced' | 'elite') => {
    if (!email) return;

    setIsSaving(true);
    try {
      const { data: newAgencyId, error } = await supabase.rpc('create_agency_version_safe', {
        user_email: email,
        version_type: versionType
      });

      if (error) {
        console.error('Error creating agency version:', error);
        toast.error(`Failed to create ${versionType} version`);
        return;
      }

      // Update local state
      const updatedVersions = {
        ...agencyVersions,
        [`${versionType}_id`]: newAgencyId
      };
      setAgencyVersions(updatedVersions);
      
      // Initialize video settings for the new agency
      await initializeVideoSettingsForAgency(newAgencyId, versionType);
      
      // Reload video settings
      await loadVideoSettings(updatedVersions);

      toast.success(`${versionType.charAt(0).toUpperCase() + versionType.slice(1)} version created!`);
    } catch (error) {
      console.error('Error creating agency version:', error);
      toast.error(`Failed to create ${versionType} version`);
    } finally {
      setIsSaving(false);
    }
  };

  // Initialize video settings for a new agency (no need to populate, defaults work)
  const initializeVideoSettingsForAgency = async (agencyId: string, versionType: string) => {
    // The frontend will handle defaults by showing all videos as visible
    // when no database entries exist for the agency
    console.log(`Initialized video settings for agency ${agencyId} (${versionType})`);
  };

  // Toggle video visibility for a specific agency version
  const toggleVideoVisibility = async (categoryId: string, moduleId: string, isVisible: boolean) => {
    const currentAgencyId = agencyVersions[`${selectedVersion}_id` as keyof AgencyVersions];
    if (!currentAgencyId || !email) return;

    try {
      // Update local state immediately for responsive UI
      setVideoSettings(prev => ({
        ...prev,
        [currentAgencyId]: {
          ...prev[currentAgencyId],
          [categoryId]: {
            ...prev[currentAgencyId]?.[categoryId],
            [moduleId]: isVisible
          }
        }
      }));

      // Update database using the new functions
      if (isVisible) {
        // When setting to visible, delete the row since default is visible
        const { error } = await supabase.rpc('delete_agency_video_setting', {
          agency_id_param: currentAgencyId,
          tier_param: selectedVersion,
          category_id_param: categoryId,
          module_id_param: moduleId
        });

        if (error) {
          console.error('Error deleting video setting:', error);
          // Revert local state on error
          setVideoSettings(prev => ({
            ...prev,
            [currentAgencyId]: {
              ...prev[currentAgencyId],
              [categoryId]: {
                ...prev[currentAgencyId]?.[categoryId],
                [moduleId]: !isVisible
              }
            }
          }));
          toast.error("Failed to update video visibility");
          return;
        }
      } else {
        // When setting to invisible, save the setting
        const { error } = await supabase.rpc('save_agency_video_setting', {
          agency_id_param: currentAgencyId,
          tier_param: selectedVersion,
          category_id_param: categoryId,
          module_id_param: moduleId,
          is_visible_param: false
        });

        if (error) {
          console.error('Error saving video setting:', error);
          // Revert local state on error
          setVideoSettings(prev => ({
            ...prev,
            [currentAgencyId]: {
              ...prev[currentAgencyId],
              [categoryId]: {
                ...prev[currentAgencyId]?.[categoryId],
                [moduleId]: !isVisible
              }
            }
          }));
          toast.error("Failed to update video visibility");
          return;
        }
      }

      toast.success(`Video ${isVisible ? 'enabled' : 'disabled'} for ${selectedVersion} version`);
      
      // Re-process training doc RAG chunks since video visibility changed
      processTrainingDocContent(currentAgencyId, selectedVersion);
    } catch (error) {
      console.error('Error updating video visibility:', error);
      toast.error("Failed to update video visibility");
    }
  };

  // Get video visibility status for current agency version
  const getVideoVisibility = (categoryId: string, moduleId: string): boolean => {
    const currentAgencyId = agencyVersions[`${selectedVersion}_id` as keyof AgencyVersions];
    if (!currentAgencyId) return true;
    
    return videoSettings[currentAgencyId]?.[categoryId]?.[moduleId] ?? true;
  };

  // Update login preference
  const updateLoginPreference = async (loginWith: 'EMAIL' | 'NAME') => {
    if (!email) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('saas_suite_users')
        .update({ login_with: loginWith })
        .ilike('email', email);

      if (error) {
        console.error('Error updating login preference:', error);
        toast.error("Failed to save login preference");
        return;
      }

      setOnboarding(prev => ({ ...prev, loginWith }));
      toast.success(`Login preference updated to collect ${loginWith.toLowerCase()}`);
    } catch (error) {
      console.error('Error updating login preference:', error);
      toast.error("Failed to save login preference");
    } finally {
      setIsSaving(false);
    }
  };

  // Save custom video
  const saveCustomVideo = async () => {
    try {
      setIsSaving(true);

      // Validate required fields
      if (!customVideoForm.title || !customVideoForm.description || !customVideoForm.videoUrl) {
        toast.error("Please fill in all required fields");
        return;
      }

      if (customVideoForm.moduleType === 'custom' && !customVideoForm.customModuleTitle) {
        toast.error("Please provide a custom module title");
        return;
      }

      if (customVideoForm.moduleType === 'existing' && !customVideoForm.existingModuleId) {
        toast.error("Please select an existing module");
        return;
      }

      const agencyId = agencyVersions[`${selectedVersion}_id` as keyof AgencyVersions];
      if (!agencyId) {
        toast.error("Please create a URL for this version first");
        return;
      }

      const { error } = await supabase
        .from('custom_onboarding_videos')
        .insert({
          agency_id: agencyId,
          module_type: customVideoForm.moduleType,
          custom_module_title: customVideoForm.moduleType === 'custom' ? customVideoForm.customModuleTitle : null,
          existing_module_id: customVideoForm.moduleType === 'existing' ? customVideoForm.existingModuleId : null,
          lesson_order: customVideoForm.lessonOrder,
          title: customVideoForm.title,
          description: customVideoForm.description,
          video_url: customVideoForm.videoUrl
        });

      if (error) throw error;

      toast.success("Custom video added successfully!");
      setShowCustomVideoDialog(false);
      
      // Reset form
      setCustomVideoForm({
        moduleType: 'existing',
        customModuleTitle: '',
        existingModuleId: '',
        lessonOrder: 1,
        title: '',
        description: '',
        videoUrl: ''
      });
    } catch (error) {
      console.error('Error saving custom video:', error);
      toast.error("Failed to save custom video");
    } finally {
      setIsSaving(false);
    }
  };

  // Update video tiers
  const updateVideoTiers = async (videoId: string, tiers: string[]) => {
    try {
      const { error } = await supabase
        .from('custom_onboarding_videos')
        .update({ tiers })
        .eq('id', videoId);
      
      if (error) throw error;
      
      // Update local state
      setCustomVideos(prev => prev.map(v => 
        v.id === videoId ? { ...v, tiers } : v
      ));
      
      toast.success('Video tiers updated');
    } catch (error) {
      console.error('Error updating video tiers:', error);
      toast.error('Failed to update video tiers');
    }
  };

  // Delete custom video
  const deleteCustomVideo = async (videoId: string) => {
    try {
      const { error } = await supabase
        .from('custom_onboarding_videos')
        .delete()
        .eq('id', videoId);
      
      if (error) throw error;
      
      setCustomVideos(prev => prev.filter(v => v.id !== videoId));
      toast.success('Custom video deleted');
    } catch (error) {
      console.error('Error deleting video:', error);
      toast.error('Failed to delete video');
    }
  };

  if (loadError || isLoading) {
    return (
      <LoadNotice
        loading={isLoading}
        error={loadError}
        label="Loading onboarding…"
        onRetry={() => setLoadAttempt((attempt) => attempt + 1)}
      />
    );
  }

  // Get the current agency ID for Client Hub URL
  const getCurrentAgencyId = () => {
    if (onboarding.useAgencyNameUrl && onboarding.agencyName) {
      return onboarding.agencyName;
    }
    return agencyVersions.basic_id || onboarding.agencyId || '';
  };

  const openClientHub = () => {
    const agencyId = getCurrentAgencyId();
    window.open(hubUrlFor(agencyId), '_blank');
  };

  // Completed onboarding view
  if (onboarding.completed) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Client Hub URL Section */}
        <Card className="border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50">
          <CardContent className="py-4 space-y-2">
            <div className="space-y-1">
              <h3 className="font-semibold text-purple-900">✨ Client Hub</h3>
              <p className="text-sm text-purple-700">An upgraded experience with more features than the standard onboarding tool</p>
            </div>
            <div className="flex items-center gap-2">
              <Input 
                value={hubUrlFor(getCurrentAgencyId())}
                readOnly
                className="bg-white"
              />
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => copyToClipboard(hubUrlFor(getCurrentAgencyId()))}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
        <Tabs value={activeTab} onValueChange={(value) => {
          if (value === 'advanced' && userPlan === 'BASIC') {
            setShowUpgradePrompt(true);
          } else {
            setActiveTab(value);
          }
        }} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="basic">Basic Mode</TabsTrigger>
            <TabsTrigger 
              value="advanced" 
              className={userPlan === 'BASIC' ? 'opacity-50 cursor-not-allowed' : ''}
            >
              Advanced Mode
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="basic" className="space-y-6">
            <Card className="border-2 border-green-200 bg-green-50">
              <CardHeader>
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-12 h-12 bg-green-500 text-white rounded-full flex items-center justify-center flex-shrink-0">
                    <Check className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <CardTitle className="text-xl text-green-800">🎉 Installation Complete!</CardTitle>
                    <CardDescription className="text-green-700">
                      Your white-labeled onboarding is now set up and ready to use
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Agency Name Setup Section */}
                {!onboarding.agencyName && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-blue-600" />
                      <Label className="text-sm font-medium text-blue-800">Set Your Agency Name for Custom URLs</Label>
                    </div>
                    <p className="text-xs text-blue-700">
                      Enter your agency name to get a memorable URL like yoursoftwareonboarding.com/<strong>youragency</strong>
                    </p>
                    <div className="flex items-center gap-2">
                      <Input 
                        value={agencyNameInput}
                        onChange={(e) => setAgencyNameInput(e.target.value.toLowerCase().replace(/\s/g, ''))}
                        placeholder="youragency"
                        className="flex-1 bg-white"
                      />
                      <Button 
                        size="sm"
                        disabled={!agencyNameInput || isSaving}
                        onClick={async () => {
                          if (!agencyNameInput) return;
                          const isAvailable = await checkAgencyNameAvailable(agencyNameInput);
                          if (!isAvailable) {
                            toast.error("This agency name is already taken. Please choose another.");
                            return;
                          }
                          await saveAgencyName(agencyNameInput);
                          setAgencyNameInput("");
                        }}
                      >
                        {isSaving ? "Saving..." : "Save"}
                      </Button>
                    </div>
                    <p className="text-xs text-blue-600">One word, lowercase letters and numbers only</p>
                  </div>
                )}

                <div className="bg-white rounded-lg p-4 border">
                  <Label className="text-sm font-medium text-gray-700">Your Custom Onboarding Link:</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <Input 
                      value={`https://yoursoftwareonboarding.com/${onboarding.useAgencyNameUrl && onboarding.agencyName ? onboarding.agencyName : (agencyVersions.basic_id || onboarding.agencyId)}`}
                      readOnly
                      className="bg-gray-50"
                    />
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => copyToClipboard(`https://yoursoftwareonboarding.com/${onboarding.useAgencyNameUrl && onboarding.agencyName ? onboarding.agencyName : (agencyVersions.basic_id || onboarding.agencyId)}`)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {/* Agency Name URL Toggle */}
                  {onboarding.agencyName && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <div className="space-y-1">
                        <Label className="text-sm font-medium">Use Agency Name URL</Label>
                        <p className="text-xs text-muted-foreground">
                          {onboarding.useAgencyNameUrl 
                            ? `Using: ${onboarding.agencyName}` 
                            : "Switch to use your agency name in the URL"}
                        </p>
                      </div>
                      <Switch
                        checked={onboarding.useAgencyNameUrl}
                        onCheckedChange={toggleAgencyNameUrl}
                        disabled={isSaving}
                      />
                    </div>
                  )}
                </div>

                <Separator />

                <div className="bg-white rounded-lg p-6 border space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                      3
                    </div>
                    <h3 className="text-lg font-semibold">Onboarding Tool Branding Customization</h3>
                  </div>
                  
                  <Tabs defaultValue="manual" className="w-full">
                    <TabsList className="grid w-full grid-cols-1 md:grid-cols-2 h-auto">
                      <TabsTrigger value="manual" className="mb-1 md:mb-0">Manual Colors</TabsTrigger>
                      <TabsTrigger value="extract">Extract from Image</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="manual" className="space-y-4 mt-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="primary">Primary Color</Label>
                          <div className="flex gap-2 mt-1">
                            <Input
                              id="primary"
                              value={tempColors.primary}
                              onChange={(e) => handleColorInputChange('primary', e.target.value)}
                              placeholder="#3b82f6"
                            />
                            <input
                              type="color"
                              value={tempColors.primary || "#3b82f6"}
                              onChange={(e) => handleColorPickerChange('primary', e.target.value)}
                              className="w-10 h-10 rounded border-2 border-gray-300 cursor-pointer"
                              title="Click to pick color"
                            />
                          </div>
                        </div>
                        
                        <div>
                          <Label htmlFor="secondary">Secondary Color</Label>
                          <div className="flex gap-2 mt-1">
                            <Input
                              id="secondary"
                              value={tempColors.secondary}
                              onChange={(e) => handleColorInputChange('secondary', e.target.value)}
                              placeholder="#10b981"
                            />
                            <input
                              type="color"
                              value={tempColors.secondary || "#10b981"}
                              onChange={(e) => handleColorPickerChange('secondary', e.target.value)}
                              className="w-10 h-10 rounded border-2 border-gray-300 cursor-pointer"
                              title="Click to pick color"
                            />
                          </div>
                        </div>
                        
                        <div>
                          <Label htmlFor="tertiary">Tertiary Color</Label>
                          <div className="flex gap-2 mt-1">
                            <Input
                              id="tertiary"
                              value={tempColors.tertiary}
                              onChange={(e) => handleColorInputChange('tertiary', e.target.value)}
                              placeholder="#f59e0b"
                            />
                            <input
                              type="color"
                              value={tempColors.tertiary || "#f59e0b"}
                              onChange={(e) => handleColorPickerChange('tertiary', e.target.value)}
                              className="w-10 h-10 rounded border-2 border-gray-300 cursor-pointer"
                              title="Click to pick color"
                            />
                          </div>
                        </div>
                      </div>
                      
                      <Button variant="accent" 
                        onClick={async () => {
                          if (tempColors.primary && tempColors.secondary && tempColors.tertiary) {
                            await saveColors(tempColors);
                          } else {
                            toast.error("Please fill in all color fields");
                          }
                        }}
                        disabled={isSaving}
                        className="w-full"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Save Brand Colors
                      </Button>
                    </TabsContent>
                    
                    <TabsContent value="extract" className="space-y-4 mt-4">
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                        <Palette className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 mb-4">
                          Upload your logo or website screenshot to automatically extract brand colors
                        </p>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload(file);
                          }}
                          className="hidden"
                          id="image-upload-basic"
                        />
                        <Button 
                          variant="outline" 
                          onClick={() => document.getElementById('image-upload-basic')?.click()}
                          disabled={isSaving}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Image
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>

                <div className="flex gap-4 justify-center pt-4">
                  <Button onClick={restartOnboarding} variant="outline">
                    <BookOpen className="w-4 h-4 mr-2" />
                    Installation Guide
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Advanced Mode - Multiple Onboarding Versions
                </CardTitle>
                <CardDescription>
                  Create up to 3 custom onboarding experiences for different client tiers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Login Collection Settings */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Login Collection Type:</Label>
                  <Select 
                    value={onboarding.loginWith} 
                    onValueChange={(value: 'EMAIL' | 'NAME') => updateLoginPreference(value)}
                    disabled={isSaving}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select login collection type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EMAIL">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          <span>Collect Email on Login</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="NAME">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          <span>Collect Name on Login</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Agency Name Setup Section */}
                {!onboarding.agencyName && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-blue-600" />
                      <Label className="text-sm font-medium text-blue-800">Set Your Agency Name for Custom URLs</Label>
                    </div>
                    <p className="text-xs text-blue-700">
                      Enter your agency name to get memorable URLs like yoursoftwareonboarding.com/<strong>youragency</strong>, <strong>youragency-2</strong>, <strong>youragency-3</strong>
                    </p>
                    <div className="flex items-center gap-2">
                      <Input 
                        value={agencyNameInput}
                        onChange={(e) => setAgencyNameInput(e.target.value.toLowerCase().replace(/\s/g, ''))}
                        placeholder="youragency"
                        className="flex-1 bg-white"
                      />
                      <Button 
                        size="sm"
                        disabled={!agencyNameInput || isSaving}
                        onClick={async () => {
                          if (!agencyNameInput) return;
                          const isAvailable = await checkAgencyNameAvailable(agencyNameInput);
                          if (!isAvailable) {
                            toast.error("This agency name is already taken. Please choose another.");
                            return;
                          }
                          await saveAgencyName(agencyNameInput);
                          setAgencyNameInput("");
                        }}
                      >
                        {isSaving ? "Saving..." : "Save"}
                      </Button>
                    </div>
                    <p className="text-xs text-blue-600">One word, lowercase letters and numbers only</p>
                  </div>
                )}

                {/* Agency Name URL Toggle */}
                {onboarding.agencyName && (
                  <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Use Agency Name URL</Label>
                      <p className="text-xs text-muted-foreground">
                        {onboarding.useAgencyNameUrl 
                          ? `Using: ${onboarding.agencyName} (Advanced: ${onboarding.agencyName}-2, Elite: ${onboarding.agencyName}-3)` 
                          : "Switch to use your agency name in all URLs"}
                      </p>
                    </div>
                    <Switch
                      checked={onboarding.useAgencyNameUrl}
                      onCheckedChange={toggleAgencyNameUrl}
                      disabled={isSaving}
                    />
                  </div>
                )}

                {/* Basic Version */}
                <div className="space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg gap-4">
                    <div className="flex-1">
                      <h4 className="font-medium">Basic Version</h4>
                      <p className="text-sm text-muted-foreground">Standard onboarding experience</p>
                    </div>
                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 w-full md:w-auto">
                      {agencyVersions.basic_id ? (
                        <div className="flex items-center gap-2 bg-muted p-3 rounded-lg border flex-1 md:min-w-[300px]">
                          <span className="text-sm truncate font-mono flex-1">
                            https://yoursoftwareonboarding.com/{onboarding.useAgencyNameUrl && onboarding.agencyName ? onboarding.agencyName : agencyVersions.basic_id}
                          </span>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => copyToClipboard(`https://yoursoftwareonboarding.com/${onboarding.useAgencyNameUrl && onboarding.agencyName ? onboarding.agencyName : agencyVersions.basic_id}`)}
                            className="flex-shrink-0 h-8 w-8 p-0"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button 
                          onClick={() => createAgencyVersion('basic')}
                          disabled={isSaving}
                          size="sm"
                          className="w-full md:w-auto"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create Basic URL
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {/* Advanced Version */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg gap-4">
                    <div className="flex-1">
                      <h4 className="font-medium">Advanced Version</h4>
                      <p className="text-sm text-muted-foreground">Enhanced onboarding with additional features</p>
                    </div>
                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 w-full md:w-auto">
                      {agencyVersions.advanced_id ? (
                        <>
                          <div className="flex items-center gap-2 bg-muted p-3 rounded-lg border flex-1 md:min-w-[300px]">
                            <span className="text-sm truncate font-mono flex-1">
                              https://yoursoftwareonboarding.com/{onboarding.useAgencyNameUrl && onboarding.agencyName ? `${onboarding.agencyName}-2` : agencyVersions.advanced_id}
                            </span>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => copyToClipboard(`https://yoursoftwareonboarding.com/${onboarding.useAgencyNameUrl && onboarding.agencyName ? `${onboarding.agencyName}-2` : agencyVersions.advanced_id}`)}
                              className="flex-shrink-0 h-8 w-8 p-0"
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        </>
                      ) : (
                        <Button 
                          onClick={() => createAgencyVersion('advanced')}
                          disabled={isSaving}
                          size="sm"
                          className="w-full md:w-auto"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create Advanced URL
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Elite Version */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg gap-4">
                    <div className="flex-1">
                      <h4 className="font-medium">Elite Version</h4>
                      <p className="text-sm text-muted-foreground">Premium onboarding with all features</p>
                    </div>
                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 w-full md:w-auto">
                      {agencyVersions.elite_id ? (
                        <>
                          <div className="flex items-center gap-2 bg-muted p-3 rounded-lg border flex-1 md:min-w-[300px]">
                            <span className="text-sm truncate font-mono flex-1">
                              https://yoursoftwareonboarding.com/{onboarding.useAgencyNameUrl && onboarding.agencyName ? `${onboarding.agencyName}-3` : agencyVersions.elite_id}
                            </span>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => copyToClipboard(`https://yoursoftwareonboarding.com/${onboarding.useAgencyNameUrl && onboarding.agencyName ? `${onboarding.agencyName}-3` : agencyVersions.elite_id}`)}
                              className="flex-shrink-0 h-8 w-8 p-0"
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        </>
                      ) : (
                        <Button 
                          onClick={() => createAgencyVersion('elite')}
                          disabled={isSaving}
                          size="sm"
                          className="w-full md:w-auto"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create Elite URL
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Video Selection */}
                <div className="mt-8">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Settings className="w-5 h-5" />
                        Video Selection
                      </CardTitle>
                      <CardDescription>
                        Customize which videos are visible for each version of your onboarding tool
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Version Selector */}
                      <div>
                        <Label className="text-sm font-medium mb-3 block">Select Version to Customize:</Label>
                        <Tabs value={selectedVersion} onValueChange={(value) => setSelectedVersion(value as 'basic' | 'advanced' | 'elite' | 'custom')} className="w-full">
                          <TabsList className="grid w-full grid-cols-1 md:grid-cols-4 gap-2 h-auto p-1">
                            <TabsTrigger value="basic" disabled={!agencyVersions.basic_id} className="w-full py-2 text-xs md:text-sm">
                              Basic {!agencyVersions.basic_id && "(Create URL first)"}
                            </TabsTrigger>
                            <TabsTrigger value="advanced" disabled={!agencyVersions.advanced_id} className="w-full py-2 text-xs md:text-sm">
                              Advanced {!agencyVersions.advanced_id && "(Create URL first)"}
                            </TabsTrigger>
                            <TabsTrigger value="elite" disabled={!agencyVersions.elite_id} className="w-full py-2 text-xs md:text-sm">
                              Elite {!agencyVersions.elite_id && "(Create URL first)"}
                            </TabsTrigger>
                            <TabsTrigger value="custom" className="w-full py-2 text-xs md:text-sm">
                              Custom Videos
                            </TabsTrigger>
                          </TabsList>
                        </Tabs>
                      </div>

                      {/* Video Categories and Modules OR Custom Videos */}
                      {selectedVersion === 'custom' ? (
                        <div className="space-y-4">
                          <div className="flex justify-end mb-4">
                            <Button 
                              onClick={() => setShowCustomVideoDialog(true)}
                              variant="outline"
                              size="sm"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Upload Custom Video
                            </Button>
                          </div>

                          {customVideos.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                              <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
                              <p className="text-lg mb-2">No custom videos yet</p>
                              <p className="text-sm">Upload your first video to get started</p>
                            </div>
                          ) : (
                            customVideos.map((video) => (
                              <div key={video.id} className="border rounded-lg p-4 space-y-3">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <h4 className="font-semibold">{video.title}</h4>
                                    <p className="text-sm text-muted-foreground mt-1">{video.description}</p>
                                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                      <span className="px-2 py-1 bg-muted rounded">
                                        {video.module_type === 'custom' 
                                          ? `Custom: ${video.custom_module_title}` 
                                          : `Module: ${video.existing_module_id}`}
                                      </span>
                                      <span className="px-2 py-1 bg-muted rounded">
                                        Order: {video.lesson_order}
                                      </span>
                                    </div>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteCustomVideo(video.id)}
                                  >
                                    Delete
                                  </Button>
                                </div>
                                
                                <div className="flex items-center gap-4 pt-2 border-t">
                                  <span className="text-sm font-medium">Available in:</span>
                                  <div className="flex gap-4">
                                    {['basic', 'advanced', 'elite'].map((tier) => (
                                      <label key={tier} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={video.tiers?.includes(tier) ?? true}
                                          onChange={(e) => {
                                            const currentTiers = video.tiers || ['basic', 'advanced', 'elite'];
                                            const newTiers = e.target.checked
                                              ? [...currentTiers, tier]
                                              : currentTiers.filter((t: string) => t !== tier);
                                            updateVideoTiers(video.id, newTiers);
                                          }}
                                          className="rounded"
                                        />
                                        <span className="text-sm capitalize">{tier}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      ) : agencyVersions[`${selectedVersion}_id` as keyof AgencyVersions] ? (
                        <div className="space-y-6">
                          <div className="flex justify-end mb-4">
                            <Button 
                              onClick={() => setShowCustomVideoDialog(true)}
                              variant="outline"
                              size="sm"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Upload Custom Video
                            </Button>
                          </div>
                          
                          <Accordion type="multiple" className="space-y-3">
                            {videoCategories.map((category) => (
                              <AccordionItem key={category.id} value={category.id} className="border rounded-lg px-3 md:px-4">
                                <AccordionTrigger className="hover:no-underline py-3 md:py-4">
                                  <span className="font-semibold text-base md:text-lg text-left">
                                    {category.name}
                                  </span>
                                </AccordionTrigger>
                                <AccordionContent className="pb-3 md:pb-4">
                                  <div className="grid gap-3">
                                    {category.modules.map((module) => {
                                      const isVisible = getVideoVisibility(category.id, module.id);
                                      return (
                                        <div key={module.id} className="flex flex-col md:flex-row md:items-center justify-between p-3 bg-muted/50 rounded-lg gap-3">
                                          <div className="flex items-center gap-3 flex-1 min-w-0">
                                            {isVisible ? (
                                              <Eye className="w-4 h-4 text-green-600 flex-shrink-0" />
                                            ) : (
                                              <EyeOff className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                            )}
                                            <span className={`text-sm ${isVisible ? 'text-foreground' : 'text-muted-foreground'} break-words`}>
                                              {module.name}
                                            </span>
                                          </div>
                                          <div className="flex justify-center md:justify-end">
                                            <Switch
                                              checked={isVisible}
                                              onCheckedChange={(checked) => toggleVideoVisibility(category.id, module.id, checked)}
                                            />
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            ))}
                          </Accordion>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Settings className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>Create a {selectedVersion} URL first to customize video selection</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>


                <div className="flex gap-4 justify-center">
                  <Button onClick={restartOnboarding} variant="outline">
                    <BookOpen className="w-4 h-4 mr-2" />
                    Installation Guide
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        
        {/* Upgrade Prompt Dialog */}
        <Dialog open={showUpgradePrompt} onOpenChange={setShowUpgradePrompt}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-center">Upgrade Today</DialogTitle>
              <DialogDescription className="text-center">
                Advanced Mode is available on our premium plan. Upgrade now to unlock multiple onboarding versions and advanced customization features.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 pt-4">
              <Button 
                onClick={() => { setShowUpgradePrompt(false); setCheckoutOpen(true); }}
                className="w-full"
              >
                Upgrade Now
              </Button>
              <Button 
                onClick={() => setShowUpgradePrompt(false)}
                variant="outline"
                className="w-full"
              >
                Maybe Later
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <StripeEmbeddedCheckout plan="advanced" open={checkoutOpen} onOpenChange={setCheckoutOpen} />



        {/* Custom Video Upload Dialog */}
        <Dialog open={showCustomVideoDialog} onOpenChange={setShowCustomVideoDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Upload Custom Video</DialogTitle>
              <DialogDescription>
                Add a custom video to your {selectedVersion} onboarding experience
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              {/* Module Type Selection */}
              <div className="space-y-2">
                <Label>Module Type</Label>
                <Select 
                  value={customVideoForm.moduleType} 
                  onValueChange={(value: 'existing' | 'custom') => setCustomVideoForm(prev => ({ 
                    ...prev, 
                    moduleType: value,
                    customModuleTitle: value === 'existing' ? '' : prev.customModuleTitle,
                    existingModuleId: value === 'custom' ? '' : prev.existingModuleId
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="existing">Add to Existing Module</SelectItem>
                    <SelectItem value="custom">Create Custom Module</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Custom Module Title (if custom) */}
              {customVideoForm.moduleType === 'custom' && (
                <div className="space-y-2">
                  <Label>Custom Module Title *</Label>
                  <Input
                    placeholder="e.g., Getting Started"
                    value={customVideoForm.customModuleTitle}
                    onChange={(e) => setCustomVideoForm(prev => ({ ...prev, customModuleTitle: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">This module will appear above "Foundational Setup"</p>
                </div>
              )}

              {/* Existing Module Selection (if existing) */}
              {customVideoForm.moduleType === 'existing' && (
                <div className="space-y-2">
                  <Label>Select Existing Module *</Label>
                  <Select 
                    value={customVideoForm.existingModuleId} 
                    onValueChange={(value) => setCustomVideoForm(prev => ({ ...prev, existingModuleId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a module" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="foundational-setup">Foundational Setup</SelectItem>
                      <SelectItem value="marketing-lead-generation">Marketing & Lead Generation</SelectItem>
                      <SelectItem value="sales-conversation">Sales & Conversation</SelectItem>
                      <SelectItem value="website-content">Website & Content</SelectItem>
                      <SelectItem value="commerce">Commerce</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Lesson Order */}
              <div className="space-y-2">
                <Label>Lesson Order *</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="1"
                  value={customVideoForm.lessonOrder}
                  onChange={(e) => setCustomVideoForm(prev => ({ ...prev, lessonOrder: parseInt(e.target.value) || 1 }))}
                />
                <p className="text-xs text-muted-foreground">1 = top of the list, higher numbers appear lower</p>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label>Video Title *</Label>
                <Input
                  placeholder="e.g., Welcome to Our Platform"
                  value={customVideoForm.title}
                  onChange={(e) => setCustomVideoForm(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label>Description *</Label>
                <Input
                  placeholder="Brief description of what this video covers"
                  value={customVideoForm.description}
                  onChange={(e) => setCustomVideoForm(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              {/* Video URL */}
              <div className="space-y-2">
                <Label>Video Link *</Label>
                <Input
                  placeholder="https://youtube.com/..."
                  value={customVideoForm.videoUrl}
                  onChange={(e) => setCustomVideoForm(prev => ({ ...prev, videoUrl: e.target.value }))}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button 
                  onClick={saveCustomVideo}
                  disabled={isSaving}
                  className="flex-1"
                >
                  {isSaving ? "Saving..." : "Save Video"}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setShowCustomVideoDialog(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Initial welcome screen
  if (onboarding.step === 0) {
    // If agency name is not set, show agency name input first
    if (!onboarding.agencyName) {
      return (
        <div className="space-y-6 animate-fade-in">
          <Card className="border-2 border-primary/20">
            <CardHeader className="text-center">
              <div className="flex items-center justify-center mb-4">
                <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
              </div>
              <CardTitle className="text-2xl">Welcome to Your Onboarding Setup!</CardTitle>
              <CardDescription>
                Let's get your white-labeled HighLevel platform configured in just a few steps
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <Label className="text-sm font-medium text-blue-900">What's your agency's name?</Label>
                <p className="text-xs text-blue-700 mb-3">
                  Enter your agency name as one word, all lowercase. This will be the custom endpoint of your onboarding URLs.
                </p>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">yoursoftwareonboarding.com/</span>
                    <Input 
                      value={agencyNameInput}
                      onChange={(e) => {
                        const value = e.target.value.toLowerCase().replace(/\s/g, '').replace(/[^a-z0-9-]/g, '');
                        setAgencyNameInput(value);
                        setNameError(null);
                      }}
                      placeholder="youragency"
                      className="bg-white border-blue-200"
                    />
                  </div>
                  {nameError && (
                    <p className="text-sm text-destructive">{nameError}</p>
                  )}
                </div>
                <p className="text-xs text-blue-700 mt-2">
                  Example: if your agency is "Digital Marketing Pro", enter "digitalmarketingpro"
                </p>
              </div>

              <div className="text-center">
                <Button 
                  size="lg" 
                  onClick={() => saveAgencyName(agencyNameInput)}
                  disabled={isSaving || !agencyNameInput || agencyNameInput.length < 2}
                  className="bg-gradient-primary hover:opacity-90 w-full md:w-auto px-3 md:px-8 text-sm md:text-base whitespace-normal text-center"
                >
                  {isSaving ? "Checking..." : "Continue"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // If agency name is set, show normal welcome screen
    return (
      <div className="space-y-6 animate-fade-in">
        <Card className="border-2 border-primary/20">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl">Welcome to Your Onboarding Setup!</CardTitle>
            <CardDescription>
              Let's get your white-labeled HighLevel platform configured in just a few steps
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <Label className="text-sm font-medium text-blue-900">Your Custom Onboarding Link:</Label>
              <div className="flex items-center gap-2 mt-2">
                <Input 
                  value={`https://yoursoftwareonboarding.com/${onboarding.agencyId || '[AGENCY_ID]'}`}
                  readOnly
                  className="bg-white border-blue-200"
                />
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => copyToClipboard(`https://yoursoftwareonboarding.com/${onboarding.agencyId}`)}
                  disabled={!onboarding.agencyId}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-blue-700 mt-2">
                This will be your clients' entry point to onboarding - no more generic URLs!
              </p>
            </div>

            <div className="text-center">
              <Button 
                size="lg" 
                onClick={() => updateOnboardingStep(1)}
                disabled={isSaving}
                className="bg-gradient-primary hover:opacity-90 w-full md:w-auto px-3 md:px-8 text-sm md:text-base whitespace-normal text-center"
              >
                Install into your GHL Now
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 1: Create Custom Menu Link
  if (onboarding.step === 1) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4 mb-6">
          <Progress value={33} className="flex-1" />
          <span className="text-sm font-medium">Step 1 of 3</span>
        </div>

        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                1
              </div>
              Create Custom Menu Link
            </CardTitle>
            <CardDescription>
              Set up your custom onboarding menu link in HighLevel
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3">Create Your Custom Menu Link</h3>
              <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground">
                <li>Go to Agency view → Settings → Custom Menu Link</li>
                <li>Create a custom menu link pointing to:
                  <div className="mt-2 flex items-center gap-2 bg-muted p-3 rounded border">
                    <span className="text-xs truncate flex-1 font-mono">https://yoursoftwareonboarding.com/{onboarding.agencyId || '[AGENCY_ID]'}</span>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => copyToClipboard(`https://yoursoftwareonboarding.com/${onboarding.agencyId || '[AGENCY_ID]'}`)}
                      className="flex-shrink-0"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </li>
                <li>Title the Menu Link "Onboarding"</li>
                <li>Click Save, then refresh the page</li>
              </ol>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800 font-medium">
                💡 Important: After creating the menu link, make sure to save it and refresh your browser before proceeding to the next step.
              </p>
            </div>

            <Separator />

            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold mb-3 block">How to Find Your Menu Link ID</Label>
                <div className="border rounded-lg overflow-hidden bg-muted/50">
                  <img 
                    src="https://storage.googleapis.com/msgsndr/T69cI1milcirIORef4Ib/media/691378439bbd7d32b603fdc5.gif" 
                    alt="How to find menu link ID"
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="menu-link-id" className="text-base font-medium">Input Menu Link ID</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Enter the ID from your custom menu link (found in the meta field)
                </p>
                <Input
                  id="menu-link-id"
                  value={menuLinkId}
                  onChange={(e) => setMenuLinkId(e.target.value)}
                  placeholder="e.g., custom-menu-12345"
                  className="font-mono"
                />
              </div>
            </div>

            <div className="flex justify-center">
              <Button 
                onClick={() => {
                  if (!menuLinkId.trim()) {
                    toast.error("Please enter your Menu Link ID");
                    return;
                  }
                  updateOnboardingStep(2);
                }}
                disabled={isSaving}
                size="lg"
              >
                <Check className="w-4 h-4 mr-2" />
                Continue to Brand Colors
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 2: Brand Colors (formerly step 3)
  if (onboarding.step === 2) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4 mb-6">
          <Progress value={50} className="flex-1" />
          <span className="text-sm font-medium">Step 2 of 3</span>
        </div>

        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                2
              </div>
              Configure Brand Colors
            </CardTitle>
            <CardDescription>
              Set your brand colors for a personalized experience
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs defaultValue="manual" className="w-full">
              <TabsList className="grid w-full grid-cols-1 md:grid-cols-2 h-auto">
                <TabsTrigger value="manual" className="mb-1 md:mb-0">Manual Colors</TabsTrigger>
                <TabsTrigger value="extract">Extract from Image</TabsTrigger>
              </TabsList>
              
              <TabsContent value="manual" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="primary">Primary Color</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="primary"
                        value={tempColors.primary}
                        onChange={(e) => handleColorInputChange('primary', e.target.value)}
                        placeholder="#3b82f6"
                      />
                      <input
                        type="color"
                        value={tempColors.primary || "#3b82f6"}
                        onChange={(e) => handleColorPickerChange('primary', e.target.value)}
                        className="w-10 h-10 rounded border-2 border-gray-300 cursor-pointer"
                        title="Click to pick color"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="secondary">Secondary Color</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="secondary"
                        value={tempColors.secondary}
                        onChange={(e) => handleColorInputChange('secondary', e.target.value)}
                        placeholder="#10b981"
                      />
                      <input
                        type="color"
                        value={tempColors.secondary || "#10b981"}
                        onChange={(e) => handleColorPickerChange('secondary', e.target.value)}
                        className="w-10 h-10 rounded border-2 border-gray-300 cursor-pointer"
                        title="Click to pick color"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="tertiary">Tertiary Color</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="tertiary"
                        value={tempColors.tertiary}
                        onChange={(e) => handleColorInputChange('tertiary', e.target.value)}
                        placeholder="#f59e0b"
                      />
                      <input
                        type="color"
                        value={tempColors.tertiary || "#f59e0b"}
                        onChange={(e) => handleColorPickerChange('tertiary', e.target.value)}
                        className="w-10 h-10 rounded border-2 border-gray-300 cursor-pointer"
                        title="Click to pick color"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="extract" className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <Palette className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">
                    Upload your logo or website screenshot to automatically extract brand colors
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file);
                    }}
                    className="hidden"
                    id="image-upload"
                  />
                  <Button 
                    variant="outline" 
                    onClick={() => document.getElementById('image-upload')?.click()}
                    disabled={isSaving}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Image
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex flex-col md:flex-row gap-4 justify-center">
              <Button 
                onClick={() => {
                  setCodeSubStep(1);
                  updateOnboardingStep(3);
                }}
                disabled={isSaving}
                size="lg"
              >
                <Check className="w-4 h-4 mr-2" />
                Continue to Custom Code
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 3: Add Custom Code (multi-step)
  if (onboarding.step === 3) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4 mb-6">
          <Progress value={100} className="flex-1" />
          <span className="text-sm font-medium">Step 3 of 3</span>
        </div>

        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                3
              </div>
              Add Custom Code
            </CardTitle>
            <CardDescription>
              Configure and install custom CSS and JavaScript for your platform
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Sub-step navigation */}
            <div className="flex items-center justify-center gap-2 pb-4 border-b">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <button
                    onClick={() => setCodeSubStep(step)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      codeSubStep === step
                        ? 'bg-primary text-primary-foreground'
                        : codeSubStep > step
                        ? 'bg-green-500 text-white'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {codeSubStep > step ? <Check className="w-4 h-4" /> : step}
                  </button>
                  {step < 3 && (
                    <div className={`w-12 h-0.5 mx-1 ${codeSubStep > step ? 'bg-green-500' : 'bg-muted'}`} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-8 text-xs text-muted-foreground mb-4">
              <span className={codeSubStep === 1 ? 'font-medium text-foreground' : ''}>Features</span>
              <span className={codeSubStep === 2 ? 'font-medium text-foreground' : ''}>Custom JS</span>
              <span className={codeSubStep === 3 ? 'font-medium text-foreground' : ''}>Custom CSS</span>
            </div>

            {/* Sub-step 1: Enable/Disable Features */}
            {codeSubStep === 1 && (
              <div className="space-y-6">
                <h3 className="font-semibold text-lg">Enable/Disable Features</h3>
                <p className="text-sm text-muted-foreground">
                  Toggle which features you want to install. The next steps will show the code based on your selections.
                </p>

                {/* Replace GHL Default Launchpad */}
                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                  <div className="space-y-1">
                    <Label className="text-base font-medium">Replace GHL Default Launchpad</Label>
                    <p className="text-sm text-muted-foreground">
                      Hide the HighLevel LaunchPad feature from your platform
                    </p>
                  </div>
                  <Switch
                    checked={removeLaunchpad}
                    onCheckedChange={setRemoveLaunchpad}
                  />
                </div>

                {/* Auto Navigate to Onboarding On Login */}
                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                  <div className="space-y-1">
                    <Label className="text-base font-medium">Auto Navigate to Onboarding On Login</Label>
                    <p className="text-sm text-muted-foreground">
                      Directs users immediately to the onboarding & education tool upon login. This provides a seamless user experience when they login to the platform, and enables more consistent data in your activity dashboard.
                    </p>
                  </div>
                  <Switch
                    checked={autoNavigateOnLogin}
                    onCheckedChange={setAutoNavigateOnLogin}
                  />
                </div>

                {/* Install Help Widget */}
                <div className="border rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between p-4">
                    <div className="space-y-1 flex items-start gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <Label className="text-base font-medium">Install Help Widget</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="w-6 h-6 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center transition-colors">
                                <Info className="w-3.5 h-3.5 text-white" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-4" side="right">
                              <div className="space-y-3">
                                <h4 className="font-semibold text-sm">What is the Help Widget?</h4>
                                <p className="text-xs text-muted-foreground">
                                  This widget directs your users to the onboarding and support tools no matter where they're at in the software
                                </p>
                                <img 
                                  src={helpWidgetImage} 
                                  alt="Help Widget Preview" 
                                  className="rounded-lg border w-full"
                                />
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Add a floating "?" button that guides users to onboarding and support
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={installHelpWidget}
                      onCheckedChange={setInstallHelpWidget}
                    />
                  </div>
                  
                  {/* Conditional fields when help widget is enabled */}
                  {installHelpWidget && (
                    <div className="px-4 pb-4 space-y-4 border-t pt-4">
                      <div>
                        <Label htmlFor="menu-link-title" className="text-sm font-medium">What did you title your custom menu link?</Label>
                        <p className="text-xs text-muted-foreground mb-2">
                          Enter the exact title you used when creating the menu link in Step 1 (e.g., "Onboarding", "Get Started", "Training")
                        </p>
                        <Input
                          id="menu-link-title"
                          value={menuLinkTitle}
                          onChange={(e) => setMenuLinkTitle(e.target.value)}
                          placeholder="e.g., Onboarding"
                        />
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="show-chat-widget" className="text-sm">Show Chat Widget Text</Label>
                          <Switch
                            id="show-chat-widget"
                            checked={showChatWidgetText}
                            onCheckedChange={setShowChatWidgetText}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="show-support-ticket" className="text-sm">Show Support Ticket Text</Label>
                          <Switch
                            id="show-support-ticket"
                            checked={showSupportTicketText}
                            onCheckedChange={setShowSupportTicketText}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-center pt-4">
                  <Button 
                    onClick={() => setCodeSubStep(2)}
                    size="lg"
                  >
                    Next: Custom JS
                  </Button>
                </div>
              </div>
            )}

            {/* Sub-step 2: Custom JS */}
            {codeSubStep === 2 && (
              <div className="space-y-6">
                <h3 className="font-semibold text-lg">Custom JavaScript</h3>
                
                {(autoNavigateOnLogin || installHelpWidget) ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Copy and paste this JavaScript code into your HighLevel agency settings.
                    </p>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <p className="text-sm text-amber-800">
                        <strong>Important:</strong> This JavaScript code will be installed at <strong>Agency Level → Company → White Label → Custom JS</strong>
                      </p>
                    </div>

                    <div>
                      <Label className="text-base font-semibold mb-2 block">Generated JavaScript Code</Label>
                      <CodeBlock code={generateCombinedJsCode()} language="javascript" maxHeight="400px" />
                    </div>
                    
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-semibold text-blue-900 mb-2">How to Install This JavaScript:</h4>
                      <ol className="text-sm text-blue-800 space-y-1">
                        <li>1. Log into your HighLevel agency account</li>
                        <li>2. Go to Settings → Company → White Label → <strong>Custom JS</strong></li>
                        <li>3. Paste the generated JavaScript code above</li>
                        <li>4. Save the changes</li>
                      </ol>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No JavaScript features are enabled. You can skip this step.</p>
                  </div>
                )}

                <div className="flex justify-center gap-4 pt-4">
                  <Button 
                    onClick={() => setCodeSubStep(1)}
                    variant="outline"
                    size="lg"
                  >
                    Back
                  </Button>
                  <Button 
                    onClick={() => setCodeSubStep(3)}
                    size="lg"
                  >
                    Next: Custom CSS
                  </Button>
                </div>
              </div>
            )}

            {/* Sub-step 3: Custom CSS */}
            {codeSubStep === 3 && (
              <div className="space-y-6">
                <h3 className="font-semibold text-lg">Custom CSS</h3>
                <p className="text-sm text-muted-foreground">
                  Copy and paste this CSS code into your HighLevel agency settings.
                </p>

                <div>
                  <Label className="text-base font-semibold mb-2 block">Generated CSS Code</Label>
                  <CodeBlock code={generateCssCode()} language="css" maxHeight="300px" />
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-2">How to Apply This CSS:</h4>
                  <ol className="text-sm text-blue-800 space-y-1">
                    <li>1. Log into your HighLevel agency account</li>
                    <li>2. Go to Settings → Company → White Label → Custom CSS</li>
                    <li>3. Paste the generated CSS code above</li>
                    <li>4. Save the changes</li>
                  </ol>
                </div>

                <div className="flex flex-col md:flex-row gap-4 justify-center pt-4">
                  <Button 
                    onClick={() => setCodeSubStep(2)}
                    variant="outline"
                    size="lg"
                  >
                    Back
                  </Button>
                  <Button 
                    onClick={completeSetupWithColors}
                    disabled={isSaving}
                    size="lg"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Complete Setup
                  </Button>
                  <Button 
                    onClick={skipColorSetup}
                    disabled={isSaving}
                    variant="outline"
                    size="lg"
                  >
                    Skip
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
};

export default OnboardingTool;
