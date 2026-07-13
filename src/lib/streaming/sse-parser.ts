/**
 * SSE Parser
 *
 * Parses Server-Sent Events from various LLM provider formats into a unified structure.
 * Supports: OpenAI, Fireworks, DeepSeek, and event-based streaming formats.
 */

import type { ParsedSSEData } from './types';
import { StreamingError } from './errors';
import { classifySseError } from '@/lib/errors';

/**
 * Convert various input types to plain text.
 * Handles nested objects, arrays, and different content field names.
 */
export function toPlainText(input: unknown): string {
  if (!input) return '';
  if (typeof input === 'string') return input;

  if (Array.isArray(input)) {
    return input.map(toPlainText).filter(Boolean).join('');
  }

  if (typeof input === 'object') {
    const record = input as Record<string, unknown>;

    // Try common content field names
    const contentFields = [
      'text', 'value', 'message', 'content', 'output_text',
      'reasoning', 'thoughts', 'parts'
    ];

    for (const field of contentFields) {
      const value = record[field];
      if (typeof value === 'string') return value;
      if (Array.isArray(value)) return toPlainText(value);
    }
  }

  return '';
}

/**
 * Extract reasoning content from a data object.
 * Checks multiple field names used by different providers.
 */
function extractReasoning(data: Record<string, unknown>): string {
  const reasoningFields = [
    'reasoning_content',
    'reasoning',
    'thinking',
    'analysis',
    'inner_thought',
    'thoughts',
    'reflection',
  ];

  for (const field of reasoningFields) {
    const value = data[field];
    if (value) {
      const text = toPlainText(value);
      if (text) return text;
    }
  }

  return '';
}

/**
 * Extract content text from a data object.
 * Checks multiple field names used by different providers.
 */
function extractContent(data: Record<string, unknown>): string {
  const contentFields = ['content', 'text', 'output_text'];

  for (const field of contentFields) {
    const value = data[field];
    if (value) {
      const text = toPlainText(value);
      if (text) return text;
    }
  }

  return '';
}

/**
 * Extract error information from response data for internal classification and
 * telemetry. `rawMessage` is NEVER shown to the user — display copy comes from
 * classifySseError / the mapped messages in checkForError.
 */
function extractErrorInfo(errorObj: Record<string, unknown>): {
  rawMessage: string;
  type?: string;
  code?: string;
  errorType?: string;
  requestId?: string;
} {
  const rawMessage =
    (typeof errorObj.message === 'string' && errorObj.message) ||
    (typeof errorObj.detail === 'string' && errorObj.detail) ||
    (typeof errorObj.error === 'string' && errorObj.error) ||
    (typeof errorObj.text === 'string' && errorObj.text) ||
    (typeof errorObj.reason === 'string' && errorObj.reason) ||
    JSON.stringify(errorObj);

  return {
    rawMessage,
    type: typeof errorObj.type === 'string' ? errorObj.type : undefined,
    code: typeof errorObj.code === 'string' ? errorObj.code : undefined,
    errorType: typeof errorObj.error_type === 'string' ? errorObj.error_type : undefined,
    requestId: typeof errorObj.request_id === 'string' ? errorObj.request_id : undefined,
  };
}

/**
 * Check if a finish_reason indicates stream completion.
 * Treat all finish reasons as done to be consistent across providers.
 */
function isFinishReasonDone(finishReason: unknown): boolean {
  if (!finishReason) return false;
  // Any non-null finish_reason indicates the stream is complete
  return true;
}

/**
 * Parse Fireworks/Responses API format.
 * Format: { output: [{ delta: { content, reasoning_content }, finish_reason }] }
 */
