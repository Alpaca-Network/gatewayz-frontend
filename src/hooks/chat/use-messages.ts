'use client';

/**
 * useMessages Hook
 *
 * Manages chat messages for a session:
 * - Message loading and caching
 * - Optimistic message adding
 * - Streaming message updates
 * - Message deduplication (O(1) with Set)
 */

import { useState, useCallback, useRef } from 'react';
import {
  ChatMessage,
  UseMessagesReturn,
  MessagesApiResponse,
  toMessage,
  generateTempId,
  isTempId,
  MessageRole,
} from './types';
import { getApiKey } from '@/lib/auth';
import { getChatApiUrl } from '@/lib/config';

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_TIMEOUT = 10000; // 10 seconds

// Use dynamic endpoint for desktop (direct backend) vs web (Next.js API route)
const getSessionMessagesUrl = (sessionId: number) => getChatApiUrl(`/v1/chat/sessions/${sessionId}`);

// =============================================================================
// HELPER: Fetch with timeout
// =============================================================================

async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, { ...fetchOptions, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

// =============================================================================
// HOOK
// =============================================================================

interface UseMessagesOptions {
  sessionId?: number;
  onError?: (error: string) => void;
}

export function useMessages(options: UseMessagesOptions = {}): UseMessagesReturn {
  const { sessionId: initialSessionId, onError } = options;

  // State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track loaded sessions and message IDs for deduplication
  const loadedSessionsRef = useRef<Set<number>>(new Set());
  const messageIdsRef = useRef<Set<number | string>>(new Set());
  const currentSessionRef = useRef<number | null>(initialSessionId ?? null);

  // ===========================================================================
  // API HELPERS
  // ===========================================================================

  const getAuthHeaders = useCallback((): HeadersInit => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('Not authenticated');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };
  }, []);

  // ===========================================================================
  // ACTIONS
  // ===========================================================================

  const loadMessages = useCallback(async (sessionId: number): Promise<void> => {
    // Update current session
    currentSessionRef.current = sessionId;

    // Check if already loaded (cache hit)
    if (loadedSessionsRef.current.has(sessionId)) {
      // Filter to current session's messages
      setMessages(prev => prev.filter(m => m.sessionId === sessionId));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchWithTimeout(getSessionMessagesUrl(sessionId), {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to load messages: ${response.status}`);
      }

      const data = await response.json();
      const apiMessages = (data.messages || []) as MessagesApiResponse['messages'];

      // Convert and deduplicate
      const newMessages: ChatMessage[] = [];
      for (const apiMsg of apiMessages) {
        if (!messageIdsRef.current.has(apiMsg.id)) {
          const msg = toMessage(apiMsg);
          newMessages.push(msg);
          messageIdsRef.current.add(apiMsg.id);
        }
      }

      // Sort by created date
      newMessages.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      setMessages(newMessages);
      loadedSessionsRef.current.add(sessionId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load messages';
      setError(message);
      onError?.(message);
      console.error('[useMessages] Error loading:', err);
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeaders, onError]);

  const addMessage = useCallback((
    messageData: Omit<ChatMessage, 'id' | 'createdAt'>
  ): ChatMessage => {
    const tempId = generateTempId();
    const newMessage: ChatMessage = {
      ...messageData,
      id: tempId,
      createdAt: new Date().toISOString(),
      isPending: true,
    };

    // Add to deduplication set
    messageIdsRef.current.add(tempId);

    setMessages(prev => [...prev, newMessage]);

    // Save to backend asynchronously (fire-and-forget for user messages)
    if (messageData.role === 'user') {
      saveMessage(newMessage).catch(err => {
        console.error('[useMessages] Error saving message:', err);
      });
    }

    return newMessage;
  }, []);

  const saveMessage = async (message: ChatMessage): Promise<void> => {
    try {
      const response = await fetchWithTimeout(`${getSessionMessagesUrl(message.sessionId)}/messages`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          role: message.role,
          content: message.content,
          model: message.model,
          tokens: message.tokens,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save message: ${response.status}`);
      }

      const data = await response.json();
      const savedId = data.id || data.message_id;

      if (savedId) {
        // Update message with real ID
        setMessages(prev =>
          prev.map(m =>
            m.id === message.id
              ? { ...m, id: savedId, isPending: false }
              : m
          )
        );

        // Update deduplication sets
        messageIdsRef.current.delete(message.id);
        messageIdsRef.current.add(savedId);
      }
    } catch (err) {
      console.error('[useMessages] Failed to save message:', err);
      // Don't remove the message - it's still displayed but might need retry
    }
  };

  const updateMessage = useCallback((
    id: number | string,
    updates: Partial<ChatMessage>
  ): void => {
    setMessages(prev =>
      prev.map(m =>
        m.id === id
          ? { ...m, ...updates }
          : m
      )
    );
  }, []);

  const clearMessages = useCallback((): void => {
    setMessages([]);
    messageIdsRef.current.clear();
    if (currentSessionRef.current) {
      loadedSessionsRef.current.delete(currentSessionRef.current);
    }
  }, []);

  // ===========================================================================
  // STREAMING HELPERS
  // ===========================================================================

  const appendToLastMessage = useCallback((
    content: string,
    reasoning?: string
  ): void => {
    setMessages(prev => {
      if (prev.length === 0) return prev;

      const lastIndex = prev.length - 1;
      const lastMessage = prev[lastIndex];

      // Only update assistant messages that are streaming
      if (lastMessage.role !== 'assistant' || !lastMessage.isStreaming) {
        return prev;
      }

      const updated = [...prev];
      updated[lastIndex] = {
        ...lastMessage,
        content: lastMessage.content + content,
        reasoning: reasoning
          ? (lastMessage.reasoning || '') + reasoning
          : lastMessage.reasoning,
      };

      return updated;
    });
  }, []);

  const finalizeLastMessage = useCallback((tokens?: number): void => {
    setMessages(prev => {
      if (prev.length === 0) return prev;

      const lastIndex = prev.length - 1;
      const lastMessage = prev[lastIndex];

      if (lastMessage.role !== 'assistant') return prev;

      const updated = [...prev];
      updated[lastIndex] = {
        ...lastMessage,
        isStreaming: false,
        isPending: false,
        tokens,
      };

      // Save the finalized message to backend
      saveMessage(updated[lastIndex]).catch(err => {
        console.error('[useMessages] Error saving final message:', err);
      });

      return updated;
    });
  }, []);

  // ===========================================================================
  // RETURN
  // ===========================================================================

  return {
    // State
    messages,
    isLoading,
    error,

    // Actions
    loadMessages,
    addMessage,
    updateMessage,
    clearMessages,

    // Streaming
    appendToLastMessage,
    finalizeLastMessage,
  };
}
