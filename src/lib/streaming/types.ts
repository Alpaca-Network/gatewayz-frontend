/**
 * Streaming Types
 *
 * Type definitions for the streaming module.
 */

/**
 * Tool call from the model.
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Result of executing a tool.
 */
export interface ToolResult {
  tool_call_id: string;
  name: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

/**
 * A chunk of streamed content from the chat API.
 */
export interface StreamChunk {
  /** Text content from the model */
  content?: string;

  /** Chain-of-thought reasoning content */
  reasoning?: string;

  /** Whether this is the final chunk */
  done?: boolean;

  /** Status indicator for special events */
  status?: 'rate_limit_retry' | 'first_token' | 'timing_info';

  /** Retry delay in ms when rate limited */
  retryAfterMs?: number;

  /** Performance timing metadata */
  timingMetadata?: {
    backendTimeMs?: number;
    networkTimeMs?: number;
    totalTimeMs?: number;
  };

  /** Type of chunk for tool calling events */
  type?: 'tool_call' | 'tool_result';

  /** Tool call being executed (type === 'tool_call') */
  toolCall?: ToolCall;

  /** Tool execution result (type === 'tool_result') */
  toolResult?: ToolResult;
}

/**
 * Parsed SSE data from various provider formats.
 */
export interface ParsedSSEData {
  content?: string;
  reasoning?: string;
  done?: boolean;
  error?: {
    message: string;
    type?: string;
    code?: string;
  };
  // Tool calling events
  type?: 'tool_call' | 'tool_result';
  toolCall?: ToolCall;
  toolResult?: ToolResult;
}

/**
 * Configuration for the stream parser.
 */
export interface StreamConfig {
  /** Timeout for the entire stream in ms (default: 60000 = 1 min) */
  streamTimeoutMs?: number;

  /** Timeout for first chunk in ms (default: 10000 = 10 sec) */
  firstChunkTimeoutMs?: number;

  /** Timeout between chunks in ms (default: 30000 = 30 sec) */
  chunkTimeoutMs?: number;

  /** Maximum retry attempts (default: 7) */
  maxRetries?: number;

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Default configuration values.
 */
export const DEFAULT_STREAM_CONFIG: Required<StreamConfig> = {
  streamTimeoutMs: 60_000, // 1 minute max
  firstChunkTimeoutMs: 10_000, // 10 seconds
  chunkTimeoutMs: 30_000, // 30 seconds
  maxRetries: 7,
  debug: process.env.NODE_ENV === 'development' ||
         process.env.NEXT_PUBLIC_DEBUG_STREAMING === 'true',
};
