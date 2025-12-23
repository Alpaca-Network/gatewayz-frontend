/**
 * Tests for SSE parser tool call handling
 */

import { parseSSEChunk, parseSSEBuffer } from '@/lib/streaming/sse-parser';

describe('SSE Parser - Tool Call Events', () => {
  describe('parseSSEChunk', () => {
    it('should parse tool_call event correctly', () => {
      const toolCallData = JSON.stringify({
        type: 'tool_call',
        tool_call_id: 'call-123',
        name: 'web_search',
        arguments: { query: 'test query' },
      });

      const result = parseSSEChunk(toolCallData);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('tool_call');
      expect(result?.toolCall).toEqual({
        id: 'call-123',
        name: 'web_search',
        arguments: { query: 'test query' },
      });
    });

    it('should parse tool_result event with success correctly', () => {
      const toolResultData = JSON.stringify({
        type: 'tool_result',
        tool_call_id: 'call-123',
        name: 'web_search',
        success: true,
        result: {
          query: 'test query',
          results: [
            { title: 'Result 1', url: 'https://example.com', content: 'Test content', score: 0.95 },
          ],
          answer: 'Test answer',
        },
      });

      const result = parseSSEChunk(toolResultData);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('tool_result');
      expect(result?.toolResult).toEqual({
        tool_call_id: 'call-123',
        name: 'web_search',
        success: true,
        result: {
          query: 'test query',
          results: [
            { title: 'Result 1', url: 'https://example.com', content: 'Test content', score: 0.95 },
          ],
          answer: 'Test answer',
        },
        error: undefined,
      });
    });

    it('should parse tool_result event with error correctly', () => {
      const toolResultData = JSON.stringify({
        type: 'tool_result',
        tool_call_id: 'call-123',
        name: 'web_search',
        success: false,
        error: 'API rate limit exceeded',
      });

      const result = parseSSEChunk(toolResultData);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('tool_result');
      expect(result?.toolResult?.success).toBe(false);
      expect(result?.toolResult?.error).toBe('API rate limit exceeded');
    });

    it('should return null for tool_call without required fields', () => {
      const incompleteToolCall = JSON.stringify({
        type: 'tool_call',
        // Missing tool_call_id and name
      });

      const result = parseSSEChunk(incompleteToolCall);
      expect(result).toBeNull();
    });

    it('should return null for tool_result without required fields', () => {
      const incompleteToolResult = JSON.stringify({
        type: 'tool_result',
        // Missing tool_call_id and name
      });

      const result = parseSSEChunk(incompleteToolResult);
      expect(result).toBeNull();
    });
  });

  describe('parseSSEBuffer', () => {
    it('should parse multiple tool events from buffer', () => {
      const buffer = `data: {"type":"tool_call","tool_call_id":"call-1","name":"web_search","arguments":{"query":"test"}}
data: {"type":"tool_result","tool_call_id":"call-1","name":"web_search","success":true,"result":{"query":"test","results":[]}}
`;

      const { chunks, remaining, done } = parseSSEBuffer(buffer);

      expect(chunks).toHaveLength(2);
      expect(chunks[0].type).toBe('tool_call');
      expect(chunks[1].type).toBe('tool_result');
      expect(remaining).toBe('');
      expect(done).toBe(false);
    });

    it('should handle mixed content and tool events', () => {
      const buffer = `data: {"type":"tool_call","tool_call_id":"call-1","name":"web_search","arguments":{"query":"test"}}
data: {"choices":[{"delta":{"content":"Here is the result"}}]}
`;

      const { chunks, remaining, done } = parseSSEBuffer(buffer);

      expect(chunks).toHaveLength(2);
      expect(chunks[0].type).toBe('tool_call');
      expect(chunks[1].content).toBe('Here is the result');
    });

    it('should handle [DONE] signal after tool events', () => {
      const buffer = `data: {"type":"tool_result","tool_call_id":"call-1","name":"web_search","success":true,"result":{}}
data: [DONE]
`;

      const { chunks, remaining, done } = parseSSEBuffer(buffer);

      expect(chunks).toHaveLength(1);
      expect(done).toBe(true);
    });
  });
});

describe('SSE Parser - Standard Events (unchanged)', () => {
  describe('parseSSEChunk', () => {
    it('should parse OpenAI format content correctly', () => {
      const openAIData = JSON.stringify({
        choices: [{
          delta: { content: 'Hello, world!' },
        }],
      });

      const result = parseSSEChunk(openAIData);

      expect(result).not.toBeNull();
      expect(result?.content).toBe('Hello, world!');
    });

    it('should parse OpenAI format with reasoning correctly', () => {
      const openAIData = JSON.stringify({
        choices: [{
          delta: {
            content: 'Answer',
            reasoning_content: 'Let me think...',
          },
        }],
      });

      const result = parseSSEChunk(openAIData);

      expect(result?.content).toBe('Answer');
      expect(result?.reasoning).toBe('Let me think...');
    });

    it('should parse done signal correctly', () => {
      const doneData = JSON.stringify({
        choices: [{
          delta: {},
          finish_reason: 'stop',
        }],
      });

      const result = parseSSEChunk(doneData);

      expect(result?.done).toBe(true);
    });

    it('should handle invalid JSON gracefully', () => {
      const invalidJson = 'not valid json';

      const result = parseSSEChunk(invalidJson);

      expect(result).toBeNull();
    });
  });
});
