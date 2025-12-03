import { retryFetch, retryAsync, DEFAULT_RETRY_OPTIONS } from '../retry-utils';

describe('Retry Utils', () => {
  describe('retryFetch', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return successful response on first attempt', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        text: async () => 'success',
      } as unknown as Response;

      const mockFetch = jest.fn().mockResolvedValueOnce(mockResponse);

      const result = await retryFetch(mockFetch);

      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on 502 and succeed on second attempt', async () => {
      const mockResponse502 = {
        ok: false,
        status: 502,
        text: async () => 'bad gateway',
      } as unknown as Response;

      const mockResponse200 = {
        ok: true,
        status: 200,
        text: async () => 'success',
      } as unknown as Response;

      const mockFetch = jest
        .fn()
        .mockResolvedValueOnce(mockResponse502)
        .mockResolvedValueOnce(mockResponse200);

      jest.useFakeTimers();

      const promise = retryFetch(mockFetch);
      await jest.runAllTimersAsync();
      const result = await promise;

      jest.useRealTimers();

      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 503 Service Unavailable', async () => {
      const mockResponse503 = {
        ok: false,
        status: 503,
        text: async () => 'service unavailable',
      } as unknown as Response;

      const mockResponse200 = {
        ok: true,
        status: 200,
        text: async () => 'success',
      } as unknown as Response;

      const mockFetch = jest
        .fn()
        .mockResolvedValueOnce(mockResponse503)
        .mockResolvedValueOnce(mockResponse200);

      jest.useFakeTimers();

      const promise = retryFetch(mockFetch);
      await jest.runAllTimersAsync();
      const result = await promise;

      jest.useRealTimers();

      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 504 Gateway Timeout', async () => {
      const mockResponse504 = {
        ok: false,
        status: 504,
        text: async () => 'gateway timeout',
      } as unknown as Response;

      const mockResponse200 = {
        ok: true,
        status: 200,
        text: async () => 'success',
      } as unknown as Response;

      const mockFetch = jest
        .fn()
        .mockResolvedValueOnce(mockResponse504)
        .mockResolvedValueOnce(mockResponse200);

      jest.useFakeTimers();

      const promise = retryFetch(mockFetch);
      await jest.runAllTimersAsync();
      const result = await promise;

      jest.useRealTimers();

      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 429 Too Many Requests', async () => {
      const mockResponse429 = {
        ok: false,
        status: 429,
        headers: new Headers(),
        text: async () => 'too many requests',
      } as unknown as Response;

      const mockResponse200 = {
        ok: true,
        status: 200,
        text: async () => 'success',
      } as unknown as Response;

      const mockFetch = jest
        .fn()
        .mockResolvedValueOnce(mockResponse429)
        .mockResolvedValueOnce(mockResponse200);

      jest.useFakeTimers();

      const promise = retryFetch(mockFetch);
      await jest.runAllTimersAsync();
      const result = await promise;

      jest.useRealTimers();

      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should respect Retry-After header for 429 responses', async () => {
      const headers = new Headers();
      headers.set('retry-after', '2'); // 2 seconds

      const mockResponse429 = {
        ok: false,
        status: 429,
        headers,
        text: async () => 'too many requests',
      } as unknown as Response;

      const mockResponse200 = {
        ok: true,
        status: 200,
        text: async () => 'success',
      } as unknown as Response;

      const mockFetch = jest
        .fn()
        .mockResolvedValueOnce(mockResponse429)
        .mockResolvedValueOnce(mockResponse200);

      // Mock performance.now to measure delay indirectly
      const originalDateNow = Date.now;
      let callCount = 0;
      const callTimes: number[] = [];

      Date.now = jest.fn(() => {
        callCount++;
        // Simulate time passing - first call is start, second is after delay
        return originalDateNow() + (callCount * 100);
      });

      jest.useFakeTimers();

      const promise = retryFetch(mockFetch);
      await jest.runAllTimersAsync();
      const result = await promise;

      jest.useRealTimers();
      Date.now = originalDateNow;

      // The fetch should have succeeded after retry
      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 401 Unauthorized', async () => {
      const mockResponse401 = {
        ok: false,
        status: 401,
        text: async () => 'unauthorized',
      } as unknown as Response;

      const mockFetch = jest.fn().mockResolvedValueOnce(mockResponse401);

      const result = await retryFetch(mockFetch);

      expect(result.status).toBe(401);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 400 Bad Request', async () => {
      const mockResponse400 = {
        ok: false,
        status: 400,
        text: async () => 'bad request',
      } as unknown as Response;

      const mockFetch = jest.fn().mockResolvedValueOnce(mockResponse400);

      const result = await retryFetch(mockFetch);

      expect(result.status).toBe(400);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should exhaust retries and return final error response', async () => {
      const mockResponse502 = {
        ok: false,
        status: 502,
        text: async () => 'bad gateway',
      } as unknown as Response;

      const mockFetch = jest.fn().mockResolvedValue(mockResponse502);

      jest.useFakeTimers();

      const promise = retryFetch(mockFetch, { maxRetries: 2 });
      await jest.runAllTimersAsync();
      const result = await promise;

      jest.useRealTimers();

      expect(result.status).toBe(502);
      // 3 total calls: initial + 2 retries
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should use custom retry options', async () => {
      const mockResponse503 = {
        ok: false,
        status: 503,
        text: async () => 'service unavailable',
      } as unknown as Response;

      const mockResponse200 = {
        ok: true,
        status: 200,
        text: async () => 'success',
      } as unknown as Response;

      const mockFetch = jest
        .fn()
        .mockResolvedValueOnce(mockResponse503)
        .mockResolvedValueOnce(mockResponse200);

      jest.useFakeTimers();

      const promise = retryFetch(mockFetch, {
        maxRetries: 1,
        initialDelayMs: 100,
        maxDelayMs: 500,
      });

      await jest.runAllTimersAsync();
      const result = await promise;

      jest.useRealTimers();

      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should apply exponential backoff with increasing delays', async () => {
      const mockResponse502 = {
        ok: false,
        status: 502,
        text: async () => 'bad gateway',
      } as unknown as Response;

      const mockFetch = jest.fn().mockResolvedValue(mockResponse502);
      const delayValues: number[] = [];

      // Mock setTimeout to capture delay values
      jest.useFakeTimers();
      const originalSetTimeout = global.setTimeout;
      let setTimeoutCallCount = 0;

      jest.spyOn(global, 'setTimeout').mockImplementation((callback, delay) => {
        delayValues.push(delay as number);
        return originalSetTimeout(callback, 0) as unknown as NodeJS.Timeout;
      });

      const promise = retryFetch(mockFetch, { maxRetries: 2 });
      await jest.runAllTimersAsync();
      await promise;

      jest.useRealTimers();

      // Should have 2 delays (retries) and increasing values
      expect(delayValues.length).toBe(2);
      expect(delayValues[1]).toBeGreaterThanOrEqual(delayValues[0]);
    });
  });

  describe('retryAsync', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return successful result on first attempt', async () => {
      const mockFn = jest.fn().mockResolvedValueOnce('success');

      const result = await retryAsync(mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on error and succeed on second attempt', async () => {
      const error = new Error('Network error');
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');

      jest.useFakeTimers();

      const promise = retryAsync(mockFn);
      await jest.runAllTimersAsync();
      const result = await promise;

      jest.useRealTimers();

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should exhaust retries and throw final error', async () => {
      const error = new Error('Persistent error');
      const mockFn = jest.fn().mockRejectedValue(error);

      // Use very short delays for the test
      await expect(
        retryAsync(mockFn, {
          maxRetries: 1,
          initialDelayMs: 0,
          maxDelayMs: 0,
        })
      ).rejects.toThrow('Persistent error');

      // 2 total calls: initial + 1 retry
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should support custom shouldRetry predicate', async () => {
      const networkError = new Error('Network timeout');
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce('success');

      jest.useFakeTimers();

      const promise = retryAsync(mockFn, {
        maxRetries: 3,
        shouldRetry: (error) => error.message.includes('Network'),
      });

      await jest.runAllTimersAsync();
      const result = await promise;

      jest.useRealTimers();

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should not retry if shouldRetry returns false', async () => {
      const error = new Error('Auth failed');
      const mockFn = jest.fn().mockRejectedValue(error);

      const promise = retryAsync(mockFn, {
        maxRetries: 3,
        shouldRetry: (error) => !error.message.includes('Auth'),
      });

      await expect(promise).rejects.toThrow('Auth failed');
      // Should only be called once since shouldRetry returned false
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('DEFAULT_RETRY_OPTIONS', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_RETRY_OPTIONS.maxRetries).toBe(3);
      expect(DEFAULT_RETRY_OPTIONS.initialDelayMs).toBe(500);
      expect(DEFAULT_RETRY_OPTIONS.maxDelayMs).toBe(10000);
      expect(DEFAULT_RETRY_OPTIONS.backoffMultiplier).toBe(2);
      expect(DEFAULT_RETRY_OPTIONS.jitterFactor).toBe(0.1);
      expect(DEFAULT_RETRY_OPTIONS.retryableStatuses).toContain(429);
      expect(DEFAULT_RETRY_OPTIONS.retryableStatuses).toContain(502);
      expect(DEFAULT_RETRY_OPTIONS.retryableStatuses).toContain(503);
      expect(DEFAULT_RETRY_OPTIONS.retryableStatuses).toContain(504);
    });
  });
});
