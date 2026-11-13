import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, PanelLeft, PenSquare, Trash2, Pencil, Check, MessageCircle, ExternalLink, Package, Lock, Calendar, Maximize2, Minimize2, X, LayoutDashboard, Palette, EyeOff, LifeBuoy, CreditCard, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  SESSION_REFRESH_PROMPT,
  formatChatFailureDetail,
  functionErrorStatus,
  invokeChatCopilot,
  readFunctionErrorMessage,
} from "@/lib/chatCopilotAuth";
import { readUnsentDraft } from "@/lib/unsentDraft";
import { useUser } from "@/contexts/UserContext";
import { useCoPilot } from "@/contexts/CoPilotContext";
import { useGhl } from "@/components/highlevel/useGhl";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { MessageResponse } from "@/components/ai-elements/message";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Composer } from "@/components/copilot-workspace/Composer";
import { IntroSlides } from "@/components/copilot-workspace/IntroSlides";
import { FirstTimeMenu } from "@/components/copilot-workspace/FirstTimeMenu";
import { Choices, MultiPick, VideosPicker, ConnectApps, GhlConnectForm, MenuLinkStep, SlackCard, HubLinkCard, UpgradeButtons } from "@/components/copilot-workspace/Widgets";
import { MenuRemovalSetupCard, GuideScreenshot } from "@/components/copilot-workspace/MenuRemovalSetupCard";
import { MenuRemovalVideo } from "@/components/copilot-workspace/MenuRemovalVideo";
import { TextUsDialog } from "@/components/dashboard/SetupHelpPopup";
import { CoPilotVoiceMode } from "@/components/copilot/CoPilotVoiceMode";
import {
  DEFAULT_ASSISTANT_NAME, FIRST_GREETING, GHL_INSTRUCTIONS, NAME_OPTIONS, NAME_QUESTION,
  composerPlaceholder, introAfterName, parseAssistant, splitReply, threadTitleFrom, typingDelay, withoutDuplicateSkip,
  PRIORITY_QUESTION, onboardingPhaseKey,
} from "@/lib/copilotWorkspace";
import { consumeCopilotStream } from "@/lib/copilotStream";
import { mergeLoadedMessages } from "@/lib/copilotQueue";
import { cn } from "@/lib/utils";
import { COPILOT_TOPICS, focusFromPath, validCopilotFocus, shouldContinueSetup, hubMenuLinkInstalled, isNameAnswer, type CopilotFocus } from "@/lib/copilotFocus";
import { ghl as ghlCall } from "@/components/highlevel/ghlApi";
import { navigateWithParams } from "@/utils/preserveParams";
import { rememberNextPath } from "@/utils/deepLink";
import { readPendingVisitorId, clearPendingVisitorId } from "@/lib/publicCopilot";
import { copilotSourcePath } from "../../supabase/functions/chat-copilot/accountActivity";
import {
  CONTINUED_CHAT_TITLE, FIRST_TIME_CHAT_TITLE, SNAPSHOT_CHAT_TITLE,
  dedupeQuickActionThreads, findReusableThread, isQuickActionTitle, mostRecentThread, parseCopilotRoute, threadToResume,
} from "@/lib/copilotThreads";
import { withDeadline } from "@/lib/loadSettle";
import { KitReturnLink } from "@/components/dashboard/KitReturnLink";
import { currentKitReturn } from "@/lib/kitReturn";
import {
  AssistantMessage, COPILOT_PROSE, CopilotCard, CopilotGreeting, CopilotMark, PromptChips, ThinkingRow, UserBubble,
  type CopilotPrompt,
} from "@/components/premium/copilot/CopilotBits";

/** Suggested prompts on the empty state. Tapping one sends it. */
const STARTER_PROMPTS: CopilotPrompt[] = [
  { label: "Set up my Client Hub", prompt: "Help me set up my Client Hub", icon: LayoutDashboard },
  { label: "Brand my login page", prompt: "Help me brand my login page", icon: Palette },
  { label: "Hide menu links for new clients", prompt: "How do I hide menu links for new clients?", icon: EyeOff },
  { label: "Turn on client support", prompt: "Help me turn on support for my clients", icon: LifeBuoy },
];

const firstNameOf = (user: { user_metadata?: Record<string, unknown> } | null | undefined) => {
  const full = user?.user_metadata?.full_name ?? user?.user_metadata?.name;
  return typeof full === "string" ? full.trim().split(/\s+/)[0] || null : null;
};

const threadWhen = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const iconButton =
  "inline-grid size-10 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 sm:size-9";
const navRow =
  "flex min-h-10 w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-normal text-foreground transition-colors hover:bg-muted " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40";

type Msg = { id: string; role: "user" | "assistant"; content: string };
type Thread = { id: string; title: string; kind: string; updated_at: string };
type Phase = "name" | "name_other" | "connect" | "ai";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pendingFirstMessage = new Map<string, string>();

async function saveCopilotThreadMessage(threadId: string, role: string, content: string) {
  const row = { thread_id: threadId, role, content };
  try {
    const { error } = await withDeadline(supabase.from("copilot_thread_messages" as any).insert(row as any));
    if (error) throw error;
    return null;
  } catch (error) {
    console.error("copilot message save failed", error);
    toast.error("Couldn't save your message", {
      description: "Your message is still on this page. Keep it open; saving wasn't confirmed.",
    });
    return error;
  }
}
const pendingContextGreeting = new Set<string>();

