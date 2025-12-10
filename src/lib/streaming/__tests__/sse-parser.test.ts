/**
 * Tests for the modular SSE parser
 */

import { parseSSEChunk, parseSSEBuffer, toPlainText } from '../sse-parser';
import { StreamingError } from '../errors';

describe('toPlainText', () => {
  it('should return empty string for falsy values', () => {
    expect(toPlainText(null)).toBe('');
    expect(toPlainText(undefined)).toBe('');
    expect(toPlainText('')).toBe('');
  });

  it('should return string as-is', () => {
    expect(toPlainText('hello')).toBe('hello');
  });

  it('should join array elements', () => {
    expect(toPlainText(['hello', ' ', 'world'])).toBe('hello world');
  });

  it('should extract text from object fields', () => {
    expect(toPlainText({ text: 'hello' })).toBe('hello');
    expect(toPlainText({ value: 'hello' })).toBe('hello');
    expect(toPlainText({ content: 'hello' })).toBe('hello');
  });

  it('should handle nested arrays', () => {
    expect(toPlainText({ text: ['hello', ' ', 'world'] })).toBe('hello world');
  });
});

describe('parseSSEChunk', () => {
  describe('OpenAI format', () => {
    it('should parse content from choices[].delta.content', () => {
      const json = JSON.stringify({
        choices: [{ delta: { content: 'Hello' }, finish_reason: null }],
      });
      const result = parseSSEChunk(json);
      expect(result?.content).toBe('Hello');
      expect(result?.done).toBeFalsy();
    });

    it('should parse reasoning from choices[].delta.reasoning_content', () => {
      const json = JSON.stringify({
        choices: [{ delta: { reasoning_content: 'Thinking...' }, finish_reason: null }],
      });
      const result = parseSSEChunk(json);
      expect(result?.reasoning).toBe('Thinking...');
    });

    it('should handle finish_reason stop', () => {
      const json = JSON.stringify({
        choices: [{ delta: {}, finish_reason: 'stop' }],
      });
      const result = parseSSEChunk(json);
      expect(result?.done).toBe(true);
    });

    it('should skip role-only delta chunks', () => {
      const json = JSON.stringify({
        choices: [{ delta: { role: 'assistant' }, finish_reason: null }],
      });
      const result = parseSSEChunk(json);
      expect(result).toBeNull();
    });
  });

  describe('Fireworks format', () => {
    it('should parse content from output[].delta.content', () => {
      const json = JSON.stringify({
        output: [{ delta: { content: 'Hello' } }],
      });
      const result = parseSSEChunk(json);
      expect(result?.content).toBe('Hello');
    });

    it('should parse reasoning from output[].delta.reasoning_content', () => {
      const json = JSON.stringify({
        output: [{ delta: { reasoning_content: 'Thinking...' } }],
      });
      const result = parseSSEChunk(json);
      expect(result?.reasoning).toBe('Thinking...');
    });

    it('should handle finish_reason in output', () => {
      const json = JSON.stringify({
        output: [{ delta: {}, finish_reason: 'stop' }],
      });
      const result = parseSSEChunk(json);
      expect(result?.done).toBe(true);
    });
  });

  describe('Event-based format', () => {
    it('should parse response.output_text.delta', () => {
      const json = JSON.stringify({
        type: 'response.output_text.delta',
        delta: 'Hello',
      });
      const result = parseSSEChunk(json);
      expect(result?.content).toBe('Hello');
    });

    it('should parse response.reasoning.delta', () => {
      const json = JSON.stringify({
        type: 'response.reasoning.delta',
        delta: 'Thinking...',
      });
      const result = parseSSEChunk(json);
      expect(result?.reasoning).toBe('Thinking...');
    });

    it('should handle response.completed', () => {
      const json = JSON.stringify({
        type: 'response.completed',
      });
      const result = parseSSEChunk(json);
      expect(result?.done).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should throw StreamingError for error objects', () => {
      const json = JSON.stringify({
        error: { message: 'Model unavailable' },
      });
      expect(() => parseSSEChunk(json)).toThrow(StreamingError);
      expect(() => parseSSEChunk(json)).toThrow('Model unavailable');
    });

    it('should handle trial expired errors', () => {
      const json = JSON.stringify({
        error: { message: 'Your trial has expired' },
      });
      expect(() => parseSSEChunk(json)).toThrow(/FREE models/);
    });

    it('should handle upstream rejected errors', () => {
      const json = JSON.stringify({
        error: { message: 'upstream rejected the request' },
      });
      expect(() => parseSSEChunk(json)).toThrow(/Backend error/);
    });

    it('should handle rate limit errors by code', () => {
      const json = JSON.stringify({
        error: { code: 'rate_limit_exceeded' },
      });
      expect(() => parseSSEChunk(json)).toThrow(/Rate limit exceeded/);
    });

    it('should handle rate limit errors by type', () => {
      const json = JSON.stringify({
        error: { type: 'rate_limit', message: 'Too many requests' },
      });
      expect(() => parseSSEChunk(json)).toThrow(/Rate limit exceeded/);
    });

    it('should handle rate limit errors by status 429', () => {
      const json = JSON.stringify({
        error: { status: 429, message: 'Slow down' },
      });
      expect(() => parseSSEChunk(json)).toThrow(/Rate limit exceeded/);
    });

    it('should return null for unparseable JSON', () => {
      const result = parseSSEChunk('{invalid json}');
      expect(result).toBeNull();
    });

    it('should NOT treat top-level message as error (false positive prevention)', () => {
      // Some providers use 'message' for legitimate content
      const json = JSON.stringify({
        message: 'This is content, not an error',
        choices: [{ delta: { content: 'Hello' } }],
      });
      const result = parseSSEChunk(json);
      expect(result?.content).toBe('Hello');
    });
  });

  describe('finish_reason consistency', () => {
    it('should return error object for finish_reason error (OpenAI)', () => {
      const json = JSON.stringify({
        choices: [{ finish_reason: 'error' }],
      });
      const result = parseSSEChunk(json);
      expect(result?.error).toBeDefined();
      expect(result?.error?.type).toBe('finish_error');
      expect(result?.error?.message).toContain('error');
    });

    it('should mark done for finish_reason stop (OpenAI)', () => {
      const json = JSON.stringify({
        choices: [{ delta: { content: 'End' }, finish_reason: 'stop' }],
      });
      const result = parseSSEChunk(json);
      expect(result?.done).toBe(true);
    });

    it('should mark done for finish_reason length (OpenAI)', () => {
      const json = JSON.stringify({
        choices: [{ delta: { content: 'Truncated' }, finish_reason: 'length' }],
      });
      const result = parseSSEChunk(json);
      expect(result?.done).toBe(true);
    });

    it('should mark done for finish_reason end_turn (OpenAI)', () => {
      const json = JSON.stringify({
        choices: [{ delta: { content: 'Done' }, finish_reason: 'end_turn' }],
      });
      const result = parseSSEChunk(json);
      expect(result?.done).toBe(true);
    });

    it('should mark done for finish_reason stop (Fireworks)', () => {
      const json = JSON.stringify({
        output: [{ delta: { content: 'End' }, finish_reason: 'stop' }],
      });
      const result = parseSSEChunk(json);
      expect(result?.done).toBe(true);
    });

    it('should mark done for finish_reason length (Fireworks)', () => {
      const json = JSON.stringify({
        output: [{ delta: { content: 'Truncated' }, finish_reason: 'length' }],
      });
      const result = parseSSEChunk(json);
      expect(result?.done).toBe(true);
    });
  });

  describe('Real API response parsing', () => {
    it('should correctly parse chunks from real gatewayz API response', () => {
      // Exact format from curl test against beta.gatewayz.ai
      const chunk1 = '{"id": "gen-1765332673", "object": "chat.completion.chunk", "choices": [{"index": 0, "delta": {"role": "assistant"}, "finish_reason": null}]}';
      const chunk2 = '{"id": "gen-1765332673", "object": "chat.completion.chunk", "choices": [{"index": 0, "delta": {"role": "assistant", "content": "Hello"}, "finish_reason": null}]}';
      const chunk3 = '{"id": "gen-1765332673", "object": "chat.completion.chunk", "choices": [{"index": 0, "delta": {"role": "assistant", "content": "!"}, "finish_reason": null}]}';
      const chunk4 = '{"id": "gen-1765332673", "object": "chat.completion.chunk", "choices": [{"index": 0, "delta": {"role": "assistant"}, "finish_reason": "stop"}]}';

      // Chunk 1: role-only initialization - should be skipped (null)
      const result1 = parseSSEChunk(chunk1);
      expect(result1).toBeNull();

      // Chunk 2: has content "Hello" - should parse
      const result2 = parseSSEChunk(chunk2);
      expect(result2?.content).toBe('Hello');

      // Chunk 3: has content "!" - should parse
      const result3 = parseSSEChunk(chunk3);
      expect(result3?.content).toBe('!');

      // Chunk 4: finish_reason stop - should have done: true
      const result4 = parseSSEChunk(chunk4);
      expect(result4?.done).toBe(true);
    });

    it('should handle delta with both role and content', () => {
      // Some providers include role in every delta
      const json = JSON.stringify({
        choices: [{ delta: { role: 'assistant', content: 'Test' }, finish_reason: null }],
      });
      const result = parseSSEChunk(json);
      expect(result?.content).toBe('Test');
    });
  });
});

