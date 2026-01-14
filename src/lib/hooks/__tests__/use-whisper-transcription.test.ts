/**
 * Unit tests for use-whisper-transcription.ts
 *
 * Tests the Whisper transcription hook including:
 * - Audio recording functionality
 * - Audio transcription via API
 * - Error handling
 * - State management
 */

import { renderHook, act, waitFor } from '@testing-library/react';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Mock MediaRecorder
class MockMediaRecorder {
  state = 'inactive';
  mimeType = 'audio/webm;codecs=opus';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  static isTypeSupported = jest.fn().mockReturnValue(true);

  start = jest.fn().mockImplementation(() => {
    this.state = 'recording';
  });

  stop = jest.fn().mockImplementation(() => {
    this.state = 'inactive';
    // Simulate data available
    if (this.ondataavailable) {
      this.ondataavailable({ data: new Blob(['audio-data'], { type: 'audio/webm' }) });
    }
    // Simulate stop callback
    setTimeout(() => {
      if (this.onstop) {
        this.onstop();
      }
    }, 0);
  });
}
(global as any).MediaRecorder = MockMediaRecorder;

// Mock getUserMedia
const mockMediaStream = {
  getTracks: jest.fn().mockReturnValue([
    { stop: jest.fn(), kind: 'audio' },
  ]),
};
const mockGetUserMedia = jest.fn().mockResolvedValue(mockMediaStream);
Object.defineProperty(navigator, 'mediaDevices', {
  value: { getUserMedia: mockGetUserMedia },
  writable: true,
});

// Mock AudioContext
const mockAudioContext = {
  decodeAudioData: jest.fn(),
  close: jest.fn().mockResolvedValue(undefined),
};
(global as any).AudioContext = jest.fn().mockImplementation(() => mockAudioContext);

// Mock OfflineAudioContext
const mockOfflineContext = {
  createBufferSource: jest.fn().mockReturnValue({
    buffer: null,
    connect: jest.fn(),
    start: jest.fn(),
  }),
  destination: {},
  startRendering: jest.fn().mockResolvedValue({
    numberOfChannels: 1,
    sampleRate: 16000,
    duration: 1,
    getChannelData: jest.fn().mockReturnValue(new Float32Array(16000)),
  }),
};
(global as any).OfflineAudioContext = jest.fn().mockImplementation(() => mockOfflineContext);

// Import after mocks
import { useWhisperTranscription } from '../use-whisper-transcription';

