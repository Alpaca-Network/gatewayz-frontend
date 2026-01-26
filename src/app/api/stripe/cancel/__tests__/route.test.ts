import { POST } from '../route';
import { NextRequest } from 'next/server';

// Mock Stripe
const mockSubscriptionsCancel = jest.fn();
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
      cancel: mockSubscriptionsCancel,
      update: mockSubscriptionsUpdate,
    },
  }));
});

describe('POST /api/stripe/cancel', () => {
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

    const request = new NextRequest('http://localhost/api/stripe/cancel', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.error).toBe('Stripe is not configured');
  });

  it('should return 400 if email is missing', async () => {
    const request = new NextRequest('http://localhost/api/stripe/cancel', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Email is required');
  });

  it('should return 404 if customer not found', async () => {
    mockCustomersList.mockResolvedValue({ data: [] });

    const request = new NextRequest('http://localhost/api/stripe/cancel', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('No Stripe customer found');
  });

  it('should return 404 if no active subscription found', async () => {
    mockCustomersList.mockResolvedValue({ data: [{ id: 'cus_123' }] });
    mockSubscriptionsList.mockResolvedValue({ data: [] });

    const request = new NextRequest('http://localhost/api/stripe/cancel', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('No active subscription found');
  });

  it('should cancel subscription at period end by default', async () => {
    const periodEnd = Math.floor(Date.now() / 1000) + 86400 * 30;
    mockCustomersList.mockResolvedValue({ data: [{ id: 'cus_123' }] });
    mockSubscriptionsList.mockResolvedValue({
      data: [{ id: 'sub_123', current_period_end: periodEnd }],
    });
    mockSubscriptionsUpdate.mockResolvedValue({ id: 'sub_123' });

    const request = new NextRequest('http://localhost/api/stripe/cancel', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.cancelledImmediately).toBe(false);
    expect(mockSubscriptionsUpdate).toHaveBeenCalledWith('sub_123', {
      cancel_at_period_end: true,
      metadata: expect.any(Object),
    });
  });

  it('should cancel subscription immediately when requested', async () => {
    const periodEnd = Math.floor(Date.now() / 1000) + 86400 * 30;
    mockCustomersList.mockResolvedValue({ data: [{ id: 'cus_123' }] });
    mockSubscriptionsList.mockResolvedValue({
      data: [{ id: 'sub_123', current_period_end: periodEnd }],
    });
    mockSubscriptionsCancel.mockResolvedValue({ id: 'sub_123' });

    const request = new NextRequest('http://localhost/api/stripe/cancel', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', cancelImmediately: true }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.cancelledImmediately).toBe(true);
    expect(mockSubscriptionsCancel).toHaveBeenCalledWith('sub_123');
  });
});
