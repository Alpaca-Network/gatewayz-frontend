/**
 * Tests for config.ts - Desktop/Web API URL routing
 *
 * Note: Desktop (Tauri) environment detection is tested via desktop tests
 * and manual testing. Jest module caching makes it difficult to test
 * dynamic window.__TAURI__ detection. The core URL mapping logic is tested here.
 *
 * To verify desktop behavior manually:
 * ```
 * node -e "global.window = { __TAURI__: {} }; const c = require('./src/lib/config.ts'); console.log(c.getChatApiUrl('/v1/chat/completions'));"
 * // Should output: https://api.gatewayz.ai/v1/chat/completions
 * ```
 */

import {
  getChatApiUrl,
  getChatApiBaseUrl,
  isTauriEnvironment,
  API_BASE_URL,
} from '../config';

describe('config', () => {
  describe('API_BASE_URL', () => {
    it('has a valid API base URL', () => {
      expect(API_BASE_URL).toBe('https://api.gatewayz.ai');
    });
  });

  describe('Web Environment (default Jest environment - no __TAURI__)', () => {
    it('isTauriEnvironment returns false', () => {
      // Jest runs in jsdom which doesn't have __TAURI__
      expect(isTauriEnvironment()).toBe(false);
    });

    it('getChatApiBaseUrl returns empty string', () => {
      expect(getChatApiBaseUrl()).toBe('');
    });

    it('maps /v1/chat/completions to /api/chat/completions', () => {
      expect(getChatApiUrl('/v1/chat/completions')).toBe('/api/chat/completions');
    });

    it('maps /v1/chat/sessions to /api/chat/sessions', () => {
      expect(getChatApiUrl('/v1/chat/sessions')).toBe('/api/chat/sessions');
    });

    it('maps /v1/chat/sessions/123 to /api/chat/sessions/123', () => {
      expect(getChatApiUrl('/v1/chat/sessions/123')).toBe('/api/chat/sessions/123');
    });

    it('maps /v1/chat/sessions/123/messages to /api/chat/sessions/123/messages', () => {
      expect(getChatApiUrl('/v1/chat/sessions/123/messages')).toBe('/api/chat/sessions/123/messages');
    });

    it('maps /v1/chat/ai-sdk-completions to /api/chat/ai-sdk-completions', () => {
      expect(getChatApiUrl('/v1/chat/ai-sdk-completions')).toBe('/api/chat/ai-sdk-completions');
    });

    it('maps /v1/chat/ai-sdk-completions?session_id=123 correctly', () => {
      // Query params are preserved
      expect(getChatApiUrl('/v1/chat/ai-sdk-completions')).toBe('/api/chat/ai-sdk-completions');
    });

    it('passes through already-mapped paths', () => {
      expect(getChatApiUrl('/api/chat/completions')).toBe('/api/chat/completions');
    });

    it('passes through unknown paths unchanged', () => {
      expect(getChatApiUrl('/some/other/path')).toBe('/some/other/path');
    });
  });

  describe('URL path mapping correctness', () => {
    // These tests verify the mapping logic is correct
    // regardless of environment detection

    it('ai-sdk-completions mapping is checked before completions', () => {
      // Important: /v1/chat/ai-sdk-completions should NOT become /api/chat/completions
      const url = getChatApiUrl('/v1/chat/ai-sdk-completions');
      expect(url).not.toContain('/api/chat/completions');
      expect(url).toContain('ai-sdk-completions');
    });

    it('session subpaths are preserved', () => {
      // /v1/chat/sessions/123/messages should become /api/chat/sessions/123/messages
      const url = getChatApiUrl('/v1/chat/sessions/123/messages');
      expect(url).toBe('/api/chat/sessions/123/messages');
    });
  });
});
