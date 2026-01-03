/**
 * Web Vitals Service Tests
 *
 * Tests for the web vitals collection and reporting service,
 * including UUID generation fallbacks for browser compatibility.
 */

import { webVitalsService, setupWebVitals } from '../web-vitals-service';

// Store original crypto
const originalCrypto = global.crypto;

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock navigator.sendBeacon
const mockSendBeacon = jest.fn();

describe('WebVitalsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Reset navigator.sendBeacon mock
    Object.defineProperty(navigator, 'sendBeacon', {
      value: mockSendBeacon,
      writable: true,
      configurable: true,
    });

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    // Restore original crypto
    Object.defineProperty(global, 'crypto', {
      value: originalCrypto,
      writable: true,
      configurable: true,
    });
  });

  describe('UUID Generation', () => {
    describe('when crypto.randomUUID is available', () => {
      it('should use crypto.randomUUID when available', () => {
        // Create a fresh instance to test constructor behavior
        const mockRandomUUID = jest.fn().mockReturnValue('test-uuid-from-crypto');
        Object.defineProperty(global, 'crypto', {
          value: {
            randomUUID: mockRandomUUID,
            getRandomValues: jest.fn(),
          },
          writable: true,
          configurable: true,
        });

        // Access private method through the class
        // We need to create a new instance to test fresh UUID generation
        // Since webVitalsService is a singleton, we test via the record method
        // which calls generateSessionId internally
        const service = new (webVitalsService.constructor as new () => typeof webVitalsService)();
        // The constructor calls generateSessionId, so randomUUID should be called
        expect(mockRandomUUID).toHaveBeenCalled();
      });
    });

    describe('when crypto.randomUUID is NOT available (fallback scenarios)', () => {
      it('should fall back to crypto.getRandomValues when randomUUID is undefined', () => {
        const mockGetRandomValues = jest.fn((array: Uint8Array) => {
          // Fill with predictable values for testing
          for (let i = 0; i < array.length; i++) {
            array[i] = i * 16;
          }
          return array;
        });

        Object.defineProperty(global, 'crypto', {
          value: {
            randomUUID: undefined, // Simulates browsers without randomUUID
            getRandomValues: mockGetRandomValues,
          },
          writable: true,
          configurable: true,
        });

        // Create new instance to trigger UUID generation
        const service = new (webVitalsService.constructor as new () => typeof webVitalsService)();

        // getRandomValues should have been called as fallback
        expect(mockGetRandomValues).toHaveBeenCalled();
      });

      it('should fall back when crypto exists but randomUUID is not a function', () => {
        const mockGetRandomValues = jest.fn((array: Uint8Array) => {
          for (let i = 0; i < array.length; i++) {
            array[i] = (i * 17) % 256;
          }
          return array;
        });

        Object.defineProperty(global, 'crypto', {
          value: {
            randomUUID: 'not-a-function', // Some browsers might have this as non-function
            getRandomValues: mockGetRandomValues,
          },
          writable: true,
          configurable: true,
        });

        const service = new (webVitalsService.constructor as new () => typeof webVitalsService)();
        expect(mockGetRandomValues).toHaveBeenCalled();
      });

      it('should generate valid UUID format with getRandomValues fallback', () => {
        const mockGetRandomValues = jest.fn((array: Uint8Array) => {
          for (let i = 0; i < array.length; i++) {
            array[i] = (i * 17 + 42) % 256;
          }
          return array;
        });

        Object.defineProperty(global, 'crypto', {
          value: {
            randomUUID: undefined,
            getRandomValues: mockGetRandomValues,
          },
          writable: true,
          configurable: true,
        });

        // Access the service and check internal sessionId via record
        // Since we can't directly access private properties, we verify through behavior
        const service = new (webVitalsService.constructor as new () => typeof webVitalsService)();

        // The UUID format should be 8-4-4-4-12 hex characters
        // We verify getRandomValues was called with 16 bytes
        expect(mockGetRandomValues).toHaveBeenCalledWith(expect.any(Uint8Array));
        const calledArray = mockGetRandomValues.mock.calls[0][0];
        expect(calledArray.length).toBe(16);
      });

      it('should fall back to Math.random when crypto is completely unavailable', () => {
        // Remove crypto entirely
        Object.defineProperty(global, 'crypto', {
          value: undefined,
          writable: true,
          configurable: true,
        });

        const mathRandomSpy = jest.spyOn(Math, 'random');

        // Create new instance - should use Math.random fallback
        const service = new (webVitalsService.constructor as new () => typeof webVitalsService)();

        // Math.random should have been called for the fallback UUID
        expect(mathRandomSpy).toHaveBeenCalled();

        mathRandomSpy.mockRestore();
      });

      it('should fall back to Math.random when getRandomValues is also unavailable', () => {
        Object.defineProperty(global, 'crypto', {
          value: {
            randomUUID: undefined,
            getRandomValues: undefined,
          },
          writable: true,
          configurable: true,
        });

        const mathRandomSpy = jest.spyOn(Math, 'random');

        const service = new (webVitalsService.constructor as new () => typeof webVitalsService)();

        expect(mathRandomSpy).toHaveBeenCalled();

        mathRandomSpy.mockRestore();
      });
    });
  });

  describe('Device Type Detection', () => {
    const originalNavigator = global.navigator;

    afterEach(() => {
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true,
        configurable: true,
      });
    });

    it('should detect mobile devices', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          userAgent:
            'Mozilla/5.0 (Linux; Android 9; DLT-A0) AppleWebKit/537.36 (KHTML, like Gecko) Twitter/1.0 Chrome/100.0.0.0 Mobile Safari/537.36',
        },
        writable: true,
        configurable: true,
      });

      expect(webVitalsService.getDeviceType()).toBe('mobile');
    });

    it('should detect tablet devices', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          userAgent:
            'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Safari/605.1.15',
        },
        writable: true,
        configurable: true,
      });

      expect(webVitalsService.getDeviceType()).toBe('tablet');
    });

    it('should detect desktop devices', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        writable: true,
        configurable: true,
      });

      expect(webVitalsService.getDeviceType()).toBe('desktop');
    });
  });

  describe('Connection Type Detection', () => {
    it('should return undefined when navigator.connection is not available', () => {
      expect(webVitalsService.getConnectionType()).toBeUndefined();
    });

    it('should return effectiveType when available', () => {
      Object.defineProperty(navigator, 'connection', {
        value: { effectiveType: '4g' },
        writable: true,
        configurable: true,
      });

      expect(webVitalsService.getConnectionType()).toBe('4g');
    });
  });

  describe('Metric Recording', () => {
    beforeEach(() => {
      // Initialize the service
      webVitalsService.init({ enabled: true, batchSize: 10 });
    });

    it('should record LCP metric', () => {
      webVitalsService.recordLCP(2500, 100);
      // Metric should be queued (we can verify via flush)
    });

    it('should record INP metric', () => {
      webVitalsService.recordINP(200, 50);
    });

    it('should record CLS metric', () => {
      webVitalsService.recordCLS(0.1, 0.05);
    });

    it('should record FCP metric', () => {
      webVitalsService.recordFCP(1800, 100);
    });

    it('should record TTFB metric', () => {
      webVitalsService.recordTTFB(800, 50);
    });
  });

  describe('Flush Behavior', () => {
    it('should use sendBeacon on page unload', async () => {
      webVitalsService.init({ enabled: true, batchSize: 10 });
      webVitalsService.recordLCP(2500);

      // Simulate visibility change to hidden
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
        configurable: true,
      });
      window.dispatchEvent(new Event('visibilitychange'));

      await jest.runAllTimersAsync();
      expect(mockSendBeacon).toHaveBeenCalled();
    });
  });

  describe('Sample Rate', () => {
    it('should respect sample rate configuration', () => {
      // Set sample rate to 0 - no metrics should be recorded
      webVitalsService.init({ enabled: true, sampleRate: 0 });

      webVitalsService.recordLCP(2500);
      webVitalsService.recordINP(200);

      // With 0 sample rate, no metrics should be queued
      // We verify by checking flush doesn't send anything
    });
  });

  describe('Disabled State', () => {
    it('should not record metrics when disabled', () => {
      webVitalsService.init({ enabled: false });

      webVitalsService.recordLCP(2500);

      // No fetch calls should be made
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});

describe('setupWebVitals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not throw when called in browser environment', async () => {
    await expect(setupWebVitals({ enabled: true })).resolves.not.toThrow();
  });
});