/* ----------------------------- account state ----------------------------- */
function useWorkspaceAccount(email: string | null) {
  const owner = (email || "").trim().toLowerCase();
  const ghlState = useGhl();
  const { agencyId } = ghlState;
  const [assistantName, setAssistantName] = useState<string>(DEFAULT_ASSISTANT_NAME);
  const [ghlSkipped, setGhlSkipped] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [slackConnected, setSlackConnected] = useState(false);
  const [menuLinkInstalled, setMenuLinkInstalled] = useState(false);
  const [userCount, setUserCount] = useState(0);
  const [hubUrl, setHubUrl] = useState<string | null>(null);
  const [statusLoaded, setStatusLoaded] = useState(false);

  useEffect(() => {
    if (!owner) {
      setPrefsLoaded(true);
      return;
    }
    let cancel = false;
    withDeadline(
      supabase.from("copilot_preferences" as any).select("assistant_name, ghl_skipped").eq("owner_email", owner).maybeSingle(),
    ).then(({ data }: any) => {
      if (cancel) return;
      if (data?.assistant_name) setAssistantName(data.assistant_name);
      setGhlSkipped(!!data?.ghl_skipped);
    }).catch(() => { /* preferences stay at their defaults */ })
      .finally(() => { if (!cancel) setPrefsLoaded(true); });
    return () => { cancel = true; };
  }, [owner]);

  const refreshSlack = useCallback(async () => {
    if (!agencyId) return false;
    const { data } = await supabase.from("slack_channel_agency_map").select("agency_id").eq("agency_id", agencyId).eq("is_active", true).limit(1);
    const on = !!data?.length;
    setSlackConnected(on);
    return on;
  }, [agencyId]);

  useEffect(() => {
    if (!agencyId) {
      setStatusLoaded(true);
      return;
    }
    let cancel = false;
    void refreshSlack();
    withDeadline(Promise.all([
      supabase.from("agency_ui_versions").select("ui_version").eq("agency_id", agencyId).maybeSingle(),
      supabase.from("agency_menu_config").select("menu_link_id").eq("agency_id", agencyId).maybeSingle(),
      supabase.from("user_progress").select("id", { count: "exact", head: true }).eq("agency_id", agencyId),
    ])).then(([ui, menu, progress]) => {
      if (cancel) return;
      const version = Number((ui.data as { ui_version?: number } | null)?.ui_version) || 2;
      setHubUrl(`https://yoursoftwareonboarding.com/v${version}/${encodeURIComponent(agencyId)}`);
      setMenuLinkInstalled(!!(menu.data as { menu_link_id?: string } | null)?.menu_link_id);
      setUserCount(progress.count ?? 0);
    }).catch(() => { /* status stays unset so setup can still continue */ })
      .finally(() => { if (!cancel) setStatusLoaded(true); });
    return () => { cancel = true; };
  }, [agencyId, refreshSlack]);

  // A link installed directly in HighLevel counts too, even if no Menu Link ID was saved here.
  useEffect(() => {
    if (!agencyId || !ghlState.connected) return;
    ghlCall<{ menus: Array<{ url?: string | null }> }>("menus", agencyId)
      .then((r) => { if (hubMenuLinkInstalled(r?.menus, agencyId)) setMenuLinkInstalled(true); })
      .catch(() => { /* keep saved state */ });
  }, [agencyId, ghlState.connected]);

  const savePrefs = useCallback(async (patch: Record<string, unknown>) => {
    if (!owner) return;
    const { error } = await supabase.from("copilot_preferences" as any).upsert({ owner_email: owner, ...patch, updated_at: new Date().toISOString() } as any, { onConflict: "owner_email" });
    if (error) toast.error("Couldn't save that preference");
  }, [owner]);

  const rename = useCallback(async (name: string) => {
    const n = name.trim().slice(0, 40) || DEFAULT_ASSISTANT_NAME;
    setAssistantName(n);
    await savePrefs({ assistant_name: n });
    return n;
  }, [savePrefs]);

  return {
    owner, agencyId, ghl: ghlState, assistantName, rename, ghlSkipped, setGhlSkipped, prefsLoaded, savePrefs,
    slackConnected, refreshSlack, menuLinkInstalled, setMenuLinkInstalled, userCount, hubUrl, statusLoaded,
  };
}
type Account = ReturnType<typeof useWorkspaceAccount>;

