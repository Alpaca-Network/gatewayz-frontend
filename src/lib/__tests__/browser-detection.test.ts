/**
 * Tests for browser detection utilities
 */

// We need to test the functions with different user agents
// Since these functions check typeof window, we'll use jest.isolateModules
// and mock the global navigator properly

describe('browser-detection', () => {
  const setUserAgent = (userAgent: string) => {
    Object.defineProperty(global.navigator, 'userAgent', {
      value: userAgent,
      configurable: true,
    });
  };

  describe('isSafariBrowser', () => {
    it('returns true for Safari desktop', () => {
      setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
      );

      // Re-import to pick up new user agent
      jest.resetModules();
      const { isSafariBrowser } = require('../browser-detection');
      expect(isSafariBrowser()).toBe(true);
    });

    it('returns true for Safari on iPhone', () => {
      setUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      );

      jest.resetModules();
      const { isSafariBrowser } = require('../browser-detection');
      expect(isSafariBrowser()).toBe(true);
    });

    it('returns false for Chrome', () => {
      setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      jest.resetModules();
      const { isSafariBrowser } = require('../browser-detection');
      expect(isSafariBrowser()).toBe(false);
    });

    it('returns false for Firefox', () => {
      setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0'
      );

      jest.resetModules();
      const { isSafariBrowser } = require('../browser-detection');
      expect(isSafariBrowser()).toBe(false);
    });

    it('returns false for Edge', () => {
      setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
      );

      jest.resetModules();
      const { isSafariBrowser } = require('../browser-detection');
      expect(isSafariBrowser()).toBe(false);
    });
  });

  describe('isWebKitBrowser', () => {
    it('returns true for Safari', () => {
      setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
      );

      jest.resetModules();
      const { isWebKitBrowser } = require('../browser-detection');
      expect(isWebKitBrowser()).toBe(true);
    });

    it('returns false for Chrome (even though it has AppleWebKit)', () => {
      setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      jest.resetModules();
      const { isWebKitBrowser } = require('../browser-detection');
      expect(isWebKitBrowser()).toBe(false);
    });
  });

  describe('isIOSDevice', () => {
    it('returns true for iPhone', () => {
      setUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      );

      jest.resetModules();
      const { isIOSDevice } = require('../browser-detection');
      expect(isIOSDevice()).toBe(true);
    });

    it('returns true for iPad', () => {
      setUserAgent(
        'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      );

      jest.resetModules();
      const { isIOSDevice } = require('../browser-detection');
      expect(isIOSDevice()).toBe(true);
    });

    it('returns false for Android', () => {
      setUserAgent(
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
      );

      jest.resetModules();
      const { isIOSDevice } = require('../browser-detection');
      expect(isIOSDevice()).toBe(false);
    });

    it('returns false for macOS', () => {
      setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
      );

      jest.resetModules();
      const { isIOSDevice } = require('../browser-detection');
      expect(isIOSDevice()).toBe(false);
    });
  });

  describe('hasIndexedDBIssues', () => {
    it('returns true for Safari desktop', () => {
      setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
      );

      jest.resetModules();
      const { hasIndexedDBIssues } = require('../browser-detection');
      expect(hasIndexedDBIssues()).toBe(true);
    });

    it('returns true for Safari on iPhone', () => {
      setUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      );

      jest.resetModules();
      const { hasIndexedDBIssues } = require('../browser-detection');
      expect(hasIndexedDBIssues()).toBe(true);
    });

    it('returns true for Chrome on iOS (uses WebKit)', () => {
      setUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1'
      );

      jest.resetModules();
      const { hasIndexedDBIssues } = require('../browser-detection');
      // Chrome on iOS still reports as iPhone, so isIOSDevice returns true
      expect(hasIndexedDBIssues()).toBe(true);
    });

    it('returns false for Chrome on desktop', () => {
      setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      jest.resetModules();
      const { hasIndexedDBIssues } = require('../browser-detection');
      expect(hasIndexedDBIssues()).toBe(false);
    });

    it('returns false for Firefox on desktop', () => {
      setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0'
      );

      jest.resetModules();
      const { hasIndexedDBIssues } = require('../browser-detection');
      expect(hasIndexedDBIssues()).toBe(false);
    });

    it('returns false for Chrome on Android', () => {
      setUserAgent(
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
      );

      jest.resetModules();
      const { hasIndexedDBIssues } = require('../browser-detection');
      expect(hasIndexedDBIssues()).toBe(false);
    });
  });
});
