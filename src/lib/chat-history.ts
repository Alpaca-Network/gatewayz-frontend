// Chat History API Types and Interfaces
import { API_BASE_URL } from './config';

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
    this.privyUserId = privyUserId;
  }

  /**
   * Makes an authenticated API request
   * @private
   */
  private async makeRequest<T>(
    method: string,
    endpoint: string,
    body: any = null
  ): Promise<ApiResponse<T>> {
    const config: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
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

    const response = await fetch(url, config);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Creates a new chat session
   */
  async createSession(title?: string, model?: string): Promise<ChatSession> {
    const result = await this.makeRequest<ChatSession>('POST', '/sessions', { 
      title: title || `Chat ${new Date().toLocaleString()}`,
      model: model || 'openai/gpt-3.5-turbo'
    });
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
    let url = `${this.baseUrl}/sessions/${sessionId}/messages`;

    // Add privy_user_id to query string for consistency with other methods
    if (this.privyUserId) {
      const separator = url.includes('?') ? '&' : '?';
      url += `${separator}privy_user_id=${encodeURIComponent(this.privyUserId)}`;
    }

    console.log('ChatHistoryAPI.saveMessage - URL:', url);
    console.log('ChatHistoryAPI.saveMessage - Role:', role);
    console.log('ChatHistoryAPI.saveMessage - Content length:', content.length);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role,
        content,
        model: model || '',
        tokens: tokens || 0
      })
    });

    console.log('ChatHistoryAPI.saveMessage - Response status:', response.status);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('ChatHistoryAPI.saveMessage - Error response:', error);
      throw new Error(error.detail || `Failed to save message (${response.status}): ${response.statusText}`);
    }

    const result = await response.json();
    console.log('ChatHistoryAPI.saveMessage - Success');
    return result.data;
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
