// Chat History API Types and Interfaces
import { API_BASE_URL } from './config';
import { TIMEOUT_CONFIG, createTimeoutController, withTimeoutAndRetry } from './timeout-config';
import { getUserData, AUTH_REFRESH_EVENT } from './api';

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

  constructor(apiKey: string, baseUrl?: string, privyUserId?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || `${API_BASE_URL}/v1/chat`;

    // If Privy ID not provided, try to get from user data
    if (!privyUserId) {
      try {
        const userData = getUserData();
        this.privyUserId = userData?.privy_user_id;
      } catch (error) {
        console.warn('[ChatHistoryAPI] Failed to retrieve Privy user ID from user data:', error);
      }
    } else {
      this.privyUserId = privyUserId;
    }

    if (this.privyUserId) {
      console.log('[ChatHistoryAPI] Initialized with Privy user ID');
    } else {
      console.warn('[ChatHistoryAPI] No Privy user ID available');
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

      // Handle 401 specifically - may indicate invalid API key or temporary backend issue
      if (response.status === 401) {
        console.error('ChatHistoryAPI - Authentication failed (401), API key may be invalid or expired');
        // Dispatch auth refresh event to trigger re-authentication attempt
        // This allows the auth context to try refreshing before clearing credentials
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event(AUTH_REFRESH_EVENT));
        }
        throw new Error('Session authentication failed. Attempting to refresh...');
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
   * Creates a new chat session
   */
  async createSession(title?: string, model?: string): Promise<ChatSession> {
    const result = await this.makeRequest<ChatSession>('POST', '/sessions', {
      title: title || `Chat ${new Date().toLocaleString()}`,
      model: model || 'openai/gpt-3.5-turbo'
    }, TIMEOUT_CONFIG.chat.sessionCreate);
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
    // Reduced timeout from 30s to 10s for quick session updates
    // These calls should be fast and not block user interactions
    const isClientSide = typeof window !== 'undefined';
    if (isClientSide) {
      const controller = new AbortController();
      const timeout = 10000; // OPTIMIZATION: Reduced from 30s to 10s
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
   */
  async saveMessage(
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
