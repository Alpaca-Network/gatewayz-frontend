/**
 * Tests for streaming error classes
 */

import {
  StreamingError,
  AuthenticationError,
  RateLimitError,
  StreamTimeoutError,
  EmptyResponseError,
} from '../errors';

describe('StreamingError', () => {
  it('should create error with message', () => {
    const error = new StreamingError('Something went wrong');
    expect(error.message).toBe('Something went wrong');
    expect(error.name).toBe('StreamingError');
    expect(error.retryable).toBe(false);
    expect(error.code).toBeUndefined();
    expect(error.type).toBeUndefined();
  });

  it('should create error with options', () => {
    const error = new StreamingError('Custom error', {
      code: 'CUSTOM_CODE',
      type: 'custom_type',
      retryable: true,
    });
    expect(error.message).toBe('Custom error');
    expect(error.code).toBe('CUSTOM_CODE');
    expect(error.type).toBe('custom_type');
    expect(error.retryable).toBe(true);
  });

  it('should be instance of Error', () => {
    const error = new StreamingError('Test');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(StreamingError);
  });

  it('should have default retryable as false', () => {
    const error = new StreamingError('Test', { code: 'TEST' });
    expect(error.retryable).toBe(false);
  });
});

describe('AuthenticationError', () => {
  it('should create authentication error', () => {
    const error = new AuthenticationError('Session expired');
    expect(error.message).toBe('Session expired');
    expect(error.name).toBe('AuthenticationError');
    expect(error.code).toBe('AUTH_ERROR');
    expect(error.type).toBe('authentication');
    expect(error.retryable).toBe(false);
  });

  it('should be instance of StreamingError', () => {
    const error = new AuthenticationError('Test');
    expect(error).toBeInstanceOf(StreamingError);
    expect(error).toBeInstanceOf(AuthenticationError);
  });
});

describe('RateLimitError', () => {
  it('should create rate limit error without retry time', () => {
    const error = new RateLimitError('Too many requests');
    expect(error.message).toBe('Too many requests');
    expect(error.name).toBe('RateLimitError');
    expect(error.code).toBe('RATE_LIMIT');
    expect(error.type).toBe('rate_limit');
    expect(error.retryable).toBe(true);
    expect(error.retryAfterMs).toBeUndefined();
  });

  it('should create rate limit error with retry time', () => {
    const error = new RateLimitError('Too many requests', 5000);
    expect(error.retryAfterMs).toBe(5000);
  });

  it('should be instance of StreamingError', () => {
    const error = new RateLimitError('Test');
    expect(error).toBeInstanceOf(StreamingError);
    expect(error).toBeInstanceOf(RateLimitError);
  });
});

describe('StreamTimeoutError', () => {
  it('should create timeout error', () => {
    const error = new StreamTimeoutError('Request timed out');
    expect(error.message).toBe('Request timed out');
    expect(error.name).toBe('StreamTimeoutError');
    expect(error.code).toBe('TIMEOUT');
    expect(error.type).toBe('timeout');
    expect(error.retryable).toBe(true);
  });

  it('should be instance of StreamingError', () => {
    const error = new StreamTimeoutError('Test');
    expect(error).toBeInstanceOf(StreamingError);
    expect(error).toBeInstanceOf(StreamTimeoutError);
  });
});

describe('EmptyResponseError', () => {
  it('should create empty response error with model id', () => {
    const error = new EmptyResponseError('gpt-4');
    expect(error.message).toContain('gpt-4');
    expect(error.message).toContain('No response received');
    expect(error.name).toBe('EmptyResponseError');
    expect(error.code).toBe('EMPTY_RESPONSE');
    expect(error.type).toBe('empty_response');
    expect(error.retryable).toBe(true);
  });

  it('should be instance of StreamingError', () => {
    const error = new EmptyResponseError('test-model');
    expect(error).toBeInstanceOf(StreamingError);
    expect(error).toBeInstanceOf(EmptyResponseError);
  });
});