describe('parseSSEBuffer', () => {
  it('should parse multiple SSE lines', () => {
    const buffer = `data: {"choices":[{"delta":{"content":"Hello"}}]}
data: {"choices":[{"delta":{"content":" World"}}]}
`;
    const { chunks, remaining, done } = parseSSEBuffer(buffer);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.content).toBe('Hello');
    expect(chunks[1]?.content).toBe(' World');
    expect(remaining).toBe('');
    expect(done).toBe(false);
  });

  it('should handle [DONE] signal', () => {
    const buffer = `data: {"choices":[{"delta":{"content":"Hello"}}]}
data: [DONE]
`;
    const { chunks, done } = parseSSEBuffer(buffer);
    expect(chunks).toHaveLength(1);
    expect(done).toBe(true);
  });

  it('should keep incomplete lines in remaining', () => {
    const buffer = `data: {"choices":[{"delta":{"content":"Hello"}}]}
data: {"choices":[{"delta":{"con`;
    const { chunks, remaining } = parseSSEBuffer(buffer);
    expect(chunks).toHaveLength(1);
    expect(remaining).toBe('data: {"choices":[{"delta":{"con');
  });

  it('should skip empty lines', () => {
    const buffer = `
data: {"choices":[{"delta":{"content":"Hello"}}]}

data: {"choices":[{"delta":{"content":"World"}}]}
`;
    const { chunks } = parseSSEBuffer(buffer);
    expect(chunks).toHaveLength(2);
  });

  it('should throw StreamingError when error is encountered', () => {
    const buffer = `data: {"error":{"message":"Rate limited"}}
`;
    expect(() => parseSSEBuffer(buffer)).toThrow(StreamingError);
  });
});
