/**
 * Chat Module Type Definitions
 *
 * Centralized types for the chat system including:
 * - Session types
 * - Message types
 * - Streaming types
 * - Hook return types
 */

// =============================================================================
// SESSION TYPES
// =============================================================================

export interface ChatSession {
  id: number;
  userId: number;
  title: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  messageCount?: number;
}

export interface SessionGroup {
  label: string;
  sessions: ChatSession[];
}

export type SessionSortOrder = 'newest' | 'oldest' | 'alphabetical';

// =============================================================================
// MESSAGE TYPES
// =============================================================================

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: number | string; // Can be temp ID (string) or server ID (number)
  sessionId: number;
  role: MessageRole;
  content: string | any[]; // Support rich content (text, images, video, audio)
  model?: string;
  tokens?: number;
  createdAt: string;
  // Streaming state
  isStreaming?: boolean;
  // Reasoning/thinking content (for models that support it)
  reasoning?: string;
  // Error state
  error?: string;
  // Optimistic update flag
  isPending?: boolean;
}

export interface MessageAttachment {
  type: 'image' | 'file';
  url: string;
  name: string;
  size?: number;
  mimeType?: string;
}

// =============================================================================
// STREAMING TYPES
// =============================================================================

export type StreamStatus =
  | 'idle'
  | 'connecting'
  | 'streaming'
  | 'completing'
  | 'complete'
  | 'error'
  | 'cancelled';

export interface StreamChunk {
  content?: string;
  reasoning?: string;
  done?: boolean;
  status?: 'rate_limit_retry' | 'first_token' | 'timing_info';
  retryAfterMs?: number;
  timingMetadata?: {
    firstTokenTime?: number;
    totalTime?: number;
    tokensPerSecond?: number;
  };
}

export interface StreamState {
  status: StreamStatus;
  content: string;
  reasoning: string;
  error: string | null;
  startTime: number | null;
  firstTokenTime: number | null;
  endTime: number | null;
}

// =============================================================================
// INPUT TYPES
// =============================================================================

export interface ChatInputState {
  message: string;
  attachments: MessageAttachment[];
  isSubmitting: boolean;
  error: string | null;
}

export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  contextLength: number;
  isFree: boolean;
  inputCost: number;
  outputCost: number;
}

// =============================================================================
// HOOK RETURN TYPES
// =============================================================================

export interface UseSessionsReturn {
  // State
  sessions: ChatSession[];
  activeSession: ChatSession | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  createSession: (title?: string, model?: string) => Promise<ChatSession | null>;
  selectSession: (sessionId: number) => void;
  updateSession: (sessionId: number, updates: Partial<Pick<ChatSession, 'title' | 'model'>>) => Promise<void>;
  deleteSession: (sessionId: number) => Promise<void>;
  refreshSessions: () => Promise<void>;

  // Computed
  groupedSessions: SessionGroup[];
}

export interface UseMessagesReturn {
  // State
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadMessages: (sessionId: number) => Promise<void>;
  addMessage: (message: Omit<ChatMessage, 'id' | 'createdAt'>) => ChatMessage;
  updateMessage: (id: number | string, updates: Partial<ChatMessage>) => void;
  clearMessages: () => void;

  // For streaming
  appendToLastMessage: (content: string, reasoning?: string) => void;
  finalizeLastMessage: (tokens?: number) => void;
}

export interface UseStreamingReturn {
  // State
  streamState: StreamState;
  isStreaming: boolean;

  // Actions
  startStream: (
    sessionId: number,
    messages: Array<{ role: MessageRole; content: string }>,
    model: string,
    onChunk: (chunk: StreamChunk) => void
  ) => Promise<void>;
  cancelStream: () => void;

  // Timing
  getTimingMetrics: () => {
    timeToFirstToken: number | null;
    totalTime: number | null;
    tokensPerSecond: number | null;
  };
}

export interface UseChatInputReturn {
  // State
  inputState: ChatInputState;

  // Actions
  setMessage: (message: string) => void;
  addAttachment: (attachment: MessageAttachment) => void;
  removeAttachment: (index: number) => void;
  clearInput: () => void;
  setError: (error: string | null) => void;

