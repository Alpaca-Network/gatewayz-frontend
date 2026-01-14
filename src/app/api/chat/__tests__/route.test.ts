import { POST } from '../route';
import { NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';

// Mock Sentry
jest.mock('@sentry/nextjs', () => ({
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

// Mock config
jest.mock('@/lib/config', () => ({
  API_BASE_URL: 'https://api.test.com',
}));

// Mock utils
jest.mock('@/lib/utils', () => ({
  normalizeModelId: jest.fn((id: string) => id),
}));

// Mock error handler
jest.mock('@/app/api/middleware/error-handler', () => ({
  handleApiError: jest.fn((error: any, context: string) => {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }),
  HttpError: class HttpError extends Error {
    constructor(message: string, public statusCode: number, public details?: any) {
      super(message);
      this.name = 'HttpError';
    }
  },
}));

describe('Chat API Route - Enhanced Error Handling', () => {
  let mockFetch: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    mockFetch.mockRestore();
  });

  const createMockRequest = (body: any): NextRequest => {
    return {
      json: jest.fn().mockResolvedValue(body),
    } as unknown as NextRequest;
  };

  describe('Successful requests', () => {
    it('should successfully process a chat request', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Hello, world!' } }],
        }),
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      const request = createMockRequest({
        model: 'test-model',
        message: 'Hello',
        apiKey: 'test-api-key',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ response: 'Hello, world!' });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-api-key',
          },
        })
      );
    });

    it('should extract content from various response formats', async () => {
      const testCases = [
        { response: { choices: [{ message: { content: 'From choices' } }] }, expected: 'From choices' },
        { response: { response: 'From response field' }, expected: 'From response field' },
        { response: { message: 'From message field' }, expected: 'From message field' },
        { response: { content: 'From content field' }, expected: 'From content field' },
        { response: {}, expected: 'No response' },
      ];

      for (const testCase of testCases) {
        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(testCase.response),
        } as any);

        const request = createMockRequest({
          model: 'test-model',
          message: 'Test',
          apiKey: 'test-key',
        });

        const response = await POST(request);
        const data = await response.json();

        expect(data.response).toBe(testCase.expected);
      }
    });
  });

  describe('Authentication errors', () => {
    it('should return 401 when API key is missing', async () => {
      const request = createMockRequest({
        model: 'test-model',
        message: 'Hello',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({ error: 'API key required' });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle 401 authentication errors from backend', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: jest.fn().mockResolvedValue(JSON.stringify({ detail: 'Invalid API key' })),
      } as any);

      const request = createMockRequest({
        model: 'test-model',
        message: 'Hello',
        apiKey: 'invalid-key',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toMatchObject({
        error: 'Authentication failed',
        message: 'Invalid API key',
      });
      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: expect.objectContaining({
            error_type: 'chat_api_auth_error',
            status_code: 401,
          }),
          level: 'warning',
        })
      );
    });

    it('should handle 403 forbidden errors from backend', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: jest.fn().mockResolvedValue(JSON.stringify({ error: 'Access denied' })),
      } as any);

      const request = createMockRequest({
        model: 'test-model',
        message: 'Hello',
        apiKey: 'test-key',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data).toMatchObject({
        error: 'Authentication failed',
        message: 'Access denied',
      });
    });
  });

  describe('404 Not Found errors', () => {
    it('should handle 404 errors with helpful suggestions', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: jest.fn().mockResolvedValue(JSON.stringify({ detail: 'Model not found' })),
      } as any);

      const request = createMockRequest({
        model: 'nonexistent-model',
        message: 'Hello',
        apiKey: 'test-key',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toMatchObject({
        error: 'Model or endpoint not available',
        message: 'Model not found',
        suggestions: [
          'Check if the model name is correct',
          'Verify the backend API is running',
          'Try a different model',
        ],
      });

      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: expect.objectContaining({
            error_type: 'chat_api_not_found',
            model: 'nonexistent-model',
            endpoint: 'https://api.test.com/v1/chat/completions',
          }),
          contexts: expect.objectContaining({
            chat_request: expect.objectContaining({
              model: 'nonexistent-model',
            }),
          }),
          level: 'warning',
        })
      );
    });

    it('should handle 404 with plain text error response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: jest.fn().mockResolvedValue('Endpoint not found'),
      } as any);

      const request = createMockRequest({
        model: 'test-model',
        message: 'Hello',
        apiKey: 'test-key',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.message).toBe('Endpoint not found');
      expect(data.details).toEqual({ raw: 'Endpoint not found' });
    });
  });

  describe('Server errors (5xx)', () => {
    it('should handle 500 internal server errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: jest.fn().mockResolvedValue(JSON.stringify({ detail: 'Database connection failed' })),
      } as any);

      const request = createMockRequest({
        model: 'test-model',
        message: 'Hello',
        apiKey: 'test-key',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toMatchObject({
        error: 'Backend API error: 500',
        message: 'Database connection failed',
      });

      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: expect.objectContaining({
            error_type: 'chat_api_server_error',
            status_code: 500,
          }),
          level: 'error',
        })
      );
    });

    it('should handle 502 bad gateway errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        text: jest.fn().mockResolvedValue(JSON.stringify({ error: 'Gateway timeout' })),
      } as any);

      const request = createMockRequest({
        model: 'test-model',
        message: 'Hello',
        apiKey: 'test-key',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(502);
      expect(data.message).toBe('Gateway timeout');
      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          level: 'error',
        })
      );
    });
  });

  describe('Error parsing and context', () => {
    it('should parse JSON error responses', async () => {
      const errorData = { detail: 'Specific error', code: 'ERROR_CODE' };

      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: jest.fn().mockResolvedValue(JSON.stringify(errorData)),
      } as any);

      const request = createMockRequest({
        model: 'test-model',
        message: 'Hello',
        apiKey: 'test-key',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.details).toEqual(errorData);
      expect(data.message).toBe('Specific error');
    });

    it('should handle non-JSON error responses', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: jest.fn().mockResolvedValue('Plain text error'),
      } as any);

      const request = createMockRequest({
        model: 'test-model',
        message: 'Hello',
        apiKey: 'test-key',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.details).toEqual({ raw: 'Plain text error' });
      expect(data.message).toBe('Plain text error');
    });

    it('should handle errors when parsing response text fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: jest.fn().mockRejectedValue(new Error('Failed to read response')),
      } as any);

      const request = createMockRequest({
        model: 'test-model',
        message: 'Hello',
        apiKey: 'test-key',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.details).toEqual({ raw: 'Failed to parse error response' });
    });

    it('should include error context in responses', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: jest.fn().mockResolvedValue(JSON.stringify({ detail: 'Model unavailable' })),
      } as any);

      const request = createMockRequest({
        model: 'original-model',
        message: 'Test message',
        apiKey: 'test-key',
      });

      await POST(request);

      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          contexts: expect.objectContaining({
            chat_request: expect.objectContaining({
              model: 'original-model',
              original_model: 'original-model',
              has_message: true,
            }),
            backend_response: expect.objectContaining({
              status: 404,
              statusText: 'Not Found',
              model: 'original-model',
            }),
          }),
        })
      );
    });
  });

  describe('Generic error handling', () => {
    it('should handle other HTTP error codes (e.g., 429 rate limit)', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: jest.fn().mockResolvedValue(JSON.stringify({ message: 'Rate limit exceeded' })),
      } as any);

      const request = createMockRequest({
        model: 'test-model',
        message: 'Hello',
        apiKey: 'test-key',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data).toMatchObject({
        error: 'Backend API error: 429',
        message: 'Rate limit exceeded',
      });
    });
  });

  describe('Unexpected errors', () => {
    it('should handle request parsing errors', async () => {
      const request = {
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      } as unknown as NextRequest;

      await POST(request);

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'chat_api',
        message: 'Unexpected error in chat API route',
        level: 'error',
        data: expect.objectContaining({
          error_message: 'Invalid JSON',
        }),
      });
    });

    it('should handle network errors during fetch', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const request = createMockRequest({
        model: 'test-model',
        message: 'Hello',
        apiKey: 'test-key',
      });

      await POST(request);

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'chat_api',
        message: 'Unexpected error in chat API route',
        level: 'error',
        data: expect.objectContaining({
          error_message: 'Network error',
        }),
      });
    });
  });

  describe('Error message extraction', () => {
    it('should extract error message from detail field', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: jest.fn().mockResolvedValue(JSON.stringify({ detail: 'Detail error' })),
      } as any);

      const request = createMockRequest({
        model: 'test-model',
        message: 'Hello',
        apiKey: 'test-key',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.message).toBe('Detail error');
    });

    it('should extract error message from error field', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: jest.fn().mockResolvedValue(JSON.stringify({ error: 'Error field message' })),
      } as any);

      const request = createMockRequest({
        model: 'test-model',
        message: 'Hello',
        apiKey: 'test-key',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.message).toBe('Error field message');
    });

    it('should extract error message from message field', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: jest.fn().mockResolvedValue(JSON.stringify({ message: 'Message field' })),
      } as any);

      const request = createMockRequest({
        model: 'test-model',
        message: 'Hello',
        apiKey: 'test-key',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.message).toBe('Message field');
    });

    it('should prioritize detail over error and message fields', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            detail: 'From detail',
            error: 'From error',
            message: 'From message',
          })
        ),
      } as any);

      const request = createMockRequest({
        model: 'test-model',
        message: 'Hello',
        apiKey: 'test-key',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.message).toBe('From detail');
    });
  });
});
