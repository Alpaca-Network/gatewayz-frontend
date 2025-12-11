/**
 * Streaming Module
 *
 * Modular streaming utilities for handling SSE responses from various LLM providers.
 * This module consolidates streaming logic that was previously in a 963-line file.
 *
 * @module streaming
 */

export { streamChatResponse } from './stream-chat';
export type { StreamChunk } from './types';
export { parseSSEChunk, toPlainText } from './sse-parser';
export { StreamingError } from './errors';
