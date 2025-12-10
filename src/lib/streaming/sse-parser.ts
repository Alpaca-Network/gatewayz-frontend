/**
 * SSE Parser
 *
 * Parses Server-Sent Events from various LLM provider formats into a unified structure.
 * Supports: OpenAI, Fireworks, DeepSeek, and event-based streaming formats.
 */

import type { ParsedSSEData } from './types';
import { StreamingError } from './errors';

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
 * Extract error information from response data.
 * Handles various error formats from different providers.
 */
function extractError(errorObj: Record<string, unknown>): { message: string; type?: string; code?: string } {
  // Try multiple common error message formats
  const message =
    (typeof errorObj.message === 'string' && errorObj.message) ||
    (typeof errorObj.detail === 'string' && errorObj.detail) ||
    (typeof errorObj.error === 'string' && errorObj.error) ||
    (typeof errorObj.text === 'string' && errorObj.text) ||
    (typeof errorObj.reason === 'string' && errorObj.reason) ||
    (errorObj.code && errorObj.type ? `${errorObj.type}: ${errorObj.code}` : null) ||
    (typeof errorObj.code === 'string' && `Error code: ${errorObj.code}`) ||
    (typeof errorObj.type === 'string' && `Error type: ${errorObj.type}`) ||
    `Stream error: ${JSON.stringify(errorObj)}`;

  return {
    message,
    type: typeof errorObj.type === 'string' ? errorObj.type : undefined,
    code: typeof errorObj.code === 'string' ? errorObj.code : undefined,
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

    // Error events
    case 'response.error': {
      const errorData = data.error as Record<string, unknown> | undefined;
      const message =
        (errorData && typeof errorData.message === 'string' && errorData.message) ||
        (typeof data.message === 'string' && data.message) ||
        'Response stream error';
      return { error: { message, type: 'response_error' } };
    }

    default:
      return null;
  }
}

/**
 * Check for error objects in the response data.
 * Only checks explicit error fields to avoid false positives with legitimate content fields.
 */
function checkForError(data: Record<string, unknown>): ParsedSSEData | null {
  // Only check for explicit error object - don't treat top-level 'message' as error
  // since some providers use 'message' for legitimate content
  if (!data.error) return null;

  // Handle nested error object
  if (typeof data.error === 'object') {
    const errorObj = data.error as Record<string, unknown>;
    const errorInfo = extractError(errorObj);

    // Check for known error patterns
    const lowerMessage = errorInfo.message.toLowerCase();
    const errorCode = (errorInfo.code || '').toLowerCase();
    const errorType = (errorInfo.type || '').toLowerCase();

    // Check for rate limit errors
    if (
      errorCode.includes('rate_limit') ||
      errorType.includes('rate_limit') ||
      lowerMessage.includes('rate limit') ||
      lowerMessage.includes('too many requests') ||
      errorObj.status === 429
    ) {
      return {
        error: {
          message: 'Rate limit exceeded. The model is temporarily unavailable due to high demand. Please try again in a moment.',
          type: 'rate_limit',
          code: errorInfo.code || 'rate_limit_exceeded',
        },
      };
    }

    if (lowerMessage.includes('trial has expired') || lowerMessage.includes('insufficient credits')) {
      return {
        error: {
          message: 'Trial credits have been used up. You can still use FREE models! Look for models with the "FREE" badge, or add credits to use premium models.',
          type: 'credits_exhausted',
        },
      };
    }

    if (lowerMessage.includes('upstream rejected')) {
      return {
        error: {
          message: `Backend error: ${errorInfo.message}. This may be a temporary issue. Please try again or select a different model.`,
          type: 'upstream_error',
        },
      };
    }

    return { error: errorInfo };
  }

  // Handle string error
  if (typeof data.error === 'string') {
    return { error: { message: `Stream error: ${data.error}` } };
  }

  // data.error exists but is neither object nor string - unusual case
  return { error: { message: `Stream error: ${JSON.stringify(data.error)}` } };
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

  // Check for errors first
  const errorResult = checkForError(data);
  if (errorResult?.error) {
    throw new StreamingError(errorResult.error.message, {
      type: errorResult.error.type,
      code: errorResult.error.code,
    });
  }

  // Try each format parser in order of likelihood
  let result: ParsedSSEData | null = null;

  // 1. Try Fireworks/Responses API format (output array)
  result = parseFireworksFormat(data);
  if (result) return result;

  // 2. Try OpenAI format (choices array)
  result = parseOpenAIFormat(data);
  if (result) return result;

  // 3. Try event-based format (type field)
  result = parseEventFormat(data);
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