function parseFireworksFormat(data: Record<string, unknown>): ParsedSSEData | null {
  const output = data.output;
  if (!Array.isArray(output) || !output[0]) return null;

  const outputRecord = output[0] as Record<string, unknown>;
  const delta = (outputRecord.delta as Record<string, unknown>) || outputRecord;

  const content = extractContent(delta);
  const reasoning = extractReasoning(delta);
  const finishReason = outputRecord.finish_reason || delta.finish_reason;

  if (!content && !reasoning && !finishReason) return null;

  return {
    content: content || undefined,
    reasoning: reasoning || undefined,
    done: isFinishReasonDone(finishReason),
  };
}

/**
 * Parse OpenAI Chat Completions format.
 * Format: { choices: [{ delta: { content, reasoning_content }, finish_reason }] }
 */
function parseOpenAIFormat(data: Record<string, unknown>): ParsedSSEData | null {
  const choices = data.choices;
  if (!Array.isArray(choices) || !choices[0]) return null;

  const choice = choices[0] as Record<string, unknown>;
  const delta = choice.delta as Record<string, unknown>;
  const finishReason = choice.finish_reason;

  if (delta) {
    const content = extractContent(delta);
    const reasoning = extractReasoning(delta);

    // Check if this is a role-only initialization chunk with no finish_reason
    const deltaKeys = Object.keys(delta);
    const isRoleOnlyDelta = deltaKeys.length === 1 && deltaKeys[0] === 'role';

    // Skip role-only chunks that don't have finish_reason or content
    // Important: Don't skip if finish_reason is present (stream completion signal)
    if (isRoleOnlyDelta && !finishReason) {
      return null;
    }

    if (!content && !reasoning && !finishReason) return null;

    return {
      content: content || undefined,
      reasoning: reasoning || undefined,
      done: isFinishReasonDone(finishReason),
    };
  }

  // Handle finish_reason without delta
  if (finishReason) {
    if (finishReason === 'error') {
      return {
        error: {
          message: 'Model returned an error without details. The model may be unavailable or misconfigured.',
          type: 'finish_error',
        },
      };
    }
    return { done: true };
  }

  return null;
}

/**
 * Parse event-based streaming format.
 * Format: { type: 'response.output_text.delta', delta: '...' }
 */
function parseEventFormat(data: Record<string, unknown>): ParsedSSEData | null {
  const eventType = data.type;
  if (typeof eventType !== 'string') return null;

  switch (eventType) {
    // Tool call events - server is executing a tool
    case 'tool_call': {
      const toolCallId = data.tool_call_id as string;
      const name = data.name as string;
      const args = data.arguments as Record<string, unknown>;
      if (toolCallId && name) {
        return {
          type: 'tool_call',
          toolCall: {
            id: toolCallId,
            name,
            arguments: args || {},
          },
        };
      }
      return null;
    }

    // Tool result events - tool execution completed
    case 'tool_result': {
      const toolCallId = data.tool_call_id as string;
      const name = data.name as string;
      const success = data.success as boolean;
      const result = data.result;
      const error = data.error as string | undefined;
      if (toolCallId && name) {
        return {
          type: 'tool_result',
          toolResult: {
            tool_call_id: toolCallId,
            name,
            success,
            result,
            error,
          },
        };
      }
      return null;
    }

    // Content delta events
    case 'response.output_text.delta': {
      const delta = data.delta as Record<string, unknown> | string;
      const content = toPlainText(delta);
      const reasoning = typeof delta === 'object' ? extractReasoning(delta) : '';
      if (content || reasoning) {
        return { content: content || undefined, reasoning: reasoning || undefined };
      }
      return null;
    }

    // Reasoning delta events
    case 'response.reasoning_content.delta':
    case 'response.reasoning.delta':
    case 'response.output_reasoning.delta':
    case 'response.reflection.delta':
    case 'response.thinking.delta':
    case 'response.output_thinking.delta':
    case 'response.inner_thought.delta': {
      const reasoning = toPlainText(data.delta);
      if (reasoning) return { reasoning };
      return null;
    }

    // Completion events
    case 'response.output_text.done':
    case 'response.completed':
    case 'response.message.completed':
    case 'response.stop':
      return { done: true };

    // Error events - these should propagate as errors, not regular returns
    case 'response.error': {
      const errorData = data.error as Record<string, unknown> | undefined;
      const info = errorData ? extractErrorInfo(errorData) : undefined;
      const appError = classifySseError({
        error_type: info?.errorType || (typeof data.error_type === 'string' ? data.error_type : 'stream_error'),
        request_id: info?.requestId,
      });
      // Throw immediately for response.error events so they're handled as
      // stream errors. Message is our friendly copy; raw text goes to telemetry.
      throw new StreamingError(appError.getUserMessage(), {
        type: 'response_error',
        code: info?.code,
        retryable: appError.retryable,
        requestId: info?.requestId,
        rawDetail: info?.rawMessage ?? (typeof data.message === 'string' ? data.message : undefined),
        appError,
      });
    }

    default:
      return null;
  }
}

