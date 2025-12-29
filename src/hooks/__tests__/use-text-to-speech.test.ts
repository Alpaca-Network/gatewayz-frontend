/**
 * Tests for the useTextToSpeech hook
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useTextToSpeech } from '../use-text-to-speech';
import { useAuthStore } from '@/lib/store/auth-store';
import { useToast } from '@/hooks/use-toast';

// Mock dependencies
jest.mock('@/lib/store/auth-store', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: jest.fn(),
}));

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('useTextToSpeech', () => {
  const mockToast = jest.fn();
  const mockUseAuthStore = useAuthStore as jest.Mock;
  const mockUseToast = useToast as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthStore.mockReturnValue({ apiKey: 'test-api-key' });
    mockUseToast.mockReturnValue({ toast: mockToast });
  });

  describe('Initial state', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useTextToSpeech());

      expect(result.current.isGenerating).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.lastResult).toBeNull();
      expect(typeof result.current.generateSpeech).toBe('function');
      expect(typeof result.current.clearError).toBe('function');
    });
  });

  describe('generateSpeech', () => {
    it('should reject empty text', async () => {
      const { result } = renderHook(() => useTextToSpeech());

      let ttsResult: any;
      await act(async () => {
        ttsResult = await result.current.generateSpeech('');
      });

      expect(ttsResult).toBeNull();
      expect(result.current.error).toBe('Text cannot be empty');
    });

    it('should reject whitespace-only text', async () => {
      const { result } = renderHook(() => useTextToSpeech());

      let ttsResult: any;
      await act(async () => {
        ttsResult = await result.current.generateSpeech('   ');
      });

      expect(ttsResult).toBeNull();
      expect(result.current.error).toBe('Text cannot be empty');
    });

    it('should reject text over 5000 characters', async () => {
      const { result } = renderHook(() => useTextToSpeech());
      const longText = 'a'.repeat(5001);

      let ttsResult: any;
      await act(async () => {
        ttsResult = await result.current.generateSpeech(longText);
      });

      expect(ttsResult).toBeNull();
      expect(result.current.error).toBe('Text too long (max 5000 characters)');
    });

    it('should make API call with correct parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          result: {
            audio_base64: 'data:audio/wav;base64,SGVsbG8=',
            duration: 1.5,
            format: 'wav',
            model: 'chatterbox-turbo',
            language: 'en',
          },
        }),
      });

      const { result } = renderHook(() => useTextToSpeech());

      let ttsResult: any;
      await act(async () => {
        ttsResult = await result.current.generateSpeech('Hello world');
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/tools/execute');
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(options.headers['Authorization']).toBe('Bearer test-api-key');

      const body = JSON.parse(options.body);
      expect(body.name).toBe('text_to_speech');
      expect(body.parameters.text).toBe('Hello world');
      expect(body.parameters.model).toBe('chatterbox-turbo');
      expect(body.parameters.language).toBe('en');
    });

    it('should return correct result on success', async () => {
      const mockResult = {
        audio_base64: 'data:audio/wav;base64,SGVsbG8=',
        duration: 1.5,
        format: 'wav',
        model: 'chatterbox-turbo',
        language: 'en',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          result: mockResult,
        }),
      });

      const { result } = renderHook(() => useTextToSpeech());

      let ttsResult: any;
      await act(async () => {
        ttsResult = await result.current.generateSpeech('Hello world');
      });

      expect(ttsResult).toEqual({
        audioUrl: undefined,
        audioBase64: 'data:audio/wav;base64,SGVsbG8=',
        duration: 1.5,
        format: 'wav',
        model: 'chatterbox-turbo',
        language: 'en',
      });
      expect(result.current.lastResult).toEqual(ttsResult);
      expect(result.current.error).toBeNull();
    });

    it('should handle API error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          detail: 'Invalid request',
        }),
      });

      const { result } = renderHook(() => useTextToSpeech());

      let ttsResult: any;
      await act(async () => {
        ttsResult = await result.current.generateSpeech('Hello world');
      });

      expect(ttsResult).toBeNull();
      expect(result.current.error).toBe('Invalid request');
      expect(mockToast).toHaveBeenCalledWith({
        title: 'TTS Error',
        description: 'Invalid request',
        variant: 'destructive',
      });
    });

    it('should handle unsuccessful TTS result', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          error: 'TTS generation failed',
        }),
      });

      const { result } = renderHook(() => useTextToSpeech());

      let ttsResult: any;
      await act(async () => {
        ttsResult = await result.current.generateSpeech('Hello world');
      });

      expect(ttsResult).toBeNull();
      expect(result.current.error).toBe('TTS generation failed');
    });

    it('should handle network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useTextToSpeech());

      let ttsResult: any;
      await act(async () => {
        ttsResult = await result.current.generateSpeech('Hello world');
      });

      expect(ttsResult).toBeNull();
      expect(result.current.error).toBe('Network error');
    });

    it('should set isGenerating during API call', async () => {
      let resolvePromise: (value: any) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce(pendingPromise);

      const { result } = renderHook(() => useTextToSpeech());

      expect(result.current.isGenerating).toBe(false);

      // Start the generation but don't await
      act(() => {
        result.current.generateSpeech('Hello world');
      });

      // isGenerating should be true while waiting
      await waitFor(() => {
        expect(result.current.isGenerating).toBe(true);
      });

      // Resolve the promise
      await act(async () => {
        resolvePromise!({
          ok: true,
          json: async () => ({
            success: true,
            result: { format: 'wav', model: 'chatterbox-turbo', language: 'en' },
          }),
        });
      });

      // isGenerating should be false after completion
      await waitFor(() => {
        expect(result.current.isGenerating).toBe(false);
      });
    });

    it('should pass custom options to API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          result: {
            format: 'wav',
            model: 'chatterbox-multilingual',
            language: 'fr',
          },
        }),
      });

      const { result } = renderHook(() => useTextToSpeech());

      await act(async () => {
        await result.current.generateSpeech('Bonjour', {
          model: 'chatterbox-multilingual',
          language: 'fr',
          voiceReferenceUrl: 'https://example.com/voice.wav',
          exaggeration: 1.5,
          cfgWeight: 0.7,
        });
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.parameters.model).toBe('chatterbox-multilingual');
      expect(body.parameters.language).toBe('fr');
      expect(body.parameters.voice_reference_url).toBe('https://example.com/voice.wav');
      expect(body.parameters.exaggeration).toBe(1.5);
      expect(body.parameters.cfg_weight).toBe(0.7);
    });

    it('should work without API key', async () => {
      mockUseAuthStore.mockReturnValue({ apiKey: null });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          result: { format: 'wav', model: 'chatterbox-turbo', language: 'en' },
        }),
      });

      const { result } = renderHook(() => useTextToSpeech());

      await act(async () => {
        await result.current.generateSpeech('Hello');
      });

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBeUndefined();
    });
  });

  describe('clearError', () => {
    it('should clear error state', async () => {
      const { result } = renderHook(() => useTextToSpeech());

      // First, create an error
      await act(async () => {
        await result.current.generateSpeech('');
      });

      expect(result.current.error).toBe('Text cannot be empty');

      // Clear the error
      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });
});
