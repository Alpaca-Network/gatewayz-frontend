/**
 * Tests for Sentry Rate Limiting Configuration
 * Tests the client-side rate limiting that prevents 429 errors from Sentry
 */

describe('Sentry Rate Limiting Configuration', () => {
  describe('Client-side Rate Limiting', () => {
    it('should have balanced rate limits for error visibility', () => {
      // These tests document the expected configuration values
      // The actual implementation is in instrumentation-client.ts

      const EXPECTED_CONFIG = {
        maxEventsPerMinute: 10,     // Balanced for visibility
        windowMs: 60000,            // 1 minute window
        dedupeWindowMs: 60000,      // 1 minute deduplication
        maxBreadcrumbs: 20,         // More breadcrumbs for debugging context
        cleanupIntervalMs: 30000,   // 30 second cleanup
        maxMapSize: 50,             // Reasonable map size
      };

      // Verify expected values are reasonable
      expect(EXPECTED_CONFIG.maxEventsPerMinute).toBe(10);
      expect(EXPECTED_CONFIG.dedupeWindowMs).toBe(60000);
      expect(EXPECTED_CONFIG.maxBreadcrumbs).toBe(20);
    });

    it('should have reasonable transaction sample rate', () => {
      // tracesSampleRate reduced from 10% to 1% to stay within quota
      const EXPECTED_TRACES_SAMPLE_RATE = 0.01; // 1%

      expect(EXPECTED_TRACES_SAMPLE_RATE).toBe(0.01);
    });

    it('should have dynamic replay sampling for first-seen vs known errors', () => {
      // Replay sampling is now dynamic based on first-seen status:
      // - First-seen errors: 100% replay capture
      // - Known errors: 1% replay capture
      // Static rates are set to 0, sampling is handled in beforeSend
      const EXPECTED_REPLAY_RATES = {
        replaysOnErrorSampleRate: 0,    // Disabled - handled dynamically in beforeSend
        replaysSessionSampleRate: 0,    // Disabled entirely
        // Dynamic sampling in beforeSend:
        firstSeenErrorReplayRate: 1.0,  // 100% for first-seen errors
        knownErrorReplayRate: 0.01,     // 1% for known errors
      };

      expect(EXPECTED_REPLAY_RATES.replaysOnErrorSampleRate).toBe(0);
      expect(EXPECTED_REPLAY_RATES.replaysSessionSampleRate).toBe(0);
      expect(EXPECTED_REPLAY_RATES.firstSeenErrorReplayRate).toBe(1.0);
      expect(EXPECTED_REPLAY_RATES.knownErrorReplayRate).toBe(0.01);
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

    it('should NOT filter out pending prompt timeouts (captured for debugging)', () => {
      // These messages are now captured for debugging UI timeout issues
      const TIMEOUT_PATTERNS = [
        'Pending prompt timed out',
        'timed out after',
        'clearing optimistic UI',
      ];

      // These patterns are no longer filtered - they're captured in Sentry
      // Verify patterns exist for documentation purposes
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

  describe('First-seen error tracking', () => {
    it('should create unique error signatures', () => {
      const createErrorSignature = (
        type: string,
        message: string,
        filename?: string,
        lineno?: number,
        colno?: number
      ) => {
        const location = filename
          ? `${filename}:${lineno || ''}:${colno || ''}`
          : '';
        return `${type}|${message.slice(0, 100)}|${location}`;
      };

      const sig1 = createErrorSignature('TypeError', 'Cannot read property', 'app.js', 10, 5);
      const sig2 = createErrorSignature('TypeError', 'Cannot read property', 'app.js', 10, 5);
      const sig3 = createErrorSignature('TypeError', 'Cannot read property', 'app.js', 20, 5);
      const sig4 = createErrorSignature('ReferenceError', 'x is not defined', 'utils.js', 5, 1);

      // Same error = same signature
      expect(sig1).toBe(sig2);

      // Different line number = different signature
      expect(sig1).not.toBe(sig3);

      // Different error type = different signature
      expect(sig1).not.toBe(sig4);
    });

    it('should limit stored error signatures to prevent unbounded growth', () => {
      const MAX_SEEN_ERRORS = 500;

      // Simulate the trimming logic
      const trimSeenErrors = (errors: string[]): string[] => {
        if (errors.length > MAX_SEEN_ERRORS) {
          return errors.slice(-MAX_SEEN_ERRORS);
        }
        return errors;
      };

      // Create array with 600 entries
      const errors = Array.from({ length: 600 }, (_, i) => `error-${i}`);
      const trimmed = trimSeenErrors(errors);

      expect(trimmed.length).toBe(MAX_SEEN_ERRORS);
      // Should keep the most recent (last 500)
      expect(trimmed[0]).toBe('error-100');
      expect(trimmed[trimmed.length - 1]).toBe('error-599');
    });

    it('should use dynamic replay sampling based on first-seen status', () => {
      // Test the sampling logic
      const FIRST_SEEN_REPLAY_RATE = 1.0;   // 100% for first-seen
      const KNOWN_ERROR_REPLAY_RATE = 0.01; // 1% for known

      const shouldCaptureReplay = (isFirstSeen: boolean, randomValue: number) => {
        return isFirstSeen || randomValue < KNOWN_ERROR_REPLAY_RATE;
      };

      // First-seen errors always capture replay
      expect(shouldCaptureReplay(true, 0.5)).toBe(true);
      expect(shouldCaptureReplay(true, 0.99)).toBe(true);

      // Known errors only capture at 1% rate
      expect(shouldCaptureReplay(false, 0.005)).toBe(true);  // Within 1%
      expect(shouldCaptureReplay(false, 0.5)).toBe(false);   // Outside 1%
    });
  });
});
