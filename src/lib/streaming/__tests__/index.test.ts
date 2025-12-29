/**
 * Tests for streaming module exports
 */

import * as streaming from '../index';

describe('streaming module exports', () => {
  it('should export streamChatResponse function', () => {
    expect(streaming.streamChatResponse).toBeDefined();
    expect(typeof streaming.streamChatResponse).toBe('function');
  });

  it('should export parseSSEChunk function', () => {
    expect(streaming.parseSSEChunk).toBeDefined();
    expect(typeof streaming.parseSSEChunk).toBe('function');
  });

  it('should export toPlainText function', () => {
    expect(streaming.toPlainText).toBeDefined();
    expect(typeof streaming.toPlainText).toBe('function');
  });

  it('should export StreamingError class', () => {
    expect(streaming.StreamingError).toBeDefined();
    const error = new streaming.StreamingError('Test');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('StreamingError');
  });

  it('should have correct module structure', () => {
    // Verify all expected exports exist
    const expectedExports = [
      'streamChatResponse',
      'parseSSEChunk',
      'toPlainText',
      'StreamingError',
    ];

    for (const exportName of expectedExports) {
      expect(streaming).toHaveProperty(exportName);
    }
  });
});

describe('exported functions work correctly', () => {
  it('parseSSEChunk should parse valid JSON', () => {
    const json = JSON.stringify({
      choices: [{ delta: { content: 'Hello' }, finish_reason: null }],
    });
    const result = streaming.parseSSEChunk(json);
    expect(result?.content).toBe('Hello');
  });

  it('toPlainText should convert values to string', () => {
    expect(streaming.toPlainText('hello')).toBe('hello');
    expect(streaming.toPlainText(['a', 'b'])).toBe('ab');
    expect(streaming.toPlainText(null)).toBe('');
  });

  it('StreamingError should work with options', () => {
    const error = new streaming.StreamingError('Test error', {
      code: 'TEST_CODE',
      retryable: true,
    });
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.retryable).toBe(true);
  });
});
