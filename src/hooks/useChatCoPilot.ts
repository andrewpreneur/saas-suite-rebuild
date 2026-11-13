import { useCallback, useEffect, useRef } from "react";
import {
  useChatContext,
  ActionResult,
  ChatAttachment,
} from "@/components/chat-copilot/ChatContext";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  ChatSessionExpiredError,
  SESSION_EXPIRED_MESSAGE,
  classifyChatFailure,
  fetchChatCopilot,
  formatChatFailureDetail,
  readResponseErrorMessage,
} from "@/lib/chatCopilotAuth";
import { toast } from "sonner";
import { rememberUnsentDraft } from "@/lib/unsentDraft";
import {
  isExplicitAiResumeRequest,
  isQuietHandoverAck,
  latestTeamReplyAt,
  replyShouldStayWithHuman,
  teamReplyWithinQuietWindow,
} from "../../supabase/functions/chat-copilot/handoverQuiet";

export function useChatCoPilot() {
  const {
    messages,
    addMessage,
    isLoading,
    setIsLoading,
    isHandedOver,
    setIsHandedOver,
    aiResumedAt,
    noteHumanResumed,
    historyReady,
    discardMessage,
  } = useChatContext();
  const { email } = useUser();
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const emailRef = useRef(email);
  emailRef.current = email;
  const handedOverRef = useRef(isHandedOver);
  handedOverRef.current = isHandedOver;
  const aiResumedAtRef = useRef(aiResumedAt);
  aiResumedAtRef.current = aiResumedAt;
  const queued = useRef<Array<{ id: string; content: string; attachments?: ChatAttachment[] }>>([]);

  const deliver = useCallback(
    async (
      content: string,
      attachments?: ChatAttachment[],
    ): Promise<"session" | "error" | "ok" | "unsent"> => {
      const currentEmail = emailRef.current;
      if (!currentEmail) return "error";

      const thread = messagesRef.current;
      if (
        replyShouldStayWithHuman({
          isHandedOver: handedOverRef.current,
          hasRecentTeamReply: teamReplyWithinQuietWindow(thread),
          resumedAt: aiResumedAtRef.current,
          latestTeamReplyAt: latestTeamReplyAt(thread),
          text: content,
        })
      ) {
        setIsLoading(true);
        const { error } = await supabase.from("copilot_chat_messages").insert({
          owner_email: currentEmail.trim().toLowerCase(),
          role: "user",
          content,
          attachments: (attachments && attachments.length
            ? attachments.map((file) => ({
                url: file.url,
                name: file.name ?? null,
                mimeType: file.mimeType ?? null,
              }))
            : null) as Json,
        });
        if (!error) {
          setIsLoading(false);
          return "ok";
        }
        const rls = error.code === "42501" || /row-level security/i.test(error.message || "");
        if (!rls) {
          console.error("Human-thread reply failed", error);
          toast.error("Failed to send message. Please try again.");
          setIsLoading(false);
          return "unsent";
        }
        // Login-as / team admin JWT cannot insert the owner's row. The edge
        // function writes it with the service role and stays quiet while paused.
        setIsLoading(false);
      }

      setIsLoading(true);

      try {
        // Build messages array for API (exclude initial greeting, format for API)
        const history = messagesRef.current.filter((m) => m.id !== "initial");
        if (history.at(-1)?.role === "user" && history.at(-1)?.content === content) history.pop();
        const apiMessages = history.map((m) => ({ role: m.role, content: m.content }));

        // Add the new user message
        apiMessages.push({ role: "user", content });
        // Attachments are attached out-of-band; edge function will merge them
        // into the last user message as multimodal content blocks.

        const response = await fetchChatCopilot(
          {
            messages: apiMessages,
            userEmail: currentEmail,
            attachments: attachments && attachments.length ? attachments : undefined,
            page: typeof window === "undefined" ? undefined : window.location.pathname,
            humanOnly: handedOverRef.current && !isExplicitAiResumeRequest(content),
            mode:
              typeof window !== "undefined" &&
              (window.location.pathname.startsWith("/v2-onboarding") ||
                window.location.pathname.startsWith("/initial-questions"))
                ? "onboarding"
                : "app",
            client:
              typeof window === "undefined"
                ? { isMobile: false }
                : {
                    isMobile:
                      window.innerWidth < 768 ||
                      !!window.matchMedia?.("(pointer: coarse)")?.matches,
                    width: window.innerWidth,
                    height: window.innerHeight,
                  },
          },
          { auth: supabase.auth },
        );

        const failure = classifyChatFailure(response.status, "deliver");
        if (failure) {
          const serverMessage = await readResponseErrorMessage(response);
          toast.error(failure.toast, {
            description: formatChatFailureDetail(response.status, serverMessage),
          });
          if (response.status === 401) {
            rememberUnsentDraft(content);
            return "session";
          }
          if (failure.assistant) addMessage({ role: "assistant", content: failure.assistant });
          return "error";
        }

        const data = await response.json();

        if (data.error) {
          throw new Error(data.error);
        }

        // Pause acknowledgements are not the model. The customer's text is
        // already saved; showing the canned line makes the copilot look awake.
        if (isQuietHandoverAck(data)) {
          setIsHandedOver(true);
        } else {
          addMessage({
            role: "assistant",
            content: data.content,
            actions: data.actions as ActionResult[],
          });
          if (data.handover) setIsHandedOver(true);
          else if (isExplicitAiResumeRequest(content)) noteHumanResumed();
        }

        // If actions were executed, dispatch an event to refresh data
        if (data.actions && data.actions.length > 0) {
          window.dispatchEvent(new CustomEvent("user-settings-changed"));
        }
        return "ok";
      } catch (error) {
        if (error instanceof ChatSessionExpiredError) {
          toast.error(SESSION_EXPIRED_MESSAGE);
          addMessage({ role: "assistant", content: SESSION_EXPIRED_MESSAGE });
          rememberUnsentDraft(content);
          return "session";
        }
        console.error("Chat CoPilot error:", error);
        const message = error instanceof Error ? error.message : "";
        toast.error("Failed to send message. Please try again.", {
          description: message ? formatChatFailureDetail(0, message) : "HTTP 0",
        });
        addMessage({
          role: "assistant",
          content: "I'm sorry, I encountered an error. Please try again.",
        });
        return "error";
      } finally {
        setIsLoading(false);
      }
    },
    [addMessage, noteHumanResumed, setIsLoading, setIsHandedOver],
  );

  const flushQueued = useCallback(() => {
    if (!emailRef.current || !historyReady || isLoading) return;
    const next = queued.current.shift();
    if (!next) return;
    void deliver(next.content, next.attachments).then((outcome) => {
      if (outcome === "session" || outcome === "unsent") discardMessage(next.id);
    });
  }, [historyReady, isLoading, deliver, discardMessage]);

  useEffect(() => {
    flushQueued();
  }, [flushQueued]);

  const sendMessage = useCallback(
    async (content: string, attachments?: ChatAttachment[]): Promise<void | "kept"> => {
      const id = addMessage({ role: "user", content, attachments });
      if (!emailRef.current || !historyReady || isLoading) {
        queued.current.push({ id, content, attachments });
        return;
      }
      const outcome = await deliver(content, attachments);
      if (outcome === "session" || outcome === "unsent") {
        discardMessage(id);
        return "kept";
      }
    },
    [addMessage, discardMessage, historyReady, isLoading, deliver],
  );

  const requestHuman = useCallback(async () => {
    if (!email) {
      toast.error("You must be logged in to use the CoPilot");
      return;
    }
    setIsLoading(true);
    try {
      const last = [...messages].reverse().find((m) => m.role === "user" && m.id !== "initial");
      const response = await fetchChatCopilot(
        {
          requestHuman: true,
          userEmail: email,
          lastMessage: typeof last?.content === "string" ? last.content : "",
          messages: [{ role: "user", content: "Request a human" }],
        },
        { auth: supabase.auth },
      );
      const failure = classifyChatFailure(response.status, "human");
      if (failure) {
        const serverMessage = await readResponseErrorMessage(response);
        toast.error(failure.toast, {
          description: formatChatFailureDetail(response.status, serverMessage),
        });
        return;
      }
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      addMessage({
        role: "assistant",
        content: data.content || "I couldn't confirm the human-support request. Please text our team directly.\n[[widget:human_help]]",
      });
      if (data.handover === true) setIsHandedOver(true);
    } catch (error) {
      if (error instanceof ChatSessionExpiredError) {
        toast.error(SESSION_EXPIRED_MESSAGE);
        return;
      }
      console.error("Request a human error:", error);
      toast.error("Could not reach the team. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [messages, email, addMessage, setIsLoading, setIsHandedOver]);

  return {
    messages,
    sendMessage,
    requestHuman,
    isLoading,
    isHandedOver,
  };
}
