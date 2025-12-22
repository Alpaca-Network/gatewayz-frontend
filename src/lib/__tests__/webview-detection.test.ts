/**
 * Tests for WebView detection utility
 * 
 * Note: These tests use jest.spyOn to mock navigator.userAgent since window
 * cannot be easily redefined in JSDOM.
 */

import { isRestrictedWebView, supportsEmbeddedWallets, getWebViewInfo } from '../webview-detection';

describe('webview-detection', () => {
  const mockUserAgent = (userAgent: string) => {
    Object.defineProperty(navigator, 'userAgent', {
      value: userAgent,
      configurable: true,
    });
  };

  const originalUserAgent = navigator.userAgent;

  afterEach(() => {
    // Restore original userAgent
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
  });

  describe('isRestrictedWebView', () => {
    describe('Twitter WebView', () => {
      it('should detect Twitter in-app browser on iOS', () => {
        mockUserAgent(
          'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter for iPhone'
        );
        expect(isRestrictedWebView()).toBe(true);
      });

      it('should detect Twitter in-app browser on Android', () => {
        mockUserAgent(
          'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Twitter/10.0.0 Chrome/118.0.0.0 Mobile Safari/537.36'
        );
        expect(isRestrictedWebView()).toBe(true);
      });
    });

    describe('Facebook WebView', () => {
      it('should detect Facebook in-app browser with FBAN', () => {
        mockUserAgent(
          'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/338.0.0.0.0]'
        );
        expect(isRestrictedWebView()).toBe(true);
      });

      it('should detect Facebook in-app browser with FB_IAB', () => {
        mockUserAgent(
          'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.5005.99 Mobile Safari/537.36 FB_IAB/FB4A'
        );
        expect(isRestrictedWebView()).toBe(true);
      });
    });

    describe('Instagram WebView', () => {
      it('should detect Instagram in-app browser', () => {
        mockUserAgent(
          'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 250.0.0.0'
        );
        expect(isRestrictedWebView()).toBe(true);
      });
    });

    describe('LinkedIn WebView', () => {
      it('should detect LinkedIn in-app browser', () => {
        mockUserAgent(
          'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]'
        );
        expect(isRestrictedWebView()).toBe(true);
      });
    });

    describe('TikTok WebView', () => {
      it('should detect TikTok in-app browser', () => {
        mockUserAgent(
          'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 TikTok/25.0.0'
        );
        expect(isRestrictedWebView()).toBe(true);
      });

      it('should detect ByteDance in-app browser', () => {
        mockUserAgent(
          'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.5005.99 Mobile Safari/537.36 ByteDance'
        );
        expect(isRestrictedWebView()).toBe(true);
      });
    });

    describe('Snapchat WebView', () => {
      it('should detect Snapchat in-app browser', () => {
        mockUserAgent(
          'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Snapchat/12.0.0.0'
        );
        expect(isRestrictedWebView()).toBe(true);
      });
    });

    describe('Line WebView', () => {
      it('should detect Line in-app browser', () => {
        mockUserAgent(
          'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Line/12.0.0'
        );
        expect(isRestrictedWebView()).toBe(true);
      });
    });

    describe('WeChat WebView', () => {
      it('should detect WeChat in-app browser with MicroMessenger', () => {
        mockUserAgent(
          'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.0'
        );
        expect(isRestrictedWebView()).toBe(true);
      });

      it('should detect WeChat in-app browser with WeChat keyword', () => {
        mockUserAgent(
          'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.5005.99 Mobile Safari/537.36 WeChat/8.0.0'
        );
        expect(isRestrictedWebView()).toBe(true);
      });
    });

    describe('Generic iOS WebView', () => {
      it('should detect generic iOS WebView (AppleWebKit without Safari)', () => {
        mockUserAgent(
          'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
        );
        expect(isRestrictedWebView()).toBe(true);
      });
    });

    describe('Generic Android WebView', () => {
      it('should detect generic Android WebView with wv marker', () => {
        mockUserAgent(
          'Mozilla/5.0 (Linux; Android 12; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/102.0.5005.99 Mobile Safari/537.36'
        );
        expect(isRestrictedWebView()).toBe(true);
      });
    });

    describe('Regular browsers (not WebViews)', () => {
      it('should not detect Chrome on iOS as WebView', () => {
        mockUserAgent(
          'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/96.0.4664.116 Mobile/15E148 Safari/604.1'
        );
        expect(isRestrictedWebView()).toBe(false);
      });

      it('should not detect Safari on iOS as WebView', () => {
        mockUserAgent(
          'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
        );
        expect(isRestrictedWebView()).toBe(false);
      });

      it('should not detect Chrome on Android as WebView', () => {
        mockUserAgent(
          'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.5005.99 Mobile Safari/537.36'
        );
        expect(isRestrictedWebView()).toBe(false);
      });

      it('should not detect Chrome on desktop as WebView', () => {
        mockUserAgent(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
        );
        expect(isRestrictedWebView()).toBe(false);
      });

      it('should not detect Firefox on desktop as WebView', () => {
        mockUserAgent(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0'
        );
        expect(isRestrictedWebView()).toBe(false);
      });
    });
  });

  describe('supportsEmbeddedWallets', () => {
    it('should return false for Twitter WebView', () => {
      mockUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter for iPhone'
      );
      expect(supportsEmbeddedWallets()).toBe(false);
    });

    it('should return true for regular Safari browser', () => {
      mockUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
      );
      expect(supportsEmbeddedWallets()).toBe(true);
    });

    it('should return true for regular Chrome browser', () => {
      mockUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
      );
      expect(supportsEmbeddedWallets()).toBe(true);
    });
  });

  describe('getWebViewInfo', () => {
    it('should return correct info for Twitter WebView', () => {
      mockUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter for iPhone'
      );
      
      const info = getWebViewInfo();
      
      expect(info.isRestrictedWebView).toBe(true);
      expect(info.supportsEmbeddedWallets).toBe(false);
      expect(info.detectedPlatform).toBe('Twitter');
      expect(info.userAgent).toContain('Twitter');
    });

    it('should return correct info for Facebook WebView', () => {
      mockUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS]'
      );
      
      const info = getWebViewInfo();
      
      expect(info.isRestrictedWebView).toBe(true);
      expect(info.supportsEmbeddedWallets).toBe(false);
      expect(info.detectedPlatform).toBe('Facebook');
    });

    it('should return correct info for regular browser', () => {
      mockUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
      );
      
      const info = getWebViewInfo();
      
      expect(info.isRestrictedWebView).toBe(false);
      expect(info.supportsEmbeddedWallets).toBe(true);
      expect(info.detectedPlatform).toBeNull();
    });
  });
});