/**
 * The backend streaming path's documented SSE error_type values
 * (chat_streaming.py). Each maps to dedicated friendly copy in
 * classifySseError — anything else falls back to generic copy.
 */
const KNOWN_SSE_ERROR_TYPES = new Set([
  'rate_limit_error',
  'capacity_error',
  'provider_error',
  'timeout_error',
  'not_found_error',
  'auth_error',
  'stream_error',
]);

/** Build the safe error payload for a ParsedSSEData from a classified AppError. */
function toSafeError(
  appError: ReturnType<typeof classifySseError>,
  info: { type?: string; code?: string; requestId?: string; rawMessage?: string }
): ParsedSSEData {
  return {
    error: {
      message: appError.getUserMessage(),
      type: info.type,
      code: info.code,
      requestId: info.requestId ?? appError.requestId,
      retryable: appError.retryable,
      rawDetail: info.rawMessage,
      appError,
    },
  };
}

/**
 * Check for error objects in the response data.
 * Only checks explicit error fields to avoid false positives with legitimate content fields.
 *
 * The returned `error.message` is always our own friendly copy — raw
 * provider/backend text only travels in `error.rawDetail` for telemetry.
 */
function checkForError(data: Record<string, unknown>): ParsedSSEData | null {
  const topLevelErrorType = typeof data.error_type === 'string' ? data.error_type : undefined;

  // Only treat explicit error fields as errors - don't treat top-level 'message'
  // as an error since some providers use 'message' for legitimate content
  if (!data.error && !topLevelErrorType) return null;

  // String or otherwise unstructured error field — classify generically.
  if (data.error && typeof data.error !== 'object') {
    const appError = classifySseError({ error_type: topLevelErrorType });
    return toSafeError(appError, {
      type: topLevelErrorType,
      rawMessage: typeof data.error === 'string' ? data.error : JSON.stringify(data.error),
    });
  }

  const errorObj = (data.error as Record<string, unknown> | undefined) ?? {};
  const info = extractErrorInfo(errorObj);
  const requestId = info.requestId ?? (typeof data.request_id === 'string' ? data.request_id : undefined);
  const errorType = (info.errorType || topLevelErrorType || info.type || '').toLowerCase();

  // New backend contract: known error_type values get dedicated copy.
  if (KNOWN_SSE_ERROR_TYPES.has(errorType)) {
    const appError = classifySseError({ error_type: errorType, request_id: requestId });
    return toSafeError(appError, { type: errorType, code: info.code, requestId, rawMessage: info.rawMessage });
  }

  // Legacy heuristics for older backend/provider chunks. The matched raw text
  // is used for classification only — never rendered.
  const lowerMessage = info.rawMessage.toLowerCase();
  const errorCode = (info.code || '').toLowerCase();

  if (
    errorCode.includes('rate_limit') ||
    errorType.includes('rate_limit') ||
    lowerMessage.includes('rate limit') ||
    lowerMessage.includes('too many requests') ||
    errorObj.status === 429
  ) {
    const appError = classifySseError({ error_type: 'rate_limit_error', request_id: requestId });
    return toSafeError(appError, { type: 'rate_limit', code: info.code || 'rate_limit_exceeded', requestId, rawMessage: info.rawMessage });
  }

  if (lowerMessage.includes('trial has expired') || lowerMessage.includes('insufficient credits')) {
    return {
      error: {
        message: 'Trial credits have been used up. You can still use FREE models! Look for models with the "FREE" badge, or add credits to use premium models.',
        type: 'credits_exhausted',
        requestId,
        rawDetail: info.rawMessage,
      },
    };
  }

  if (
    lowerMessage === 'not found' ||
    lowerMessage.includes('model not found') ||
    lowerMessage.includes('no such model') ||
    errorCode === '404' ||
    errorObj.status === 404
  ) {
    const appError = classifySseError({ error_type: 'not_found_error', request_id: requestId });
    return toSafeError(appError, { type: 'model_not_found', code: '404', requestId, rawMessage: info.rawMessage });
  }

  // Anything unmapped (including "upstream rejected" and unknown provider
  // errors): treat as a provider-side stream failure with generic copy.
  const appError = classifySseError({ error_type: lowerMessage.includes('upstream rejected') ? 'provider_error' : 'stream_error', request_id: requestId });
  return toSafeError(appError, { type: info.type, code: info.code, requestId, rawMessage: info.rawMessage });
}

