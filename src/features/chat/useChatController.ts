"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGatewayzAuth } from "@/context/gatewayz-auth-context";
import {
  ChatHistoryAPI,
  handleApiError,
  type ChatSession as ApiChatSession,
  type ChatMessage as ApiChatMessage,
} from "@/lib/chat-history";
import { streamChatResponse } from "@/lib/streaming";
import type { ModelOption } from "@/components/chat/model-select";

export type ChatSessionView = {
  id: string;
  apiId?: number;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessageView = {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  isStreaming?: boolean;
  createdAt: number;
};

const makeLocalId = (prefix: string) => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
};

const mapSession = (session: ApiChatSession): ChatSessionView => ({
  id: `api-${session.id}`,
  apiId: session.id,
  title: session.title || "Untitled chat",
  createdAt: session.created_at,
  updatedAt: session.updated_at,
});

const mapMessage = (message: ApiChatMessage): ChatMessageView => ({
  id: `api-msg-${message.id ?? makeLocalId("msg")}`,
  role: message.role,
  content: Array.isArray(message.content) ? JSON.stringify(message.content) : message.content,
  model: message.model,
  createdAt: Date.parse(message.created_at ?? "") || Date.now(),
});

type ControllerState = {
  sessions: ChatSessionView[];
  activeSessionId: string | null;
  messagesBySession: Record<string, ChatMessageView[]>;
  loadingSessions: boolean;
  loadingMessages: boolean;
  sending: boolean;
  error: string | null;
};

const initialState: ControllerState = {
  sessions: [],
  activeSessionId: null,
  messagesBySession: {},
  loadingSessions: false,
  loadingMessages: false,
  sending: false,
  error: null,
};

