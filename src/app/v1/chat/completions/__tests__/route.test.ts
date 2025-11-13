/**
 * @jest-environment node
 */
import { POST } from '../route';
import { NextRequest } from 'next/server';

// Mock global fetch before any imports
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

// Mock the braintrust module
jest.mock('braintrust', () => ({
  traced: jest.fn((fn) => fn({ log: jest.fn() })),
  wrapTraced: jest.fn((fn) => fn),
}));

// Mock the utils module
jest.mock('@/lib/utils', () => ({
  normalizeModelId: jest.fn((id) => id),
}));

// Mock the braintrust config
jest.mock('@/lib/braintrust', () => ({
  isBraintrustEnabled: jest.fn(() => false),
}));

describe('POST /v1/chat/completions', () => {
  const mockApiKey = 'Bearer gw_test_key_12345';
  const baseUrl = 'https://api.gatewayz.ai';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_API_BASE_URL = baseUrl;

    // Reset console methods to avoid cluttering test output
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Gateway Parameter Handling', () => {
    it('should include gateway parameter in request body when provided', async () => {
      const mockRequestBody = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
        gateway: 'openrouter',
      };

      const mockResponse = new Response('data: {"choices":[{"delta":{"content":"Hi"}}]}', {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });

      mockFetch.mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/v1/chat/completions', {
        method: 'POST',
        headers: {
          'authorization': mockApiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(mockRequestBody),
      });

      await POST(request);

      // Verify fetch was called with gateway in the body
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(URL),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(mockRequestBody),
        })
      );

      const fetchCall = mockFetch.mock.calls[0];
      const bodyStr = fetchCall[1].body;
      const body = JSON.parse(bodyStr);
      expect(body.gateway).toBe('openrouter');
    });

    it('should support NEAR gateway in request body', async () => {
      const mockRequestBody = {
        model: 'near/meta-llama/Llama-3.3-70B-Instruct',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
        gateway: 'near',
      };

      const mockResponse = new Response('data: {"choices":[{"delta":{"content":"Hi"}}]}', {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });

      mockFetch.mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/v1/chat/completions', {
        method: 'POST',
        headers: {
          'authorization': mockApiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(mockRequestBody),
      });

      await POST(request);

      const fetchCall = mockFetch.mock.calls[0];
      const bodyStr = fetchCall[1].body;
      const body = JSON.parse(bodyStr);
      expect(body.gateway).toBe('near');
      expect(body.model).toBe('near/meta-llama/Llama-3.3-70B-Instruct');
    });

    it('should support Cerebras gateway in request body', async () => {
      const mockRequestBody = {
        model: 'cerebras/llama-3.3-70b',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
        gateway: 'cerebras',
      };

      const mockResponse = new Response('data: {"choices":[{"delta":{"content":"Hi"}}]}', {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });

      mockFetch.mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/v1/chat/completions', {
        method: 'POST',
        headers: {
          'authorization': mockApiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(mockRequestBody),
      });

      await POST(request);

      const fetchCall = mockFetch.mock.calls[0];
      const bodyStr = fetchCall[1].body;
      const body = JSON.parse(bodyStr);
      expect(body.gateway).toBe('cerebras');
    });

    it('should handle request without gateway parameter', async () => {
      const mockRequestBody = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
      };

      const mockResponse = new Response('data: {"choices":[{"delta":{"content":"Hi"}}]}', {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });

      mockFetch.mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/v1/chat/completions', {
        method: 'POST',
        headers: {
          'authorization': mockApiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(mockRequestBody),
      });

      await POST(request);

      const fetchCall = mockFetch.mock.calls[0];
      const bodyStr = fetchCall[1].body;
      const body = JSON.parse(bodyStr);
      expect(body.gateway).toBeUndefined();
    });
  });

  describe('Session ID Query Parameter Handling', () => {
    it('should forward session_id as URL query parameter', async () => {
      const mockRequestBody = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
        gateway: 'openrouter',
      };

      const mockResponse = new Response('data: {"choices":[{"delta":{"content":"Hi"}}]}', {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });

      mockFetch.mockResolvedValueOnce(mockResponse);

      const sessionId = 'test-session-123';
      const request = new NextRequest(
        `http://localhost:3000/v1/chat/completions?session_id=${sessionId}`,
        {
          method: 'POST',
          headers: {
            'authorization': mockApiKey,
            'content-type': 'application/json',
          },
          body: JSON.stringify(mockRequestBody),
        }
      );

      await POST(request);

      // Verify session_id is in the URL, not the body
      const fetchCall = mockFetch.mock.calls[0];
      const targetUrl = fetchCall[0] as URL;
      expect(targetUrl.searchParams.get('session_id')).toBe(sessionId);

      // Verify session_id is NOT in the request body
      const bodyStr = fetchCall[1].body;
      const body = JSON.parse(bodyStr);
      expect(body.session_id).toBeUndefined();
    });

    it('should handle request without session_id', async () => {
      const mockRequestBody = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
        gateway: 'openrouter',
      };

      const mockResponse = new Response('data: {"choices":[{"delta":{"content":"Hi"}}]}', {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });

      mockFetch.mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/v1/chat/completions', {
        method: 'POST',
        headers: {
          'authorization': mockApiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(mockRequestBody),
      });

      await POST(request);

      const fetchCall = mockFetch.mock.calls[0];
      const targetUrl = fetchCall[0] as URL;
      expect(targetUrl.searchParams.get('session_id')).toBeNull();
    });

    it('should handle both session_id and gateway correctly', async () => {
      const mockRequestBody = {
        model: 'near/llama-3.3-70b',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
        gateway: 'near',
      };

      const mockResponse = new Response('data: {"choices":[{"delta":{"content":"Hi"}}]}', {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });

      mockFetch.mockResolvedValueOnce(mockResponse);

      const sessionId = 'session-456';
      const request = new NextRequest(
        `http://localhost:3000/v1/chat/completions?session_id=${sessionId}`,
        {
          method: 'POST',
          headers: {
            'authorization': mockApiKey,
            'content-type': 'application/json',
          },
          body: JSON.stringify(mockRequestBody),
        }
      );

      await POST(request);

      const fetchCall = mockFetch.mock.calls[0];
      const targetUrl = fetchCall[0] as URL;
      const bodyStr = fetchCall[1].body;
      const body = JSON.parse(bodyStr);

      // session_id should be in URL
      expect(targetUrl.searchParams.get('session_id')).toBe(sessionId);

      // gateway should be in body
      expect(body.gateway).toBe('near');

      // session_id should NOT be in body
      expect(body.session_id).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should return 401 when no authorization header is provided', async () => {
      const mockRequestBody = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
      };

      const request = new NextRequest('http://localhost:3000/v1/chat/completions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(mockRequestBody),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('No authorization header provided');
    });

    it('should include gateway parameter in error response', async () => {
      const mockRequestBody = {
        model: 'invalid-model',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
        gateway: 'test-gateway',
      };

      const mockResponse = new Response(
        JSON.stringify({
          error: 'Model not found',
          detail: 'The requested model does not exist'
        }),
        {
          status: 404,
          headers: { 'content-type': 'application/json' },
        }
      );

      mockFetch.mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/v1/chat/completions', {
        method: 'POST',
        headers: {
          'authorization': mockApiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(mockRequestBody),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.gateway).toBe('test-gateway');
      expect(data.model).toBe('invalid-model');
    });
  });

  describe('Streaming vs Non-Streaming', () => {
    it('should handle streaming requests with gateway parameter', async () => {
      const mockRequestBody = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
        gateway: 'openrouter',
      };

      const mockResponse = new Response('data: {"choices":[{"delta":{"content":"Hi"}}]}', {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });

      mockFetch.mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/v1/chat/completions', {
        method: 'POST',
        headers: {
          'authorization': mockApiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(mockRequestBody),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/event-stream');
    });

    it('should handle non-streaming requests with gateway parameter', async () => {
      const mockRequestBody = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false,
        gateway: 'openrouter',
      };

      const mockResponseData = {
        choices: [{ message: { role: 'assistant', content: 'Hello!' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      const mockResponse = new Response(JSON.stringify(mockResponseData), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

      mockFetch.mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/v1/chat/completions', {
        method: 'POST',
        headers: {
          'authorization': mockApiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(mockRequestBody),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.choices[0].message.content).toBe('Hello!');
    });
  });

  describe('URL Construction', () => {
    it('should construct target URL correctly with base URL and query params', async () => {
      const mockRequestBody = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
        gateway: 'openrouter',
      };

      const mockResponse = new Response('data: {"choices":[{"delta":{"content":"Hi"}}]}', {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });

      mockFetch.mockResolvedValueOnce(mockResponse);

      const sessionId = 'test-session';
      const request = new NextRequest(
        `http://localhost:3000/v1/chat/completions?session_id=${sessionId}`,
        {
          method: 'POST',
          headers: {
            'authorization': mockApiKey,
            'content-type': 'application/json',
          },
          body: JSON.stringify(mockRequestBody),
        }
      );

      await POST(request);

      const fetchCall = mockFetch.mock.calls[0];
      const targetUrl = fetchCall[0] as URL;

      expect(targetUrl.origin).toBe(baseUrl);
      expect(targetUrl.pathname).toBe('/v1/chat/completions');
      expect(targetUrl.searchParams.get('session_id')).toBe(sessionId);
    });
  });
});
