/**
 * Tests for streaming types
 */

import { DEFAULT_STREAM_CONFIG } from '../types';
import type { StreamChunk, ParsedSSEData, StreamConfig } from '../types';

describe('DEFAULT_STREAM_CONFIG', () => {
  it('should have correct default timeout values', () => {
    expect(DEFAULT_STREAM_CONFIG.streamTimeoutMs).toBe(600_000); // 10 minutes
    expect(DEFAULT_STREAM_CONFIG.firstChunkTimeoutMs).toBe(10_000); // 10 seconds
    expect(DEFAULT_STREAM_CONFIG.chunkTimeoutMs).toBe(30_000); // 30 seconds
  });

  it('should have correct default retry value', () => {
    expect(DEFAULT_STREAM_CONFIG.maxRetries).toBe(7);
  });

  it('should have debug property', () => {
    expect(typeof DEFAULT_STREAM_CONFIG.debug).toBe('boolean');
  });
});

describe('StreamChunk type', () => {
  it('should allow content-only chunk', () => {
    const chunk: StreamChunk = {
      content: 'Hello',
    };
    expect(chunk.content).toBe('Hello');
  });

  it('should allow reasoning-only chunk', () => {
    const chunk: StreamChunk = {
      reasoning: 'Thinking...',
    };
    expect(chunk.reasoning).toBe('Thinking...');
  });

  it('should allow done chunk', () => {
    const chunk: StreamChunk = {
      done: true,
    };
    expect(chunk.done).toBe(true);
  });

  it('should allow status chunk', () => {
    const chunk: StreamChunk = {
      status: 'first_token',
      content: 'First',
    };
    expect(chunk.status).toBe('first_token');
  });

  it('should allow rate_limit_retry with retryAfterMs', () => {
    const chunk: StreamChunk = {
      status: 'rate_limit_retry',
      retryAfterMs: 5000,
    };
    expect(chunk.status).toBe('rate_limit_retry');
    expect(chunk.retryAfterMs).toBe(5000);
  });

  it('should allow timing_info with metadata', () => {
    const chunk: StreamChunk = {
      status: 'timing_info',
      timingMetadata: {
        backendTimeMs: 100,
        networkTimeMs: 50,
        totalTimeMs: 150,
      },
    };
    expect(chunk.timingMetadata?.backendTimeMs).toBe(100);
  });
});

describe('ParsedSSEData type', () => {
  it('should represent content data', () => {
    const data: ParsedSSEData = {
      content: 'Hello',
    };
    expect(data.content).toBe('Hello');
  });

  it('should represent error data', () => {
    const data: ParsedSSEData = {
      error: {
        message: 'Something went wrong',
        type: 'api_error',
        code: 'ERR_001',
      },
    };
    expect(data.error?.message).toBe('Something went wrong');
    expect(data.error?.type).toBe('api_error');
    expect(data.error?.code).toBe('ERR_001');
  });

  it('should represent done signal', () => {
    const data: ParsedSSEData = {
      done: true,
    };
    expect(data.done).toBe(true);
  });
});

describe('StreamConfig type', () => {
  it('should allow partial configuration', () => {
    const config: StreamConfig = {
      maxRetries: 3,
    };
    expect(config.maxRetries).toBe(3);
    expect(config.streamTimeoutMs).toBeUndefined();
  });

  it('should allow full configuration', () => {
    const config: StreamConfig = {
      streamTimeoutMs: 300_000,
      firstChunkTimeoutMs: 5_000,
      chunkTimeoutMs: 15_000,
      maxRetries: 5,
      debug: true,
    };
    expect(config.streamTimeoutMs).toBe(300_000);
    expect(config.debug).toBe(true);
  });
});
