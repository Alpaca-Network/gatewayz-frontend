import { monitoringService } from '../monitoring-service';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Monitoring Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('fetchWithOptionalAuth', () => {
    describe('429 Rate Limit Handling', () => {
      it('should retry on 429 and succeed on second attempt', async () => {
        const mockResponse429 = {
          ok: false,
          status: 429,
          headers: new Headers(),
        };

        const mockResponse200 = {
          ok: true,
          status: 200,
          json: async () => ({ data: 'success' }),
        };

        mockFetch
          .mockResolvedValueOnce(mockResponse429)
          .mockResolvedValueOnce(mockResponse200);

        const promise = monitoringService.getHealthStats();
        await jest.runAllTimersAsync();
        const result = await promise;

        expect(result).toEqual({ data: 'success' });
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      it('should throw error after max retries for 429', async () => {
        const mockResponse429 = {
          ok: false,
          status: 429,
          headers: new Headers(),
        };

        mockFetch.mockResolvedValue(mockResponse429);

        let error: Error | null = null;
        const promise = monitoringService.getHealthStats().catch(e => {
          error = e;
        });

        // Run all timers to allow retries to complete
        await jest.runAllTimersAsync();
        await promise;

        expect(error).not.toBeNull();
        expect(error?.message).toContain('Rate limit exceeded');
      });

      it('should respect Retry-After header for 429', async () => {
        const headers = new Headers();
        headers.set('retry-after', '5');

        const mockResponse429 = {
          ok: false,
          status: 429,
          headers,
        };

        const mockResponse200 = {
          ok: true,
          status: 200,
          json: async () => ({ data: 'success' }),
        };

        mockFetch
          .mockResolvedValueOnce(mockResponse429)
          .mockResolvedValueOnce(mockResponse200);

        const promise = monitoringService.getHealthStats();
        await jest.runAllTimersAsync();
        const result = await promise;

        expect(result).toEqual({ data: 'success' });
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      it('should cap Retry-After at MAX_RETRY_DELAY_MS to prevent long waits', async () => {
        // Large Retry-After value (1 hour = 3600 seconds)
        const headers = new Headers();
        headers.set('retry-after', '3600');

        const mockResponse429 = {
          ok: false,
          status: 429,
          headers,
        };

        const mockResponse200 = {
          ok: true,
          status: 200,
          json: async () => ({ data: 'success' }),
        };

        mockFetch
          .mockResolvedValueOnce(mockResponse429)
          .mockResolvedValueOnce(mockResponse200);

        // Track setTimeout calls to verify delay is capped
        const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

        const promise = monitoringService.getHealthStats();
        await jest.runAllTimersAsync();
        const result = await promise;

        expect(result).toEqual({ data: 'success' });

        // Find the retry delay setTimeout call (should be capped at ~10000ms + jitter, not 3600000ms)
        // MAX_RETRY_DELAY_MS is 10000, plus up to 500ms jitter
        const retryCall = setTimeoutSpy.mock.calls.find(
          call => typeof call[1] === 'number' && call[1] > 500
        );
        expect(retryCall).toBeDefined();
        // Delay should be at most MAX_RETRY_DELAY_MS (10000) + jitter (500) = 10500ms
        // NOT 3600000ms (1 hour)
        expect(retryCall![1]).toBeLessThanOrEqual(10500);
        expect(retryCall![1]).toBeLessThan(3600000);

        setTimeoutSpy.mockRestore();
      });
    });

    describe('502/503/504 Server Error Handling', () => {
      it('should retry on 502 Bad Gateway and succeed', async () => {
        const mockResponse502 = {
          ok: false,
          status: 502,
          headers: new Headers(),
        };

        const mockResponse200 = {
          ok: true,
          status: 200,
          json: async () => ({ data: 'success' }),
        };

        mockFetch
          .mockResolvedValueOnce(mockResponse502)
          .mockResolvedValueOnce(mockResponse200);

        const promise = monitoringService.getHealthStats();
        await jest.runAllTimersAsync();
        const result = await promise;

        expect(result).toEqual({ data: 'success' });
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      it('should retry on 503 Service Unavailable and succeed', async () => {
        const mockResponse503 = {
          ok: false,
          status: 503,
          headers: new Headers(),
        };

        const mockResponse200 = {
          ok: true,
          status: 200,
          json: async () => ({ data: 'success' }),
        };

        mockFetch
          .mockResolvedValueOnce(mockResponse503)
          .mockResolvedValueOnce(mockResponse200);

        const promise = monitoringService.getHealthStats();
        await jest.runAllTimersAsync();
        const result = await promise;

        expect(result).toEqual({ data: 'success' });
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      it('should retry on 504 Gateway Timeout and succeed', async () => {
        const mockResponse504 = {
          ok: false,
          status: 504,
          headers: new Headers(),
        };

        const mockResponse200 = {
          ok: true,
          status: 200,
          json: async () => ({ data: 'success' }),
        };

        mockFetch
          .mockResolvedValueOnce(mockResponse504)
          .mockResolvedValueOnce(mockResponse200);

        const promise = monitoringService.getHealthStats();
        await jest.runAllTimersAsync();
        const result = await promise;

        expect(result).toEqual({ data: 'success' });
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      it('should throw Gateway Timeout error after max retries for 504', async () => {
        const mockResponse504 = {
          ok: false,
          status: 504,
          headers: new Headers(),
        };

        mockFetch.mockResolvedValue(mockResponse504);

        let error: Error | null = null;
        const promise = monitoringService.getHealthStats().catch(e => {
          error = e;
        });

        await jest.runAllTimersAsync();
        await promise;

        expect(error).not.toBeNull();
        expect(error?.message).toContain('Gateway Timeout');
      });

      it('should throw Service Unavailable error after max retries for 503', async () => {
        const mockResponse503 = {
          ok: false,
          status: 503,
          headers: new Headers(),
        };

        mockFetch.mockResolvedValue(mockResponse503);

        let error: Error | null = null;
        const promise = monitoringService.getHealthStats().catch(e => {
          error = e;
        });

        await jest.runAllTimersAsync();
        await promise;

        expect(error).not.toBeNull();
        expect(error?.message).toContain('Service Unavailable');
      });

      it('should throw Bad Gateway error after max retries for 502', async () => {
        const mockResponse502 = {
          ok: false,
          status: 502,
          headers: new Headers(),
        };

        mockFetch.mockResolvedValue(mockResponse502);

        let error: Error | null = null;
        const promise = monitoringService.getHealthStats().catch(e => {
          error = e;
        });

        await jest.runAllTimersAsync();
        await promise;

        expect(error).not.toBeNull();
        expect(error?.message).toContain('Bad Gateway');
      });
    });

    describe('401 Unauthorized Handling', () => {
      it('should retry without auth on 401 when API key provided', async () => {
        const mockResponse401 = {
          ok: false,
          status: 401,
          headers: new Headers(),
        };

        const mockResponse200 = {
          ok: true,
          status: 200,
          json: async () => ({ data: 'public data' }),
        };

        mockFetch
          .mockResolvedValueOnce(mockResponse401)
          .mockResolvedValueOnce(mockResponse200);

        const result = await monitoringService.getHealthStats('test-api-key');

        expect(result).toEqual({ data: 'public data' });
        expect(mockFetch).toHaveBeenCalledTimes(2);

        // First call should have auth header
        expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe('Bearer test-api-key');
        // Second call should not have auth header
        expect(mockFetch.mock.calls[1][1].headers.Authorization).toBeUndefined();
      });
    });

    describe('404 Not Found Handling', () => {
      it('should throw error on 404', async () => {
        const mockResponse404 = {
          ok: false,
          status: 404,
          headers: new Headers(),
        };

        mockFetch.mockResolvedValueOnce(mockResponse404);

        await expect(monitoringService.getHealthStats()).rejects.toThrow('No data available');
      });

      it('should return null for getModelHealth on 404', async () => {
        const mockResponse404 = {
          ok: false,
          status: 404,
          headers: new Headers(),
        };

        mockFetch.mockResolvedValueOnce(mockResponse404);

        const result = await monitoringService.getModelHealth('openai', 'gpt-4');

        expect(result).toBeNull();
      });
    });

    describe('Other Error Handling', () => {
      it('should throw error for unhandled status codes', async () => {
        const mockResponse500 = {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          headers: new Headers(),
        };

        mockFetch.mockResolvedValueOnce(mockResponse500);

        await expect(monitoringService.getHealthStats()).rejects.toThrow('HTTP 500: Internal Server Error');
      });

      it('should propagate network errors', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network failure'));

        await expect(monitoringService.getHealthStats()).rejects.toThrow('Network failure');
      });
    });

    describe('Successful Responses', () => {
      it('should return data on successful response', async () => {
        const mockResponse200 = {
          ok: true,
          status: 200,
          json: async () => ({ health: 'good', models: 100 }),
        };

        mockFetch.mockResolvedValueOnce(mockResponse200);

        const result = await monitoringService.getHealthStats();

        expect(result).toEqual({ health: 'good', models: 100 });
      });
    });
  });

  describe('API Methods', () => {
    const mockSuccessResponse = {
      ok: true,
      status: 200,
      json: async () => ({ data: 'test' }),
    };

    beforeEach(() => {
      mockFetch.mockResolvedValue(mockSuccessResponse);
    });

    it('getModelHealth should call correct endpoint', async () => {
      await monitoringService.getModelHealth('openai', 'gpt-4');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/model-health/openai/gpt-4'),
        expect.any(Object)
      );
    });

    it('getHealthStats should call correct endpoint', async () => {
      await monitoringService.getHealthStats();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/model-health/stats'),
        expect.any(Object)
      );
    });

    it('getModelHealthList should call correct endpoint with pagination', async () => {
      await monitoringService.getModelHealthList(100, 50);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/model-health?limit=100&offset=50'),
        expect.any(Object)
      );
    });

    it('getUnhealthyModels should call correct endpoint with threshold', async () => {
      await monitoringService.getUnhealthyModels(0.3);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/model-health/unhealthy?error_threshold=0.3'),
        expect.any(Object)
      );
    });

    it('getProviderSummary should call correct endpoint', async () => {
      await monitoringService.getProviderSummary('anthropic');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/model-health/provider/anthropic/summary'),
        expect.any(Object)
      );
    });

    it('getProviderList should call correct endpoint', async () => {
      await monitoringService.getProviderList();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/model-health/providers'),
        expect.any(Object)
      );
    });
  });
});