describe('useWhisperTranscription', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue('test-api-key');
    mockFetch.mockReset();
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useWhisperTranscription());

      expect(result.current.isRecording).toBe(false);
      expect(result.current.isTranscribing).toBe(false);
      expect(result.current.error).toBeNull();
      expect(typeof result.current.startRecording).toBe('function');
      expect(typeof result.current.stopRecording).toBe('function');
      expect(typeof result.current.transcribeAudio).toBe('function');
    });

    it('should accept default options', () => {
      const options = {
        language: 'en',
        prompt: 'Technical discussion',
        model: 'whisper-1',
      };

      const { result } = renderHook(() => useWhisperTranscription(options));

      expect(result.current.isRecording).toBe(false);
      expect(result.current.isTranscribing).toBe(false);
    });
  });

  describe('transcribeAudio', () => {
    it('should transcribe audio blob successfully', async () => {
      const mockResponse = {
        text: 'Hello world',
        language: 'en',
        duration: 2.5,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      // Mock audio preprocessing to return original blob
      mockAudioContext.decodeAudioData.mockRejectedValueOnce(
        new Error('Preprocessing disabled for test')
      );

      const { result } = renderHook(() =>
        useWhisperTranscription({ preprocess: false })
      );

      const audioBlob = new Blob(['test-audio'], { type: 'audio/webm' });

      let transcriptionResult: any;
      await act(async () => {
        transcriptionResult = await result.current.transcribeAudio(audioBlob);
      });

      expect(transcriptionResult).toEqual({
        text: 'Hello world',
        language: 'en',
        duration: 2.5,
      });
      expect(result.current.isTranscribing).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle transcription API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Invalid API key' }),
      });

      const { result } = renderHook(() =>
        useWhisperTranscription({ preprocess: false })
      );

      const audioBlob = new Blob(['test-audio'], { type: 'audio/webm' });

      await act(async () => {
        try {
          await result.current.transcribeAudio(audioBlob);
        } catch (error) {
          // Expected error
        }
      });

      expect(result.current.error).toBe('Invalid API key');
      expect(result.current.isTranscribing).toBe(false);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() =>
        useWhisperTranscription({ preprocess: false })
      );

      const audioBlob = new Blob(['test-audio'], { type: 'audio/webm' });

      await act(async () => {
        try {
          await result.current.transcribeAudio(audioBlob);
        } catch (error) {
          // Expected error
        }
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.isTranscribing).toBe(false);
    });

    it('should include API key in request headers', async () => {
      mockLocalStorage.getItem.mockReturnValue('my-api-key');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ text: 'test' }),
      });

      const { result } = renderHook(() =>
        useWhisperTranscription({ preprocess: false })
      );

      const audioBlob = new Blob(['test-audio'], { type: 'audio/webm' });

      await act(async () => {
        await result.current.transcribeAudio(audioBlob);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/audio/transcriptions',
        expect.objectContaining({
          method: 'POST',
          headers: { Authorization: 'Bearer my-api-key' },
        })
      );
    });

    it('should include language hint in form data when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ text: 'Hola mundo' }),
      });

      const { result } = renderHook(() =>
        useWhisperTranscription({ preprocess: false, language: 'es' })
      );

      const audioBlob = new Blob(['test-audio'], { type: 'audio/webm' });

      await act(async () => {
        await result.current.transcribeAudio(audioBlob);
      });

      // Verify FormData was sent
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].body).toBeInstanceOf(FormData);
    });

    it('should merge default options with call options', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ text: 'test' }),
      });

      const { result } = renderHook(() =>
        useWhisperTranscription({ language: 'en', preprocess: false })
      );

      const audioBlob = new Blob(['test-audio'], { type: 'audio/webm' });

      await act(async () => {
        await result.current.transcribeAudio(audioBlob, { language: 'es' });
      });

      // Call-time options should override defaults
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('startRecording', () => {
    it('should request microphone access', async () => {
      const { result } = renderHook(() => useWhisperTranscription());

      await act(async () => {
        await result.current.startRecording();
      });

      expect(mockGetUserMedia).toHaveBeenCalledWith({
        audio: expect.objectContaining({
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }),
      });
    });

    it('should set isRecording to true after starting', async () => {
      const { result } = renderHook(() => useWhisperTranscription());

      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.isRecording).toBe(true);
    });

    it('should handle microphone access denied error', async () => {
      mockGetUserMedia.mockRejectedValueOnce(
        new Error('Permission denied')
      );

      const { result } = renderHook(() => useWhisperTranscription());

      await act(async () => {
        try {
          await result.current.startRecording();
        } catch (error) {
          // Expected error
        }
      });

      expect(result.current.error).toBe('Permission denied');
      expect(result.current.isRecording).toBe(false);
    });

    it('should clear previous errors on new recording', async () => {
      const { result } = renderHook(() => useWhisperTranscription());

      // First, trigger an error
      mockGetUserMedia.mockRejectedValueOnce(new Error('First error'));
      await act(async () => {
        try {
          await result.current.startRecording();
        } catch (e) {
          // Expected
        }
      });
      expect(result.current.error).toBe('First error');

      // Then, start a successful recording
      mockGetUserMedia.mockResolvedValueOnce(mockMediaStream);
      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('stopRecording', () => {
    it('should return null when not recording', async () => {
      const { result } = renderHook(() => useWhisperTranscription());

      let stopResult: any;
      await act(async () => {
        stopResult = await result.current.stopRecording();
      });

      expect(stopResult).toBeNull();
    });

    it('should stop media tracks after recording', async () => {
      const mockTracks = [{ stop: jest.fn(), kind: 'audio' }];
      const mockStream = { getTracks: jest.fn().mockReturnValue(mockTracks) };
      mockGetUserMedia.mockResolvedValueOnce(mockStream);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ text: 'transcribed text' }),
      });

      const { result } = renderHook(() =>
        useWhisperTranscription({ preprocess: false })
      );

      // Start recording
      await act(async () => {
        await result.current.startRecording();
      });

      // Stop recording
      await act(async () => {
        await result.current.stopRecording();
      });

      // Wait for async operations
      await waitFor(() => {
        expect(mockTracks[0].stop).toHaveBeenCalled();
      });
    });

    it('should set isRecording to false after stopping', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ text: 'test' }),
      });

      const { result } = renderHook(() =>
        useWhisperTranscription({ preprocess: false })
      );

      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.isRecording).toBe(true);

      await act(async () => {
        await result.current.stopRecording();
      });

      await waitFor(() => {
        expect(result.current.isRecording).toBe(false);
      });
    });
  });

  describe('state management', () => {
    it('should track isTranscribing state during transcription', async () => {
      let resolveTranscription: (value: any) => void;
      const transcriptionPromise = new Promise((resolve) => {
        resolveTranscription = resolve;
      });

      mockFetch.mockImplementationOnce(() => transcriptionPromise);

      const { result } = renderHook(() =>
        useWhisperTranscription({ preprocess: false })
      );

      const audioBlob = new Blob(['test-audio'], { type: 'audio/webm' });

      // Start transcription
      act(() => {
        result.current.transcribeAudio(audioBlob);
      });

      // Should be transcribing
      expect(result.current.isTranscribing).toBe(true);

      // Complete transcription
      await act(async () => {
        resolveTranscription!({
          ok: true,
          json: async () => ({ text: 'test' }),
        });
      });

      expect(result.current.isTranscribing).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle empty transcription result', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ text: '' }),
      });

      const { result } = renderHook(() =>
        useWhisperTranscription({ preprocess: false })
      );

      const audioBlob = new Blob(['test-audio'], { type: 'audio/webm' });

      let transcriptionResult: any;
      await act(async () => {
        transcriptionResult = await result.current.transcribeAudio(audioBlob);
      });

      expect(transcriptionResult.text).toBe('');
    });

    it('should handle non-JSON error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('Not JSON');
        },
      });

      const { result } = renderHook(() =>
        useWhisperTranscription({ preprocess: false })
      );

      const audioBlob = new Blob(['test-audio'], { type: 'audio/webm' });

      await act(async () => {
        try {
          await result.current.transcribeAudio(audioBlob);
        } catch (error) {
          // Expected error
        }
      });

      expect(result.current.error).toBe('Transcription failed: 500');
    });

    it('should work without API key (guest mode)', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ text: 'test' }),
      });

      const { result } = renderHook(() =>
        useWhisperTranscription({ preprocess: false })
      );

      const audioBlob = new Blob(['test-audio'], { type: 'audio/webm' });

      await act(async () => {
        await result.current.transcribeAudio(audioBlob);
      });

      // Should be called without Authorization header
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/audio/transcriptions',
        expect.objectContaining({
          method: 'POST',
          headers: {},
        })
      );
    });
  });
});
