import type Stripe from 'stripe';
import { findAccountStripeCustomer } from '../stripe-account-customer';

function fakeStripe(opts: { list?: Array<Partial<Stripe.Customer>>; retrieve?: unknown; retrieveError?: unknown }) {
  return {
    customers: {
      list: jest.fn().mockResolvedValue({ data: opts.list ?? [] }),
      retrieve: opts.retrieveError
        ? jest.fn().mockRejectedValue(opts.retrieveError)
        : jest.fn().mockResolvedValue(opts.retrieve),
    },
  } as unknown as Stripe & { customers: { list: jest.Mock; retrieve: jest.Mock } };
}

const account = { email: 'user@example.com', userId: '42', stripeCustomerId: null };

describe('findAccountStripeCustomer', () => {
  beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it('returns the email match bound to this account by metadata.user_id', async () => {
    const stripe = fakeStripe({
      list: [
        { id: 'cus_other', metadata: { user_id: '7' } },
        { id: 'cus_mine', metadata: { user_id: '42' } },
      ],
    });
    const customer = await findAccountStripeCustomer(stripe, account);
    expect(customer?.id).toBe('cus_mine');
    expect(stripe.customers.list).toHaveBeenCalledWith({ email: 'user@example.com', limit: 10 });
  });

  it('refuses a customer that only shares the email', async () => {
    const stripe = fakeStripe({ list: [{ id: 'cus_other', metadata: { user_id: '7' } }, { id: 'cus_nometa', metadata: {} }] });
    expect(await findAccountStripeCustomer(stripe, account)).toBeNull();
    expect(JSON.stringify((console.warn as jest.Mock).mock.calls)).not.toMatch(/cus_|example\.com/);
  });

  it('returns null when nothing matches the email', async () => {
    expect(await findAccountStripeCustomer(fakeStripe({ list: [] }), account)).toBeNull();
  });

  it('uses a stored customer id when the backend provides one, without an email lookup', async () => {
    const stripe = fakeStripe({ retrieve: { id: 'cus_stored', metadata: {} } });
    const customer = await findAccountStripeCustomer(stripe, { ...account, stripeCustomerId: 'cus_stored' });
    expect(customer?.id).toBe('cus_stored');
    expect(stripe.customers.retrieve).toHaveBeenCalledWith('cus_stored');
    expect(stripe.customers.list).not.toHaveBeenCalled();
  });

  it('treats a deleted or missing stored customer as none, and rethrows other errors', async () => {
    const stored = { ...account, stripeCustomerId: 'cus_stored' };
    expect(await findAccountStripeCustomer(fakeStripe({ retrieve: { id: 'cus_stored', deleted: true } }), stored)).toBeNull();
    expect(await findAccountStripeCustomer(fakeStripe({ retrieveError: { statusCode: 404 } }), stored)).toBeNull();
    await expect(findAccountStripeCustomer(fakeStripe({ retrieveError: new Error('boom') }), stored)).rejects.toThrow('boom');
  });
});
