/**
 * Stripe Checkout API Route Tests
 *
 * Tests for /api/stripe/checkout endpoint
 * Covers:
 * - Valid checkout session creation
 * - Input validation
 * - Authentication
 * - Error handling
 * - Edge cases
 */

import { POST } from '../route'
import { NextRequest } from 'next/server'

// Mock fetch
global.fetch = jest.fn()

describe('POST /api/stripe/checkout', () => {
  const validRequestBody = {
    amount: 100,
    creditValue: 100,
    userEmail: 'test@gatewayz.ai',
    userId: 1,
    apiKey: 'test-api-key-123',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    // Set environment variables
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.gatewayz.ai'
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Successful checkout session creation', () => {
    it('should create a checkout session with valid data', async () => {
      // Mock successful backend response
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          session_id: 'cs_test_123',
          url: 'https://checkout.stripe.com/pay/cs_test_123',
        }),
      })

      const request = new NextRequest('http://localhost:3000/api/stripe/checkout', {
        method: 'POST',
        body: JSON.stringify(validRequestBody),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        sessionId: 'cs_test_123',
        url: 'https://checkout.stripe.com/pay/cs_test_123',
      })

      // Verify backend was called correctly
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.gatewayz.ai/api/stripe/checkout-session',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-api-key-123',
          },
        })
      )
    })

    it('should handle discounted credit packages correctly', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          session_id: 'cs_test_123',
          url: 'https://checkout.stripe.com/pay/cs_test_123',
        }),
      })

      const request = new NextRequest('http://localhost:3000/api/stripe/checkout', {
        method: 'POST',
        body: JSON.stringify({
          ...validRequestBody,
          amount: 50, // Payment amount
          creditValue: 100, // Actual credits received (2x bonus)
        }),
      })

      const response = await POST(request)

      expect(response.status).toBe(200)

      // Verify the backend received correct values
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
      const requestBody = JSON.parse(fetchCall[1].body)

      expect(requestBody.amount).toBe(5000) // $50 in cents
      expect(requestBody.credit_value).toBe(100) // $100 in credits
      expect(requestBody.description).toContain('$100 credits')
      expect(requestBody.description).toContain('discounted price: $50')
    })

    it('should use creditValue as fallback when not provided', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          session_id: 'cs_test_123',
          url: 'https://checkout.stripe.com/pay/cs_test_123',
        }),
      })

      const request = new NextRequest('http://localhost:3000/api/stripe/checkout', {
        method: 'POST',
        body: JSON.stringify({
          amount: 100,
          userEmail: 'test@gatewayz.ai',
          userId: 1,
          apiKey: 'test-api-key-123',
          // creditValue omitted
        }),
      })

      const response = await POST(request)

      expect(response.status).toBe(200)

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
      const requestBody = JSON.parse(fetchCall[1].body)

      expect(requestBody.credit_value).toBe(100) // Should use amount as fallback
    })

    it('should handle wallet addresses as email (Privy DID)', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          session_id: 'cs_test_123',
          url: 'https://checkout.stripe.com/pay/cs_test_123',
        }),
      })

      const request = new NextRequest('http://localhost:3000/api/stripe/checkout', {
        method: 'POST',
        body: JSON.stringify({
          ...validRequestBody,
          userEmail: 'did:privy:0x1234567890abcdef',
        }),
      })

      const response = await POST(request)

      expect(response.status).toBe(200)

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
      const requestBody = JSON.parse(fetchCall[1].body)

      // Email should be undefined for wallet addresses
      expect(requestBody.customer_email).toBeUndefined()
    })
  })

  describe('Input validation', () => {
    it('should reject requests with missing amount', async () => {
      const request = new NextRequest('http://localhost:3000/api/stripe/checkout', {
        method: 'POST',
        body: JSON.stringify({
          ...validRequestBody,
          amount: undefined,
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid amount')
    })

    it('should reject requests with zero amount', async () => {
      const request = new NextRequest('http://localhost:3000/api/stripe/checkout', {
        method: 'POST',
        body: JSON.stringify({
          ...validRequestBody,
          amount: 0,
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid amount')
    })

    it('should reject requests with negative amount', async () => {
      const request = new NextRequest('http://localhost:3000/api/stripe/checkout', {
        method: 'POST',
        body: JSON.stringify({
          ...validRequestBody,
          amount: -10,
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid amount')
    })

    it('should reject requests without API key', async () => {
      const request = new NextRequest('http://localhost:3000/api/stripe/checkout', {
        method: 'POST',
        body: JSON.stringify({
          ...validRequestBody,
          apiKey: undefined,
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('API key is required')
    })

    it('should reject requests with empty API key', async () => {
      const request = new NextRequest('http://localhost:3000/api/stripe/checkout', {
        method: 'POST',
        body: JSON.stringify({
          ...validRequestBody,
          apiKey: '',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('API key is required')
    })
  })

  describe('Backend integration', () => {
    it('should handle backend errors gracefully', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => JSON.stringify({ detail: 'Internal server error' }),
      })

      const request = new NextRequest('http://localhost:3000/api/stripe/checkout', {
        method: 'POST',
        body: JSON.stringify(validRequestBody),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })

    it('should handle backend authentication errors', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ detail: 'Invalid API key' }),
      })

      const request = new NextRequest('http://localhost:3000/api/stripe/checkout', {
        method: 'POST',
        body: JSON.stringify(validRequestBody),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Invalid API key')
    })

    it('should handle non-JSON backend responses', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Plain text error message',
      })

      const request = new NextRequest('http://localhost:3000/api/stripe/checkout', {
        method: 'POST',
        body: JSON.stringify(validRequestBody),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Plain text error message')
    })

    it('should handle network errors', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      const request = new NextRequest('http://localhost:3000/api/stripe/checkout', {
        method: 'POST',
        body: JSON.stringify(validRequestBody),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Network error')
      expect(data.details).toBeTruthy()
    })
  })

  describe('URL configuration', () => {
    it('should use correct backend URL from environment', async () => {
      process.env.NEXT_PUBLIC_API_BASE_URL = 'https://custom-backend.com'

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          session_id: 'cs_test_123',
          url: 'https://checkout.stripe.com/pay/cs_test_123',
        }),
      })

      const request = new NextRequest('http://localhost:3000/api/stripe/checkout', {
        method: 'POST',
        body: JSON.stringify(validRequestBody),
      })

      await POST(request)

      expect(global.fetch).toHaveBeenCalledWith(
        'https://custom-backend.com/api/stripe/checkout-session',
        expect.any(Object)
      )
    })

    it('should use beta.gatewayz.ai for Stripe redirect URLs', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          session_id: 'cs_test_123',
          url: 'https://checkout.stripe.com/pay/cs_test_123',
        }),
      })

      const request = new NextRequest('http://localhost:3000/api/stripe/checkout', {
        method: 'POST',
        body: JSON.stringify(validRequestBody),
      })

      await POST(request)

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
      const requestBody = JSON.parse(fetchCall[1].body)

      expect(requestBody.success_url).toContain('https://beta.gatewayz.ai')
      expect(requestBody.cancel_url).toContain('https://beta.gatewayz.ai')
      expect(requestBody.success_url).toContain('session_id={{CHECKOUT_SESSION_ID}}')
    })
  })

  describe('Edge cases', () => {
    it('should handle malformed JSON in request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/stripe/checkout', {
        method: 'POST',
        body: 'not valid json',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBeTruthy()
    })

    it('should handle very large amounts', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          session_id: 'cs_test_123',
          url: 'https://checkout.stripe.com/pay/cs_test_123',
        }),
      })

      const request = new NextRequest('http://localhost:3000/api/stripe/checkout', {
        method: 'POST',
        body: JSON.stringify({
          ...validRequestBody,
          amount: 1000000, // $1M
        }),
      })

      const response = await POST(request)

      expect(response.status).toBe(200)

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
      const requestBody = JSON.parse(fetchCall[1].body)

      expect(requestBody.amount).toBe(100000000) // $1M in cents
    })

    it('should handle decimal amounts', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          session_id: 'cs_test_123',
          url: 'https://checkout.stripe.com/pay/cs_test_123',
        }),
      })

      const request = new NextRequest('http://localhost:3000/api/stripe/checkout', {
        method: 'POST',
        body: JSON.stringify({
          ...validRequestBody,
          amount: 50.99,
        }),
      })

      const response = await POST(request)

      expect(response.status).toBe(200)

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
      const requestBody = JSON.parse(fetchCall[1].body)

      expect(requestBody.amount).toBe(5099) // $50.99 in cents
    })
  })
})
