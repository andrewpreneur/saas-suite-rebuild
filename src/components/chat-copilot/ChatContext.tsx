import React, { createContext, useCallback, useContext, useState, ReactNode, useEffect } from 'react';
import { INITIAL_GREETING } from '@/constants/copilotSuggestions';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { computeCopilotOpener } from '@/lib/copilotOpener';
import { useViewerIdentity } from '@/hooks/useViewerIdentity';
import { mergeLoadedMessages } from '@/lib/copilotQueue';
import { messageIsTeamReply, teamReplyWithinQuietWindow } from '../../../supabase/functions/chat-copilot/handoverQuiet';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: ActionResult[];
  attachments?: ChatAttachment[];
  timestamp: Date;
}

export interface ActionResult {
  tool: string;
  args: Record<string, any>;
  message: string;
}

export interface ChatAttachment {
  url: string; // data URL or https URL
  name?: string;
  mimeType?: string;
}

interface ChatContextType {
  messages: ChatMessage[];
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => string;
  discardMessage: (id: string) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  clearMessages: () => void;
  userExchangeCount: number;
  isHandedOver: boolean;
  setIsHandedOver: (handedOver: boolean) => void;
  /** Set when the customer explicitly asks for the copilot back during a human thread. */
  aiResumedAt: number | null;
  noteHumanResumed: () => void;
  historyReady: boolean;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  // Build a route-aware opener at mount so the user sees a proactive suggestion
  // instead of a generic greeting. Rule-based → instant, no AI call.
  const initialOpener = (() => {
    try {
      const route = typeof window !== 'undefined' ? window.location.pathname : '/';
      return computeCopilotOpener({ plan: null, route });
    } catch {
      return { message: INITIAL_GREETING, suggestions: [] };
    }
  })();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'initial',
      role: 'assistant',
      content: initialOpener.message,
      timestamp: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isHandedOver, setIsHandedOver] = useState(false);
  const [aiResumedAt, setAiResumedAt] = useState<number | null>(null);
  const [historyReady, setHistoryReady] = useState(false);
  const noteHumanResumed = useCallback(() => {
    setAiResumedAt(Date.now());
    setIsHandedOver(false);
  }, []);
  const { email, plan } = useUser();
  const viewer = useViewerIdentity(null);

  // Once we know the plan, refresh the opener (only if user hasn't chatted yet)
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length !== 1 || prev[0].id !== 'initial') return prev;
      const route = typeof window !== 'undefined' ? window.location.pathname : '/';
      const opener = computeCopilotOpener({ plan, route });
      return [{ ...prev[0], content: opener.message }];
    });
  }, [plan]);

  // Fetch a lightweight account snapshot + first name, then rewrite the
  // initial opener with real numbers so it's personalized on every load.
  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: me } = await supabase
          .from('saas_suite_users')
          .select('full_name, plan, agency_id, agency_id_basic, agency_id_advanced, agency_id_elite, support_webhook_url, generated_css, primary_color')
          .ilike('email', email)
          .maybeSingle();
        if (cancelled || !me) return;
        const ownerFirst = ((me.full_name || '').trim().split(/\s+/)[0]) || null;
        const adminFirst = viewer.displayName.trim().split(/\s+/)[0] || null;
        const firstName = viewer.showsAccountAdmin ? adminFirst : ownerFirst;
        const agencyIds = [me.agency_id, me.agency_id_basic, me.agency_id_advanced, me.agency_id_elite].filter(Boolean) as string[];

        let totalUsers = 0, active7d = 0;
        if (agencyIds.length) {
          const iso7 = new Date(Date.now() - 7 * 86400000).toISOString();
          const { data: users } = await supabase
            .from('user_progress')
            .select('email, last_accessed')
            .in('agency_id', agencyIds);
          totalUsers = users?.length ?? 0;
          active7d = (users ?? []).filter((u: any) => u.last_accessed && u.last_accessed >= iso7).length;
        }

        let workflowsConfigured = 0;
        if (agencyIds.length) {
          const { data: wfs } = await supabase
            .from('workflows')
            .select('enabled, webhook_url')
            .in('agency_id', agencyIds);
          workflowsConfigured = (wfs ?? []).filter((w: any) => w.enabled && w.webhook_url).length;
        }

        const snapshot = {
          totalUsers,
          active7d,
          workflowsConfigured,
          brandingSet: !!(me.generated_css || me.primary_color),
          supportSet: !!me.support_webhook_url,
        };

        if (cancelled) return;
        setMessages((prev) => {
          if (prev.length !== 1 || prev[0].id !== 'initial') return prev;
          const route = typeof window !== 'undefined' ? window.location.pathname : '/';
          const opener = computeCopilotOpener({ plan: me.plan ?? plan, route, firstName, snapshot });
          return [{ ...prev[0], content: opener.message }];
        });
      } catch (e) {
        console.error('Copilot snapshot failed', e);
      }
    })();
    return () => { cancelled = true; };
  }, [email, plan, viewer.showsAccountAdmin, viewer.displayName]);

  // Load persisted CoPilot conversation on mount
  useEffect(() => {
    if (!email) { setHistoryReady(false); return; }
    let cancelled = false;
    setHistoryReady(false);
    (async () => {
      const { data: state, error: stateError } = await supabase.functions.invoke('chat-copilot', {
        body: { action: 'handover_status', userEmail: email.trim().toLowerCase() },
      });
      if (cancelled) return;
      setIsHandedOver(!stateError && state?.handover === true);
      setAiResumedAt(null);
      const { data, error } = await supabase
        .from('copilot_chat_messages')
        .select('id, role, content, actions, attachments, created_at')
        .eq('owner_email', email.trim().toLowerCase())
        .order('created_at', { ascending: true });
      if (cancelled) return;
      if (!error && data && data.length > 0) {
        const loaded: ChatMessage[] = data.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          actions: Array.isArray(m.actions) ? m.actions : undefined,
          attachments: Array.isArray(m.attachments) ? m.attachments : undefined,
          timestamp: new Date(m.created_at),
        }));
        setMessages((prev) => {
          const opener = prev.find((m) => m.id === 'initial');
          const rest = mergeLoadedMessages(loaded, prev.filter((message) => message.id !== 'initial'));
          return opener ? [opener, ...rest] : rest;
        });
        if (teamReplyWithinQuietWindow(loaded)) setIsHandedOver(true);
      }
      setHistoryReady(true);
    })();
    return () => { cancelled = true; };
  }, [email]);

  // Realtime: receive admin replies inserted directly into the DB
  useEffect(() => {
    if (!email) return;
    const ownerKey = email.toLowerCase();
    const channel = supabase
      .channel(`copilot-messages-${ownerKey}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'copilot_chat_messages',
          filter: `owner_email=eq.${ownerKey}`,
        },
        (payload) => {
          const m: any = payload.new;
          const isAdminReply = messageIsTeamReply({ role: m.role, actions: m.actions });
          if (!isAdminReply) return;
          setIsHandedOver(true);
          setMessages((prev) => {
            if (prev.some((x) => x.id === m.id)) return prev;
            return [
              ...prev,
              {
                id: m.id,
                role: m.role,
                content: m.content,
                actions: Array.isArray(m.actions) ? m.actions : undefined,
                timestamp: new Date(m.created_at),
              },
            ];
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [email]);

  // Count complete exchanges (user message followed by assistant response)
  const userExchangeCount = messages.filter((m, i) => {
    if (m.role !== 'user') return false;
    // Check if there's an assistant reply after this user message
    return messages.slice(i + 1).some(next => next.role === 'assistant');
  }).length;

  const addMessage = (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
    return newMessage.id;
  };

  const discardMessage = (id: string) => {
    setMessages((prev) => prev.filter((message) => message.id !== id));
  };

  const clearMessages = () => {
    setMessages([
      {
        id: 'initial',
        role: 'assistant',
        content: INITIAL_GREETING,
        timestamp: new Date(),
      },
    ]);
  };

  return (
    <ChatContext.Provider
      value={{
        messages,
        addMessage,
        discardMessage,
        isLoading,
        setIsLoading,
        clearMessages,
        userExchangeCount,
        isHandedOver,
        setIsHandedOver,
        aiResumedAt,
        noteHumanResumed,
        historyReady,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
}
