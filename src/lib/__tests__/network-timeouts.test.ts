/**
 * Tests for network-timeouts.ts
 *
 * Validates adaptive timeout behavior for different network conditions,
 * device types, and visibility states - critical for mobile streaming support.
 */

// Mock the navigator and document before importing the module
const mockNavigator = {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
  connection: undefined as any,
  mozConnection: undefined as any,
  webkitConnection: undefined as any,
};

const mockMatchMedia = jest.fn(() => ({ matches: false }));
const mockVisibilityState = { value: 'visible' };

// Setup mocks before tests
Object.defineProperty(window, 'matchMedia', {
  value: mockMatchMedia,
  configurable: true,
});

// Import after mocks are set up
import { getAdaptiveTimeout } from '../network-timeouts';

describe('getAdaptiveTimeout', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    mockMatchMedia.mockReturnValue({ matches: false });
    mockVisibilityState.value = 'visible';

    // Reset navigator mock
    mockNavigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0';
    mockNavigator.connection = undefined;
    mockNavigator.mozConnection = undefined;
    mockNavigator.webkitConnection = undefined;

    // Mock navigator
    Object.defineProperty(navigator, 'userAgent', {
      value: mockNavigator.userAgent,
      configurable: true,
    });

    Object.defineProperty(navigator, 'connection', {
      value: mockNavigator.connection,
      configurable: true,
    });

    // Mock document.visibilityState
    Object.defineProperty(document, 'visibilityState', {
      value: mockVisibilityState.value,
      configurable: true,
    });
  });

  describe('Base timeout handling', () => {
    test('should return base timeout when no conditions are met', () => {
      const result = getAdaptiveTimeout(10000);
      expect(result).toBe(10000);
    });

    test('should return base timeout for invalid inputs', () => {
      expect(getAdaptiveTimeout(0)).toBe(0);
      expect(getAdaptiveTimeout(-100)).toBe(-100);
      expect(getAdaptiveTimeout(NaN)).toBe(NaN);
      expect(getAdaptiveTimeout(Infinity)).toBe(Infinity);
    });
  });

  describe('Mobile device detection', () => {
    test('should increase timeout for iPhone user agent', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        configurable: true,
      });

      const result = getAdaptiveTimeout(10000, { mobileMultiplier: 2.0 });
      expect(result).toBeGreaterThanOrEqual(17500); // Default mobile multiplier is 1.75
    });

    test('should increase timeout for Android user agent', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0 Mobile',
        configurable: true,
      });

      const result = getAdaptiveTimeout(10000, { mobileMultiplier: 2.0 });
      expect(result).toBeGreaterThanOrEqual(17500);
    });

    test('should increase timeout for iPad user agent', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        configurable: true,
      });

      const result = getAdaptiveTimeout(10000);
      expect(result).toBeGreaterThan(10000);
    });

    test('should detect mobile via pointer: coarse media query', () => {
      mockMatchMedia.mockReturnValue({ matches: true });

      const result = getAdaptiveTimeout(10000);
      expect(result).toBeGreaterThan(10000);
    });
  });

  describe('Slow network detection', () => {
    test('should increase timeout for 2G networks', () => {
      Object.defineProperty(navigator, 'connection', {
        value: { effectiveType: '2g' },
        configurable: true,
      });

      const result = getAdaptiveTimeout(10000);
      expect(result).toBeGreaterThan(20000); // Should be multiplied by slowNetworkMultiplier
    });

    test('should increase timeout for slow-2g networks', () => {
      Object.defineProperty(navigator, 'connection', {
        value: { effectiveType: 'slow-2g' },
        configurable: true,
      });

      const result = getAdaptiveTimeout(10000);
      expect(result).toBeGreaterThan(25000); // Should be multiplied by slowNetworkMultiplier * 1.3
    });

    test('should increase timeout for 3G networks', () => {
      Object.defineProperty(navigator, 'connection', {
        value: { effectiveType: '3g' },
        configurable: true,
      });

      const result = getAdaptiveTimeout(10000);
      expect(result).toBeGreaterThan(20000); // Should be multiplied by slowNetworkMultiplier
    });

    test('should increase timeout for low downlink speeds', () => {
      Object.defineProperty(navigator, 'connection', {
        value: { effectiveType: '4g', downlink: 0.5 },
        configurable: true,
      });

      const result = getAdaptiveTimeout(10000);
      expect(result).toBeGreaterThan(10000);
    });

    test('should increase timeout when saveData is enabled', () => {
      Object.defineProperty(navigator, 'connection', {
        value: { effectiveType: '4g', saveData: true },
        configurable: true,
      });

      const result = getAdaptiveTimeout(10000);
      expect(result).toBeGreaterThan(10000);
    });
  });

  describe('Background tab detection', () => {
    test('should increase timeout when tab is hidden', () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      });

      const result = getAdaptiveTimeout(10000);
      expect(result).toBeGreaterThan(10000);
    });
  });

  describe('Combined conditions', () => {
    test('should apply multiple multipliers for mobile + slow network', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        configurable: true,
      });
      Object.defineProperty(navigator, 'connection', {
        value: { effectiveType: '3g' },
        configurable: true,
      });

      const result = getAdaptiveTimeout(10000);
      // Should be significantly higher due to both mobile and slow network
      expect(result).toBeGreaterThan(20000);
    });

    test('should apply mobile + hidden tab multipliers', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        configurable: true,
      });
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      });

      const result = getAdaptiveTimeout(10000);
      expect(result).toBeGreaterThan(15000);
    });
  });

  describe('Options handling', () => {
    test('should respect custom mobileMultiplier', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        configurable: true,
      });

      const result = getAdaptiveTimeout(10000, { mobileMultiplier: 3.0 });
      expect(result).toBeGreaterThanOrEqual(30000);
    });

    test('should respect maxMs cap', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        configurable: true,
      });
      Object.defineProperty(navigator, 'connection', {
        value: { effectiveType: 'slow-2g' },
        configurable: true,
      });
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      });

      const result = getAdaptiveTimeout(10000, { maxMs: 15000 });
      expect(result).toBeLessThanOrEqual(15000);
    });

    test('should respect minMs floor', () => {
      const result = getAdaptiveTimeout(10000, { minMs: 20000 });
      expect(result).toBeGreaterThanOrEqual(20000);
    });
  });

  describe('Streaming-specific scenarios', () => {
    test('should provide appropriate first chunk timeout for mobile', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        configurable: true,
      });

      // Simulating streaming.ts first chunk timeout settings
      const baseFirstChunkTimeout = 10000;
      const result = getAdaptiveTimeout(baseFirstChunkTimeout, {
        mobileMultiplier: 3.0,
        slowNetworkMultiplier: 4.0,
        maxMs: 60000,
      });

      expect(result).toBeGreaterThanOrEqual(30000); // At least 30 seconds on mobile
      expect(result).toBeLessThanOrEqual(60000); // Capped at 60 seconds
    });

    test('should provide appropriate chunk timeout for mobile', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        configurable: true,
      });

      // Simulating streaming.ts chunk timeout settings
      const baseChunkTimeout = 30000;
      const result = getAdaptiveTimeout(baseChunkTimeout, {
        mobileMultiplier: 2.0,
        slowNetworkMultiplier: 2.5,
        maxMs: 90000,
      });

      expect(result).toBeGreaterThanOrEqual(52500); // At least ~52.5 seconds on mobile (1.75 default multiplier)
      expect(result).toBeLessThanOrEqual(90000); // Capped at 90 seconds
    });

    test('should provide appropriate stream timeout for mobile on 3G', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        configurable: true,
      });
      Object.defineProperty(navigator, 'connection', {
        value: { effectiveType: '3g' },
        configurable: true,
      });

      // Simulating streaming.ts overall stream timeout settings
      const baseStreamTimeout = 600000; // 10 minutes
      const result = getAdaptiveTimeout(baseStreamTimeout, {
        mobileMultiplier: 1.5,
        slowNetworkMultiplier: 2.0,
        maxMs: 1200000, // 20 minutes
      });

      // Should be significantly higher due to both mobile and 3G network
      expect(result).toBeGreaterThanOrEqual(600000); // At least 10 minutes
      expect(result).toBeLessThanOrEqual(1200000); // Capped at 20 minutes
    });
  });
});