export function useChatController() {
  const { status, apiKey, userData, refresh } = useGatewayzAuth();
  const [state, setState] = useState<ControllerState>(initialState);
  const hydratedRef = useRef(false);

  const chatApi = useMemo(() => {
    if (!apiKey) return null;
    return new ChatHistoryAPI(apiKey, undefined, userData?.privy_user_id);
  }, [apiKey, userData?.privy_user_id]);

  const setError = useCallback((message: string | null) => {
    setState((prev) => ({ ...prev, error: message }));
  }, []);

  const setMessages = useCallback((sessionId: string, updater: (messages: ChatMessageView[]) => ChatMessageView[]) => {
    setState((prev) => ({
      ...prev,
      messagesBySession: {
        ...prev.messagesBySession,
        [sessionId]: updater(prev.messagesBySession[sessionId] ?? []),
      },
    }));
  }, []);

  const loadSessions = useCallback(async () => {
    if (!chatApi) return;
    setState((prev) => ({ ...prev, loadingSessions: true }));

    try {
      const sessions = await chatApi.getSessionsWithCache(50, 0);
      const mapped = sessions.map(mapSession);
      setState((prev) => ({
        ...prev,
        sessions: mapped,
        loadingSessions: false,
        activeSessionId: prev.activeSessionId ?? mapped[0]?.id ?? null,
      }));
    } catch (error) {
      setError(handleApiError(error));
      setState((prev) => ({ ...prev, loadingSessions: false }));
    } finally {
      hydratedRef.current = true;
    }
  }, [chatApi, setError]);

  const loadMessagesForSession = useCallback(async (sessionId: string) => {
    if (!chatApi) return;
    const session = state.sessions.find((s) => s.id === sessionId);
    if (!session?.apiId) return;

    // Already loaded
    if (state.messagesBySession[sessionId]) return;

    setState((prev) => ({ ...prev, loadingMessages: true }));
    try {
      const fullSession = await chatApi.getSession(session.apiId);
      const messages = (fullSession.messages ?? []).map(mapMessage);
      setMessages(sessionId, () => messages);
    } catch (error) {
      setError(handleApiError(error));
    } finally {
      setState((prev) => ({ ...prev, loadingMessages: false }));
    }
  }, [chatApi, setMessages, setError, state.messagesBySession, state.sessions]);

  // Hydrate session list when auth is ready
  useEffect(() => {
    if (status !== "authenticated" || !chatApi) return;
    if (hydratedRef.current) return;
    loadSessions();
  }, [chatApi, loadSessions, status]);

  const ensureSession = useCallback(async () => {
    if (!chatApi) {
      throw new Error("Chat API is not ready – try logging in again.");
    }

    const active = state.sessions.find((s) => s.id === state.activeSessionId);
    if (active) {
      return active;
    }

    const apiSession = await chatApi.createSession("New chat");
    const mapped = mapSession(apiSession);
    setState((prev) => ({
      ...prev,
      sessions: [mapped, ...prev.sessions],
      activeSessionId: mapped.id,
    }));
    setMessages(mapped.id, () => []);
    return mapped;
  }, [chatApi, setMessages, state.activeSessionId, state.sessions]);

  const selectSession = useCallback((sessionId: string) => {
    setState((prev) => ({ ...prev, activeSessionId: sessionId }));
    void loadMessagesForSession(sessionId);
  }, [loadMessagesForSession]);

  const createSession = useCallback(async () => {
    if (!chatApi) {
      setError("Chat API is not ready yet.");
      return null;
    }
    const apiSession = await chatApi.createSession("New chat");
    const mapped = mapSession(apiSession);
    setState((prev) => ({
      ...prev,
      sessions: [mapped, ...prev.sessions],
      activeSessionId: mapped.id,
    }));
    setMessages(mapped.id, () => []);
    return mapped;
  }, [chatApi, setError, setMessages]);

  const renameSession = useCallback(async (sessionId: string, title: string) => {
    if (!chatApi) return;
    const session = state.sessions.find((s) => s.id === sessionId);
    if (!session?.apiId) return;
    try {
      await chatApi.updateSession(session.apiId, title);
      setState((prev) => ({
        ...prev,
        sessions: prev.sessions.map((s) =>
          s.id === sessionId ? { ...s, title, updatedAt: new Date().toISOString() } : s
        ),
      }));
    } catch (error) {
      setError(handleApiError(error));
    }
  }, [chatApi, setError, state.sessions]);

  const deleteSession = useCallback(async (sessionId: string) => {
    if (!chatApi) return;
    const session = state.sessions.find((s) => s.id === sessionId);
    if (!session?.apiId) return;
    try {
      await chatApi.deleteSession(session.apiId);
      setState((prev) => {
        const filtered = prev.sessions.filter((s) => s.id !== sessionId);
        const nextActive = prev.activeSessionId === sessionId ? filtered[0]?.id ?? null : prev.activeSessionId;
        const { [sessionId]: _removed, ...rest } = prev.messagesBySession;
        return {
          ...prev,
          sessions: filtered,
          activeSessionId: nextActive,
          messagesBySession: rest,
        };
      });
    } catch (error) {
      setError(handleApiError(error));
    }
  }, [chatApi, setError, state.sessions]);

  const sendMessage = useCallback(async (content: string, model: ModelOption | null) => {
    if (!chatApi || !apiKey) {
      setError("You are not fully authenticated. Please sign in again.");
      return;
    }

    const trimmed = content.trim();
    if (!trimmed) return;

    setState((prev) => ({ ...prev, sending: true, error: null }));

    try {
      const session = await ensureSession();
      await loadMessagesForSession(session.id);

      const modelId = model?.value ?? "fireworks/deepseek-r1";
      const history = state.messagesBySession[session.id] ?? [];

      const userMessage: ChatMessageView = {
        id: makeLocalId("user"),
        role: "user",
        content: trimmed,
        model: modelId,
        createdAt: Date.now(),
      };

      const assistantMessage: ChatMessageView = {
        id: makeLocalId("assistant"),
        role: "assistant",
        content: "",
        model: modelId,
        isStreaming: true,
        createdAt: Date.now(),
      };

      setMessages(session.id, (msgs) => [...msgs, userMessage, assistantMessage]);

      // Persist the user message in the background
      void chatApi.saveMessage(session.apiId!, "user", trimmed, modelId).catch((err) => {
        console.warn("Failed to persist user message", err);
      });

      const payload = {
        model: modelId,
        messages: [...history, userMessage].map((m) => ({ role: m.role, content: m.content })),
        stream: true,
      };

      let assembled = "";

      for await (const chunk of streamChatResponse("/api/chat/completions", apiKey, payload)) {
        if (chunk.content) {
          assembled += chunk.content;
          const contentCopy = assembled;
          setMessages(session.id, (msgs) =>
            msgs.map((m) => (m.id === assistantMessage.id ? { ...m, content: contentCopy } : m))
          );
        }

        if (chunk.done) {
          break;
        }
      }

      // Finalize assistant message
      setMessages(session.id, (msgs) =>
        msgs.map((m) => (m.id === assistantMessage.id ? { ...m, content: assembled, isStreaming: false } : m))
      );

      // Persist assistant message in the background
      void chatApi.saveMessage(session.apiId!, "assistant", assembled, modelId).catch((err) => {
        console.warn("Failed to persist assistant message", err);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setError(message);

      // If the backend complains about auth, trigger a refresh
      if (message.toLowerCase().includes("auth") || message.includes("401")) {
        void refresh({ force: true });
      }

      // Surface the error in the thread for visibility
      const sessionId = state.activeSessionId;
      if (sessionId) {
        setMessages(sessionId, (msgs) => [
          ...msgs,
          {
            id: makeLocalId("error"),
            role: "assistant",
            content: `⚠️ ${message}`,
            createdAt: Date.now(),
          },
        ]);
      }
    } finally {
      setState((prev) => ({ ...prev, sending: false }));
    }
  }, [apiKey, chatApi, ensureSession, loadMessagesForSession, refresh, setMessages, setError, state.activeSessionId, state.messagesBySession]);

  const activeSession = state.sessions.find((s) => s.id === state.activeSessionId) ?? null;
  const activeMessages = activeSession ? state.messagesBySession[activeSession.id] ?? [] : [];

  return {
    ready: status === "authenticated" && !!apiKey,
    ...state,
    activeSession,
    messages: activeMessages,
    loadSessions,
    selectSession,
    createSession,
    renameSession,
    deleteSession,
    sendMessage,
    clearError: () => setError(null),
  };
}

