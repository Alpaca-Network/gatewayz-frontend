/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

const mockList = jest.fn();
const mockRetrieve = jest.fn();
const mockPaymentMethodsList = jest.fn();
const mockPortalCreate = jest.fn();

jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => ({
    customers: { list: mockList, retrieve: mockRetrieve },
    paymentMethods: { list: mockPaymentMethodsList },
    billingPortal: { sessions: { create: mockPortalCreate } },
  }))
);

// jest.setup.js swaps NextResponse for a plain Response; the routes need the real one.
jest.unmock('next/server');

import { POST as portalPOST } from '../portal/route';
import { GET as customerGET } from '../customer/route';

const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;

function profile(body: Record<string, unknown>, status = 200) {
  fetchMock.mockResolvedValueOnce({ ok: status < 400, status, json: async () => body });
}

function req(path: string, method = 'GET', auth = 'Bearer test-key') {
  return new NextRequest(`http://localhost:3000${path}`, { method, headers: auth ? { authorization: auth } : {} });
}

const mine = { id: 'cus_mine', email: 'user@example.com', name: 'U', address: null, metadata: { user_id: '42' } };
const other = { id: 'cus_other', email: 'user@example.com', name: 'O', address: null, metadata: { user_id: '7' } };

describe('Stripe account routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = ['sk', 'test', 'placeholder'].join('_'); // built at runtime; Stripe is mocked
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    mockPaymentMethodsList.mockResolvedValue({ data: [{ id: 'pm_1', card: { brand: 'visa', last4: '4242', exp_month: 1, exp_year: 2030 } }] });
    mockPortalCreate.mockResolvedValue({ url: 'https://billing.stripe.com/session/test' });
  });

  describe('POST /api/stripe/portal', () => {
    it('opens the portal for the customer bound to the account', async () => {
      profile({ user_id: 42, email: 'user@example.com' });
      mockList.mockResolvedValue({ data: [other, mine] });
      const res = await portalPOST(req('/api/stripe/portal', 'POST'));
      expect(res.status).toBe(200);
      expect(mockPortalCreate).toHaveBeenCalledWith(expect.objectContaining({ customer: 'cus_mine' }));
    });

    it('refuses when the only email match belongs to another account', async () => {
      profile({ user_id: 42, email: 'user@example.com' });
      mockList.mockResolvedValue({ data: [other] });
      const res = await portalPOST(req('/api/stripe/portal', 'POST'));
      expect(res.status).toBe(404);
      expect(mockPortalCreate).not.toHaveBeenCalled();
    });

    it('uses a stored customer id from the profile when present', async () => {
      profile({ user_id: 42, email: 'user@example.com', stripe_customer_id: 'cus_stored' });
      mockRetrieve.mockResolvedValue({ id: 'cus_stored', metadata: {} });
      const res = await portalPOST(req('/api/stripe/portal', 'POST'));
      expect(res.status).toBe(200);
      expect(mockList).not.toHaveBeenCalled();
      expect(mockPortalCreate).toHaveBeenCalledWith(expect.objectContaining({ customer: 'cus_stored' }));
    });

    it('requires an API key and a resolvable account', async () => {
      expect((await portalPOST(req('/api/stripe/portal', 'POST', ''))).status).toBe(401);
      profile({ email: 'user@example.com' }); // no user_id
      expect((await portalPOST(req('/api/stripe/portal', 'POST'))).status).toBe(401);
      expect(mockList).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/stripe/customer', () => {
    it('returns card and billing details only for the bound customer', async () => {
      profile({ user_id: 42, email: 'user@example.com' });
      mockList.mockResolvedValue({ data: [mine] });
      const body = await (await customerGET(req('/api/stripe/customer'))).json();
      expect(body.customer.id).toBe('cus_mine');
      expect(body.paymentMethods[0].last4).toBe('4242');
      expect(mockPaymentMethodsList).toHaveBeenCalledWith({ customer: 'cus_mine', type: 'card' });
    });

    it('returns an empty result when the email match belongs to another account', async () => {
      profile({ user_id: 42, email: 'user@example.com' });
      mockList.mockResolvedValue({ data: [other] });
      const body = await (await customerGET(req('/api/stripe/customer'))).json();
      expect(body).toEqual({ customer: null, paymentMethods: [], billingAddress: null });
      expect(mockPaymentMethodsList).not.toHaveBeenCalled();
    });
  });
});