/**
 * Parse a single SSE data chunk from various provider formats.
 *
 * @param jsonStr - The JSON string from the SSE data field
 * @returns Parsed data or null if the chunk should be skipped
 * @throws StreamingError if the chunk contains an error
 */
export function parseSSEChunk(jsonStr: string): ParsedSSEData | null {
  let data: Record<string, unknown>;

  try {
    data = JSON.parse(jsonStr);
  } catch {
    // Skip unparseable chunks (could be partial data)
    return null;
  }

  // Try each format parser in order of likelihood
  let result: ParsedSSEData | null = null;

  // 1. Try event-based format first (type field) - this includes tool_call and tool_result
  // which may have "error" fields that are not streaming errors
  result = parseEventFormat(data);
  if (result) return result;

  // 2. Check for errors (after event format to avoid false positives with tool_result.error)
  const errorResult = checkForError(data);
  if (errorResult?.error) {
    throw new StreamingError(errorResult.error.message, {
      type: errorResult.error.type,
      code: errorResult.error.code,
      retryable: errorResult.error.retryable,
      requestId: errorResult.error.requestId,
      rawDetail: errorResult.error.rawDetail,
      appError: errorResult.error.appError,
    });
  }

  // 3. Try Fireworks/Responses API format (output array)
  result = parseFireworksFormat(data);
  if (result) return result;

  // 4. Try OpenAI format (choices array)
  result = parseOpenAIFormat(data);
  if (result) return result;

  // No recognized format - return null to skip
  return null;
}

/**
 * Parse SSE lines from a text buffer.
 * Handles the "data: " prefix and [DONE] signal.
 *
 * @param buffer - Text buffer containing SSE lines
 * @returns Array of parsed chunks and remaining buffer
 */
export function parseSSEBuffer(buffer: string): {
  chunks: ParsedSSEData[];
  remaining: string;
  done: boolean;
} {
  const chunks: ParsedSSEData[] = [];
  const lines = buffer.split('\n');
  let done = false;

  // Keep the last incomplete line in the buffer
  const remaining = lines.pop() || '';

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Check for [DONE] signal
    if (trimmedLine === 'data: [DONE]') {
      done = true;
      break;
    }

    // Parse data lines
    if (trimmedLine.startsWith('data: ')) {
      const jsonStr = trimmedLine.slice(6);
      try {
        const chunk = parseSSEChunk(jsonStr);
        if (chunk) {
          chunks.push(chunk);
        }
      } catch (error) {
        if (error instanceof StreamingError) {
          throw error;
        }
        // Ignore JSON parse errors, continue processing
      }
    }
  }

  return { chunks, remaining, done };
}
