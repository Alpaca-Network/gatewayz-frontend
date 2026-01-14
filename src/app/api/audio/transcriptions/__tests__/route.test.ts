/**
 * @jest-environment node
 */
import { POST } from '../route';
import { NextRequest } from 'next/server';

// Mock the fetch function
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock the error handler
jest.mock('@/app/api/middleware/error-handler', () => ({
  handleApiError: jest.fn((error: Error, context: string) => {
    return new Response(
      JSON.stringify({ error: error.message, context }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }),
}));

// Mock config
jest.mock('@/lib/config', () => ({
  API_BASE_URL: 'https://api.gatewayz.ai',
}));

// Mock console methods
let mockConsoleLog: jest.SpyInstance;
let mockConsoleError: jest.SpyInstance;

/**
 * Helper to create a mock request with FormData support
 * In Node.js test environment, NextRequest.formData() doesn't work properly,
 * so we need to mock it
 */
function createMockRequest(
  authHeader: string | null,
  formDataEntries: Record<string, string | Blob> = {}
): NextRequest {
  const headers = new Headers();
  if (authHeader) {
    headers.set('Authorization', authHeader);
  }
  headers.set('Content-Type', 'multipart/form-data');

  const request = new NextRequest('http://localhost:3000/api/audio/transcriptions', {
    method: 'POST',
    headers,
  });

  // Create a mock FormData
  const mockFormData = new FormData();
  Object.entries(formDataEntries).forEach(([key, value]) => {
    if (value instanceof Blob) {
      mockFormData.append(key, value, 'audio.wav');
    } else {
      mockFormData.append(key, value);
    }
  });

  // Override the formData method
  request.formData = jest.fn().mockResolvedValue(mockFormData);

  return request;
}

describe('POST /api/audio/transcriptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  describe('Authentication', () => {
    it('should return 401 when no Authorization header is provided', async () => {
      const request = createMockRequest(null, {
        file: new Blob(['audio-data'], { type: 'audio/wav' }),
        model: 'whisper-1',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('API key required');
      expect(data.detail).toBe('Authorization header with Bearer token is required');
    });

    it('should return 401 when Authorization header has no Bearer token', async () => {
      const request = createMockRequest('', {
        file: new Blob(['audio-data'], { type: 'audio/wav' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('API key required');
    });
  });

  describe('Successful Transcription', () => {
    it('should forward request to backend and return transcription result', async () => {
      const mockTranscriptionResult = {
        text: 'Hello world, this is a test transcription.',
        language: 'en',
        duration: 3.5,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockTranscriptionResult,
      });

      const request = createMockRequest('Bearer test-api-key', {
        file: new Blob(['audio-data'], { type: 'audio/wav' }),
        model: 'whisper-1',
        response_format: 'json',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.text).toBe('Hello world, this is a test transcription.');
      expect(data.language).toBe('en');
      expect(data.duration).toBe(3.5);
    });

    it('should forward API key to backend', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ text: 'test' }),
      });

      const request = createMockRequest('Bearer my-secret-key', {
        file: new Blob(['audio-data'], { type: 'audio/wav' }),
        model: 'whisper-1',
      });

      await POST(request);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.gatewayz.ai/v1/audio/transcriptions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': 'Bearer my-secret-key',
          },
        })
      );
    });

    it('should forward form data to backend', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ text: 'test' }),
      });

      const request = createMockRequest('Bearer test-api-key', {
        file: new Blob(['audio-data'], { type: 'audio/wav' }),
        model: 'whisper-1',
        language: 'es',
        prompt: 'Technical conversation',
      });

      await POST(request);

      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[1].body).toBeInstanceOf(FormData);
    });
  });

  describe('Error Handling', () => {
    it('should handle backend 400 Bad Request errors', async () => {
      const errorResponse = {
        detail: 'Invalid audio format. Supported formats: mp3, wav, m4a, webm',
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => JSON.stringify(errorResponse),
      });

      const request = createMockRequest('Bearer test-api-key', {
        file: new Blob(['invalid-data'], { type: 'text/plain' }),
        model: 'whisper-1',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Transcription failed: 400');
      expect(data.detail).toContain('Invalid audio format');
    });

    it('should handle backend 401 Unauthorized errors', async () => {
      const errorResponse = {
        detail: 'Invalid or expired API key',
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => JSON.stringify(errorResponse),
      });

      const request = createMockRequest('Bearer invalid-key', {
        file: new Blob(['audio-data'], { type: 'audio/wav' }),
        model: 'whisper-1',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.detail).toContain('Invalid or expired API key');
    });

    it('should handle backend 413 Payload Too Large errors', async () => {
      const errorResponse = {
        detail: 'Audio file exceeds maximum size of 25MB',
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 413,
        text: async () => JSON.stringify(errorResponse),
      });

      const request = createMockRequest('Bearer test-api-key', {
        file: new Blob(['large-audio-data'], { type: 'audio/wav' }),
        model: 'whisper-1',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(413);
      expect(data.detail).toContain('exceeds maximum size');
    });

    it('should handle backend 500 Internal Server Error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => JSON.stringify({ detail: 'Whisper service unavailable' }),
      });

      const request = createMockRequest('Bearer test-api-key', {
        file: new Blob(['audio-data'], { type: 'audio/wav' }),
        model: 'whisper-1',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Transcription failed: 500');
    });

    it('should handle non-JSON error responses from backend', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: async () => 'Bad Gateway',
      });

      const request = createMockRequest('Bearer test-api-key', {
        file: new Blob(['audio-data'], { type: 'audio/wav' }),
        model: 'whisper-1',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(502);
      expect(data.detail).toBe('Bad Gateway');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network connection failed'));

      const request = createMockRequest('Bearer test-api-key', {
        file: new Blob(['audio-data'], { type: 'audio/wav' }),
        model: 'whisper-1',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Network connection failed');
    });

    it('should handle empty error text from backend', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => '',
      });

      const request = createMockRequest('Bearer test-api-key', {
        file: new Blob(['audio-data'], { type: 'audio/wav' }),
        model: 'whisper-1',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.detail).toBe('Unknown error');
    });
  });

  describe('Logging', () => {
    it('should log forwarding request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ text: 'test' }),
      });

      const request = createMockRequest('Bearer test-api-key', {
        file: new Blob(['audio-data'], { type: 'audio/wav' }),
        model: 'whisper-1',
      });

      await POST(request);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[Audio Transcription API] Forwarding to:',
        'https://api.gatewayz.ai/v1/audio/transcriptions'
      );
    });

    it('should log response status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ text: 'test' }),
      });

      const request = createMockRequest('Bearer test-api-key', {
        file: new Blob(['audio-data'], { type: 'audio/wav' }),
        model: 'whisper-1',
      });

      await POST(request);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[Audio Transcription API] Response status:',
        200
      );
    });

    it('should log backend errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ detail: 'Invalid format' }),
      });

      const request = createMockRequest('Bearer test-api-key', {
        file: new Blob(['audio-data'], { type: 'audio/wav' }),
      });

      await POST(request);

      expect(mockConsoleError).toHaveBeenCalledWith(
        '[Audio Transcription API] Backend error:',
        expect.objectContaining({
          status: 400,
        })
      );
    });

    it('should log unexpected errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Unexpected error'));

      const request = createMockRequest('Bearer test-api-key', {
        file: new Blob(['audio-data'], { type: 'audio/wav' }),
      });

      await POST(request);

      expect(mockConsoleError).toHaveBeenCalledWith(
        '[Audio Transcription API] Unexpected error:',
        expect.any(Error)
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle rate limit errors (429)', async () => {
      const errorResponse = {
        detail: 'Rate limit exceeded. Please try again later.',
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => JSON.stringify(errorResponse),
      });

      const request = createMockRequest('Bearer test-api-key', {
        file: new Blob(['audio-data'], { type: 'audio/wav' }),
        model: 'whisper-1',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.detail).toContain('Rate limit exceeded');
    });

    it('should handle timeout errors from backend', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Request timeout'));

      const request = createMockRequest('Bearer test-api-key', {
        file: new Blob(['audio-data'], { type: 'audio/wav' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Request timeout');
    });

    it('should strip Bearer prefix from Authorization header correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ text: 'test' }),
      });

      const request = createMockRequest('Bearer   spaced-key  ', {
        file: new Blob(['audio-data'], { type: 'audio/wav' }),
      });

      await POST(request);

      // Should forward the key with spaces trimmed from Bearer
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer   spaced-key  ',
          },
        })
      );
    });
  });
});
