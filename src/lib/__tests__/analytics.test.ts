/**
 * Tests for analytics service
 * Backend analytics event logging with error handling
 */

import {
  logAnalyticsEvent,
  logAnalyticsEventBatch,
  isAnalyticsAvailable,
} from '../analytics';

// Mock fetch
global.fetch = jest.fn();

describe('analytics', () => {
  let mockLocalStorage: { [key: string]: string };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock localStorage
    mockLocalStorage = {};
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (key: string) => mockLocalStorage[key] || null,
        setItem: (key: string, value: string) => {
          mockLocalStorage[key] = value;
        },
        removeItem: (key: string) => {
          delete mockLocalStorage[key];
        },
        clear: () => {
          mockLocalStorage = {};
        },
      },
      writable: true,
    });

    // Reset fetch mock
    (global.fetch as jest.Mock).mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('isAnalyticsAvailable', () => {
    it('should return true when statsig is available', () => {
      (window as any).statsigAvailable = true;

      expect(isAnalyticsAvailable()).toBe(true);
    });

    it('should return false when statsig is blocked', () => {
      (window as any).statsigAvailable = false;

      expect(isAnalyticsAvailable()).toBe(false);
    });

    it('should return true by default if not explicitly blocked', () => {
      delete (window as any).statsigAvailable;

      expect(isAnalyticsAvailable()).toBe(true);
    });
  });

  describe('logAnalyticsEvent', () => {
    it('should send analytics event with API key', async () => {
      mockLocalStorage['gatewayz_api_key'] = 'test-api-key';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await logAnalyticsEvent('test_event', { foo: 'bar' }, 'test_value');

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/analytics/events',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-api-key',
          }),
          body: JSON.stringify({
            event_name: 'test_event',
            value: 'test_value',
            metadata: { foo: 'bar' },
          }),
        })
      );
    });

    it('should try alternative API key locations', async () => {
      mockLocalStorage['api_key'] = 'alternative-key';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await logAnalyticsEvent('test_event');

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/analytics/events',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer alternative-key',
          }),
        })
      );
    });

    it('should skip event if no API key found', async () => {
      const consoleDebug = jest.spyOn(console, 'debug').mockImplementation();

      await logAnalyticsEvent('test_event');

      expect(global.fetch).not.toHaveBeenCalled();
      expect(consoleDebug).toHaveBeenCalledWith(
        '[Analytics] No API key found, skipping event:',
        'test_event'
      );

      consoleDebug.mockRestore();
    });

    it('should handle failed requests gracefully', async () => {
      mockLocalStorage['gatewayz_api_key'] = 'test-key';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();

      await logAnalyticsEvent('test_event');

      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('[Analytics] Failed to log event'),
        'test_event',
        500
      );

      consoleWarn.mockRestore();
    });

    it('should handle network errors gracefully', async () => {
      mockLocalStorage['gatewayz_api_key'] = 'test-key';

      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      await logAnalyticsEvent('test_event');

      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('[Analytics] Error logging event'),
        'test_event',
        expect.any(Error)
      );

      consoleError.mockRestore();
    });

    it('should handle timeout', async () => {
      mockLocalStorage['gatewayz_api_key'] = 'test-key';

      // Mock a fetch that never resolves
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      const promise = logAnalyticsEvent('test_event');

      // Fast-forward past timeout (5 seconds)
      jest.advanceTimersByTime(6000);

      await promise;

      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('[Analytics] Error logging event'),
        'test_event',
        expect.any(Error)
      );

      consoleError.mockRestore();
    });

    it('should send events without metadata or value', async () => {
      mockLocalStorage['gatewayz_api_key'] = 'test-key';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await logAnalyticsEvent('simple_event');

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/analytics/events',
        expect.objectContaining({
          body: JSON.stringify({
            event_name: 'simple_event',
            value: undefined,
            metadata: undefined,
          }),
        })
      );
    });
  });

  describe('logAnalyticsEventBatch', () => {
    it('should send batch of events', async () => {
      mockLocalStorage['gatewayz_api_key'] = 'test-key';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const events = [
        { event_name: 'event1', value: 'value1' },
        { event_name: 'event2', metadata: { foo: 'bar' } },
      ];

      await logAnalyticsEventBatch(events);

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/analytics/batch',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-key',
          }),
          body: JSON.stringify({ events }),
        })
      );
    });

    it('should skip batch if no API key', async () => {
      const consoleDebug = jest.spyOn(console, 'debug').mockImplementation();

      await logAnalyticsEventBatch([{ event_name: 'test' }]);

      expect(global.fetch).not.toHaveBeenCalled();
      expect(consoleDebug).toHaveBeenCalled();

      consoleDebug.mockRestore();
    });

    it('should handle batch errors gracefully', async () => {
      mockLocalStorage['gatewayz_api_key'] = 'test-key';

      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Batch error')
      );

      const consoleDebug = jest.spyOn(console, 'debug').mockImplementation();

      await logAnalyticsEventBatch([{ event_name: 'test' }]);

      expect(consoleDebug).toHaveBeenCalled();

      consoleDebug.mockRestore();
    });

    it('should handle empty batch', async () => {
      mockLocalStorage['gatewayz_api_key'] = 'test-key';

      await logAnalyticsEventBatch([]);

      // Should still make request with empty array
      expect(global.fetch).toHaveBeenCalled();
    });
  });
});
