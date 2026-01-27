import { POST } from '../route';
import { NextRequest } from 'next/server';

// Mock Stripe
const mockSubscriptionsUpdate = jest.fn();
const mockSubscriptionsList = jest.fn();
const mockCustomersList = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    customers: {
      list: mockCustomersList,
    },
    subscriptions: {
      list: mockSubscriptionsList,
      update: mockSubscriptionsUpdate,
    },
  }));
});

describe('POST /api/stripe/downgrade', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, STRIPE_SECRET_KEY: 'sk_test_123' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return 503 if Stripe is not configured', async () => {
    process.env.STRIPE_SECRET_KEY = '';

    const request = new NextRequest('http://localhost/api/stripe/downgrade', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', newPriceId: 'price_123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.error).toBe('Stripe is not configured');
  });

  it('should return 400 if email is missing', async () => {
    const request = new NextRequest('http://localhost/api/stripe/downgrade', {
      method: 'POST',
      body: JSON.stringify({ newPriceId: 'price_123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Email is required');
  });

  it('should return 400 if newPriceId is missing', async () => {
    const request = new NextRequest('http://localhost/api/stripe/downgrade', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('New price ID is required');
  });

  it('should return 404 if customer not found', async () => {
    mockCustomersList.mockResolvedValue({ data: [] });

    const request = new NextRequest('http://localhost/api/stripe/downgrade', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', newPriceId: 'price_123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('No Stripe customer found');
  });

  it('should return 404 if no active subscription found', async () => {
    mockCustomersList.mockResolvedValue({ data: [{ id: 'cus_123' }] });
    mockSubscriptionsList.mockResolvedValue({ data: [] });

    const request = new NextRequest('http://localhost/api/stripe/downgrade', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', newPriceId: 'price_123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('No active subscription found');
  });

  it('should downgrade subscription successfully', async () => {
    mockCustomersList.mockResolvedValue({ data: [{ id: 'cus_123' }] });
    mockSubscriptionsList.mockResolvedValue({
      data: [{ id: 'sub_123', items: { data: [{ id: 'si_123' }] } }],
    });
    mockSubscriptionsUpdate.mockResolvedValue({ id: 'sub_123' });

    const request = new NextRequest('http://localhost/api/stripe/downgrade', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        newPriceId: 'price_pro_123',
        newTier: 'pro',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.subscriptionId).toBe('sub_123');
    expect(data.message).toContain('pro');
    expect(mockSubscriptionsUpdate).toHaveBeenCalledWith('sub_123', {
      items: [{ id: 'si_123', price: 'price_pro_123' }],
      proration_behavior: 'create_prorations',
      metadata: expect.objectContaining({ tier: 'pro' }),
    });
  });
});
