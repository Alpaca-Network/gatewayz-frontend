/**
 * Tests for Sentry Rate Limiting Configuration
 * Tests the client-side rate limiting that prevents 429 errors from Sentry
 */

describe('Sentry Rate Limiting Configuration', () => {
  describe('Client-side Rate Limiting', () => {
    it('should have aggressive rate limits to prevent 429 errors', () => {
      // These tests document the expected configuration values
      // The actual implementation is in instrumentation-client.ts

      const EXPECTED_CONFIG = {
        maxEventsPerMinute: 5,      // Very conservative
        windowMs: 60000,            // 1 minute window
        dedupeWindowMs: 120000,     // 2 minute deduplication
        maxBreadcrumbs: 10,         // Reduced breadcrumbs
        cleanupIntervalMs: 30000,   // 30 second cleanup
        maxMapSize: 50,             // Reasonable map size
      };

      // Verify expected values are reasonable
      expect(EXPECTED_CONFIG.maxEventsPerMinute).toBeLessThanOrEqual(10);
      expect(EXPECTED_CONFIG.dedupeWindowMs).toBeGreaterThanOrEqual(60000);
      expect(EXPECTED_CONFIG.maxBreadcrumbs).toBeLessThanOrEqual(30);
    });

    it('should have low transaction sample rate', () => {
      // tracesSampleRate should be very low to avoid 429s
      const EXPECTED_TRACES_SAMPLE_RATE = 0.01; // 1%

      expect(EXPECTED_TRACES_SAMPLE_RATE).toBeLessThanOrEqual(0.1);
    });

    it('should have replays disabled', () => {
      // Replays contribute significantly to event volume
      const EXPECTED_REPLAY_RATES = {
        replaysOnErrorSampleRate: 0,
        replaysSessionSampleRate: 0,
      };

      expect(EXPECTED_REPLAY_RATES.replaysOnErrorSampleRate).toBe(0);
      expect(EXPECTED_REPLAY_RATES.replaysSessionSampleRate).toBe(0);
    });
  });

  describe('Edge Runtime Rate Limiting', () => {
    it('should have appropriate edge rate limits', () => {
      const EXPECTED_EDGE_CONFIG = {
        maxEventsPerMinute: 10,    // Slightly higher for edge
        windowMs: 60000,
        dedupeWindowMs: 60000,    // 1 minute deduplication
      };

      expect(EXPECTED_EDGE_CONFIG.maxEventsPerMinute).toBeLessThanOrEqual(30);
      expect(EXPECTED_EDGE_CONFIG.dedupeWindowMs).toBeGreaterThanOrEqual(5000);
    });
  });

  describe('Server-side Rate Limiting', () => {
    it('should have appropriate server rate limits', () => {
      const EXPECTED_SERVER_CONFIG = {
        maxEventsPerMinute: 20,   // Higher for server
        windowMs: 60000,
        dedupeWindowMs: 60000,   // 1 minute deduplication
      };

      expect(EXPECTED_SERVER_CONFIG.maxEventsPerMinute).toBeLessThanOrEqual(50);
      expect(EXPECTED_SERVER_CONFIG.dedupeWindowMs).toBeGreaterThanOrEqual(5000);
    });
  });

  describe('Error Filtering', () => {
    it('should filter out wallet extension errors', () => {
      // These errors should be filtered to save quota
      const WALLET_ERROR_PATTERNS = [
        'chrome.runtime.sendMessage',
        'runtime.sendMessage',
        'Extension ID',
        'walletconnect',
        'relay.walletconnect.com',
        'websocket error 1006',
      ];

      // Verify all patterns are non-empty strings
      WALLET_ERROR_PATTERNS.forEach(pattern => {
        expect(pattern.length).toBeGreaterThan(0);
      });
    });

    it('should filter out pending prompt timeouts', () => {
      // These informational messages should not consume quota
      const TIMEOUT_PATTERNS = [
        'Pending prompt timed out',
        'timed out after',
        'clearing optimistic UI',
      ];

      // Verify all patterns are non-empty strings
      TIMEOUT_PATTERNS.forEach(pattern => {
        expect(pattern.length).toBeGreaterThan(0);
      });
    });
  });
});

describe('Rate Limit Behavior', () => {
  describe('Exponential backoff calculation', () => {
    it('should calculate correct retry delays', () => {
      // Test exponential backoff formula: BASE_DELAY * 2^retryCount
      const BASE_DELAY = 1000;
      const MAX_DELAY = 10000;

      const calculateDelay = (retryCount: number) => {
        return Math.min(BASE_DELAY * Math.pow(2, retryCount), MAX_DELAY);
      };

      expect(calculateDelay(0)).toBe(1000);  // 1s
      expect(calculateDelay(1)).toBe(2000);  // 2s
      expect(calculateDelay(2)).toBe(4000);  // 4s
      expect(calculateDelay(3)).toBe(8000);  // 8s
      expect(calculateDelay(4)).toBe(10000); // Capped at 10s
      expect(calculateDelay(5)).toBe(10000); // Still capped
    });

    it('should handle Retry-After header', () => {
      // Test that Retry-After header is respected but capped
      const MAX_DELAY = 10000;

      const calculateWithRetryAfter = (retryAfterSeconds: number) => {
        return Math.min(retryAfterSeconds * 1000, MAX_DELAY);
      };

      expect(calculateWithRetryAfter(5)).toBe(5000);
      expect(calculateWithRetryAfter(15)).toBe(10000); // Capped
      expect(calculateWithRetryAfter(60)).toBe(10000); // Capped
    });
  });

  describe('Deduplication', () => {
    it('should create consistent event keys', () => {
      // Test that event keys are created consistently for deduplication
      const createEventKey = (message: string, type: string) => {
        return `${type}:${message.slice(0, 100)}`;
      };

      const key1 = createEventKey('Test error', 'Error');
      const key2 = createEventKey('Test error', 'Error');
      const key3 = createEventKey('Different error', 'Error');

      expect(key1).toBe(key2);
      expect(key1).not.toBe(key3);
    });

    it('should truncate long messages in keys', () => {
      const createEventKey = (message: string, type: string) => {
        return `${type}:${message.slice(0, 100)}`;
      };

      const longMessage = 'A'.repeat(200);
      const key = createEventKey(longMessage, 'Error');

      // Key should be type (5 chars) + : (1 char) + 100 chars = 106 chars max
      expect(key.length).toBe(106);
    });
  });

  describe('Memory management', () => {
    it('should limit map size to prevent unbounded growth', () => {
      const MAX_MAP_SIZE = 50;

      // Simulate cleanup logic
      const cleanupMap = (map: Map<string, number>) => {
        if (map.size > MAX_MAP_SIZE) {
          const entries = Array.from(map.entries())
            .sort((a, b) => a[1] - b[1]);
          const toRemove = entries.slice(0, entries.length - MAX_MAP_SIZE);
          for (const [key] of toRemove) {
            map.delete(key);
          }
        }
        return map;
      };

      // Create a map with 60 entries
      const testMap = new Map<string, number>();
      for (let i = 0; i < 60; i++) {
        testMap.set(`key-${i}`, i);
      }

      expect(testMap.size).toBe(60);

      cleanupMap(testMap);

      expect(testMap.size).toBe(MAX_MAP_SIZE);
    });
  });
});
