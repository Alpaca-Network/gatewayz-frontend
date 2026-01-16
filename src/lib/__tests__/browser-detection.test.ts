import {
  isIOSInAppBrowser,
  isTauriDesktop,
  shouldDisableEmbeddedWallets,
  getBrowserEnvironmentInfo,
} from '../browser-detection';

describe('browser-detection', () => {
  const originalUserAgent = navigator.userAgent;

  const setUserAgent = (ua: string) => {
    Object.defineProperty(navigator, 'userAgent', {
      value: ua,
      writable: true,
      configurable: true,
    });
  };

  afterEach(() => {
    // Restore original userAgent
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      writable: true,
      configurable: true,
    });
  });

  describe('isIOSInAppBrowser', () => {
    it('should return false for desktop browsers', () => {
      setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      expect(isIOSInAppBrowser()).toBe(false);
    });

    it('should return false for iOS Safari', () => {
      setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
      expect(isIOSInAppBrowser()).toBe(false);
    });

    it('should return false for iOS Chrome', () => {
      setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1');
      expect(isIOSInAppBrowser()).toBe(false);
    });

    it('should return true for iOS Twitter in-app browser', () => {
      setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_7_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22B91 Twitter for iPhone');
      expect(isIOSInAppBrowser()).toBe(true);
    });

    it('should return true for iOS Facebook in-app browser', () => {
      setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/450.0.0.0]');
      expect(isIOSInAppBrowser()).toBe(true);
    });

    it('should return true for iOS Instagram in-app browser', () => {
      setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram');
      expect(isIOSInAppBrowser()).toBe(true);
    });

    it('should return true for iOS TikTok in-app browser', () => {
      setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 TikTok');
      expect(isIOSInAppBrowser()).toBe(true);
    });

    it('should return true for iOS WebView without Safari', () => {
      setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148');
      expect(isIOSInAppBrowser()).toBe(true);
    });

    it('should return false for Android browsers', () => {
      setUserAgent('Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');
      expect(isIOSInAppBrowser()).toBe(false);
    });

    it('should return true for iOS WhatsApp in-app browser', () => {
      setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 WhatsApp/2.23.0');
      expect(isIOSInAppBrowser()).toBe(true);
    });

    it('should return true for iOS LinkedIn in-app browser', () => {
      setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 LinkedIn');
      expect(isIOSInAppBrowser()).toBe(true);
    });

    it('should return true for iOS Discord in-app browser', () => {
      setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Discord');
      expect(isIOSInAppBrowser()).toBe(true);
    });
  });

  describe('isTauriDesktop', () => {
    const originalTauri = (window as Record<string, unknown>).__TAURI__;

    afterEach(() => {
      // Restore original values
      if (originalTauri !== undefined) {
        (window as Record<string, unknown>).__TAURI__ = originalTauri;
      } else {
        delete (window as Record<string, unknown>).__TAURI__;
      }
    });

    it('should return false for regular web browsers', () => {
      delete (window as Record<string, unknown>).__TAURI__;
      expect(isTauriDesktop()).toBe(false);
    });

    it('should return true when __TAURI__ global is present', () => {
      (window as Record<string, unknown>).__TAURI__ = {};
      expect(isTauriDesktop()).toBe(true);
    });

    // Note: Cannot test tauri.localhost hostname in jsdom as window.location.hostname
    // cannot be redefined. The __TAURI__ global check is the primary detection method.
  });

  describe('shouldDisableEmbeddedWallets', () => {
    const originalTauri = (window as Record<string, unknown>).__TAURI__;

    afterEach(() => {
      // Restore original values
      if (originalTauri !== undefined) {
        (window as Record<string, unknown>).__TAURI__ = originalTauri;
      } else {
        delete (window as Record<string, unknown>).__TAURI__;
      }
    });

    it('should return false for desktop browsers', () => {
      delete (window as Record<string, unknown>).__TAURI__;
      setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      expect(shouldDisableEmbeddedWallets()).toBe(false);
    });

    it('should return true for iOS Twitter browser', () => {
      delete (window as Record<string, unknown>).__TAURI__;
      setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_7_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22B91 Twitter for iPhone');
      expect(shouldDisableEmbeddedWallets()).toBe(true);
    });

    it('should return false for iOS Safari', () => {
      delete (window as Record<string, unknown>).__TAURI__;
      setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
      expect(shouldDisableEmbeddedWallets()).toBe(false);
    });

    it('should return true for Tauri desktop app', () => {
      (window as Record<string, unknown>).__TAURI__ = {};
      setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) GatewayZ/0.2.0 Chrome/128.0.0.0 Safari/537.36');
      expect(shouldDisableEmbeddedWallets()).toBe(true);
    });
  });

  describe('getBrowserEnvironmentInfo', () => {
    const originalTauri = (window as Record<string, unknown>).__TAURI__;

    afterEach(() => {
      // Restore original values
      if (originalTauri !== undefined) {
        (window as Record<string, unknown>).__TAURI__ = originalTauri;
      } else {
        delete (window as Record<string, unknown>).__TAURI__;
      }
    });

    it('should return iOS info for iOS Safari', () => {
      delete (window as Record<string, unknown>).__TAURI__;
      setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
      const info = getBrowserEnvironmentInfo();
      expect(info.isIOS).toBe(true);
      expect(info.isInAppBrowser).toBe(false);
      expect(info.isTauri).toBe(false);
      expect(info.userAgent).toContain('iPhone');
    });

    it('should return in-app browser info for iOS Twitter', () => {
      delete (window as Record<string, unknown>).__TAURI__;
      setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_7_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22B91 Twitter for iPhone');
      const info = getBrowserEnvironmentInfo();
      expect(info.isIOS).toBe(true);
      expect(info.isInAppBrowser).toBe(true);
      expect(info.isTauri).toBe(false);
    });

    it('should return desktop info for macOS Chrome', () => {
      delete (window as Record<string, unknown>).__TAURI__;
      setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      const info = getBrowserEnvironmentInfo();
      expect(info.isIOS).toBe(false);
      expect(info.isInAppBrowser).toBe(false);
      expect(info.isTauri).toBe(false);
    });

    it('should report indexedDB support correctly', () => {
      delete (window as Record<string, unknown>).__TAURI__;
      setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      const info = getBrowserEnvironmentInfo();
      // jsdom may or may not have indexedDB defined depending on configuration
      expect(typeof info.indexedDBSupported).toBe('boolean');
    });

    it('should return Tauri info for desktop app', () => {
      (window as Record<string, unknown>).__TAURI__ = {};
      setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) GatewayZ/0.2.0 Chrome/128.0.0.0 Safari/537.36');
      const info = getBrowserEnvironmentInfo();
      expect(info.isIOS).toBe(false);
      expect(info.isInAppBrowser).toBe(false);
      expect(info.isTauri).toBe(true);
    });
  });
});
