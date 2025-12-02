'use client';

/**
 * useChatOrchestrator Hook
 *
 * The main orchestrator that coordinates all chat hooks:
 * - Manages initialization sequence
 * - Coordinates session, messages, streaming, and input
 * - Handles cross-cutting concerns (auth, URL params)
 * - Provides high-level chat actions
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { UseChatOrchestratorReturn, ChatMessage } from './types';
import { useSessions } from './use-sessions';
import { useMessages } from './use-messages';
import { useStreaming } from './use-streaming';
import { useChatInput } from './use-chat-input';
import { getApiKey } from '@/lib/auth';

// =============================================================================
// TYPES
// =============================================================================

type InitState = 'pending' | 'checking_auth' | 'loading_sessions' | 'ready' | 'error';

// =============================================================================
// HOOK
// =============================================================================

interface UseChatOrchestratorOptions {
  defaultModel?: string;
  onAuthRequired?: () => void;
  onError?: (error: string) => void;
}

export function useChatOrchestrator(
  options: UseChatOrchestratorOptions = {}
): UseChatOrchestratorReturn {
  const {
    defaultModel = 'deepseek/deepseek-r1',
    onAuthRequired,
    onError,
  } = options;

  const searchParams = useSearchParams();

  // ===========================================================================
  // INITIALIZATION STATE
  // ===========================================================================

  const [initState, setInitState] = useState<InitState>('pending');
  const [initError, setInitError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState(defaultModel);

  // Refs to prevent double initialization
  const initStartedRef = useRef(false);
  const autoSendTriggeredRef = useRef(false);

  // ===========================================================================
  // CHILD HOOKS
  // ===========================================================================

  const sessions = useSessions({
    onSessionChange: (session) => {
      if (session) {
        // Load messages when session changes
        messages.loadMessages(session.id);
        // Update model from session
        if (session.model) {
          setSelectedModel(session.model);
        }
      } else {
        messages.clearMessages();
      }
    },
  });

  const messages = useMessages({
    onError: (error) => {
      onError?.(error);
    },
  });

  const streaming = useStreaming({
    onError: (error) => {
      onError?.(error);
      // Update last message with error
      const lastMsg = messages.messages[messages.messages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant' && lastMsg.isStreaming) {
        messages.updateMessage(lastMsg.id, {
          isStreaming: false,
          error,
        });
      }
    },
    onComplete: () => {
      // Finalize the streamed message
      const metrics = streaming.getTimingMetrics();
      messages.finalizeLastMessage(
        metrics.tokensPerSecond ? Math.round(metrics.tokensPerSecond * (metrics.totalTime || 0) / 1000) : undefined
      );
    },
  });

  const input = useChatInput({
    onValidationError: onError,
  });

  // ===========================================================================
  // COMPUTED
  // ===========================================================================

  const isReady = initState === 'ready';
  const isInitializing = initState !== 'ready' && initState !== 'error';

  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================

  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    const initialize = async () => {
      setInitState('checking_auth');

      // Check authentication
      const apiKey = getApiKey();
      if (!apiKey) {
        setInitState('error');
        setInitError('Please log in to use the chat');
        onAuthRequired?.();
        return;
      }

      setInitState('loading_sessions');

      // Load sessions
      try {
        await sessions.refreshSessions();
      } catch (error) {
        console.error('[Orchestrator] Failed to load sessions:', error);
        // Don't fail initialization - user can still create new sessions
      }

      setInitState('ready');

      // Handle URL params (auto-send, model selection, etc.)
      handleUrlParams();
    };

    initialize();
  }, []);

  const handleUrlParams = useCallback(() => {
    if (autoSendTriggeredRef.current) return;

    // Check for model in URL
    const modelParam = searchParams?.get('model');
    if (modelParam) {
      setSelectedModel(modelParam);
    }

    // Check for auto-send message
    const messageParam = searchParams?.get('message') || searchParams?.get('q');
    if (messageParam && !autoSendTriggeredRef.current) {
      autoSendTriggeredRef.current = true;
      // Wait a tick for initialization to complete
      setTimeout(() => {
        sendMessage(messageParam, modelParam || selectedModel);
      }, 100);
    }
  }, [searchParams, selectedModel]);

  // ===========================================================================
  // HIGH-LEVEL ACTIONS
  // ===========================================================================

  const sendMessage = useCallback(async (
    content: string,
    model: string
  ): Promise<void> => {
    if (!content.trim()) return;

    // Ensure we have a session
    let session = sessions.activeSession;
    if (!session) {
      session = await sessions.createSession(
        content.slice(0, 50) + (content.length > 50 ? '...' : ''),
        model
      );
      if (!session) {
        onError?.('Failed to create chat session');
        return;
      }
    }

    // Add user message
    const userMessage = messages.addMessage({
      sessionId: session.id,
      role: 'user',
      content,
      model,
    });

    // Add placeholder assistant message
    const assistantMessage = messages.addMessage({
      sessionId: session.id,
      role: 'assistant',
      content: '',
      model,
      isStreaming: true,
    });

    // Clear input
    input.clearInput();

    // Start streaming
    const allMessages = messages.messages.filter(m => m.sessionId === session!.id);
    const messagesToSend = allMessages
      .filter(m => !m.isStreaming)
      .map(m => ({
        role: m.role,
        content: m.content,
      }));

    await streaming.startStream(
      session.id,
      messagesToSend,
      model,
      (chunk) => {
        if (chunk.content || chunk.reasoning) {
          messages.appendToLastMessage(chunk.content || '', chunk.reasoning);
        }
      }
    );
  }, [sessions, messages, input, streaming, onError]);

  const startNewChat = useCallback(async (model?: string): Promise<void> => {
    // Clear current state
    messages.clearMessages();
    input.clearInput();

    // Create new session
    const session = await sessions.createSession('New Chat', model || selectedModel);
    if (!session) {
      onError?.('Failed to create new chat');
    }
  }, [sessions, messages, input, selectedModel, onError]);

  const switchSession = useCallback(async (sessionId: number): Promise<void> => {
    // Cancel any active stream
    if (streaming.isStreaming) {
      streaming.cancelStream();
    }

    // Clear input
    input.clearInput();

    // Switch session (this will trigger message load via onSessionChange)
    sessions.selectSession(sessionId);
  }, [sessions, streaming, input]);

  // ===========================================================================
  // RETURN
  // ===========================================================================

  return {
    // Child hooks
    sessions,
    messages,
    streaming,
    input,

    // Orchestration state
    isReady,
    isInitializing,
    initError,

    // High-level actions
    sendMessage,
    startNewChat,
    switchSession,

    // Model
    selectedModel,
    setSelectedModel,
  };
}