/* --------------------------------- chat ---------------------------------- */
function ChatView({ threadId, kind, account, onVoice, runIntro, onTouched, focus, compact }: {
  threadId: string; kind: string; account: Account; onVoice: () => void; runIntro?: boolean; onTouched: (title?: string) => void; focus: CopilotFocus | null; compact?: boolean;
}) {
  const { email, plan, user } = useUser();
  const location = useLocation();
  const sourcePage = copilotSourcePath(location.state?.copilotSource);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draftReply, setDraftReply] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [checkout, setCheckout] = useState<{ url: string; name: string } | null>(null);
  const [installationSkipped, setInstallationSkipped] = useState(false);
  const priorityQuestion = focus ? `You want to learn about ${COPILOT_TOPICS[focus]}, right?\n[[choices: Yes, let's do that | No, I want something else]]` : PRIORITY_QUESTION;
  const isFirstTime = kind === "first_time";
  const phaseKey = onboardingPhaseKey(account.owner, threadId);
  const [phase, setPhaseState] = useState<Phase>(() => {
    try { return (localStorage.getItem(phaseKey) as Phase) || "name"; } catch { return "name"; }
  });
  const setPhase = (p: Phase) => { setPhaseState(p); try { localStorage.setItem(phaseKey, p); } catch { /* ignore */ } };
  const msgsRef = useRef<Msg[]>([]);
  msgsRef.current = msgs;
  const startedRef = useRef(false);

  const persist = useCallback(async (role: Msg["role"], content: string) => {
    const local: Msg = { id: crypto.randomUUID(), role, content };
    msgsRef.current = [...msgsRef.current, local];
    setMsgs(msgsRef.current);
    void saveCopilotThreadMessage(threadId, role, content);
    return local;
  }, [threadId]);

  const say = useCallback(async (content: string) => {
    setTyping(true);
    try {
      await sleep(typingDelay(content));
      await persist("assistant", content);
    } finally {
      setTyping(false);
    }
  }, [persist]);

  // Load the thread from the database.
  useEffect(() => {
    let cancel = false;
    withDeadline(
      supabase.from("copilot_thread_messages" as any).select("id, role, content").eq("thread_id", threadId).order("created_at"),
    ).then(({ data, error }: any) => {
        if (cancel) return;
        if (error) setReplyError("Couldn't load this chat.");
        else setReplyError(null);
        const loadedRows = (data as Msg[]) || [];
        const merged = mergeLoadedMessages(loadedRows, msgsRef.current);
        msgsRef.current = merged;
        setMsgs(merged);
        setLoaded(true);
      }).catch(() => {
        if (cancel) return;
        setReplyError("Couldn't load this chat.");
        setLoaded(true);
      });
    return () => { cancel = true; };
  }, [threadId]);

  const askAI = useCallback(async (extraUserText?: string, proactiveGreeting = false): Promise<void | "session"> => {
    setBusy(true);
    setTyping(true);
    setDraftReply("");
    setReplyError(null);
    let streamedText = "";
    try {
      const history = msgsRef.current.map((m) => ({ role: m.role, content: m.content }));
      if (extraUserText) history.push({ role: "user", content: extraUserText });
      const { data, error } = await invokeChatCopilot(
        (body) => supabase.functions.invoke("chat-copilot", { body }),
        () => supabase.auth.refreshSession(),
        {
          messages: history.slice(-40),
          userEmail: email,
          page: window.location.pathname,
          mode: "workspace",
          workspace: {
            assistantName: account.assistantName,
            stage: isFirstTime ? "onboarding" : "chat",
            ghlConnected: account.ghl.connected,
            ghlSkipped: account.ghlSkipped,
            slackConnected: account.slackConnected,
            menuLinkInstalled: account.menuLinkInstalled,
            focus, installationSkipped,
            sourcePage,
            proactiveGreeting,
            plan, agencyId: account.agencyId, userCount: account.userCount,
          },
          client: { isMobile: window.innerWidth < 768, width: window.innerWidth, height: window.innerHeight },
        },
      );
      if (error) {
        const status = functionErrorStatus(error);
        const serverMessage = await readFunctionErrorMessage(error);
        if (status === 401) {
          toast.error(SESSION_REFRESH_PROMPT, { description: formatChatFailureDetail(401, serverMessage) });
          setTyping(false);
          setReplyError(SESSION_REFRESH_PROMPT);
          return "session";
        }
        let msg = "Couldn't get a reply. Please try again in a moment.";
        if (serverMessage) msg = serverMessage;
        if (status === 429) msg = "I'm getting a lot of requests right now. Give me a few seconds and send that again.";
        toast.error("Failed to send message. Please try again.", {
          description: formatChatFailureDetail(status || 0, serverMessage || msg),
        });
        setTyping(false);
        setReplyError(msg);
        setHelpOpen(true);
        return;
      }
      if (data instanceof Response) {
        await consumeCopilotStream(data, (event) => {
          if (event.type === "delta") { streamedText += event.text; setDraftReply(streamedText); setTyping(false); }
          if (event.type === "replace") { streamedText = event.text; setDraftReply(event.text); setTyping(false); }
          if (event.type === "working") setTyping(true);
          if (event.type === "done" && event.actions?.length) window.dispatchEvent(new CustomEvent("user-settings-changed"));
          if (event.type === "done" && (event.handover || event.needsHelp)) setHelpOpen(true);
        });
        const parts = splitReply(streamedText);
        const locals: Msg[] = parts.map((content) => ({ id: crypto.randomUUID(), role: "assistant", content }));
        msgsRef.current = [...msgsRef.current, ...locals];
        setMsgs(msgsRef.current);
        setDraftReply("");
        for (const content of parts) void saveCopilotThreadMessage(threadId, "assistant", content);
        if (parts.some(p => p.includes("[[widget:menu_link]]"))) void account.ghl.reload();
        return;
      }
      const parts = splitReply(String((data as any)?.content || ""));
      if ((data as any)?.handover && !(data as any)?.quiet) setHelpOpen(true);
      if ((data as any)?.quiet) {
        setTyping(false);
        setReplyError("AI replies are paused for human support. Your message was saved. Text our team for direct help.");
        return;
      }
      if ((data as any)?.actions?.length) window.dispatchEvent(new CustomEvent("user-settings-changed"));
      setTyping(false);
      for (let i = 0; i < parts.length; i++) {
        await persist("assistant", parts[i]);
      }
      if (!parts.length) await persist("assistant", "Sorry, I didn't catch that. Could you say it another way?");
      if ((data as any)?.actions?.length) void account.ghl.reload();
    } catch (error) {
      setReplyError(error instanceof Error ? error.message : "The reply was interrupted. Please try again.");
      setHelpOpen(true);
    } finally {
      setTyping(false);
      setBusy(false);
    }
  }, [email, plan, account, isFirstTime, persist, threadId, focus, installationSkipped, sourcePage]);

  const outbound = useRef<string[]>([]);
  const draining = useRef(false);
  const drainOutbound = useCallback(async (): Promise<string | null> => {
    if (!loaded || draining.current) return null;
    draining.current = true;
    let failed: string | null = null;
    try {
      while (outbound.current.length) {
        const next = outbound.current.shift() as string;
        const outcome = await askAI();
        if (outcome === "session") {
          failed = next;
          break;
        }
        const isFirstUserMsg = msgsRef.current.filter((m) => m.role === "user").length <= 1;
        void saveCopilotThreadMessage(threadId, "user", next);
        onTouched(isFirstUserMsg && !isFirstTime ? threadTitleFrom(next) : undefined);
      }
    } finally {
      draining.current = false;
      if (loaded && outbound.current.length && !failed) void drainOutbound();
    }
    return failed;
  }, [loaded, askAI, onTouched, isFirstTime, threadId]);
  const sendUser = useCallback(async (text: string): Promise<void | "kept"> => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const id = crypto.randomUUID();
    msgsRef.current = [...msgsRef.current, { id, role: "user", content: trimmed }];
    setMsgs(msgsRef.current);
    outbound.current.push(trimmed);
    const failed = await drainOutbound();
    if (failed === trimmed) {
      msgsRef.current = msgsRef.current.filter((message) => message.id !== id);
      setMsgs([...msgsRef.current]);
      return "kept";
    }
  }, [drainOutbound]);

  // Scripted opening for the first-time experience.
  useEffect(() => {
    if (!loaded || startedRef.current) return;
    startedRef.current = true;
    if (runIntro && isFirstTime && msgsRef.current.length === 0) {
      const pending = pendingFirstMessage.get(threadId);
      if (pending) pendingFirstMessage.delete(threadId);
      setPhase("name");
      void (async () => {
        setBusy(true);
        try {
          await say(focus === "menulinkremoval" ? `${FIRST_GREETING}\n\nYou can watch the Menu Link Removal training now, or we can work through it together.\n[[widget:menu_removal_video]]` : FIRST_GREETING);
          await say(NAME_QUESTION);
        } finally {
          setBusy(false);
        }
        if (pending) await sendUser(pending);
      })();
      return;
    }
    const pending = pendingFirstMessage.get(threadId);
    if (pending) { pendingFirstMessage.delete(threadId); void sendUser(pending); }
    else if (outbound.current.length) void drainOutbound();
    else if (pendingContextGreeting.delete(threadId) && msgsRef.current.length === 0) {
      void askAI("I opened Copilot from the app. Briefly orient me using my current page, saved account setup and latest recorded activity; suggest the most relevant next step and ask what I need. Read-only greeting: do not change settings or start an upgrade.", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const pickName = async (raw: string) => {
    if (raw === "Other") {
      await persist("user", "Other");
      setPhase("name_other");
      await say("What should I go by?");
      return;
    }
    setBusy(true);
    if (phase === "name") await persist("user", raw);
    else await persist("user", raw);
    const name = await account.rename(raw);
    setPhase("connect");
    for (const m of introAfterName(name)) {
      if (m.includes("[[widget:connect_apps]]") && account.ghl.connected && account.slackConnected) continue;
      await say(m);
    }
    setBusy(false);
  };

  const continueToAI = async (userText: string) => {
    setPhase("ai");
    await persist("user", userText);
    await askAI();
  };

  useEffect(() => {
    if (!loaded || busy || !isFirstTime || phase !== "connect" || account.ghl.loading || !account.statusLoaded) return;
    if (shouldContinueSetup(account.ghl.connected, account.slackConnected, account.menuLinkInstalled)) {
      void continueToAI("My saved HighLevel connection is ready. Continue from my existing installation state; don't repeat completed setup.");
    }
  }, [loaded, busy, isFirstTime, phase, account.ghl.loading, account.statusLoaded, account.ghl.connected, account.slackConnected, account.menuLinkInstalled]);

  const skipSetup = async () => {
    account.setGhlSkipped(true);
    setInstallationSkipped(true);
    await account.savePrefs({ ghl_skipped: true });
    setPhase("ai");
    await persist("user", "Skip unfinished authorization and installation for now.");
    await say("You can preview your Client Hub independently. Opening it doesn't install it in HighLevel; finish the desktop installation when you're ready.\n[[widget:hub_link]]");
    await say(priorityQuestion);
  };

  const startUpgrade = async (target: "basic" | "advanced" | "enhanced") => {
    if (upgradeBusy) return;
    setUpgradeBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("chat-copilot", {
        body: { userEmail: email, action: "upgrade", target_plan: target, messages: [] },
      });
      if (error || !data?.success || !data?.upgrade_url) throw new Error(data?.message || "Couldn't open your upgrade. Please use Settings > Billing or text us.");
      setCheckout({ url: data.upgrade_url, name: target === "enhanced" ? "Premium Support" : target === "advanced" ? "Advanced" : "Basic" });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't start your upgrade"); setHelpOpen(true); }
    finally { setUpgradeBusy(false); }
  };

  const onComposerSend = async (text: string): Promise<void | "kept"> => {
    if (isFirstTime && (phase === "name" || phase === "name_other")) {
      const opt = NAME_OPTIONS.find((o) => o.toLowerCase() === text.trim().toLowerCase());
      if (opt === "Other") return pickName("Other");
      if (isNameAnswer(text, NAME_OPTIONS, phase)) return pickName(opt || text.trim());
      // Not a name: keep the default name and treat it as a normal message.
      setPhase(account.ghl.connected ? "ai" : "connect");
      return sendUser(text);
    }
    if (isFirstTime && phase === "connect") setPhase("ai");
    return sendUser(text);
  };

  const lastAssistantIdx = (() => { for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].role === "assistant") return i; return -1; })();
  const lastIsAssistant = msgs.length > 0 && msgs[msgs.length - 1].role === "assistant";

  const renderWidget = (w: ReturnType<typeof parseAssistant>["widgets"][number], live: boolean, key: string) => {
    if (w.kind === "choices") {
      const isNameCard = isFirstTime && w.options.join("|") === NAME_OPTIONS.join("|");
      return <Choices key={key} options={w.options} disabled={!live || busy}
        onPick={(o) => (isNameCard ? pickName(o) : sendUser(o))} />;
    }
    if (w.kind === "multi") {
      return <MultiPick key={key} options={w.options} disabled={!live || busy}
        onSubmit={(p) => sendUser(p.length ? `Yes: ${p.join(", ")}` : "None of these for now")} />;
    }
    if (w.kind === "screenshot") return <GuideScreenshot key={key} k={w.key} />;
    switch (w.name) {
      case "menu_removal_video":
        return <MenuRemovalVideo key={key} />;
      case "menu_removal_setup":
        return <MenuRemovalSetupCard key={key} agencyId={account.agencyId} onHelp={() => setHelpOpen(true)} onConnect={() => void say(GHL_INSTRUCTIONS)} onUpgrade={() => void say("Choose a plan to review.\n[[widget:upgrade]]")} />;
      case "connect_apps":
        return <div key={key} className="space-y-2"><ConnectApps agencyId={account.agencyId} email={email} slackConnected={account.slackConnected} ghlConnected={account.ghl.connected}
          onSlackDone={async () => { const on = await account.refreshSlack(); toast[on ? "success" : "message"](on ? "Slack connected" : "Slack isn't showing as connected yet. Finish the Slack screen, then try again."); }}
          onGhlAuthorize={() => (account.ghl.connected ? continueToAI("HighLevel is already connected. Let's keep going.") : say(GHL_INSTRUCTIONS))} /><div className="flex flex-wrap gap-2">{account.ghl.connected && <Button size="sm" variant="outline" disabled={!live || busy} onClick={() => continueToAI("HighLevel is connected. Continue setup; Slack can wait.")}>Continue setup</Button>}<Button size="sm" variant="ghost" disabled={!live || busy} onClick={skipSetup}>Skip for now</Button></div></div>;
      case "slack_connect":
        return <div key={key}><SlackCard agencyId={account.agencyId} email={email} connected={account.slackConnected} onDone={() => void account.refreshSlack()} /></div>;
      case "ghl_connect":
        return <GhlConnectForm key={key} agencyId={account.agencyId} connected={account.ghl.connected} disabled={busy}
          showSkip={!msgs.some((message) => message.content.includes("[[widget:connect_apps]]"))}
          onConnected={async (company) => { await account.ghl.reload(true); toast.success("HighLevel connected"); await continueToAI(`I connected HighLevel${company ? ` (${company})` : ""}.`); }}
          onSkip={skipSetup} />;
      case "hub_link":
        return account.hubUrl ? <HubLinkCard key={key} url={account.hubUrl} onConnect={() => say(GHL_INSTRUCTIONS)} /> : null;
      case "upgrade":
        return <UpgradeButtons key={key} disabled={busy || upgradeBusy} onUpgrade={startUpgrade} />;
      case "human_help":
        return <Button key={key} variant="outline" size="sm" onClick={() => setHelpOpen(true)}><MessageCircle className="h-4 w-4" />Text us for human help</Button>;
      case "menu_link":
        return <div key={key} className="space-y-2"><MenuLinkStep agencyId={account.agencyId} connected={account.ghl.connected} installed={account.menuLinkInstalled}
          onConnect={() => say(GHL_INSTRUCTIONS)}
          onCreated={async () => {
            account.setMenuLinkInstalled(true);
            setPhase("ai");
            await persist("user", "I installed the menu link.");
            await say("Your menu link is installed. Paste your account’s CSS and JavaScript in HighLevel’s Agency Settings > Company > White Label on desktop to finish installation.");
            await say(priorityQuestion);
          }} /><Button size="sm" variant="ghost" disabled={!live || busy} onClick={skipSetup}>Skip installation for now</Button></div>;
      case "videos":
        return <VideosPicker key={key} disabled={!live || busy} onSubmit={(p) => sendUser(p.length ? `Teach them these videos: ${p.join(", ")}` : "No extra videos for now")} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-1 min-h-0 min-w-0 flex-col">
      <TextUsDialog open={helpOpen} onOpenChange={setHelpOpen} title="Need a hand?" description="Text our team for help with setup, billing, or anything you're stuck on." message={`I need help with SaaSSuite Copilot. My agency is ${account.agencyId || "still loading"}.`} />
      <Conversation className="flex-1 min-h-0">
        <ConversationContent className={cn("mx-auto w-full max-w-3xl gap-4 px-4", compact ? "py-4" : "py-6")}>
          {loaded && msgs.length === 0 && !typing && !draftReply && (
            <CopilotGreeting firstName={firstNameOf(user)} assistantName={account.assistantName} heading={compact ? "h2" : "h1"} compact={compact} className={compact ? "pt-8" : "pt-[12vh]"}>
              <PromptChips prompts={STARTER_PROMPTS} disabled={busy} onPick={(prompt) => void onComposerSend(prompt)} />
            </CopilotGreeting>
          )}
          {!loaded && (
            <div className="space-y-3 pt-2" aria-hidden="true">
              <div className="px-skeleton ml-auto h-10 w-2/3 rounded-lg" />
              <div className="px-skeleton h-20 w-5/6 rounded-lg" />
            </div>
          )}
          {msgs.map((m, i) => {
            if (m.role === "user") return <UserBubble key={m.id}>{m.content}</UserBubble>;
            const { text, widgets: parsedWidgets } = parseAssistant(m.content);
            const widgets = withoutDuplicateSkip(parsedWidgets);
            const live = i === lastAssistantIdx && lastIsAssistant;
            return (
              <AssistantMessage key={m.id} name={account.assistantName} showName={i === 0 || msgs[i - 1].role !== "assistant"}
                after={widgets.length ? widgets.map((w, n) => renderWidget(w, live, `${m.id}-${n}`)) : undefined}>
                {text ? <MessageResponse className={COPILOT_PROSE}>{text}</MessageResponse> : null}
              </AssistantMessage>
            );
          })}
          {draftReply && splitReply(draftReply).map((part, i) => {
            const safeText = parseAssistant(part.replace(/\[\[[\s\S]*$/, "")).text;
            return safeText ? (
              <AssistantMessage key={`draft-${i}`} name={account.assistantName} showName={i === 0 && !lastIsAssistant}>
                <MessageResponse isAnimating={busy} className={COPILOT_PROSE}>{safeText}</MessageResponse>
              </AssistantMessage>
            ) : null;
          })}
          {replyError && <p role="alert" className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{replyError}</p>}
          {checkout && (
            <CopilotCard icon={<CreditCard />} title={`Review your ${checkout.name} upgrade`}
              description="Confirming in Stripe charges immediately, prorated where applicable. Access changes only after payment is confirmed.">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="accent" asChild><a href={checkout.url}>Review upgrade in Stripe<ExternalLink className="h-4 w-4" /></a></Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => sendUser("I completed my upgrade. Please refresh my saved plan and limits before continuing setup.")}>I've paid, check my plan</Button>
              </div>
            </CopilotCard>
          )}
          {typing && <ThinkingRow name={account.assistantName} label={draftReply ? "Working on it…" : "Thinking…"} />}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="mx-auto w-full max-w-3xl px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
        <Composer placeholder={composerPlaceholder(account.assistantName)} disabled={busy} onSend={onComposerSend} onVoice={onVoice} initialValue={readUnsentDraft()}
          leading={<>
            <Button size="sm" variant="ghost" className="h-9 px-2.5 text-muted-foreground" onClick={() => setHelpOpen(true)} title="Text our team"><MessageCircle className="h-4 w-4" />Text us</Button>
            <Button size="sm" variant="ghost" className="h-9 px-2.5 text-muted-foreground" disabled={busy} title="Plans and upgrades" onClick={() => void say("Choose a plan to review your upgrade.\n[[widget:upgrade]]")}><Sparkles className="h-4 w-4" />Plans</Button>
          </>} />
      </div>
    </div>
  );
}

/* --------------------------------- page ---------------------------------- */
export default function CopilotPage({
  embedded = false,
  presentation = "expanded",
  onExpand,
  onCollapse,
  onClose,
}: {
  embedded?: boolean;
  presentation?: "dock" | "expanded";
  onExpand?: () => void;
  onCollapse?: () => void;
  onClose?: () => void;
} = {}) {
  const { email, plan, isLoading, initialQuestionsCompleted, user } = useUser();
  const location = useLocation();
  const navigate = useNavigate();
  const { setDockNavOpen } = useCoPilot();
  const route = parseCopilotRoute(location.pathname);
  const docked = embedded && presentation === "dock";
  const [pickedId, setPickedId] = useState<string | null>(null);
  const threadId = route.kind === "thread" ? route.threadId : route.onCopilotPath ? null : pickedId;
  const routeFocus = route.kind === "focus" ? route.focus : focusFromPath(location.pathname);
  const focus = (routeFocus as CopilotFocus | null) || validCopilotFocus(new URLSearchParams(location.search).get("copilot_focus"));
  const isFirstTimeRoute = route.kind === "first-time";
  const account = useWorkspaceAccount(email);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadsLoaded, setThreadsLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [explicitNewChat, setExplicitNewChat] = useState(false);
  const [voice, setVoice] = useState(false);
  const [showSlides, setShowSlides] = useState(false);
  const [introThread, setIntroThread] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [threadListError, setThreadListError] = useState<string | null>(null);
  const [featureThread, setFeatureThread] = useState<string | null>(null);
  const featureStarting = useRef<string | null>(null);
  const heldPrompt = useRef<string | null>(null);
  const [heldPromptText, setHeldPromptText] = useState<string | null>(null);
  const launcherStarting = useRef(false);

  useEffect(() => {
    setDockNavOpen(docked && menuOpen);
  }, [docked, menuOpen, setDockNavOpen]);
  useEffect(() => () => setDockNavOpen(false), [setDockNavOpen]);

  useEffect(() => {
    if (isLoading) return;
    const params = new URLSearchParams(location.search);
    if (focus) params.set("copilot_focus", focus);
    const destination = `${location.pathname}${params.size ? `?${params}` : ""}`;
    if (!email) {
      if (!route.onCopilotPath) return;
      rememberNextPath(destination);
      params.set("next", destination);
      navigate(`/login?${params}`, { replace: true });
    } else if (focus && !new URLSearchParams(location.search).has("copilot_focus")) {
      navigate(destination, { replace: true });
    }
  }, [isLoading, email, initialQuestionsCompleted, focus, location.pathname, location.search, navigate]);

  const loadThreads = useCallback(async () => {
    if (!account.owner) {
      setThreadsLoaded(true);
      return;
    }
    try {
      const { data, error } = await withDeadline(
        supabase.from("copilot_threads" as any).select("id, title, kind, updated_at")
          .eq("owner_email", account.owner).order("updated_at", { ascending: false }).limit(100),
      );
      if (error) setThreadListError("Couldn't load your chats.");
      else {
        setThreadListError(null);
        setThreads((data as unknown as Thread[]) || []);
      }
    } catch (loadError) {
      setThreadListError(loadError instanceof Error ? loadError.message : "Couldn't load your chats.");
    } finally {
      setThreadsLoaded(true);
    }
  }, [account.owner]);
  useEffect(() => { void loadThreads(); }, [loadThreads]);

  // Carry a signed-out /copilot conversation from this device into the account.
  useEffect(() => {
    if (!email || initialQuestionsCompleted === null || !account.owner || account.owner !== email.toLowerCase()) return;
    const visitorId = readPendingVisitorId();
    if (!visitorId) return;
    clearPendingVisitorId();
    supabase.functions.invoke("public-copilot", { body: { action: "claim", visitorId } }).then(({ data, error }) => {
      if (error || !data?.threadId) return;
      toast.success("Your chat from before signing in is saved here");
      void loadThreads();
      navigate(navigateWithParams(`/app/copilot/${data.threadId}`), { replace: true });
    });
  }, [email, initialQuestionsCompleted, account.owner, loadThreads, navigate]);

  const firstTimeThread = findReusableThread(threads, FIRST_TIME_CHAT_TITLE, "first_time");
  // One row per chat, even if a list refresh and a new chat land in the same moment.
  const visibleThreads = dedupeQuickActionThreads(threads).filter((t, i, all) => all.findIndex((x) => x.id === t.id) === i);

  const routeThreadId = route.kind === "thread" ? route.threadId : "";
  useEffect(() => {
    if (route.kind === "thread") setPickedId(route.threadId);
    if (route.kind === "home") setPickedId(null);
  }, [location.pathname, route.kind, routeThreadId]);

  const resumeId = threadToResume({
    threads,
    explicitNewChat,
    routeKind: route.kind,
    hasSourceHandoff: Boolean(copilotSourcePath(location.state?.copilotSource)),
  })?.id ?? null;
  useEffect(() => {
    if (!threadsLoaded || !resumeId) return;
    if (!route.onCopilotPath) {
      setPickedId((current) => current ?? resumeId);
      return;
    }
    if (route.kind === "home") {
      navigate(navigateWithParams(`/app/copilot/${resumeId}`), { replace: true });
    }
  }, [threadsLoaded, resumeId, route.onCopilotPath, route.kind, navigate]);
  useEffect(() => {
    if (isFirstTimeRoute && threadsLoaded && !firstTimeThread && !introThread) setShowSlides(true);
  }, [isFirstTimeRoute, threadsLoaded, firstTimeThread, introThread]);

  const createThread = async (kind: string, title: string) => {
    const insert = () => supabase.from("copilot_threads" as any).insert({ owner_email: account.owner, kind, title } as any).select("id, title, kind, updated_at").single();
    let { data, error } = await insert();
    if (error || !data) {
      const retry = await insert();
      data = retry.data;
      error = retry.error;
    }
    if (error || !data) {
      console.error("copilot thread create failed", error);
      toast.error("Couldn't start a new chat", { description: error?.message || "Please try again." });
      return null;
    }
    setThreads((t) => [data as any, ...t]);
    return (data as any).id as string;
  };

  const ensureThread = async (kind: string, title: string) => {
    if (isQuickActionTitle(title)) {
      const existing = findReusableThread(threads, title, kind);
      if (existing) return existing.id;
    }
    return createThread(kind, title);
  };

  const selectThread = (id: string) => {
    setSheetOpen(false);
    setExplicitNewChat(false);
    setPickedId(id);
    if (route.onCopilotPath) navigate(navigateWithParams(`/app/copilot/${id}`));
  };

  const openNewChat = () => {
    setSheetOpen(false);
    setExplicitNewChat(true);
    setPickedId(null);
    setShowSlides(false);
    if (route.onCopilotPath) navigate("/app/copilot");
  };

  useEffect(() => {
    if (!copilotSourcePath(location.state?.copilotSource) || threadId || isFirstTimeRoute || routeFocus || launcherStarting.current || !threadsLoaded || !account.prefsLoaded || !account.statusLoaded || account.ghl.loading || initialQuestionsCompleted === null) return;
    launcherStarting.current = true;
    void (async () => {
      const id = await ensureThread("chat", CONTINUED_CHAT_TITLE);
      if (!id) {
        launcherStarting.current = false;
        const prompt = location.state?.copilotPrompt;
        if (typeof prompt === "string" && prompt.trim()) {
          heldPrompt.current = prompt.trim();
          setHeldPromptText(prompt.trim());
        }
        return;
      }
      const reused = threads.some((thread) => thread.id === id);
      const prompt = location.state?.copilotPrompt;
      if (!reused && typeof prompt === "string" && prompt.trim()) pendingFirstMessage.set(id, prompt);
      else if (!reused) pendingContextGreeting.add(id);
      navigate(navigateWithParams(`/app/copilot/${id}`), { replace: true, state: location.state });
    })();
  }, [threadsLoaded, account.prefsLoaded, account.statusLoaded, account.ghl.loading, initialQuestionsCompleted, location.state, threadId, isFirstTimeRoute, routeFocus]);

  useEffect(() => {
    if (!routeFocus || !threadsLoaded || !account.prefsLoaded || !account.statusLoaded || account.ghl.loading || featureStarting.current === routeFocus || initialQuestionsCompleted === null) return;
    featureStarting.current = routeFocus;
    const key = `ss_copilot_feature_${account.owner}_${routeFocus}`;
    let saved: string | null = null;
    try { saved = sessionStorage.getItem(key); } catch { /* storage unavailable */ }
    const titled = findReusableThread(threads, `Learn ${COPILOT_TOPICS[routeFocus]}`, "first_time");
    if (saved && threads.some((t) => t.id === saved)) {
      if (heldPrompt.current) { pendingFirstMessage.set(saved, heldPrompt.current); heldPrompt.current = null; setHeldPromptText(null); }
      setFeatureThread(saved);
      return;
    }
    if (titled) {
      if (heldPrompt.current) { pendingFirstMessage.set(titled.id, heldPrompt.current); heldPrompt.current = null; setHeldPromptText(null); }
      setFeatureThread(titled.id);
      try { sessionStorage.setItem(key, titled.id); } catch { /* storage unavailable */ }
      return;
    }
    void (async () => {
      const id = await createThread("first_time", `Learn ${COPILOT_TOPICS[routeFocus]}`);
      if (!id) { featureStarting.current = null; return; }
      if (heldPrompt.current) { pendingFirstMessage.set(id, heldPrompt.current); heldPrompt.current = null; setHeldPromptText(null); }
      try { sessionStorage.setItem(key, id); localStorage.setItem(onboardingPhaseKey(account.owner, id), "name"); } catch { /* storage unavailable */ }
      setIntroThread(id);
      setFeatureThread(id);
    })();
  }, [routeFocus, threadsLoaded, account.prefsLoaded, account.statusLoaded, account.ghl.loading, initialQuestionsCompleted]);

  const startFirstTime = async () => {
    const id = await createThread("first_time", "First-time setup");
    if (!id) return;
    try { localStorage.setItem(onboardingPhaseKey(account.owner, id), "name"); } catch { /* in-memory intro still resets the phase */ }
    setIntroThread(id);
    setShowSlides(false);
  };

  const restartFirstTime = useCallback(() => {
    setSheetOpen(false);
    setExplicitNewChat(false);
    setIntroThread(null);
    setShowSlides(true);
    navigate(navigateWithParams("/app/copilot/first-time"));
  }, [navigate]);

  const touch = useCallback(async (id: string, title?: string) => {
    const patch: any = { updated_at: new Date().toISOString() };
    if (title) patch.title = title;
    await supabase.from("copilot_threads" as any).update(patch).eq("id", id);
    setThreads((ts) => [{ ...(ts.find((t) => t.id === id) as Thread), ...patch }, ...ts.filter((t) => t.id !== id)].filter(Boolean));
  }, []);

  const deleteThread = async (id: string) => {
    const { error } = await supabase.from("copilot_threads" as any).delete().eq("id", id);
    if (error) { toast.error("Couldn't delete that chat"); return; }
    const remaining = threads.filter((x) => x.id !== id);
    setThreads(remaining);
    if (threadId === id || pickedId === id) {
      const next = mostRecentThread(remaining);
      if (next) selectThread(next.id);
      else openNewChat();
    }
  };

  const activeId = routeFocus ? featureThread : isFirstTimeRoute ? (introThread || firstTimeThread?.id || null) : threadId || null;
  const activeKind = routeFocus || isFirstTimeRoute ? "first_time" : threads.find((t) => t.id === threadId)?.kind || "chat";

  const newChatFromComposer = async (text: string): Promise<void | "kept"> => {
    if (routeFocus && !activeId) {
      heldPrompt.current = text;
      setHeldPromptText(text);
      return;
    }
    const id = await createThread("chat", threadTitleFrom(text));
    if (!id) return "kept";
    pendingFirstMessage.set(id, text);
    selectThread(id);
  };

  const openSnapshot = async () => {
    const id = await ensureThread("chat", SNAPSHOT_CHAT_TITLE);
    if (!id) return;
    const existing = threads.some((thread) => thread.id === id);
    if (!existing) pendingFirstMessage.set(id, SNAPSHOT_CHAT_TITLE);
    selectThread(id);
  };

  const renderSidebar = () => (
    <div className="flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden p-3">
      {!embedded && !currentKitReturn(location.search) && <Link to="/app" className={cn(navRow, "mb-2 text-muted-foreground")}><ArrowLeft className="h-4 w-4" /> Back to SaaSSuite</Link>}
      <Button variant="outline" onClick={openNewChat} className="w-full justify-start gap-2.5 px-3"><PenSquare className="h-4 w-4 text-brand" /> New chat</Button>
      <p className="px-eyebrow mb-1 mt-5 px-3">Shortcuts</p>
      <FirstTimeMenu onResume={() => { setSheetOpen(false); setExplicitNewChat(false); setShowSlides(false); if (route.onCopilotPath) navigate("/app/copilot/first-time"); else navigate(navigateWithParams("/app/copilot/first-time")); }} onRestart={restartFirstTime} />
      <button type="button" className={navRow} onClick={() => { setSheetOpen(false); void openSnapshot(); }}><Package className="h-4 w-4 text-muted-foreground" />Snapshot{!/^(BASIC|ADVANCED|PREMIUM|ENHANCED)$/i.test(plan || "") && <Lock className="ml-auto h-3.5 w-3.5 text-muted-foreground" aria-label="Needs a paid plan" />}</button>
      <Link to="/book" className={navRow}><Calendar className="h-4 w-4 text-muted-foreground" />Book a call</Link>
      <p className="px-eyebrow mb-1 mt-5 px-3">Recent chats</p>
      <div className="min-h-0 min-w-0 flex-1 space-y-0.5 overflow-x-hidden overflow-y-auto overscroll-contain">
        {threadListError && (
          <div className="px-3 py-2" role="alert">
            <p className="text-sm text-destructive">{threadListError}</p>
            <button type="button" className="mt-1 text-sm font-medium text-brand underline-offset-4 hover:underline" onClick={() => void loadThreads()}>Try again</button>
          </div>
        )}
        {!threadsLoaded && <div className="space-y-2 px-3 py-1" aria-hidden="true"><div className="px-skeleton h-9 w-full" /><div className="px-skeleton h-9 w-4/5" /></div>}
        {visibleThreads.map((t) => {
          const current = t.id === activeId;
          return (
            <div key={t.id} className={cn("group relative flex w-full min-w-0 items-center overflow-hidden rounded-md transition-colors", current ? "bg-brand-subtle" : "hover:bg-muted")}>
              {current && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-brand" />}
              <button type="button" onClick={() => selectThread(t.id)} title={t.title || "New chat"} aria-current={current ? "page" : undefined}
                className="min-w-0 flex-1 rounded-md px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/40">
                <span className={cn("block truncate text-sm", current ? "font-medium text-brand" : "text-foreground")}>{t.title || "New chat"}</span>
                <span className="block truncate text-caption font-normal text-muted-foreground">{threadWhen(t.updated_at)}</span>
              </button>
              <Button variant="ghost" size="icon-sm" onClick={() => deleteThread(t.id)} aria-label={`Delete ${t.title}`} title="Delete chat" className="mr-1 shrink-0 text-muted-foreground opacity-60 hover:bg-transparent hover:text-destructive hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"><Trash2 className="h-4 w-4" /></Button>
            </div>
          );
        })}
        {threadsLoaded && !threadListError && visibleThreads.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">No chats yet. Ask anything to start one.</p>}
      </div>
      <div className="mt-2 border-t border-border pt-2">
        {renaming ? (
          <form className="flex gap-2 px-1" onSubmit={async (e) => { e.preventDefault(); await account.rename(nameDraft); setRenaming(false); toast.success("Name updated"); }}>
            <Input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} maxLength={40} aria-label="Assistant name" autoFocus />
            <Button size="icon" variant="accent" type="submit" aria-label="Save name"><Check className="h-4 w-4" /></Button>
          </form>
        ) : (
          <button type="button" onClick={() => { setNameDraft(account.assistantName); setRenaming(true); }} className={cn(navRow, "text-muted-foreground")}><Pencil className="h-4 w-4" /> <span className="min-w-0 truncate">Rename {account.assistantName}</span></button>
        )}
      </div>
    </div>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  );

  const activeTitle = activeId ? threads.find((t) => t.id === activeId)?.title || (activeKind === "first_time" ? "First-time setup" : "New chat") : "New chat";
  const showHistoryColumn = !embedded || presentation === "expanded";
  if (!email) return null;
  if (isFirstTimeRoute && showSlides) {
    return (
      <div className={cn("px-canvas text-foreground", embedded ? "h-full min-h-0 overflow-auto" : "min-h-[100dvh]")}>
        <IntroSlides onDone={startFirstTime} />
      </div>
    );
  }

  return (
    <div
      data-copilot-nav={docked ? (menuOpen ? "open" : "closed") : undefined}
      className={cn("px-canvas relative flex min-h-0 flex-1 overflow-hidden text-foreground", embedded ? "h-full" : "h-[100dvh]")}
    >
      {showHistoryColumn && <aside className="hidden h-full min-h-0 w-64 shrink-0 border-r border-border bg-card md:flex">{renderSidebar()}</aside>}
      {docked && menuOpen && (
        <aside data-copilot-sidebar="inline" className="flex h-full min-h-0 w-[224px] shrink-0 flex-col border-r border-border bg-card">
          {renderSidebar()}
        </aside>
      )}
      {!docked && (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="left" className="z-[70] w-72 bg-card p-0 pt-10"><SheetTitle className="sr-only">Chats</SheetTitle>{renderSidebar()}</SheetContent>
        </Sheet>
      )}
      <main className="flex min-w-0 flex-1 flex-col">
        <KitReturnLink placement="copilot" className="px-3 pt-[max(8px,env(safe-area-inset-top))]" />
        <header className="px-glass flex h-14 shrink-0 items-center gap-1 border-b border-border/70 px-2 sm:px-3">
          <button
            type="button"
            className={cn(iconButton, !docked && showHistoryColumn && "md:hidden", docked && menuOpen && "bg-brand-subtle text-brand hover:bg-brand-subtle hover:text-brand")}
            onClick={() => {
              if (docked) setMenuOpen((open) => !open);
              else setSheetOpen(true);
            }}
            aria-expanded={docked ? menuOpen : undefined}
            aria-label={docked && menuOpen ? "Close chats and shortcuts" : "Open chats and shortcuts"}
            title={docked && menuOpen ? "Hide chats" : "Chats and shortcuts"}
          >
            <PanelLeft className="h-[18px] w-[18px]" />
          </button>
          <CopilotMark size="sm" className="ml-1" />
          <div className="ml-1.5 min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-5 text-foreground">{account.assistantName}</p>
            <p className="truncate text-caption font-normal text-muted-foreground">{activeTitle}</p>
          </div>
          {!activeId && !embedded && <Button size="sm" variant="ghost" onClick={() => setHelpOpen(true)}><MessageCircle className="h-4 w-4" />Text us</Button>}
          {embedded && presentation === "dock" && (
            <button type="button" className={iconButton} onClick={onExpand} aria-label="Expand Copilot" title="Expand to full view">
              <Maximize2 className="h-4 w-4" />
            </button>
          )}
          {embedded && presentation === "expanded" && (
            <button type="button" className={iconButton} onClick={onCollapse} aria-label="Collapse Copilot to the side" title="Dock to the side">
              <Minimize2 className="h-4 w-4" />
            </button>
          )}
          {embedded && (
            <button type="button" className={iconButton} onClick={onClose} aria-label="Close Copilot" title="Close">
              <X className="h-4 w-4" />
            </button>
          )}
        </header>
        {activeId ? (
          <ChatView key={activeId} threadId={activeId} kind={activeKind} account={account} focus={focus} onVoice={() => setVoice(true)} compact={docked}
            runIntro={!!routeFocus || (isFirstTimeRoute && activeId === introThread)} onTouched={(title) => touch(activeId, title)} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-6 pb-[max(16px,env(safe-area-inset-bottom))]">
            <CopilotGreeting firstName={firstNameOf(user)} assistantName={account.assistantName} heading={docked ? "h2" : "h1"} compact={docked}>
              <div className="space-y-4 text-left">
                <Composer placeholder={composerPlaceholder(account.assistantName)} onSend={newChatFromComposer} onVoice={() => setVoice(true)} initialValue={readUnsentDraft()} />
                {heldPromptText
                  ? <p className="text-center text-sm text-muted-foreground">Got it. I'll send that as soon as this chat is ready.</p>
                  : <PromptChips prompts={STARTER_PROMPTS} onPick={(prompt) => void newChatFromComposer(prompt)} />}
              </div>
            </CopilotGreeting>
          </div>
        )}
      </main>
      <TextUsDialog open={helpOpen} onOpenChange={setHelpOpen} title="Need a hand?" description="Text our team for help with setup, billing, or anything you're stuck on." />
      {voice && (
        <div className={cn("px-canvas z-50", embedded ? "absolute inset-0" : "fixed inset-0")}>
          <CoPilotVoiceMode onExit={() => setVoice(false)} playOpener={false} />
        </div>
      )}
    </div>
  );
}
