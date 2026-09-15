/**
 * Stripe Webhook API Route Tests
 *
 * Tests for /api/stripe/webhook endpoint
 * Covers:
 * - Subscription checkout handling
 * - One-time payment processing
 * - Webhook signature verification
 * - Event handling logic
 */

import { POST } from '../route'
import { NextRequest } from 'next/server'
import Stripe from 'stripe'

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: jest.fn(),
    },
  }))
})

// Mock fetch
global.fetch = jest.fn()

describe('POST /api/stripe/webhook', () => {
  let mockStripe: any

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_123'
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.gatewayz.ai'

    mockStripe = new (Stripe as any)()
  })

  afterEach(() => {
    jest.restoreAllMocks()
    delete process.env.STRIPE_SECRET_KEY
    delete process.env.STRIPE_WEBHOOK_SECRET
  })

  describe('Subscription checkout handling', () => {
    it('should skip frontend processing for subscription mode and let backend handle tier upgrade', async () => {
      const subscriptionEvent: Stripe.Event = {
        id: 'evt_test_123',
        object: 'event',
        api_version: '2025-10-29.clover',
        created: Date.now(),
        data: {
          object: {
            id: 'cs_test_subscription_123',
            object: 'checkout.session',
            mode: 'subscription',
            customer: 'cus_test_123',
            subscription: 'sub_test_123',
            amount_total: 1000,
            customer_email: 'test@example.com',
            metadata: {
              user_id: '123',
              tier: 'pro',
              product_id: 'prod_TKOqQPhVRxNp4Q',
            },
          } as Stripe.Checkout.Session,
        },
        livemode: false,
        pending_webhooks: 0,
        request: { id: null, idempotency_key: null },
        type: 'checkout.session.completed',
      }

      mockStripe.webhooks.constructEvent.mockReturnValue(subscriptionEvent)

      const request = new NextRequest('http://localhost:3000/api/stripe/webhook', {
        method: 'POST',
        headers: {
          'stripe-signature': 'test_signature',
        },
        body: JSON.stringify(subscriptionEvent),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        received: true,
        message: 'Subscription handled by backend webhook',
      })

      // Verify that /user/credits was NOT called
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('should log subscription details for debugging', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      const subscriptionEvent: Stripe.Event = {
        id: 'evt_test_456',
        object: 'event',
        api_version: '2025-10-29.clover',
        created: Date.now(),
        data: {
          object: {
            id: 'cs_test_subscription_456',
            object: 'checkout.session',
            mode: 'subscription',
            customer: 'cus_test_456',
            subscription: 'sub_test_456',
            amount_total: 7500,
            customer_email: 'max@example.com',
            metadata: {
              user_id: '456',
              tier: 'max',
              product_id: 'prod_TKOraBpWMxMAIu',
            },
          } as Stripe.Checkout.Session,
        },
        livemode: false,
        pending_webhooks: 0,
        request: { id: null, idempotency_key: null },
        type: 'checkout.session.completed',
      }

      mockStripe.webhooks.constructEvent.mockReturnValue(subscriptionEvent)

      const request = new NextRequest('http://localhost:3000/api/stripe/webhook', {
        method: 'POST',
        headers: {
          'stripe-signature': 'test_signature',
        },
        body: JSON.stringify(subscriptionEvent),
      })

      await POST(request)

      expect(consoleSpy).toHaveBeenCalledWith(
        'Subscription checkout detected - backend will handle tier upgrade via webhook'
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        'Subscription details:',
        expect.objectContaining({
          mode: 'subscription',
          tier: 'max',
          userId: '456',
        })
      )

      consoleSpy.mockRestore()
    })
  })

  describe('One-time payment processing', () => {
    it('should process one-time payment checkouts through /user/credits endpoint', async () => {
      const paymentEvent: Stripe.Event = {
        id: 'evt_test_789',
        object: 'event',
        api_version: '2025-10-29.clover',
        created: Date.now(),
        data: {
          object: {
            id: 'cs_test_payment_789',
            object: 'checkout.session',
            mode: 'payment',
            customer: 'cus_test_789',
            amount_total: 10000,
            payment_intent: 'pi_test_789',
            customer_email: 'buyer@example.com',
            metadata: {
              user_id: '789',
              credits: '10000',
              payment_id: '1',
            },
          } as Stripe.Checkout.Session,
        },
        livemode: false,
        pending_webhooks: 0,
        request: { id: null, idempotency_key: null },
        type: 'checkout.session.completed',
      }

      mockStripe.webhooks.constructEvent.mockReturnValue(paymentEvent)

      // Mock successful backend response
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      })

      const request = new NextRequest('http://localhost:3000/api/stripe/webhook', {
        method: 'POST',
        headers: {
          'stripe-signature': 'test_signature',
        },
        body: JSON.stringify(paymentEvent),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ received: true })

      // Verify that /user/credits WAS called for one-time payments
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.gatewayz.ai/user/credits',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: expect.stringContaining('"credits":10000'),
        })
      )
    })

    it('should return 200 even when no credits in metadata for one-time payment', async () => {
      const paymentEvent: Stripe.Event = {
        id: 'evt_test_999',
        object: 'event',
        api_version: '2025-10-29.clover',
        created: Date.now(),
        data: {
          object: {
            id: 'cs_test_payment_999',
            object: 'checkout.session',
            mode: 'payment',
            customer: 'cus_test_999',
            amount_total: 5000,
            customer_email: 'nocredits@example.com',
            metadata: {
              user_id: '999',
              // No credits in metadata
            },
          } as Stripe.Checkout.Session,
        },
        livemode: false,
        pending_webhooks: 0,
        request: { id: null, idempotency_key: null },
        type: 'checkout.session.completed',
      }

      mockStripe.webhooks.constructEvent.mockReturnValue(paymentEvent)

      const request = new NextRequest('http://localhost:3000/api/stripe/webhook', {
        method: 'POST',
        headers: {
          'stripe-signature': 'test_signature',
        },
        body: JSON.stringify(paymentEvent),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        error: 'No credits in metadata',
        received: true,
      })

      // Should not call backend without credits
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  describe('Webhook signature verification', () => {
    it('should return 200 when Stripe is not configured', async () => {
      delete process.env.STRIPE_SECRET_KEY
      delete process.env.STRIPE_WEBHOOK_SECRET

      const request = new NextRequest('http://localhost:3000/api/stripe/webhook', {
        method: 'POST',
        headers: {
          'stripe-signature': 'test_signature',
        },
        body: JSON.stringify({}),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        error: 'Stripe is not configured',
        received: true,
      })
    })

    it('should return 200 when no signature provided', async () => {
      const request = new NextRequest('http://localhost:3000/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        error: 'No signature',
        received: true,
      })
    })

    it('should return 200 when signature verification fails', async () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature')
      })

      const request = new NextRequest('http://localhost:3000/api/stripe/webhook', {
        method: 'POST',
        headers: {
          'stripe-signature': 'invalid_signature',
        },
        body: JSON.stringify({}),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        error: 'Invalid signature',
        received: true,
      })
    })
  })

  describe('Unhandled event types', () => {
    it('should return 200 for unhandled event types', async () => {
      const unhandledEvent: Stripe.Event = {
        id: 'evt_test_unhandled',
        object: 'event',
        api_version: '2025-10-29.clover',
        created: Date.now(),
        data: {
          object: {} as any,
        },
        livemode: false,
        pending_webhooks: 0,
        request: { id: null, idempotency_key: null },
        type: 'customer.created', // Unhandled event type
      }

      mockStripe.webhooks.constructEvent.mockReturnValue(unhandledEvent)

      const request = new NextRequest('http://localhost:3000/api/stripe/webhook', {
        method: 'POST',
        headers: {
          'stripe-signature': 'test_signature',
        },
        body: JSON.stringify(unhandledEvent),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ received: true })
    })
  })
})