  // Validation
  canSubmit: boolean;
  validate: () => boolean;
}

export interface UseChatOrchestratorReturn {
  // Combined state
  sessions: UseSessionsReturn;
  messages: UseMessagesReturn;
  streaming: UseStreamingReturn;
  input: UseChatInputReturn;

  // Orchestration state
  isReady: boolean;
  isInitializing: boolean;
  initError: string | null;

  // High-level actions
  sendMessage: (content: string, model: string) => Promise<void>;
  startNewChat: (model?: string) => Promise<void>;
  switchSession: (sessionId: number) => Promise<void>;

  // Model
  selectedModel: string;
  setSelectedModel: (model: string) => void;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface SessionsApiResponse {
  sessions: Array<{
    id: number;
    user_id: number;
    title: string;
    model: string;
    created_at: string;
    updated_at: string;
    is_active: boolean;
    message_count?: number;
  }>;
  total?: number;
}

export interface MessagesApiResponse {
  messages: Array<{
    id: number;
    session_id: number;
    role: string;
    content: string;
    model?: string;
    tokens?: number;
    created_at: string;
  }>;
}

export interface ChatStatsApiResponse {
  total_sessions: number;
  total_messages: number;
  active_sessions: number;
  total_tokens: number;
}

// =============================================================================
// CHAT COMPLETION TYPES
// =============================================================================

export interface ChatCompletionRequest {
  model: string;
  messages: Array<{
    role: MessageRole;
    content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  }>;
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

// =============================================================================
// ERROR TYPES
// =============================================================================

export type ChatErrorCode =
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'AUTH_ERROR'
  | 'RATE_LIMIT'
  | 'MODEL_ERROR'
  | 'SESSION_ERROR'
  | 'STREAM_ERROR'
  | 'UNKNOWN';

export interface ChatError {
  code: ChatErrorCode;
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert API session response to ChatSession
 */
export function toSession(apiSession: SessionsApiResponse['sessions'][0]): ChatSession {
  return {
    id: apiSession.id,
    userId: apiSession.user_id,
    title: apiSession.title,
    model: apiSession.model,
    createdAt: apiSession.created_at,
    updatedAt: apiSession.updated_at,
    isActive: apiSession.is_active,
    messageCount: apiSession.message_count,
  };
}

/**
 * Convert API message response to ChatMessage
 */
export function toMessage(apiMessage: MessagesApiResponse['messages'][0]): ChatMessage {
  return {
    id: apiMessage.id,
    sessionId: apiMessage.session_id,
    role: apiMessage.role as MessageRole,
    content: apiMessage.content,
    model: apiMessage.model,
    tokens: apiMessage.tokens,
    createdAt: apiMessage.created_at,
  };
}

/**
 * Generate temporary message ID
 */
export function generateTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if message ID is temporary
 */
export function isTempId(id: number | string): boolean {
  return typeof id === 'string' && id.startsWith('temp_');
}

/**
 * Group sessions by date
 */
export function groupSessionsByDate(sessions: ChatSession[]): SessionGroup[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const groups: Record<string, ChatSession[]> = {
    'Today': [],
    'Yesterday': [],
    'Last 7 Days': [],
    'Last 30 Days': [],
    'Older': [],
  };

  for (const session of sessions) {
    const sessionDate = new Date(session.updatedAt);

    if (sessionDate >= today) {
      groups['Today'].push(session);
    } else if (sessionDate >= yesterday) {
      groups['Yesterday'].push(session);
    } else if (sessionDate >= lastWeek) {
      groups['Last 7 Days'].push(session);
    } else if (sessionDate >= lastMonth) {
      groups['Last 30 Days'].push(session);
    } else {
      groups['Older'].push(session);
    }
  }

  // Filter out empty groups and convert to array
  return Object.entries(groups)
    .filter(([, sessions]) => sessions.length > 0)
    .map(([label, sessions]) => ({ label, sessions }));
}

/**
 * Default stream state
 */
export function createInitialStreamState(): StreamState {
  return {
    status: 'idle',
    content: '',
    reasoning: '',
    error: null,
    startTime: null,
    firstTokenTime: null,
    endTime: null,
  };
}
