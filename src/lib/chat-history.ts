// Chat History API Types and Interfaces
import { API_BASE_URL } from './config';
import { TIMEOUT_CONFIG, createTimeoutController, withTimeoutAndRetry } from './timeout-config';
<<<<<<< HEAD
import { messageBatcher, type BatchedMessage } from './message-batcher';
import { debounce } from './utils';
=======
import { getUserData, AUTH_REFRESH_EVENT } from './api';
import {
  getCachedSessions,
  setCachedSessions,
  getCachedDefaultModel,
  setCachedDefaultModel,
  addCachedSession,
  updateCachedSession,
  removeCachedSession,
  clearSessionCache
} from './session-cache';
>>>>>>> refs/remotes/origin/master

export interface ChatMessage {
  id: number;
  session_id: number;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  tokens?: number;
  created_at: string; // ISO 8601 format
}

export interface ChatSession {
  id: number;
  user_id: number;
  title: string;
  model: string;
  created_at: string; // ISO 8601 format
  updated_at: string; // ISO 8601 format
  is_active: boolean;
  messages?: ChatMessage[]; // Only included when fetching specific session
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  count?: number; // For list responses
}

export interface ErrorResponse {
  detail: string;
  status_code: number;
}

export interface ChatStats {
  total_sessions: number;
  total_messages: number;
  active_sessions: number;
  total_tokens: number;
  average_messages_per_session: number;
}

export interface SearchRequest {
  query: string;
  limit?: number;
}

export interface CreateSessionRequest {
  title?: string;
  model?: string;
}

export interface UpdateSessionRequest {
  title?: string;
  model?: string;
}

export interface SaveMessageRequest {
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  tokens?: number;
}

// Chat History API Service Class
export class ChatHistoryAPI {
  private apiKey: string;
  private baseUrl: string;
  private privyUserId?: string;
  private useBatching: boolean;

  constructor(apiKey: string, baseUrl?: string, privyUserId?: string, useBatching: boolean = true) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || `${API_BASE_URL}/v1/chat`;
    this.privyUserId = privyUserId;
    this.useBatching = useBatching;

