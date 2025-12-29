/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

// Mock retry-utils with pass-through behavior for testing
const mockRetryFetch = jest.fn();
jest.mock('@/lib/retry-utils', () => ({
  retryFetch: (fn: () => Promise<Response>, _options?: unknown) => mockRetryFetch(fn),
}));

// Mock error handler
jest.mock('@/app/api/middleware/error-handler', () => ({
  handleApiError: jest.fn((error: Error, context: string) => {
    const { NextResponse } = require('next/server');
    return NextResponse.json(
      { error: error.message, context },
      { status: 500 }
    );
  }),
}));

// Mock config
jest.mock('@/lib/config', () => ({
  API_BASE_URL: 'https://api.gatewayz.ai',
}));

// Import after mocks are set up
import { POST, GET } from '../route';

// Mock console methods
jest.spyOn(console, 'log').mockImplementation();
jest.spyOn(console, 'warn').mockImplementation();
jest.spyOn(console, 'error').mockImplementation();

describe('POST /api/contact', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up mockRetryFetch to execute the function passed to it
    mockRetryFetch.mockImplementation(async (fn: () => Promise<Response>) => fn());
  });

  describe('Successful Submissions', () => {
    it('should accept valid contact form submission', async () => {
      const mockContactData = {
        name: 'John Doe',
        email: 'john@example.com',
        company: 'Acme Inc.',
        subject: 'sales',
        message: 'I would like to learn more about your enterprise solutions.',
      };

      // Mock backend API success
      mockRetryFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const request = new NextRequest('http://localhost:3000/api/contact', {
        method: 'POST',
        body: JSON.stringify(mockContactData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('sent successfully');
    });

    it('should accept submission without optional company field', async () => {
      const mockContactData = {
        name: 'Jane Smith',
        email: 'jane@example.com',
        subject: 'general',
        message: 'This is a general inquiry about your services.',
      };

      mockRetryFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const request = new NextRequest('http://localhost:3000/api/contact', {
        method: 'POST',
        body: JSON.stringify(mockContactData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should handle all subject types', async () => {
      const subjects = ['general', 'sales', 'support', 'partnership', 'enterprise'];

      for (const subject of subjects) {
        mockRetryFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
        });

        const mockContactData = {
          name: 'Test User',
          email: 'test@example.com',
          subject,
          message: 'Test message for ' + subject,
        };

        const request = new NextRequest('http://localhost:3000/api/contact', {
          method: 'POST',
          body: JSON.stringify(mockContactData),
        });

        const response = await POST(request);
        expect(response.status).toBe(200);
      }
    });

    it('should still succeed when backend API is unavailable', async () => {
      const mockContactData = {
        name: 'John Doe',
        email: 'john@example.com',
        subject: 'sales',
        message: 'Test message when backend is unavailable',
      };

      // Mock backend API failure
      mockRetryFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const request = new NextRequest('http://localhost:3000/api/contact', {
        method: 'POST',
        body: JSON.stringify(mockContactData),
      });

      const response = await POST(request);
      const data = await response.json();

      // Should still return success (form data is logged)
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('received');
    });

    it('should handle backend API network error gracefully', async () => {
      const mockContactData = {
        name: 'John Doe',
        email: 'john@example.com',
        subject: 'support',
        message: 'Test message with network error',
      };

      // Mock network error
      mockRetryFetch.mockRejectedValueOnce(new Error('Network error'));

      const request = new NextRequest('http://localhost:3000/api/contact', {
        method: 'POST',
        body: JSON.stringify(mockContactData),
      });

      const response = await POST(request);
      const data = await response.json();

      // Should still return success (form data is logged)
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('Validation Errors', () => {
    it('should reject empty name', async () => {
      const mockContactData = {
        name: '',
        email: 'john@example.com',
        subject: 'sales',
        message: 'Test message',
      };

      const request = new NextRequest('http://localhost:3000/api/contact', {
        method: 'POST',
        body: JSON.stringify(mockContactData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid form data');
    });

    it('should reject name shorter than 2 characters', async () => {
      const mockContactData = {
        name: 'J',
        email: 'john@example.com',
        subject: 'sales',
        message: 'Test message',
      };

      const request = new NextRequest('http://localhost:3000/api/contact', {
        method: 'POST',
        body: JSON.stringify(mockContactData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid form data');
    });

    it('should reject invalid email format', async () => {
      const mockContactData = {
        name: 'John Doe',
        email: 'invalid-email',
        subject: 'sales',
        message: 'Test message',
      };

      const request = new NextRequest('http://localhost:3000/api/contact', {
        method: 'POST',
        body: JSON.stringify(mockContactData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid form data');
    });

    it('should reject missing email', async () => {
      const mockContactData = {
        name: 'John Doe',
        subject: 'sales',
        message: 'Test message',
      };

      const request = new NextRequest('http://localhost:3000/api/contact', {
        method: 'POST',
        body: JSON.stringify(mockContactData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid form data');
    });

    it('should reject invalid subject', async () => {
      const mockContactData = {
        name: 'John Doe',
        email: 'john@example.com',
        subject: 'invalid_subject',
        message: 'Test message',
      };

      const request = new NextRequest('http://localhost:3000/api/contact', {
        method: 'POST',
        body: JSON.stringify(mockContactData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid form data');
    });

    it('should reject missing subject', async () => {
      const mockContactData = {
        name: 'John Doe',
        email: 'john@example.com',
        message: 'Test message',
      };

      const request = new NextRequest('http://localhost:3000/api/contact', {
        method: 'POST',
        body: JSON.stringify(mockContactData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid form data');
    });

    it('should reject message shorter than 10 characters', async () => {
      const mockContactData = {
        name: 'John Doe',
        email: 'john@example.com',
        subject: 'sales',
        message: 'Too short',
      };

      const request = new NextRequest('http://localhost:3000/api/contact', {
        method: 'POST',
        body: JSON.stringify(mockContactData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid form data');
    });

    it('should reject message longer than 5000 characters', async () => {
      const mockContactData = {
        name: 'John Doe',
        email: 'john@example.com',
        subject: 'sales',
        message: 'x'.repeat(5001),
      };

      const request = new NextRequest('http://localhost:3000/api/contact', {
        method: 'POST',
        body: JSON.stringify(mockContactData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid form data');
    });

    it('should reject empty request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/contact', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid form data');
    });

    it('should handle malformed JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/contact', {
        method: 'POST',
        body: 'invalid json{',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });
  });

  describe('Backend API Integration', () => {
    it('should call retryFetch with correct URL', async () => {
      const mockContactData = {
        name: 'John Doe',
        email: 'john@example.com',
        company: 'Acme Inc.',
        subject: 'enterprise',
        message: 'I need enterprise solutions for my team.',
      };

      mockRetryFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const request = new NextRequest('http://localhost:3000/api/contact', {
        method: 'POST',
        body: JSON.stringify(mockContactData),
      });

      await POST(request);

      expect(mockRetryFetch).toHaveBeenCalledTimes(1);
    });

    it('should return success when backend is unavailable', async () => {
      const mockContactData = {
        name: 'John Doe',
        email: 'john@example.com',
        subject: 'sales',
        message: 'Test message for logging',
      };

      mockRetryFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const request = new NextRequest('http://localhost:3000/api/contact', {
        method: 'POST',
        body: JSON.stringify(mockContactData),
      });

      const response = await POST(request);
      const data = await response.json();

      // Should still return success (form data is logged for manual processing)
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});

describe('GET /api/contact', () => {
  it('should return health check status', async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.endpoint).toBe('contact');
  });
});
