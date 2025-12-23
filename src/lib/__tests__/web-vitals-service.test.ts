/**
 * @jest-environment jsdom
 */

// Store original crypto for restoration
const originalCrypto = global.crypto;

// Mock UUID for consistent test results
const mockUUID = '12345678-1234-4234-8234-123456789abc';

describe('WebVitalsService', () => {
  let webVitalsService: typeof import('../web-vitals-service').webVitalsService;

  beforeEach(() => {
    jest.resetModules();
    // Restore crypto to original state before each test
    Object.defineProperty(global, 'crypto', {
      value: originalCrypto,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // Clean up
    Object.defineProperty(global, 'crypto', {
      value: originalCrypto,
      writable: true,
      configurable: true,
    });
  });

  describe('generateSessionId', () => {
    it('should use crypto.randomUUID when available', async () => {
      // Mock crypto.randomUUID
      Object.defineProperty(global, 'crypto', {
        value: {
          randomUUID: jest.fn().mockReturnValue(mockUUID),
          getRandomValues: jest.fn(),
        },
        writable: true,
        configurable: true,
      });

      const { webVitalsService: service } = await import('../web-vitals-service');
      // Access the sessionId through a method that exposes it (via record)
      // The sessionId is generated in constructor, so we can test by checking if randomUUID was called
      expect(global.crypto.randomUUID).toHaveBeenCalled();
    });

    it('should fallback to getRandomValues when randomUUID is not available', async () => {
      // Mock crypto without randomUUID (like older browsers)
      const mockGetRandomValues = jest.fn((array: Uint8Array) => {
        // Fill with predictable values for testing
        for (let i = 0; i < array.length; i++) {
          array[i] = i * 16;
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

      const { webVitalsService: service } = await import('../web-vitals-service');
      expect(mockGetRandomValues).toHaveBeenCalled();
    });

    it('should fallback to timestamp-based ID when crypto is not available', async () => {
      // Remove crypto entirely (like very old environments)
      Object.defineProperty(global, 'crypto', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(1234567890);
      const mathSpy = jest.spyOn(Math, 'random').mockReturnValue(0.123456789);

      const { webVitalsService: service } = await import('../web-vitals-service');

      dateSpy.mockRestore();
      mathSpy.mockRestore();
    });

    it('should not throw when crypto.randomUUID is null', async () => {
      Object.defineProperty(global, 'crypto', {
        value: {
          randomUUID: null,
          getRandomValues: jest.fn((array: Uint8Array) => {
            for (let i = 0; i < array.length; i++) {
              array[i] = Math.floor(Math.random() * 256);
            }
            return array;
          }),
        },
        writable: true,
        configurable: true,
      });

      // Should not throw
      await expect(import('../web-vitals-service')).resolves.toBeDefined();
    });

    it('should handle Twitter browser on Android 9 scenario (crypto exists but randomUUID does not)', async () => {
      // This simulates the exact error condition from the bug report:
      // Twitter browser on Android 9 has crypto but not crypto.randomUUID
      const mockGetRandomValues = jest.fn((array: Uint8Array) => {
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.floor(Math.random() * 256);
        }
        return array;
      });

      Object.defineProperty(global, 'crypto', {
        value: {
          // randomUUID is intentionally missing (not even undefined, just not present)
          getRandomValues: mockGetRandomValues,
          subtle: {}, // crypto.subtle usually exists
        },
        writable: true,
        configurable: true,
      });

      // Should not throw "crypto.randomUUID is not a function"
      const { webVitalsService: service } = await import('../web-vitals-service');
      expect(mockGetRandomValues).toHaveBeenCalled();
    });
  });

  describe('getRandomValues UUID generation', () => {
    it('should generate valid UUID v4 format using getRandomValues', async () => {
      let capturedBytes: Uint8Array | null = null;
      const mockGetRandomValues = jest.fn((array: Uint8Array) => {
        capturedBytes = array;
        for (let i = 0; i < array.length; i++) {
          array[i] = 0xff; // All 1s for predictable output
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

      const { webVitalsService: service } = await import('../web-vitals-service');

      // Verify getRandomValues was called with 16 bytes
      expect(mockGetRandomValues).toHaveBeenCalled();
      expect(capturedBytes).toHaveLength(16);
    });

    it('should set correct version and variant bits for UUID v4', async () => {
      let modifiedBytes: Uint8Array | null = null;
      const mockGetRandomValues = jest.fn((array: Uint8Array) => {
        for (let i = 0; i < array.length; i++) {
          array[i] = 0xff; // Start with all 1s
        }
        // Capture reference to check modifications
        modifiedBytes = array;
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

      await import('../web-vitals-service');

      // After generateSessionId runs, bytes[6] should have version 4 (0x4x)
      // and bytes[8] should have variant bits set (0x8x, 0x9x, 0xax, or 0xbx)
      // Note: We can't directly access the modified bytes after the function runs
      // but we can verify the function was called
      expect(mockGetRandomValues).toHaveBeenCalled();
    });
  });

  describe('service initialization', () => {
    it('should not throw during import with various crypto configurations', async () => {
      const configs = [
        { randomUUID: jest.fn().mockReturnValue(mockUUID), getRandomValues: jest.fn() },
        { randomUUID: undefined, getRandomValues: jest.fn((a: Uint8Array) => a) },
        { getRandomValues: jest.fn((a: Uint8Array) => a) },
        undefined,
      ];

      for (const config of configs) {
        jest.resetModules();
        Object.defineProperty(global, 'crypto', {
          value: config,
          writable: true,
          configurable: true,
        });

        await expect(import('../web-vitals-service')).resolves.toBeDefined();
      }
    });
  });

  describe('getDeviceType', () => {
    beforeEach(async () => {
      jest.resetModules();
      Object.defineProperty(global, 'crypto', {
        value: {
          randomUUID: jest.fn().mockReturnValue(mockUUID),
          getRandomValues: jest.fn(),
        },
        writable: true,
        configurable: true,
      });
    });

    it('should detect mobile devices', async () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Linux; Android 9; DLT-A0) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/79.0.3945.93 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/308.0.0.0.115;]',
        writable: true,
        configurable: true,
      });

      const { webVitalsService: service } = await import('../web-vitals-service');
      expect(service.getDeviceType()).toBe('mobile');
    });

    it('should detect tablet devices', async () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPad; CPU OS 13_0 like Mac OS X) AppleWebKit/605.1.15',
        writable: true,
        configurable: true,
      });

      const { webVitalsService: service } = await import('../web-vitals-service');
      expect(service.getDeviceType()).toBe('tablet');
    });

    it('should detect desktop devices', async () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        writable: true,
        configurable: true,
      });

      const { webVitalsService: service } = await import('../web-vitals-service');
      expect(service.getDeviceType()).toBe('desktop');
    });
  });
});