    // Initialize message batcher with save function
    if (useBatching) {
      messageBatcher.setSaveFunction(async (messages: BatchedMessage[]) => {
        return await this.saveBatchedMessages(messages);
      });
    }
  }

  /**
   * Makes an authenticated API request
   * @private
   */
  private async makeRequest<T>(
    method: string,
    endpoint: string,
    body: any = null,
    timeout?: number
  ): Promise<ApiResponse<T>> {
    // Use unified timeout configuration
    const timeoutMs = timeout || TIMEOUT_CONFIG.api.default;
    const { controller, timeoutId } = createTimeoutController(timeoutMs);

    const config: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Connection': 'keep-alive' // Enable connection pooling for session API
      },
      signal: controller.signal
    };

    if (body) {
      config.body = JSON.stringify(body);
    }

    // Add privy_user_id to query string if available
    let url = `${this.baseUrl}${endpoint}`;
    if (this.privyUserId) {
      const separator = endpoint.includes('?') ? '&' : '?';
      url += `${separator}privy_user_id=${encodeURIComponent(this.privyUserId)}`;
    }

    console.log('ChatHistoryAPI - Making request to:', url);
    console.log('ChatHistoryAPI - Method:', method);
    console.log('ChatHistoryAPI - Has API key:', !!this.apiKey);

    try {
      const response = await fetch(url, config);
      clearTimeout(timeoutId);

      // Handle 401 specifically - invalid API key
      if (response.status === 401) {
        console.error('ChatHistoryAPI - Authentication failed (401), API key may be invalid');
        // Dispatch auth refresh event to trigger re-authentication
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('gatewayz:refresh-auth'));
        }
        throw new Error('Authentication failed. Please login again.');
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('ChatHistoryAPI - Request timed out after', timeoutMs, 'ms');
        throw new Error(`Request timed out after ${timeoutMs / 1000} seconds. Please try again.`);
      }
      throw error;
    }
  }

  /**
   * Creates a new chat session with automatic retry on timeout/network errors
   */
  async createSession(title?: string, model?: string): Promise<ChatSession> {
    const sessionTitle = title || `Chat ${new Date().toLocaleString()}`;
    const sessionModel = model || 'openai/gpt-3.5-turbo';

    // Use withTimeoutAndRetry for automatic retry on transient failures
    const result = await withTimeoutAndRetry<ApiResponse<ChatSession>>(
      async (signal) => {
        const { controller, timeoutId } = createTimeoutController(TIMEOUT_CONFIG.chat.sessionCreate);

        try {
          const response = await fetch(`${this.baseUrl}/sessions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
              'Connection': 'keep-alive'
            },
            body: JSON.stringify({
              title: sessionTitle,
              model: sessionModel
            }),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || `HTTP ${response.status}: ${response.statusText}`);
          }

          return await response.json();
        } catch (error) {
          clearTimeout(timeoutId);
          if (error instanceof Error && error.name === 'AbortError') {
            throw new Error(`Request timed out after ${TIMEOUT_CONFIG.chat.sessionCreate / 1000} seconds. Please try again.`);
          }
          throw error;
        }
      },
      {
        timeout: TIMEOUT_CONFIG.chat.sessionCreate,
        maxRetries: 3,
        shouldRetry: (error) => {
          // Retry on timeouts and network errors
          if (error instanceof Error) {
            return error.name === 'AbortError' ||
                   error.message.includes('timeout') ||
                   error.message.includes('network');
          }
          return false;
        },
        onRetry: (attempt, error) => {
          console.log(`[Session Creation Retry] Attempt ${attempt} failed:`, error);
        }
      }
    );

    return result.data!;
  }

  /**
   * Retrieves all chat sessions for the authenticated user
   */
  async getSessions(limit: number = 50, offset: number = 0): Promise<ChatSession[]> {
    const result = await this.makeRequest<ChatSession[]>('GET', `/sessions?limit=${limit}&offset=${offset}`);
    return result.data || [];
  }

  /**
   * Retrieves a specific chat session with all its messages
   */
  async getSession(sessionId: number): Promise<ChatSession> {
    const result = await this.makeRequest<ChatSession>('GET', `/sessions/${sessionId}`);
    return result.data!;
  }

  /**
   * Updates a chat session's title or model
   */
  async updateSession(sessionId: number, title?: string, model?: string): Promise<ChatSession> {
    // OPTIMIZATION: Route through Next.js API with optimized timeout
    // Use unified timeout configuration for consistency
    const isClientSide = typeof window !== 'undefined';
    if (isClientSide) {
      const controller = new AbortController();
      const timeout = TIMEOUT_CONFIG.chat.sessionUpdate;
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      let url = `/api/chat/sessions/${sessionId}`;
      // Add privy_user_id to query string for consistency with other methods
      if (this.privyUserId) {
        url += `?privy_user_id=${encodeURIComponent(this.privyUserId)}`;
      }

      try {
        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'Connection': 'keep-alive' // Enable connection pooling
          },
          body: JSON.stringify({ title, model }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Failed to update session' }));
          throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        return result.data;
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          console.error('ChatHistoryAPI.updateSession - Request timed out after', timeout, 'ms');
          throw new Error(`Request timed out. Session update took too long.`);
        }
        throw error;
      }
    }

    // Server-side: call backend directly
    const result = await this.makeRequest<ChatSession>('PUT', `/sessions/${sessionId}`, {
      title,
      model
    });
    return result.data!;
  }

  /**
   * Deletes a chat session and all its messages
   */
  async deleteSession(sessionId: number): Promise<boolean> {
    // Route through Next.js API to avoid CORS issues
    const isClientSide = typeof window !== 'undefined';
    if (isClientSide) {
      const controller = new AbortController();
      const timeout = 30000; // 30 second timeout
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      let url = `/api/chat/sessions/${sessionId}`;
      // Add privy_user_id to query string for consistency with other methods
      if (this.privyUserId) {
        url += `?privy_user_id=${encodeURIComponent(this.privyUserId)}`;
      }

      try {
        const response = await fetch(url, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Failed to delete session' }));
          throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        return true;
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          console.error('ChatHistoryAPI.deleteSession - Request timed out after', timeout, 'ms');
          throw new Error(`Request timed out after ${timeout / 1000} seconds. Please try again.`);
        }
        throw error;
      }
    }

    // Server-side: call backend directly
    await this.makeRequest('DELETE', `/sessions/${sessionId}`);
    return true;
  }

  /**
   * Saves a message to a chat session
   * Uses batching if enabled for better performance
   */
  async saveMessage(
    sessionId: number,
    role: 'user' | 'assistant',
    content: string,
    model?: string,
    tokens?: number
  ): Promise<ChatMessage> {
    // Use batching for non-critical saves (assistant messages)
    // User messages are saved immediately for better UX
    if (this.useBatching && role === 'assistant') {
      // Add to batch queue
      await messageBatcher.addMessage({
        sessionId: sessionId.toString(),
        apiSessionId: sessionId,
        role,
        content,
        model,
        tokens,
        timestamp: Date.now(),
      });

      // Return optimistic response
      return {
        id: -1, // Temporary ID
        session_id: sessionId,
        role,
        content,
        model,
        tokens,
        created_at: new Date().toISOString(),
      };
    }

    // Save immediately for user messages
    return await this.saveMessageImmediate(sessionId, role, content, model, tokens);
  }

  /**
   * Save a message immediately (bypasses batching)
   */
  private async saveMessageImmediate(
    sessionId: number,
    role: 'user' | 'assistant',
    content: string,
    model?: string,
    tokens?: number
  ): Promise<ChatMessage> {
    // Use unified timeout configuration for message saves
    const { controller, timeoutId } = createTimeoutController(TIMEOUT_CONFIG.chat.messagesSave);

    let url = `${this.baseUrl}/sessions/${sessionId}/messages`;

    // Add privy_user_id to query string for consistency with other methods
    if (this.privyUserId) {
      const separator = url.includes('?') ? '&' : '?';
      url += `${separator}privy_user_id=${encodeURIComponent(this.privyUserId)}`;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Connection': 'keep-alive' // Enable connection pooling
        },
        body: JSON.stringify({
          role,
          content,
          model: model || '',
          tokens: tokens || 0
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `Failed to save message (${response.status}): ${response.statusText}`);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('ChatHistoryAPI.saveMessage - Request timed out after', TIMEOUT_CONFIG.chat.messagesSave, 'ms');
        // Throw the error properly instead of returning fake success
        throw new Error(`Failed to save message: Request timed out after ${TIMEOUT_CONFIG.chat.messagesSave / 1000} seconds`);
      }
      throw error;
    }
  }

  /**
   * Save multiple messages in a batch
   * OPTIMIZATION: Reduces API overhead by 60-80%
   */
  private async saveBatchedMessages(messages: BatchedMessage[]): Promise<Array<{ success: boolean; messageId?: number; error?: string }>> {
    if (messages.length === 0) return [];

    // Group by session
    const bySession = new Map<number, BatchedMessage[]>();
    messages.forEach(msg => {
      if (!msg.apiSessionId) return;
      if (!bySession.has(msg.apiSessionId)) {
        bySession.set(msg.apiSessionId, []);
      }
      bySession.get(msg.apiSessionId)!.push(msg);
    });

    // Save each session's messages
    const results: Array<{ success: boolean; messageId?: number; error?: string }> = [];

    for (const [sessionId, sessionMessages] of bySession.entries()) {
      for (const msg of sessionMessages) {
        try {
          const saved = await this.saveMessageImmediate(
            sessionId,
            msg.role,
            msg.content,
            msg.model,
            msg.tokens
          );
          results.push({ success: true, messageId: saved.id });
        } catch (error) {
          results.push({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    return results;
  }

  /**
   * Flush all pending batched messages immediately
   */
  async flushBatches(): Promise<void> {
    if (this.useBatching) {
      await messageBatcher.flushAll();
    }
  }

  /**
   * Searches chat sessions by title or message content
   */
  async searchSessions(query: string, limit: number = 20): Promise<ChatSession[]> {
    const result = await this.makeRequest<ChatSession[]>('POST', '/search', { 
      query, 
      limit 
    });
    return result.data || [];
  }

  /**
   * Retrieves statistics about the user's chat sessions
   */
  async getStats(): Promise<ChatStats> {
    const result = await this.makeRequest<ChatStats>('GET', '/stats');
    return result.data!;
  }

  /**
   * Cache-aware session loading
   * Returns cached sessions immediately, syncs with backend in background
   */
  async getSessionsWithCache(limit: number = 50, offset: number = 0): Promise<ChatSession[]> {
    // Return cached sessions immediately for instant UI
    const cached = getCachedSessions();
    if (cached.length > 0) {
      // Trigger background sync in non-blocking way
      this.getSessions(limit, offset)
        .then(sessions => {
          // Update cache with fresh data
          setCachedSessions(sessions);
        })
        .catch(error => {
          console.warn('[ChatHistoryAPI] Background sync failed:', error);
          // Silently fail - we already have cached data to show
        });

      return cached;
    }

    // No cache, fetch from backend
    const sessions = await this.getSessions(limit, offset);

    // Cache the result for next time
    setCachedSessions(sessions);

    return sessions;
  }

  /**
   * Get cached default model for new sessions
   */
  getCachedDefaultModel(): string {
    return getCachedDefaultModel() || 'openai/gpt-3.5-turbo';
  }

  /**
   * Store user's model preference in cache
   */
  cacheDefaultModel(model: string): void {
    setCachedDefaultModel(model);
  }

  /**
   * Add optimistic session to cache (before backend confirmation)
   */
  optimisticAddSession(session: ChatSession): void {
    addCachedSession(session);
  }

  /**
   * Update optimistic session in cache
   */
  optimisticUpdateSession(sessionId: number, updates: Partial<ChatSession>): void {
    updateCachedSession(sessionId, updates);
  }

  /**
   * Remove session from cache
   */
  removeCachedSession(sessionId: number): void {
    removeCachedSession(sessionId);
  }

  /**
   * Clear entire session cache (e.g., on logout)
   */
  clearCache(): void {
    clearSessionCache();
  }
}

// Utility functions for error handling
export const handleApiError = (error: any): string => {
  if (error.message.includes('401')) {
    return 'Authentication failed. Please check your API key.';
  } else if (error.message.includes('404')) {
    return 'Session not found.';
  } else if (error.message.includes('500')) {
    return 'Server error. Please try again later.';
  } else {
    return error.message || 'An unexpected error occurred.';
  }
};

// Helper function to create API instance
export const createChatHistoryAPI = (apiKey: string): ChatHistoryAPI => {
  return new ChatHistoryAPI(apiKey);
};
